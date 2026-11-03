import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvidenceManifest } from '../tests/support/evidence-manifest';
import { verifyEvidenceBundle } from '../tests/support/evidence-verify';
import type { PerfRunRecord } from '../tests/support/perf-compare';
import { evaluateRun, type PerfResult, type PerfSample, type PerfTelemetry } from '../tests/support/perf-metrics';
import { approveProfile, PROFILE_SCHEMA, type PerfProfile } from '../tests/support/perf-profile';
import { prepareNestedRun, readManifests, runNested, type NestedRun } from './evidence-pipeline.harness';
import type { PerfFault } from './performance-reference-app';

/**
 * Harness cho performance-adapter.spec.ts: Playwright run thật (process con) chạy load generator
 * vào app tham chiếu local (process riêng); raw samples, telemetry, profile và kết quả đi qua
 * evidence Phase 1. Recipe để người khác chạy lại một run con (UAT-16-P4-1 bước d):
 *   cd <runRoot của nested-runs.json>/../../..   (thư mục có nested.config.ts)
 *   PERF_FAULT=<none|latency|errors|slow> PERF_BUSY=<0|1> EVIDENCE_RECORD_ENV=PERF_FAULT,PERF_BUSY \
 *     npx playwright test -c nested.config.ts specs/perf.spec.ts --workers=1 --repeat-each=<n>
 * Receipt run con ghi đúng argv + `recordedEnv`; `profile.json` được đối chiếu hash với evidence.
 */
const posix = (p: string) => p.split(path.sep).join('/');
const SUPPORT = posix(path.resolve(__dirname, '../tests/support'));
const APP = posix(path.join(__dirname, 'performance-reference-app'));
const PW_ROOT = path.resolve(__dirname, '..');

const DRAFT: PerfProfile = {
  schemaVersion: PROFILE_SCHEMA,
  id: 'PERF-REF-ORDERS',
  kind: 'load',
  author: 'qa-author',
  target: { alias: 'reference-orders', route: '/orders' },
  arrival: { mode: 'constant-arrival-rate', ratePerSec: 40, durationSec: 3, warmupSec: 0.5, maxInFlight: 20 },
  dataset: { schema: 'ref-orders/1', seed: 42 },
  stop: { maxErrorRate: 0.05, minSamples: 80, requestTimeoutMs: 5_000 },
  slo: [
    { metric: 'p95_ms', op: '<=', value: 100, source: 'SLO-REF-P95' },
    { metric: 'error_rate', op: '<=', value: 0.01, source: 'SLO-REF-ERR' },
    { metric: 'dropped', op: '<=', value: 0, source: 'SLO-REF-DROP' },
  ],
  approval: null,
};
export const BASE_PROFILE = approveProfile(DRAFT, { approvedBy: 'perf-owner', reason: 'Reference workload agreed for harness', at: '2026-11-03T00:00:00Z' });

const PERF_SPEC = `
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runConstantArrival } from '${SUPPORT}/perf-loadgen';
import { evaluateRun, expectPerformance, formatPerfReport } from '${SUPPORT}/perf-metrics';
import { startPerfApp } from '${APP}';
const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'profile.json'), 'utf8'));
test('TC-REF-P - AC-REF-P workload ' + profile.id, async ({ evidence }) => {
  const fault = process.env.PERF_FAULT ?? 'none';
  evidence.attach('perf-profile.json', profile);
  const app = await startPerfApp(fault as any);
  // PERF_BUSY: máy tạo tải bị chiếm CPU (chặn event loop 80ms mỗi 100ms) — nhiễu môi trường, không phải app.
  const busy = process.env.PERF_BUSY === '1' ? setInterval(() => { const end = Date.now() + 80; while (Date.now() < end) {} }, 100) : null;
  try {
    const run = await runConstantArrival(app.url, profile);
    const result = evaluateRun(profile, run.samples, run.telemetry);
    const env = { os: process.platform, node: process.version, cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model ?? 'unknown' };
    evidence.attach('perf-samples.ndjson', run.samples.map((s) => JSON.stringify(s)).join('\\n'), { mime: 'application/x-ndjson' });
    evidence.attach('perf-telemetry.json', { ...run.telemetry, startedAt: run.startedAt, finishedAt: run.finishedAt, env });
    evidence.attach('perf-result.json', result);
    const context = { fault, busy: String(Boolean(busy)), attempt: test.info().testId + ' p' + test.info().repeatEachIndex };
    evidence.attach('perf-report.txt', formatPerfReport(profile, result, context), { mime: 'text/plain' });
    expectPerformance(result);
  } finally {
    if (busy) clearInterval(busy);
    await app.close();
  }
});
`;

let runCounter = 0;

export function preparePerfDir(label: string, profile: PerfProfile = BASE_PROFILE): string {
  const dir = prepareNestedRun(label, { 'perf.spec.ts': PERF_SPEC });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  return dir;
}

export interface PerfRun {
  run: NestedRun;
  manifests: EvidenceManifest[];
}

export function runPerf(dir: string, opts: { fault?: PerfFault; busy?: boolean; repeatEach?: number } = {}): PerfRun {
  const env = { PERF_FAULT: opts.fault ?? 'none', PERF_BUSY: opts.busy ? '1' : '0', EVIDENCE_RECORD_ENV: 'PERF_FAULT,PERF_BUSY' };
  const args = ['specs/perf.spec.ts', '--workers=1', `--repeat-each=${opts.repeatEach ?? 1}`];
  const run = runNested(dir, args, env, true, `r${++runCounter}`);
  return { run, manifests: readManifests(run) };
}

/** Replay đúng như receipt ghi (argv sau `playwright test -c nested.config.ts` + recordedEnv). */
export function replayPerf(dir: string, v: PerfRun): PerfRun {
  const exec = v.run.receipt!.execution;
  const prefix = ['playwright', 'test', '-c', 'nested.config.ts'];
  if (prefix.some((p, i) => exec.argv[i] !== p)) throw new Error(`unexpected argv ${exec.argv.join(' ')}`);
  const run = runNested(dir, exec.argv.slice(prefix.length), exec.recordedEnv ?? {}, true, `r${++runCounter}`);
  return { run, manifests: readManifests(run) };
}

export function readArtifact(v: PerfRun, m: EvidenceManifest, name: string): Buffer | null {
  const a = m.artifacts.find((x) => x.name === name);
  return a ? fs.readFileSync(path.join(v.run.runRoot, a.path)) : null;
}

/** Hash profile mà mỗi attempt đã chạy: replay khác hash → không phải cùng recipe. */
export const profileDigests = (v: PerfRun) =>
  v.manifests.map((m) => m.artifacts.find((a) => a.name === 'perf-profile.json')?.sha256 ?? null);

export const perfIndex = (runs: PerfRun[]) =>
  runs.map((v) => ({
    runId: v.run.receipt?.runId ?? null,
    runRoot: posix(path.relative(PW_ROOT, v.run.runRoot)),
    exitCode: v.run.exitCode,
    verdict: v.run.receipt?.verdict.evidence ?? null,
    recordedEnv: v.run.receipt?.execution.recordedEnv ?? {},
  }));

/**
 * Bản ghi so sánh: bundle phải verify, kết quả tính lại từ raw và phải khớp `perf-result.json`.
 * Đây là kiểm NHẤT QUÁN giữa các artifact (cùng `evaluateRun`), không phải một cài đặt độc lập;
 * hash Phase 1 chưa có chữ ký nên một bản ghi lại trọn vẹn và nhất quán không bị phát hiện.
 */
export function perfRecords(v: PerfRun): { records: PerfRunRecord[]; problems: string[] } {
  const bundle = verifyEvidenceBundle(v.run.runRoot);
  const problems = [...bundle.problems];
  const records: PerfRunRecord[] = [];
  for (const m of v.manifests) {
    try {
      const json = <T>(name: string): T => {
        const bytes = readArtifact(v, m, name);
        if (!bytes) throw new Error(`ARTIFACT_MISSING: ${name}`);
        return JSON.parse(bytes.toString('utf8')) as T;
      };
      const profile = json<PerfProfile>('perf-profile.json');
      const raw = readArtifact(v, m, 'perf-samples.ndjson');
      if (!raw) throw new Error('ARTIFACT_MISSING: perf-samples.ndjson');
      const samples = raw.toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as PerfSample);
      const telemetry = json<PerfTelemetry & { env: PerfRunRecord['env'] }>('perf-telemetry.json');
      const claimed = json<PerfResult>('perf-result.json');
      const result = evaluateRun(profile, samples, telemetry);
      if (JSON.stringify(result) !== JSON.stringify(claimed)) problems.push(`RESULT_MISMATCH: ${m.attempt.attemptId} summary differs from raw samples`);
      records.push({ runId: m.identity.runId, attemptId: m.attempt.attemptId, workloadHash: result.workloadHash, seed: profile.dataset.seed, env: telemetry.env, result, telemetry });
    } catch (err) {
      problems.push(`${m.attempt.attemptId}: ${(err as Error).message}`);
    }
  }
  return { records, problems };
}
