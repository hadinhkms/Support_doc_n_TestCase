import { REQUIRED_CLEAN_ATTEMPTS } from './repro-classify';
import { attemptsFor, type ReproRun } from './repro-context';

/**
 * Xác minh bản sửa (reproduction-protocol §6): before fail đúng signature mục tiêu, after pass
 * cùng expected + data profile + test revision, regression lân cận pass, và một rerun độc lập
 * (actor khác, run khác) trên cùng build. Thiếu before → NOT_FEASIBLE có lý do, không VERIFIED.
 * Kết quả là trạng thái bug, KHÔNG phải chữ ký gate Master.
 */
export type FixStatus = 'VERIFIED_FIXED' | 'FIX_IMPLEMENTED_UNVERIFIED';

export interface FixVerificationInput {
  scenario: string;
  targetSignature: string;
  author: string;
  before: ReproRun | null;
  notFeasible?: { reason: string; historicalEvidence: string };
  after: ReproRun;
  regression: string[];
  independentRerun: ReproRun | null;
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

function runProblems(label: string, run: ReproRun): string[] {
  return run.evidenceOk ? [] : [`${label}_EVIDENCE_INCOMPLETE: ${run.problems.slice(0, 3).join('; ')}`];
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
  problems.push(...runProblems('BEFORE', before));
  const [fails, total] = ratio(before, scenario, 'failed');
  if (total < REQUIRED_CLEAN_ATTEMPTS || fails !== total) {
    problems.push(`BEFORE_NOT_FAILING: ${fails}/${total} clean attempts failed`);
  }
  const wrong = attemptsFor(before, scenario).filter((a) => a.status !== 'passed' && a.signature !== input.targetSignature);
  if (wrong.length > 0) problems.push(`BEFORE_SIGNATURE_MISMATCH: ${wrong.length} attempt(s) failed on another assertion`);
}

/** After và rerun phải so được với before: cùng test revision, expected, data profile; build khác. */
function comparable(label: string, base: ReproRun, other: ReproRun, problems: string[]): void {
  if (other.qaRevision !== base.qaRevision) problems.push(`${label}_TEST_REVISION_CHANGED: ${base.qaRevision} -> ${other.qaRevision}`);
  if (other.expectedSha256 !== base.expectedSha256) problems.push(`${label}_EXPECTED_CHANGED: expected contract hash differs`);
  if (other.seedProfile !== base.seedProfile) problems.push(`${label}_DATA_PROFILE_CHANGED: ${base.seedProfile} -> ${other.seedProfile}`);
}

export function verifyFix(input: FixVerificationInput): FixVerification {
  const problems: string[] = [];
  const limitations = ['INDEPENDENCE_SELF_DECLARED: actor names are not identity-bound signatures'];
  const { after, before, scenario } = input;
  checkBefore(input, problems, limitations);
  problems.push(...runProblems('AFTER', after));
  const [passes, total] = ratio(after, scenario, 'passed');
  if (total < REQUIRED_CLEAN_ATTEMPTS || passes !== total) problems.push(`AFTER_NOT_PASSING: ${passes}/${total}`);
  if (before) {
    comparable('AFTER', before, after, problems);
    if (before.appBuild === after.appBuild) problems.push(`NO_BUILD_CHANGE: before and after both ran ${after.appBuild}`);
  }
  if (input.regression.length === 0) problems.push('REGRESSION_MISSING: no neighbouring scenario selected');
  for (const neighbour of input.regression) {
    const [ok, n] = ratio(after, neighbour, 'passed');
    if (n === 0 || ok !== n) problems.push(`REGRESSION_FAILED: ${neighbour} ${ok}/${n}`);
  }
  const rerun = input.independentRerun;
  if (!rerun) {
    problems.push('INDEPENDENT_RERUN_MISSING');
  } else {
    problems.push(...runProblems('RERUN', rerun));
    if (!rerun.actor || rerun.actor === input.author || rerun.runId === after.runId) {
      problems.push(`NOT_INDEPENDENT: rerun actor '${rerun.actor}' run '${rerun.runId}'`);
    }
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
    limitations,
  };
}
