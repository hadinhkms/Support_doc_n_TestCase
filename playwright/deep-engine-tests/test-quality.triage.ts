import type { TriageEntry } from '../tests/support/mutation-score';

/**
 * Triage survivor của mutation run (PLAN-16 Phase 5, AC-16-P5-2). Mỗi mục là MỘT mutant theo ID,
 * có lý do và người triage — không exclude theo file/pattern. ID gắn với vị trí trong source:
 * sửa file đích làm mục cũ thành STALE_TRIAGE và survivor mới thành UNTRIAGED → buộc triage lại.
 * Survivor không tương đương đã được xử lý bằng cách thêm kiểm vào kill suite, không đưa vào đây.
 */
const BY = 'dev-author (pending independent review)';
const TYPE_ONLY = 'Union literal in a type annotation (exitCode: 0 | 1 | 2); erased by TS transpile, no runtime effect';

export const PERF_METRICS_TRIAGE: TriageEntry[] = [
  { mutantId: 'be1641dc919b', verdict: 'EQUIVALENT', reason: TYPE_ONLY, triagedBy: BY },
  { mutantId: 'e7cceb297ae0', verdict: 'EQUIVALENT', reason: TYPE_ONLY, triagedBy: BY },
  { mutantId: '8e4fadedaa9b', verdict: 'EQUIVALENT', reason: TYPE_ONLY, triagedBy: BY },
  { mutantId: 'b2059cfd7d5c', verdict: 'EQUIVALENT', reason: TYPE_ONLY, triagedBy: BY },
  { mutantId: '88523091c789', verdict: 'EQUIVALENT', reason: TYPE_ONLY, triagedBy: BY },
  { mutantId: '8faaf16327d9', verdict: 'EQUIVALENT', reason: TYPE_ONLY, triagedBy: BY },
  {
    mutantId: '05b8cba94cb1',
    verdict: 'EQUIVALENT',
    reason: 'percentile: Math.min(len - 1 -> len + 1, ...) is unreachable because ceil(p/100*n) - 1 <= n - 1 for p <= 100',
    triagedBy: BY,
  },
  {
    mutantId: '22a22eadecdd',
    verdict: 'EQUIVALENT',
    reason: 'evaluateRun: first guard `> 0 -> > 1` is redundant; the second guard returns INVALID_RUN(2) for any non-empty problems',
    triagedBy: BY,
  },
  {
    mutantId: 'c565d6b03d41',
    verdict: 'ACCEPTED_RISK',
    reason: 'computeStats default warm-up (?? 0 -> ?? 1) only applies to an invalid profile; stats of an INVALID_RUN carry no contract',
    triagedBy: BY,
  },
  {
    mutantId: 'f9f1b476d073',
    verdict: 'ACCEPTED_RISK',
    reason: 'computeStats default duration (?? 0 -> ?? 1) only applies to an invalid profile; stats of an INVALID_RUN carry no contract',
    triagedBy: BY,
  },
];

export const REFERENCE_TRIAGE: TriageEntry[] = [
  { mutantId: 'e66c62973a58', verdict: 'EQUIVALENT', reason: 'waitUntil yields 1 ms vs 2 ms; the contract is "yield between polls", not the delay length', triagedBy: BY },
  { mutantId: '899c035db98f', verdict: 'EQUIVALENT', reason: 'clamp: x < lo -> x <= lo returns lo when x === lo, which equals x', triagedBy: BY },
  { mutantId: '98d8d335f087', verdict: 'EQUIVALENT', reason: 'clamp: x > hi -> x >= hi returns hi when x === hi, which equals x', triagedBy: BY },
];
