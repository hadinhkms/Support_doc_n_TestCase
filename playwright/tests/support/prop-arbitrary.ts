/**
 * Arbitrary + shrinker tối giản, không dependency (PLAN-16 Phase 5, T5.2 — fast-check còn là
 * candidate, B4). Sinh xác định theo seed (mulberry32); shrink cũng xác định nên `seed + runIndex +
 * path` (chỉ số candidate đã chọn ở mỗi bước shrink) tái hiện đúng counterexample.
 */
export type Rng = () => number;

export interface Arbitrary<T> {
  generate(rng: Rng, size: number): T;
  /** Candidate nhỏ hơn, theo thứ tự cố định (nhỏ nhất trước). */
  shrink(value: T): T[];
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

export function integer(min: number, max: number): Arbitrary<number> {
  const target = Math.min(Math.max(0, min), max);
  return {
    generate: (rng, size) => {
      // Size nhỏ → giá trị gần target trước, để run đầu thử biên nhỏ.
      const span = Math.max(1, Math.ceil(((max - min) * Math.min(size, 100)) / 100));
      const lo = Math.max(min, target - span);
      const hi = Math.min(max, target + span);
      return between(rng, lo, hi);
    },
    shrink: (v) => {
      if (v === target) return [];
      const out = [target];
      let gap = Math.trunc((v - target) / 2);
      while (gap !== 0) {
        out.push(v - gap);
        gap = Math.trunc(gap / 2);
      }
      out.push(v > target ? v - 1 : v + 1);
      return [...new Set(out)].filter((x) => x !== v && x >= min && x <= max);
    },
  };
}

export function constantFrom<T>(...values: T[]): Arbitrary<T> {
  return {
    generate: (rng) => values[between(rng, 0, values.length - 1)],
    shrink: (v) => values.slice(0, values.indexOf(v)),
  };
}

export function array<T>(item: Arbitrary<T>, opts: { minLength?: number; maxLength?: number } = {}): Arbitrary<T[]> {
  const minLength = opts.minLength ?? 0;
  const maxLength = opts.maxLength ?? 30;
  return {
    generate: (rng, size) => {
      const len = between(rng, minLength, Math.max(minLength, Math.min(maxLength, size)));
      return Array.from({ length: len }, () => item.generate(rng, size));
    },
    shrink: (v) => {
      const out: T[][] = [];
      // Bỏ nửa sau, nửa đầu, rồi từng phần tử; sau đó shrink từng phần tử tại chỗ.
      for (let cut = Math.floor((v.length - minLength) / 2); cut >= 1; cut = Math.floor(cut / 2)) {
        out.push(v.slice(0, v.length - cut), v.slice(cut));
      }
      if (v.length > minLength) for (let i = 0; i < v.length; i++) out.push([...v.slice(0, i), ...v.slice(i + 1)]);
      for (let i = 0; i < v.length; i++) {
        for (const s of item.shrink(v[i])) out.push([...v.slice(0, i), s, ...v.slice(i + 1)]);
      }
      return out.filter((a) => a.length >= minLength);
    },
  };
}

export function stringOf(alphabet: string, opts: { minLength?: number; maxLength?: number } = {}): Arbitrary<string> {
  const chars = array(constantFrom(...alphabet), opts);
  return {
    generate: (rng, size) => chars.generate(rng, size).join(''),
    shrink: (v) => chars.shrink([...v]).map((a) => a.join('')),
  };
}

export function tuple<T extends unknown[]>(...items: { [K in keyof T]: Arbitrary<T[K]> }): Arbitrary<T> {
  return {
    generate: (rng, size) => items.map((a) => a.generate(rng, size)) as T,
    shrink: (v) => {
      const out: T[] = [];
      items.forEach((a, i) => {
        for (const s of a.shrink(v[i])) out.push(v.map((x, j) => (j === i ? s : x)) as T);
      });
      return out;
    },
  };
}
