import { REQUIRED_CLEAN_ATTEMPTS, type DualProof } from './repro-classify';
import { attemptsFor, classifyRun, type ReproRun } from './repro-context';

/**
 * Xác minh bản sửa (reproduction-protocol §6): before phải là CONFIRMED_BUG đúng signature mục
 * tiêu; after pass cùng expected + data profile + test revision (đều phải biết, không null) trên
 * build khác; regression lân cận pass; rerun độc lập (actor khác, run khác) cùng build. Evidence
 * phải trusted, trừ khi caller khai `allowUntrusted` (điều tra local) — khi đó ghi limitation.
 * Thiếu before → NOT_FEASIBLE có lý do, không VERIFIED. Kết quả là trạng thái bug, KHÔNG phải chữ ký gate.
 */
export type FixStatus = 'VERIFIED_FIXED' | 'FIX_IMPLEMENTED_UNVERIFIED';

export interface FixVerificationInput {
  scenario: string;
  targetSignature: string;
  expectedSource: string;
  dualProof: DualProof;
  controlScenario?: string;
  author: string;
  before: ReproRun | null;
  notFeasible?: { reason: string; historicalEvidence: string };
  after: ReproRun;
  regression: string[];
  independentRerun: ReproRun | null;
  allowUntrusted?: boolean;
}

export interface FixVerification {
  status: FixStatus;
  before: string;
  after: string;
  problems: string[];
  limitations: string[];
}

function ratio(run: ReproRun | null, scenario: string, want: 'passed' | 'failed'): [number, number] {
  const clean = run ? attemptsFor(run, scenario).filter((a) => a.retryIndex === 0) : [];
  return [clean.filter((a) => (want === 'passed') === (a.status === 'passed')).length, clean.length];
}

function runProblems(label: string, run: ReproRun, input: FixVerificationInput, limitations: string[]): string[] {
  const problems = run.evidenceOk ? [] : [`${label}_EVIDENCE_INCOMPLETE: ${run.problems.slice(0, 3).join('; ')}`];
  if (run.trust !== 'TRUSTED_CANDIDATE') {
    if (input.allowUntrusted) limitations.push(`${label}_UNTRUSTED: trust '${run.trust}' (investigation only)`);
    else problems.push(`${label}_UNTRUSTED_EVIDENCE: trust '${run.trust}'`);
  }
  return problems;
}

function checkBefore(input: FixVerificationInput, problems: string[], limitations: string[]): void {
  const { before, scenario } = input;
  if (!before) {
    if (input.notFeasible?.reason) {
      limitations.push(`BEFORE_NOT_FEASIBLE: ${input.notFeasible.reason} (history: ${input.notFeasible.historicalEvidence})`);
    } else {
      problems.push('BEFORE_MISSING: no failing run before the fix and no NOT_FEASIBLE reason');
    }
    return;
  }
  problems.push(...runProblems('BEFORE', before, input, limitations));
  const [fails, total] = ratio(before, scenario, 'failed');
  if (total < REQUIRED_CLEAN_ATTEMPTS || fails !== total) {
    problems.push(`BEFORE_NOT_FAILING: ${fails}/${total} clean attempts failed`);
  }
  const wrong = attemptsFor(before, scenario).filter((a) => a.status !== 'passed' && a.signature !== input.targetSignature);
  if (wrong.length > 0) problems.push(`BEFORE_SIGNATURE_MISMATCH: ${wrong.length} attempt(s) failed on another assertion`);
  // Before phải là một Confirmed Bug thật (control khỏe, state riêng...), không chỉ "fail 3/3".
  const cls = classifyRun(before, scenario, { expectedSource: input.expectedSource, dualProof: input.dualProof, controlScenario: input.controlScenario });
  if (cls.status !== 'CONFIRMED_BUG') problems.push(`BEFORE_NOT_CONFIRMED: ${cls.status} (${cls.basis})`);
}

/** After và rerun phải so được với before: cùng test revision, expected, data profile — đều đã biết. */
function comparable(label: string, base: ReproRun, other: ReproRun, problems: string[]): void {
  const fields = [['TEST_REVISION', 'qaRevision'], ['EXPECTED', 'expectedSha256'], ['DATA_PROFILE', 'seedProfile']] as const;
  for (const [name, key] of fields) {
    if (!base[key] || !other[key]) problems.push(`${label}_${name}_UNKNOWN`);
    else if (base[key] !== other[key]) problems.push(`${label}_${name}_CHANGED: ${base[key]} -> ${other[key]}`);
  }
}

export function verifyFix(input: FixVerificationInput): FixVerification {
  const problems: string[] = [];
  const limitations = ['INDEPENDENCE_SELF_DECLARED: actor names are not identity-bound signatures'];
  const { after, before, scenario } = input;
  checkBefore(input, problems, limitations);
  problems.push(...runProblems('AFTER', after, input, limitations));
  const [passes, total] = ratio(after, scenario, 'passed');
  if (total < REQUIRED_CLEAN_ATTEMPTS || passes !== total) problems.push(`AFTER_NOT_PASSING: ${passes}/${total}`);
  if (before) {
    comparable('AFTER', before, after, problems);
    if (before.appBuild === after.appBuild) problems.push(`NO_BUILD_CHANGE: before and after both ran ${after.appBuild}`);
  }
  if (input.regression.length === 0) problems.push('REGRESSION_MISSING: no neighbouring scenario selected');
  if (input.regression.includes(scenario)) problems.push('REGRESSION_INVALID: the target scenario is not its own regression');
  for (const neighbour of input.regression) {
    const [ok, n] = ratio(after, neighbour, 'passed');
    if (n === 0 || ok !== n) problems.push(`REGRESSION_FAILED: ${neighbour} ${ok}/${n}`);
  }
  const rerun = input.independentRerun;
  if (!rerun) {
    problems.push('INDEPENDENT_RERUN_MISSING');
  } else {
    problems.push(...runProblems('RERUN', rerun, input, limitations));
    if (!rerun.actor || rerun.actor === input.author) problems.push(`NOT_INDEPENDENT: rerun actor '${rerun.actor}'`);
    if (rerun.runId === after.runId) problems.push(`NOT_INDEPENDENT: rerun is the after run '${rerun.runId}'`);
    comparable('RERUN', after, rerun, problems);
    if (rerun.appBuild !== after.appBuild) problems.push(`RERUN_BUILD_MISMATCH: ${rerun.appBuild} != ${after.appBuild}`);
    const [ok, n] = ratio(rerun, scenario, 'passed');
    if (n === 0 || ok !== n) problems.push(`RERUN_NOT_PASSING: ${ok}/${n}`);
  }
  const verified = problems.length === 0 && Boolean(before);
  const [bf, bt] = ratio(before, scenario, 'failed');
  return {
    status: verified ? 'VERIFIED_FIXED' : 'FIX_IMPLEMENTED_UNVERIFIED',
    before: before ? `${bf}/${bt} failed on ${before.appBuild}` : 'NOT_FEASIBLE',
    after: `${passes}/${total} passed on ${after.appBuild}`,
    problems,
    limitations: [...new Set(limitations)],
  };
}
