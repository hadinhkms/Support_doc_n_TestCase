import { array, constantFrom, integer, stringOf, tuple, type Arbitrary } from '../tests/support/prop-arbitrary';
import type { Predicate } from '../tests/support/prop-check';

/**
 * Property có nguồn (PLAN-16 Phase 5, T5.1): invariant lấy từ định nghĩa/contract, không suy từ code.
 * - Percentile nearest-rank (perf-metrics, PDR-16-P4): kết quả là một phần tử của mẫu, có ít nhất
 *   ceil(p/100·n) phần tử ≤ nó và ít hơn ceil(p/100·n) phần tử < nó; mẫu rỗng → null.
 * - Redaction (evidence-contract §4): giá trị gán cho key nhạy cảm không bao giờ còn trong output.
 */
export interface PropertyDef<T, I> {
  name: string;
  source: string;
  arb: Arbitrary<T>;
  predicate: (impl: I) => Predicate<T>;
}

export type PercentileImpl = (values: readonly number[], p: number) => number | null;
export type RedactImpl = (text: string) => string;

export const percentileProperty: PropertyDef<[number[], number], PercentileImpl> = {
  name: 'percentile is the nearest-rank element',
  source: 'NIST nearest-rank definition; Phase 4 perf-result/1',
  arb: tuple(array(integer(-50, 50), { minLength: 0, maxLength: 30 }), integer(1, 100)),
  predicate: (impl) => ([values, p]) => {
    const r = impl(values, p);
    if (values.length === 0) return r === null;
    const rank = Math.ceil((p / 100) * values.length);
    const atMost = values.filter((v) => v <= (r as number)).length;
    const below = values.filter((v) => v < (r as number)).length;
    if (!values.includes(r as number)) throw new Error(`result ${r} is not a sample value`);
    if (atMost < rank || below >= rank) throw new Error(`result ${r} has ${below} below / ${atMost} at-or-below, rank ${rank}`);
    return true;
  },
};

// Bảng chữ cái tách rời: secret không thể trùng với key, filler hay chuỗi "[REDACTED]".
const KEYS = ['password', 'token', 'api_key', 'client_secret', 'PASSWORD', 'accessToken'];
export const redactionProperty: PropertyDef<[string, string, string, string], RedactImpl> = {
  name: 'secret values next to sensitive keys never survive redaction',
  source: 'evidence-contract §4 (no secret in shareable artifacts)',
  arb: tuple(stringOf('abcdefgh ', { maxLength: 12 }), constantFrom(...KEYS), constantFrom('=', ':', ': '), stringOf('0123456789XQJZ', { minLength: 6, maxLength: 16 })),
  predicate: (impl) => ([filler, key, sep, secret]) => {
    const out = impl(`${filler} ${key}${sep}${secret} end`);
    if (out.includes(secret)) throw new Error(`secret leaked: ${JSON.stringify(out)}`);
    return true;
  },
};
