import type { AttemptStatus } from './evidence-manifest';

/**
 * Phân loại kết quả tái hiện (reproduction-protocol §1, copilot-instructions mục 14).
 * Chỉ ra `CONFIRMED_BUG` khi: có expected có thẩm quyền, control khỏe, đủ N lần chạy sạch
 * độc lập (không retry, state riêng), cùng signature ở mọi lần, evidence trọn vẹn và dual proof.
 * Mọi trường hợp thiếu điều kiện giữ ở mức thấp hơn — không suy ra lỗi ứng dụng.
 */
export type ReproStatus =
  | 'OBSERVATION'
  | 'TEST_DEFECT'
  | 'ENVIRONMENT_ISSUE'
  | 'SPEC_GAP'
  | 'INTERMITTENT_OBSERVATION'
  | 'CONFIRMED_BUG';

export const REQUIRED_CLEAN_ATTEMPTS = 3;
/** Lỗi precondition môi trường phải mang tiền tố này (vd thiếu env, dịch vụ không lên). */
export const ENVIRONMENT_TAG = '[ENVIRONMENT]';
const SHARED_STATE = 'SHARED_STATE';

export interface ReproAttempt {
  attemptId: string;
  runId: string;
  scenario: string;
  repeatIndex: number;
  retryIndex: number;
  status: AttemptStatus;
  signature: string | null;
  signatureText: string | null;
  stateId: string | null;
  evidenceOk: boolean;
}

export interface DualProof {
  runtimeEvidence: boolean;
  /** `file:line` khi đọc được mã nguồn ứng dụng. */
  sourceAnchor?: string;
  /** Minimal STR / lệnh khi không đọc được mã nguồn. */
  minimalSteps?: string[];
}

export interface ClassifyInput {
  scenario: ReproAttempt[];
  control: ReproAttempt[];
  expectedSource: string | null;
  dualProof: DualProof;
  required?: number;
  /** Trigger nhân tạo (barrier/fault injection): ghi vào limitation, không suy tần suất production. */
  artificialTrigger?: string;
  /** Vấn đề cấp run (bundle không verify, attempt thiếu repro.json...) — có thì không Confirmed. */
  runProblems?: string[];
}

export interface ReproClassification {
  status: ReproStatus;
  numerator: number;
  denominator: number;
  signature: string | null;
  signatureText: string | null;
  basis: string;
  problems: string[];
  limitations: string[];
}

const failed = (a: ReproAttempt) => a.status !== 'passed' && a.status !== 'skipped';

function cleanAttempts(attempts: ReproAttempt[], problems: string[]): ReproAttempt[] {
  const ids = attempts.map((a) => a.attemptId);
  if (new Set(ids).size !== ids.length) problems.push('DUPLICATE_ATTEMPT: one attempt is counted more than once');
  const retries = attempts.filter((a) => a.retryIndex > 0);
  if (retries.length > 0) problems.push(`RETRY_ATTEMPTS_EXCLUDED: ${retries.length} retry attempt(s) are not clean runs`);
  const cut = attempts.filter((a) => a.status === 'interrupted');
  if (cut.length > 0) problems.push(`INTERRUPTED_ATTEMPTS: ${cut.length} attempt(s) were cut short`);
  const clean = attempts.filter((a) => a.retryIndex === 0 && a.status !== 'skipped' && a.status !== 'interrupted');
  const states = clean.map((a) => a.stateId);
  if (states.some((s) => !s)) problems.push('STATE_UNKNOWN: some attempts did not record their seeded state');
  if (new Set(states.filter(Boolean)).size !== states.filter(Boolean).length) {
    problems.push(`${SHARED_STATE}: attempts do not each have their own seeded state`);
  }
  if (clean.some((a) => !a.evidenceOk)) problems.push('EVIDENCE_INCOMPLETE: some attempts lack verified evidence');
  return clean;
}

function controlFailure(control: ReproAttempt[]): ReproClassification | null {
  if (control.length === 0) return null;
  const bad = control.filter(failed);
  if (bad.length === 0) return null;
  const sig = bad[0];
  const env = bad.some((a) => a.signatureText?.startsWith(ENVIRONMENT_TAG));
  return {
    status: env ? 'ENVIRONMENT_ISSUE' : 'TEST_DEFECT',
    numerator: bad.length,
    denominator: control.length,
    signature: sig.signature,
    signatureText: sig.signatureText,
    basis: env
      ? 'healthy control failed on an environment precondition'
      : 'healthy control failed without the fault: test/fixture/data defect, not the app',
    problems: [],
    limitations: [],
  };
}

/** Control chỉ có giá trị khi sạch, cùng run và không chung state với scenario. */
function controlProblems(control: ReproAttempt[], raw: ReproAttempt[], scenario: ReproAttempt[]): string[] {
  const problems: string[] = [];
  cleanAttempts(raw, problems);
  if (control.length === 0) return ['CONTROL_MISSING: no healthy control in the same run'];
  const runs = new Set(scenario.map((a) => a.runId));
  if (control.some((a) => !runs.has(a.runId)) || runs.size > 1) problems.push('CONTROL_OTHER_RUN: control and scenario are not one run');
  const states = new Set(scenario.map((a) => a.stateId).filter(Boolean));
  if (control.some((a) => a.stateId && states.has(a.stateId))) problems.push(`${SHARED_STATE}: control reuses a scenario state`);
  return problems.map((p) => (p.startsWith('CONTROL_') ? p : `CONTROL_${p}`));
}

export function classifyReproduction(input: ClassifyInput): ReproClassification {
  const required = input.required ?? REQUIRED_CLEAN_ATTEMPTS;
  const problems = (input.runProblems ?? []).map((p) => `RUN_EVIDENCE: ${p}`);
  const limitations = input.artificialTrigger ? [`ARTIFICIAL_TRIGGER: ${input.artificialTrigger}`] : [];
  const control = cleanAttempts(input.control, []);
  const fromControl = controlFailure(control);
  if (fromControl) return { ...fromControl, problems: controlProblems(control, input.control, input.scenario), limitations };
  const attempts = cleanAttempts(input.scenario, problems);
  const fails = attempts.filter(failed);
  const signatures = new Set(fails.map((a) => a.signature));
  const result = (status: ReproStatus, basis: string): ReproClassification => ({
    status,
    numerator: fails.length,
    denominator: attempts.length,
    signature: signatures.size === 1 ? (fails[0]?.signature ?? null) : null,
    signatureText: signatures.size === 1 ? (fails[0]?.signatureText ?? null) : null,
    basis,
    problems,
    limitations,
  });
  if (!input.expectedSource) return result('SPEC_GAP', 'no authoritative expected result');
  problems.push(...controlProblems(control, input.control, input.scenario));
  if (fails.some((a) => a.signatureText?.startsWith(ENVIRONMENT_TAG))) {
    return result('ENVIRONMENT_ISSUE', 'scenario failed on an environment precondition');
  }
  if (attempts.length === 0) {
    problems.push('NO_ATTEMPTS: nothing executed for this scenario');
    return result('OBSERVATION', 'no evidence (0/0); not a negative result');
  }
  if (fails.length === 0) return result('OBSERVATION', `not reproduced (0/${attempts.length})`);
  // Dữ liệu bẩn/trùng giữa các lần chạy là lỗi của test (mục 14 bước 1), chưa được quy cho app.
  if (problems.some((p) => p.startsWith(SHARED_STATE))) {
    return result('TEST_DEFECT', 'attempts reused one state; isolate data before judging the app');
  }
  if (fails.some((a) => !a.signature)) problems.push('SIGNATURE_UNKNOWN: a failure carries no error message');
  if (signatures.size > 1) problems.push(`SIGNATURE_DIVERGENCE: ${signatures.size} distinct failure signatures`);
  if (fails.length < attempts.length || signatures.size > 1) {
    return result('INTERMITTENT_OBSERVATION', `reproduced ${fails.length}/${attempts.length}`);
  }
  if (attempts.length < required) problems.push(`INSUFFICIENT_ATTEMPTS: ${attempts.length}/${required} clean runs`);
  const proof = input.dualProof;
  if (!proof.runtimeEvidence || !(proof.sourceAnchor || proof.minimalSteps?.length)) {
    problems.push('MISSING_DUAL_PROOF: need runtime evidence plus source anchor or minimal steps');
  }
  if (problems.length > 0) return result('OBSERVATION', 'consistent failure but gate conditions not met');
  return result('CONFIRMED_BUG', `reproduced ${fails.length}/${attempts.length} with one signature`);
}