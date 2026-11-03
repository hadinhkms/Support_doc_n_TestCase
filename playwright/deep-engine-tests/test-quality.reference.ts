/**
 * Module tham chiếu cho test-quality.spec.ts (PLAN-16 Phase 5). Chứa bản cài SAI có chủ đích (để
 * property phải bắt và shrink được) và một vòng chờ async (để mutant `++`→`--` tạo TIMEOUT thật).
 * Không dùng cho code sản phẩm.
 */

/** Sai có chủ đích: dùng floor thay vì ceil của nearest-rank → lệch 1 hạng ở nhiều (p, n). */
export function brokenPercentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length) - 1))];
}

/** Sai có chủ đích: chỉ che `password=` viết thường; mọi key nhạy cảm khác lọt nguyên giá trị. */
export function naiveRedact(text: string): string {
  return text.replace(/password=\S+/g, 'password=[REDACTED]');
}

/** Chờ điều kiện, tối đa `maxTicks` lần, mỗi lần nhường event loop 1 ms. */
export async function waitUntil(condition: () => boolean, maxTicks: number): Promise<boolean> {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (condition()) return true;
    await new Promise((r) => setTimeout(r, 1));
  }
  return false;
}

/** Kẹp x vào [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}
