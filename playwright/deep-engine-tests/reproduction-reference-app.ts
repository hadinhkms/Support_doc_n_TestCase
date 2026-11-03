import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Ứng dụng tham chiếu tổng hợp cho reproduction-pipeline (PLAN-16 Phase 2). Dữ liệu giả lập,
 * state tách theo `stateId`, lỗi gắn với BUILD (APP_BUILD_ID) để có before/after thật:
 * - `ref-app@1`: tổng đơn bỏ qua số lượng + lost update khi hai lượt giữ hàng chồng nhau.
 * - `ref-app@1-intermittent`: lỗi tổng đơn chỉ khi seed % 3 === 1 (ngắt quãng xác định được).
 * - `ref-app@2`: bản sửa.
 * Barrier (`x-test-barrier`) là fault injection có điều kiện: giữ request tới khi đủ số in-flight.
 */
export interface ServerEvent {
  seq: number;
  at: number;
  requestId: string;
  event: string;
  detail?: Record<string, unknown>;
}

interface LedgerState {
  seed: number;
  orders: { total: number }[];
  stock: number;
}

const DEFECTS: Record<string, { total?: (seed: number) => boolean; race?: boolean }> = {
  'ref-app@1': { total: () => true, race: true },
  'ref-app@1-intermittent': { total: (seed) => seed % 3 === 1 },
  'ref-app@2': {},
};

export async function startReferenceApp(build: string) {
  const defects = DEFECTS[build];
  if (!defects) throw new Error(`[ENVIRONMENT] unknown reference build '${build}'`);
  const states = new Map<string, LedgerState>();
  const events: ServerEvent[] = [];
  let seq = 0;
  let inFlight = 0;
  let arrived = 0;
  let waiting: (() => void)[] = [];
  const log = (requestId: string, event: string, detail?: Record<string, unknown>) =>
    events.push({ seq: ++seq, at: Date.now(), requestId, event, detail });

  // Rendezvous: mọi request chờ tới khi đủ `size` request đã tới barrier, rồi thả cùng lúc.
  async function barrier(requestId: string, size: number): Promise<void> {
    const releaseOrder = ++arrived;
    if (arrived >= size) {
      arrived = 0;
      log(requestId, 'barrier-release', { inFlight, releaseOrder });
      waiting.splice(0).forEach((release) => release());
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => (log(requestId, 'barrier-timeout', { inFlight }), resolve()), 2_000);
      waiting.push(() => (clearTimeout(timer), resolve()));
    });
    log(requestId, 'barrier-passed', { inFlight, releaseOrder });
  }

  const routes: Record<string, (body: Record<string, unknown>, rid: string, barrierSize: number) => Promise<unknown>> = {
    'POST /reset': async (b) => {
      states.set(String(b.stateId), { seed: Number(b.seed), orders: [], stock: Number(b.stock ?? 10) });
      return { ok: true };
    },
    'POST /orders': async (b) => {
      const state = need(b.stateId);
      const items = b.items as { price: number; qty: number }[];
      const buggy = defects.total?.(state.seed) ?? false;
      const total = items.reduce((sum, i) => sum + i.price * (buggy ? 1 : i.qty), 0);
      state.orders.push({ total });
      return { total };
    },
    'POST /reserve': async (b, rid, size) => {
      const state = need(b.stateId);
      if (!defects.race) {
        if (size > 1) await barrier(rid, size);
        state.stock -= Number(b.qty);
        return { stock: state.stock };
      }
      const read = state.stock;
      if (size > 1) await barrier(rid, size);
      state.stock = read - Number(b.qty);
      log(rid, 'write', { read, wrote: state.stock });
      return { stock: state.stock };
    },
    'GET /state': async (b) => need(b.stateId),
    'GET /health': async () => ({ build }),
  };

  function need(stateId: unknown): LedgerState {
    const state = states.get(String(stateId));
    if (!state) throw Object.assign(new Error('STATE_NOT_SEEDED'), { status: 409 });
    return state;
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://ref.local');
    const rid = String(req.headers['x-request-id'] ?? `anon-${seq + 1}`);
    const route = routes[`${req.method} ${url.pathname}`];
    inFlight += 1;
    log(rid, 'request-start', { route: `${req.method} ${url.pathname}`, inFlight });
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = { ...Object.fromEntries(url.searchParams), ...(raw ? JSON.parse(raw) : {}) };
      if (!route) throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
      const out = await route(body, rid, Number(req.headers['x-test-barrier'] ?? 1));
      res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': rid }).end(JSON.stringify(out));
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      res.writeHead(status, { 'x-request-id': rid }).end(JSON.stringify({ error: (err as Error).message }));
    } finally {
      inFlight -= 1;
      log(rid, 'request-end', { inFlight });
    }
  }
  const server = http.createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    build,
    events,
    close: () => new Promise<void>((resolve) => (waiting = [], server.close(() => resolve()))),
  };
}
