import type { Mutant } from './mutation-engine';

/**
 * Phân loại & chấm mutant (PLAN-16 Phase 5, AC-16-P5-2). Kết quả lấy từ attempt của run thật:
 * kill suite FAIL trên mutant → KILLED; PASS → SURVIVED; quá thời gian → TIMEOUT (vẫn là bị phát hiện);
 * mutant không nạp được → INVALID (tự loại, có lý do). Survivor chỉ được loại khỏi mẫu số khi có
 * triage riêng từng mutant với lý do và người triage — không có exclude theo file/pattern.
 */
export type MutantStatus = 'KILLED' | 'SURVIVED' | 'TIMEOUT' | 'INVALID' | 'NOT_RUN';

export interface MutantResult {
  mutant: Mutant;
  status: MutantStatus;
  detail: string | null;
}

export interface TriageEntry {
  mutantId: string;
  verdict: 'EQUIVALENT' | 'ACCEPTED_RISK';
  reason: string;
  triagedBy: string;
}

export interface MutationOutcome {
  schemaVersion: 'mutation-report/1';
  ok: boolean;
  baselinePassed: boolean;
  counts: Record<MutantStatus, number> & { total: number; equivalent: number; acceptedRisk: number };
  /** (killed + timeout) / (total − invalid − equivalent); null khi mẫu số 0. */
  score: number | null;
  /** Ngưỡng chưa chốt (Q-16-P5): không có ngưỡng có nguồn thì không tuyên bố đạt/không đạt score. */
  threshold: { value: number; source: string } | null;
  results: MutantResult[];
  problems: string[];
}

export interface AttemptLike {
  title: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  error?: string | null;
}

export const mutantTitle = (id: string) => `MUTANT ${id}`;
export const BASELINE_TITLE = 'BASELINE unmutated source';

export function classifyMutants(mutants: Mutant[], attempts: AttemptLike[]): { results: MutantResult[]; baselinePassed: boolean } {
  const byTitle = new Map(attempts.map((a) => [a.title.split(' › ').pop() ?? a.title, a]));
  const baseline = byTitle.get(BASELINE_TITLE);
  const results = mutants.map((mutant): MutantResult => {
    const a = byTitle.get(mutantTitle(mutant.id));
    if (!a) return { mutant, status: 'NOT_RUN', detail: 'no attempt recorded' };
    const status: MutantStatus =
      a.status === 'failed' ? 'KILLED' : a.status === 'timedOut' ? 'TIMEOUT' : a.status === 'skipped' ? 'INVALID' : a.status === 'passed' ? 'SURVIVED' : 'NOT_RUN';
    return { mutant, status, detail: a.error ?? null };
  });
  return { results, baselinePassed: baseline?.status === 'passed' };
}

export function evaluateMutation(input: {
  mutants: Mutant[];
  attempts: AttemptLike[];
  triage: TriageEntry[];
  threshold?: { value: number; source: string } | null;
}): MutationOutcome {
  const { results, baselinePassed } = classifyMutants(input.mutants, input.attempts);
  const problems: string[] = [];
  if (!baselinePassed) problems.push('BASELINE_NOT_GREEN: kill suite must pass on the unmutated source');
  const ids = new Set(input.mutants.map((m) => m.id));
  const status = new Map(results.map((r) => [r.mutant.id, r.status]));
  const triaged = new Map<string, TriageEntry>();
  for (const t of input.triage) {
    if (!ids.has(t.mutantId)) problems.push(`STALE_TRIAGE: ${t.mutantId} is not a current mutant`);
    else if (status.get(t.mutantId) !== 'SURVIVED') problems.push(`TRIAGE_NOT_NEEDED: ${t.mutantId} is ${status.get(t.mutantId)}`);
    else if (!t.reason?.trim() || !t.triagedBy?.trim()) problems.push(`TRIAGE_WITHOUT_REASON: ${t.mutantId}`);
    else if (!['EQUIVALENT', 'ACCEPTED_RISK'].includes(t.verdict)) problems.push(`TRIAGE_INVALID: ${t.mutantId}`);
    else triaged.set(t.mutantId, t);
  }
  for (const r of results) {
    if (r.status === 'SURVIVED' && !triaged.has(r.mutant.id)) {
      problems.push(`UNTRIAGED_SURVIVOR: ${r.mutant.id} ${r.mutant.file}:${r.mutant.line} ${r.mutant.original.trim()} -> ${r.mutant.replacement.trim()}`);
    }
    if (r.status === 'NOT_RUN') problems.push(`MUTANT_NOT_RUN: ${r.mutant.id}`);
  }
  const count = (s: MutantStatus) => results.filter((r) => r.status === s).length;
  const equivalent = [...triaged.values()].filter((t) => t.verdict === 'EQUIVALENT').length;
  const acceptedRisk = triaged.size - equivalent;
  const counts = { total: results.length, KILLED: count('KILLED'), SURVIVED: count('SURVIVED'), TIMEOUT: count('TIMEOUT'), INVALID: count('INVALID'), NOT_RUN: count('NOT_RUN'), equivalent, acceptedRisk };
  const denominator = counts.total - counts.INVALID - equivalent - counts.NOT_RUN;
  const score = denominator > 0 ? (counts.KILLED + counts.TIMEOUT) / denominator : null;
  const threshold = input.threshold?.source?.trim() ? input.threshold : null;
  if (input.threshold && !threshold) problems.push('SPEC_GAP: mutation threshold has no authoritative source');
  if (threshold && (score === null || score < threshold.value)) problems.push(`SCORE_BELOW_THRESHOLD: ${score} < ${threshold.value} (${threshold.source})`);
  if (counts.total === 0) problems.push('NO_MUTANTS: nothing was mutated');
  return { schemaVersion: 'mutation-report/1', ok: problems.length === 0, baselinePassed, counts, score, threshold, results, problems };
}
