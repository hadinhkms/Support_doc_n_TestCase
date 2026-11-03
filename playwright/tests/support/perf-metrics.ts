import { approvalProblems, validateProfile, workloadHash, type PerfProfile, type SloMetric } from './perf-profile';

/**
 * Raw metrics → thống kê → verdict (PLAN-16 Phase 4, T4.4). Mọi số liệu tính lại được từ raw
 * samples (giữ nguyên trong evidence). Raw phải đủ (seq 0..n-1, không trùng), warm-up tính lại
 * từ `scheduledMs` (không tin cờ), percentile nearest-rank trên latency TÍNH TỪ LỊCH.
 * Exit: 0 đạt ngưỡng, 1 vượt ngưỡng, 2 run không hợp lệ (profile lỗi, thiếu sample, máy tạo tải bận).
 */
export interface PerfSample {
  seq: number;
  scheduledMs: number;
  /** Thời điểm gửi thật (ms từ lúc bắt đầu); `sentMs - scheduledMs` = độ trễ phía generator. */
  sentMs: number | null;
  /** Từ thời điểm lên lịch tới khi xong — gồm cả độ trễ gửi (chống coordinated omission). */
  latencyMs: number | null;
  status: number | null;
  outcome: 'ok' | 'error' | 'dropped';
  warmup: boolean;
}

export interface PerfTelemetry {
  /** Độ trễ event loop của chính load generator. */
  loopLagP99Ms: number;
  loopLagMaxMs: number;
  /** Độ trễ gửi so với lịch: cao → generator không theo kịp lịch, latency bị nhiễm phía client. */
  sendLagP95Ms: number;
  sendLagMaxMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  cpus: number;
  rssMb: number;
}

export type PerfStats = Record<SloMetric, number | null> & {
  samples: number;
  measured: number;
  ok: number;
  errors: number;
  windowSec: number;
};

export type PerfVerdict = 'SLO_MET' | 'SLO_BREACHED' | 'THRESHOLD_CHECK_ONLY' | 'THRESHOLD_BREACHED' | 'INVALID_RUN';

export interface PerfResult {
  schemaVersion: 'perf-result/1';
  verdict: PerfVerdict;
  exitCode: 0 | 1 | 2;
  workloadHash: string;
  stats: PerfStats;
  breaches: string[];
  problems: string[];
  limitations: string[];
}

/** Ngưỡng "máy tạo tải bận" — dev đặt, chờ owner (PDR-16-P4-03). */
export const BUSY = { loopLagP99Ms: 50, sendLagP95Ms: 50, sendLagMaxMs: 250 } as const;
export const REPORT_STATEMENT = 'Synthetic reference workload: results are not a production capacity or SLA claim.';

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export function busyProblems(t: PerfTelemetry): string[] {
  return (Object.keys(BUSY) as (keyof typeof BUSY)[])
    .filter((k) => !(t?.[k] <= BUSY[k]))
    .map((k) => `ENVIRONMENT_BUSY: generator ${k} ${t?.[k]} > ${BUSY[k]}; latency is contaminated client-side`);
}

/** Raw đủ và nhất quán với profile: đúng số request đã lên lịch, seq duy nhất, cờ warm-up đúng. */
export function sampleProblems(samples: readonly PerfSample[], profile: PerfProfile): string[] {
  const expected = Math.round(profile.arrival.ratePerSec * profile.arrival.durationSec);
  const seqs = new Set(samples.map((s) => s.seq));
  const problems: string[] = [];
  if (samples.length !== expected || seqs.size !== expected || ![...seqs].every((q) => Number.isInteger(q) && q >= 0 && q < expected)) {
    problems.push(`INCOMPLETE_SAMPLES: ${samples.length} samples / ${seqs.size} unique seq, expected 0..${expected - 1}`);
  }
  const mislabeled = samples.filter((s) => s.warmup !== s.scheduledMs < profile.arrival.warmupSec * 1000).length;
  if (mislabeled > 0) problems.push(`WARMUP_MISLABELED: ${mislabeled} sample(s) disagree with scheduledMs`);
  return problems;
}

export function computeStats(samples: readonly PerfSample[], profile: PerfProfile): PerfStats {
  const measured = samples.filter((s) => s.scheduledMs >= profile.arrival.warmupSec * 1000);
  const ok = measured.filter((s) => s.outcome === 'ok' && typeof s.latencyMs === 'number' && Number.isFinite(s.latencyMs));
  const lat = ok.map((s) => s.latencyMs as number);
  const windowSec = Math.max(profile.arrival.durationSec - profile.arrival.warmupSec, 1e-9);
  return {
    samples: samples.length,
    measured: measured.length,
    ok: ok.length,
    errors: measured.filter((s) => s.outcome === 'error').length,
    dropped: measured.filter((s) => s.outcome === 'dropped').length,
    windowSec,
    p50_ms: percentile(lat, 50),
    p95_ms: percentile(lat, 95),
    p99_ms: percentile(lat, 99),
    // Work bị bỏ cũng là thất bại: bỏ request không được làm error rate "đẹp" hơn.
    error_rate: measured.length ? (measured.length - ok.length) / measured.length : null,
    throughput_rps: ok.length / windowSec,
  };
}

export function evaluateRun(profile: PerfProfile, samples: readonly PerfSample[], telemetry: PerfTelemetry): PerfResult {
  const problems = validateProfile(profile);
  const hash = problems.length === 0 ? workloadHash(profile) : 'invalid';
  const stats = computeStats(samples, profile);
  const limitations = [REPORT_STATEMENT];
  const breaches: string[] = [];
  const result = (verdict: PerfVerdict, exitCode: 0 | 1 | 2): PerfResult =>
    ({ schemaVersion: 'perf-result/1', verdict, exitCode, workloadHash: hash, stats, breaches, problems, limitations });
  if (problems.length > 0) return result('INVALID_RUN', 2);
  problems.push(...sampleProblems(samples, profile), ...busyProblems(telemetry));
  if (stats.measured < profile.stop.minSamples) problems.push(`INSUFFICIENT_SAMPLES: ${stats.measured} measured < ${profile.stop.minSamples}`);
  if (problems.length > 0) return result('INVALID_RUN', 2);
  for (const rule of profile.slo) {
    const actual = stats[rule.metric];
    const ok = actual !== null && (rule.op === '<=' ? actual <= rule.value : actual >= rule.value);
    if (!ok) breaches.push(`${rule.metric} ${actual === null ? 'unavailable' : +actual.toFixed(3)} violates ${rule.op} ${rule.value} (${rule.source})`);
  }
  if (stats.error_rate === null || stats.error_rate > profile.stop.maxErrorRate) {
    breaches.push(`STOP_CONDITION: error_rate ${stats.error_rate} > ${profile.stop.maxErrorRate}`);
  }
  const approval = approvalProblems(profile);
  limitations.push(...approval.map((a) => `NOT_AN_SLA_CLAIM: ${a}`));
  const approved = approval.length === 0;
  if (breaches.length > 0) return result(approved ? 'SLO_BREACHED' : 'THRESHOLD_BREACHED', 1);
  return result(approved ? 'SLO_MET' : 'THRESHOLD_CHECK_ONLY', 0);
}

export function formatPerfReport(profile: PerfProfile, r: PerfResult, context: Record<string, string> = {}): string {
  const s = r.stats;
  return [
    REPORT_STATEMENT,
    `Profile ${profile.id} (${profile.kind}) · workload ${r.workloadHash} · verdict ${r.verdict} · exit ${r.exitCode}`,
    ...Object.entries(context).map(([k, v]) => `${k}: ${v}`),
    `Samples ${s.samples} (measured ${s.measured}, ok ${s.ok}, errors ${s.errors}, dropped ${s.dropped}) over ${s.windowSec}s`,
    `p50 ${s.p50_ms} ms · p95 ${s.p95_ms} ms · p99 ${s.p99_ms} ms (from scheduled time) · error rate ${s.error_rate} · throughput ${s.throughput_rps?.toFixed(2)} rps`,
    ...r.breaches.map((b) => `BREACH ${b}`),
    ...r.problems.map((p) => `PROBLEM ${p}`),
    ...r.limitations.slice(1).map((l) => `LIMIT ${l}`),
  ].join('\n');
}

/** Wrapper cho spec: vượt ngưỡng hoặc run không hợp lệ → fail (runner exit ≠ 0). */
export function expectPerformance(r: PerfResult): void {
  if (r.exitCode !== 0) throw new Error(`PERF_${r.verdict}: ${[...r.breaches, ...r.problems].join('; ')}`);
}
