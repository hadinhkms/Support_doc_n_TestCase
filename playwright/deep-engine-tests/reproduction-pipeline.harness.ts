import * as fs from 'node:fs';
import * as path from 'node:path';
import { sha256 } from '../tests/support/evidence-integrity';
import type { VerifyOptions } from '../tests/support/evidence-verify';
import { readReproRun, type ReproRun } from '../tests/support/repro-context';
import { RECIPE_SCHEMA_VERSION, recipeArgs, type ReproRecipe } from '../tests/support/repro-recipe';
import { gitHead, prepareNestedRun, runNested, type NestedRun } from './evidence-pipeline.harness';

/**
 * Harness cho reproduction-pipeline.spec.ts: một Playwright run thật trên ứng dụng tham chiếu
 * tổng hợp, chạy bằng argv sinh từ recipe (đúng đường người tái hiện đi), rồi đọc lại bundle.
 */
const APP = path.join(__dirname, 'reproduction-reference-app').split(path.sep).join('/');
export const SPEC_PATH = 'specs/reference.spec.ts';

export const CONTRACT = {
  source: 'AC-REF-1',
  seedBase: 100,
  control: { items: [{ price: 4, qty: 1 }], expected: 4 },
  order: { items: [{ price: 5, qty: 3 }, { price: 2, qty: 1 }], expected: 17 },
  reserve: { initial: 10, qty: 3, expectedRemaining: 4 },
};

const REFERENCE_SPEC = `
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { startReferenceApp } from '${APP}';
const bytes = fs.readFileSync(path.join(__dirname, '..', 'contract.json'));
const C = JSON.parse(bytes.toString('utf8'));
const EXPECTED_SHA = createHash('sha256').update(bytes).digest('hex');
let app: Awaited<ReturnType<typeof startReferenceApp>> | null = null;
test.afterAll(async () => { await app?.close(); });

async function begin(evidence: any, scenario: string) {
  const info = test.info();
  const tenant = process.env.REF_APP_TENANT ?? null;
  const shared = process.env.REPRO_TEST_DEFECT === 'shared-state';
  const tag = info.testId + '-r' + info.retry + '-p' + info.repeatEachIndex;
  const stateId = shared ? 'state-' + tenant + '-shared' : 'state-' + tenant + '-' + tag;
  const seed = C.seedBase + info.repeatEachIndex;
  const requestIds: string[] = [];
  app ??= await startReferenceApp(process.env.APP_BUILD_ID ?? '');
  const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
    const rid = 'req-' + tag + '-' + (requestIds.length + 1);
    requestIds.push(rid);
    const res = await fetch(app!.url + route, { method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'content-type': 'application/json', 'x-request-id': rid, ...headers } });
    return { status: res.status, json: await res.json() };
  };
  const health = (await call('GET', '/health')).json;
  const record = () => {
    evidence.attach('repro.json', { scenario, stateId, seed, appBuild: health.build,
      actor: process.env.REPRO_ACTOR ?? null, expectedSha256: EXPECTED_SHA, requestIds });
    evidence.attach('timeline.json', app!.events.filter((e) => requestIds.includes(e.requestId)));
  };
  if (!tenant) { record(); throw new Error('[ENVIRONMENT] REF_APP_TENANT is not set'); }
  const exists = shared && (await call('GET', '/state?stateId=' + stateId)).status === 200;
  if (!exists) await call('POST', '/reset', { stateId, seed, stock: C.reserve.initial });
  return { call, record, stateId };
}

test.describe('@REQ-REF-1 reference ledger', () => {
  test('TC-REF-1 - AC-REF-1 control: single-unit order is persisted', async ({ evidence }) => {
    const ctx = await begin(evidence, 'control');
    const order = await ctx.call('POST', '/orders', { stateId: ctx.stateId, items: C.control.items });
    const state = await ctx.call('GET', '/state?stateId=' + ctx.stateId);
    ctx.record();
    const oracle = process.env.REPRO_TEST_DEFECT === 'wrong-oracle' ? C.control.expected + 1 : C.control.expected;
    expect(order.json.total, 'control total').toBe(oracle);
    expect(state.json.orders.length, 'persisted orders').toBe(1);
  });
  test('TC-REF-2 - AC-REF-1 order total multiplies quantity', async ({ evidence }) => {
    const ctx = await begin(evidence, 'order-total');
    const order = await ctx.call('POST', '/orders', { stateId: ctx.stateId, items: C.order.items });
    const state = await ctx.call('GET', '/state?stateId=' + ctx.stateId);
    ctx.record();
    evidence.observe({ expectedSource: C.source, expected: String(C.order.expected), actual: String(order.json.total), anchor: 'POST /orders' });
    expect(order.json.total, 'order total').toBe(C.order.expected);
    expect(state.json.orders[0]?.total, 'persisted total').toBe(C.order.expected);
  });
  test('TC-REF-3 - AC-REF-2 concurrent reservations keep stock consistent', async ({ evidence }) => {
    const ctx = await begin(evidence, 'reserve-race');
    const body = { stateId: ctx.stateId, qty: C.reserve.qty };
    await Promise.all([1, 2].map(() => ctx.call('POST', '/reserve', body, { 'x-test-barrier': '2' })));
    const state = await ctx.call('GET', '/state?stateId=' + ctx.stateId);
    ctx.record();
    expect(state.json.stock, 'remaining stock').toBe(C.reserve.expectedRemaining);
  });
});
`;

/** Thư mục run tạm: spec tham chiếu + contract (expected có thẩm quyền) do caller chọn. */
export function prepareReproDir(label: string, contract: unknown = CONTRACT): string {
  const dir = prepareNestedRun(label, { 'reference.spec.ts': REFERENCE_SPEC });
  fs.writeFileSync(path.join(dir, 'contract.json'), JSON.stringify(contract));
  return dir;
}

export const specReader = (dir: string) => (rel: string) => {
  const file = path.join(dir, rel);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
};

export function draftRecipe(dir: string): ReproRecipe {
  return {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: 'OBS-REF-1',
    businessContext: 'Khách đặt đơn nhiều sản phẩm số lượng > 1; tổng tiền phải nhân đơn giá với số lượng.',
    trace: { req: ['REQ-REF-1'], ac: ['AC-REF-1', 'AC-REF-2'], tc: ['TC-REF-1', 'TC-REF-2', 'TC-REF-3'] },
    expected: { source: CONTRACT.source, sha256: sha256(fs.readFileSync(path.join(dir, 'contract.json'))) },
    source: { qaRevision: gitHead(), appBuild: 'ref-app@1' },
    environment: { node: process.version, os: process.platform },
    roles: [{ alias: 'tenant-alias', howToCreate: 'Any synthetic tenant name via REF_APP_TENANT' }],
    dataset: { schema: 'ref-ledger/1', seedBase: CONTRACT.seedBase, reset: 'POST /reset per attempt (stateId per test/retry/repeat)' },
    command: { tool: 'playwright-test', spec: SPEC_PATH, specSha256: sha256(fs.readFileSync(path.join(dir, SPEC_PATH))), grep: null, repeatEach: 3, workers: 1 },
    envNames: ['APP_BUILD_ID', 'REF_APP_TENANT', 'REPRO_ACTOR'],
    steps: ['Reset ledger state', 'POST /orders with contract items', 'Read back GET /state', 'Compare with contract'],
    observable: { scenario: 'order-total', signature: null, signatureText: null, numerator: 0, denominator: 0 },
    limitations: ['Synthetic reference app; no production frequency implied'],
  };
}

export interface ReproExec {
  run: NestedRun;
  repro: ReproRun;
}

/** Chạy đúng argv recipe sinh ra (recipe bị từ chối thì ném lỗi, không chạy); env chỉ gồm biến hệ thống + env. */
export function execRecipe(dir: string, recipe: ReproRecipe, env: Record<string, string>, verify: VerifyOptions = {}): ReproExec {
  const run = runNested(dir, recipeArgs(recipe, { readSpec: specReader(dir) }), env, true);
  return { run, repro: readReproRun(run.runRoot, verify) };
}

/** Đặt tạm một biến ở process cha (probe rò env), luôn khôi phục kể cả khi `fn` ném lỗi. */
export function withParentEnv<T>(name: string, value: string, fn: () => T): T {
  const previous = process.env[name];
  process.env[name] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}