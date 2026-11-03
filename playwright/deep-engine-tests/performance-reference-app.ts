import { spawn } from 'node:child_process';
import { once } from 'node:events';

/**
 * App tham chiếu tổng hợp cho performance-adapter.spec.ts (PLAN-16 Phase 4), chạy trong PROCESS
 * RIÊNG để event loop của load generator không đội latency của app (QA Phase 4 F3). Latency xác
 * định theo seq/seed (2–5 ms), fault cài cố ý theo `PERF_FAULT`, mỗi fault đúng một nguyên nhân:
 * - `latency`: +150 ms mỗi request (vượt p95).
 * - `errors`: mọi request thứ 4 trả 500 (vượt error rate).
 * - `slow`: +600 ms — 40 rps × 0.6 s = 24 in-flight > maxInFlight 20 → generator phải bỏ work (dropped).
 */
export type PerfFault = 'none' | 'latency' | 'errors' | 'slow';

const EXTRA: Record<PerfFault, number> = { none: 0, latency: 150, errors: 0, slow: 600 };

const SERVER = `
const http = require('node:http');
const [extra, errors] = [Number(process.argv[1]), process.argv[2] === '1'];
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://perf.local');
  const seq = Number(url.searchParams.get('seq') || 0);
  const seed = Number(url.searchParams.get('seed') || 0);
  setTimeout(() => {
    const fail = errors && seq % 4 === 3;
    res.writeHead(fail ? 500 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(fail ? { error: 'INJECTED' } : { seq, items: [{ sku: 'sku-' + seed, qty: 1 }] }));
  }, 2 + ((seq * 7 + seed) % 4) + extra);
});
server.listen(0, '127.0.0.1', () => process.stdout.write('PORT ' + server.address().port + '\\n'));
process.on('disconnect', () => process.exit(0));
`;

export async function startPerfApp(fault: PerfFault) {
  if (!(fault in EXTRA)) throw new Error(`[ENVIRONMENT] unknown PERF_FAULT '${fault}'`);
  const child = spawn(process.execPath, ['-e', SERVER, String(EXTRA[fault]), fault === 'errors' ? '1' : '0'], {
    stdio: ['ignore', 'pipe', 'inherit', 'ipc'],
  });
  let buffer = '';
  const stdout = child.stdout!;
  stdout.setEncoding('utf8');
  const port = await new Promise<number>((resolve, reject) => {
    stdout.on('data', (chunk: string) => {
      buffer += chunk;
      const m = /PORT (\d+)/.exec(buffer);
      if (m) resolve(Number(m[1]));
    });
    child.once('exit', (code) => reject(new Error(`[ENVIRONMENT] reference app exited early (${code})`)));
  });
  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      if (child.exitCode !== null) return;
      child.kill();
      await once(child, 'exit');
    },
  };
}
