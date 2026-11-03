import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * App tham chiếu tổng hợp cho performance-adapter.spec.ts (PLAN-16 Phase 4). Latency xác định
 * theo seq/seed (2–5 ms), fault cài cố ý theo `PERF_FAULT`, mỗi fault đúng một nguyên nhân:
 * - `latency`: +150 ms mỗi request (vượt p95).
 * - `errors`: mọi request thứ 4 trả 500 (vượt error rate).
 * - `slow`: +600 ms — 40 rps × 0.6 s = 24 in-flight > maxInFlight 20 → generator phải bỏ work (dropped).
 */
export type PerfFault = 'none' | 'latency' | 'errors' | 'slow';

const EXTRA: Record<PerfFault, number> = { none: 0, latency: 150, errors: 0, slow: 600 };

export async function startPerfApp(fault: PerfFault) {
  if (!(fault in EXTRA)) throw new Error(`[ENVIRONMENT] unknown PERF_FAULT '${fault}'`);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://perf.local');
    const seq = Number(url.searchParams.get('seq') ?? 0);
    const seed = Number(url.searchParams.get('seed') ?? 0);
    const delay = 2 + ((seq * 7 + seed) % 4) + EXTRA[fault];
    setTimeout(() => {
      const fail = fault === 'errors' && seq % 4 === 3;
      res.writeHead(fail ? 500 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(fail ? { error: 'INJECTED' } : { seq, items: [{ sku: `sku-${seed}`, qty: 1 }] }));
    }, delay);
  });
  server.keepAliveTimeout = 5_000;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
