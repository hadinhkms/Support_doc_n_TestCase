import { sha256 } from './evidence-integrity';
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

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const VOLATILE: [RegExp, string][] = [
  [/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '<ts>'],
  [/\b\d+(\.\d+)?\s?ms\b/g, '<ms>'],
  [/(?:[A-Za-z]:)?[\\/][^\s:'"]+\.(?:ts|js|mjs)(?::\d+){0,2}/g, '<file>'],
  [/\b[0-9a-f]{12,}\b/gi, '<hex>'],
  [/:\d{2,5}\b/g, ':<port>'],
  [/\b(req|state)-[A-Za-z0-9_.~-]+/g, '$1-<id>'],
];

/**
 * Signature ổn định của một lỗi: bỏ ANSI, thời gian, đường dẫn, id/port biến động, giữ
 * thông điệp assertion + Expected/Received để hai lần lỗi khác nguyên nhân không trùng nhau.
 */
export function failureSignature(errors: readonly string[]): { text: string; hash: string } | null {
  const first = errors.find((e) => e.trim().length > 0);
  if (!first) return null;
  const lines = first
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^at\s/.test(l) && !/^Call log:/.test(l));
  const keep = [lines[0], ...lines.filter((l) => /^(Expected|Received)\b/.test(l))];
  let text = keep.join(' | ').replace(/^Error:\s*/, '');
  for (const [pattern, replacement] of VOLATILE) text = text.replace(pattern, replacement);
  return { text, hash: sha256(Buffer.from(text, 'utf8')).slice(0, 16) };
}

const failed = (a: ReproAttempt) => a.status !== 'passed' && a.status !== 'skipped';

function cleanAttempts(attempts: ReproAttempt[], problems: string[]): ReproAttempt[] {
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

export function classifyReproduction(input: ClassifyInput): ReproClassification {
  const required = input.required ?? REQUIRED_CLEAN_ATTEMPTS;
  const problems: string[] = [];
  const limitations = input.artificialTrigger ? [`ARTIFICIAL_TRIGGER: ${input.artificialTrigger}`] : [];
  const controlProblems: string[] = [];
  const control = cleanAttempts(input.control, controlProblems);
  const fromControl = controlFailure(control);
  if (fromControl) return { ...fromControl, problems: controlProblems, limitations };
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
  if (control.length === 0) problems.push('CONTROL_MISSING: no healthy control in the same run');
  if (fails.some((a) => a.signatureText?.startsWith(ENVIRONMENT_TAG))) {
    return result('ENVIRONMENT_ISSUE', 'scenario failed on an environment precondition');
  }
  if (fails.length === 0) return result('OBSERVATION', `not reproduced (0/${attempts.length})`);
  // Dữ liệu bẩn/trùng giữa các lần chạy là lỗi của test (mục 14 bước 1), chưa được quy cho app.
  if (problems.some((p) => p.startsWith(SHARED_STATE))) {
    return result('TEST_DEFECT', 'attempts reused one state; isolate data before judging the app');
  }
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
