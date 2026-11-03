import { mulberry32, type Arbitrary } from './prop-arbitrary';

/**
 * Property runner (PLAN-16 Phase 5, AC-16-P5-1). Mỗi property: N lần sinh input theo seed; lần đầu
 * vi phạm → shrink tham lam (lấy candidate vi phạm đầu tiên) tới khi không nhỏ hơn được. Report
 * `property-report/1` lưu seed, runIndex, path shrink và counterexample để `replayProperty` tái hiện
 * đúng input đó mà không phải chạy lại cả N lần. Invariant phải lấy từ contract, không suy từ code.
 */
export const PROPERTY_REPORT = 'property-report/1';

export type Predicate<T> = (value: T) => boolean | void;

export interface PropertyOptions {
  seed: number;
  numRuns?: number;
  maxShrinks?: number;
  /** Nguồn invariant (AC/contract); thiếu → SPEC_GAP, property không được chạy. */
  source: string;
}

export interface PropertyReport<T = unknown> {
  schemaVersion: typeof PROPERTY_REPORT;
  name: string;
  source: string;
  status: 'PASSED' | 'FAILED' | 'SPEC_GAP';
  seed: number;
  numRuns: number;
  runsExecuted: number;
  failure: null | {
    runIndex: number;
    original: T;
    counterexample: T;
    path: number[];
    shrinkSteps: number;
    error: string;
  };
}

const sizeFor = (runIndex: number) => Math.min(100, 1 + runIndex);

/** Lỗi của predicate: `false` hoặc throw đều là vi phạm; trả về thông điệp, null nếu đạt. */
function violation<T>(predicate: Predicate<T>, value: T): string | null {
  try {
    return predicate(value) === false ? 'predicate returned false' : null;
  } catch (err) {
    return (err as Error).message?.split('\n')[0] ?? String(err);
  }
}

/** Input của lần chạy `runIndex`: sinh tuần tự từ seed (mỗi run dùng chung một dòng PRNG). */
export function generateAt<T>(arb: Arbitrary<T>, seed: number, runIndex: number): T {
  const rng = mulberry32(seed);
  let value = arb.generate(rng, sizeFor(0));
  for (let i = 1; i <= runIndex; i++) value = arb.generate(rng, sizeFor(i));
  return value;
}

export function checkProperty<T>(name: string, arb: Arbitrary<T>, predicate: Predicate<T>, opts: PropertyOptions): PropertyReport<T> {
  const numRuns = opts.numRuns ?? 200;
  const base = { schemaVersion: PROPERTY_REPORT, name, source: opts.source, seed: opts.seed, numRuns } as const;
  if (!opts.source?.trim()) return { ...base, status: 'SPEC_GAP', runsExecuted: 0, failure: null };
  const rng = mulberry32(opts.seed);
  for (let runIndex = 0; runIndex < numRuns; runIndex++) {
    const original = arb.generate(rng, sizeFor(runIndex));
    const first = violation(predicate, original);
    if (first === null) continue;
    let current = original;
    let error = first;
    const path: number[] = [];
    for (let step = 0; step < (opts.maxShrinks ?? 500); step++) {
      const candidates = arb.shrink(current);
      const idx = candidates.findIndex((c) => violation(predicate, c) !== null);
      if (idx < 0) break;
      current = candidates[idx];
      error = violation(predicate, current) ?? error;
      path.push(idx);
    }
    return { ...base, status: 'FAILED', runsExecuted: runIndex + 1, failure: { runIndex, original, counterexample: current, path, shrinkSteps: path.length, error } };
  }
  return { ...base, status: 'PASSED', runsExecuted: numRuns, failure: null };
}

/** Tái hiện từ report: sinh lại input của `runIndex`, đi theo `path` shrink, chạy predicate một lần. */
export function replayProperty<T>(arb: Arbitrary<T>, predicate: Predicate<T>, replay: { seed: number; runIndex: number; path: number[] }) {
  let value = generateAt(arb, replay.seed, replay.runIndex);
  for (const [step, idx] of replay.path.entries()) {
    const candidates = arb.shrink(value);
    if (idx >= candidates.length) return { value, error: null as string | null, problems: [`REPLAY_PATH_INVALID: step ${step} index ${idx}`] };
    value = candidates[idx];
  }
  return { value, error: violation(predicate, value), problems: [] as string[] };
}
