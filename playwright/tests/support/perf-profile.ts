import { sha256 } from './evidence-integrity';

/**
 * Workload profile `perf-profile/1` (PLAN-16 Phase 4, T4.3). Profile là DỮ LIỆU đã được owner
 * duyệt: arrival rate, warm-up, dataset seed, stop conditions và SLO có nguồn. Không có approval
 * độc lập → kết quả chỉ là "kiểm ngưỡng", không bao giờ là tuyên bố đạt SLO/SLA (AC-16-P4-1).
 */
export const PROFILE_SCHEMA = 'perf-profile/1';

export type SloMetric = 'p50_ms' | 'p95_ms' | 'p99_ms' | 'error_rate' | 'throughput_rps' | 'dropped';

export interface SloRule {
  metric: SloMetric;
  op: '<=' | '>=';
  value: number;
  /** ID SLO/AC có thẩm quyền (vd `SLO-ORDERS-1`); thiếu → SPEC_GAP. */
  source: string;
}

export interface PerfProfile {
  schemaVersion: typeof PROFILE_SCHEMA;
  id: string;
  kind: 'load' | 'spike' | 'soak';
  author: string;
  target: { alias: string; route: string };
  arrival: { mode: 'constant-arrival-rate'; ratePerSec: number; durationSec: number; warmupSec: number; maxInFlight: number };
  dataset: { schema: string; seed: number };
  stop: { maxErrorRate: number; minSamples: number };
  slo: SloRule[];
  /** Owner duyệt workload + SLO; người duyệt khác tác giả. Tên là tự khai — chưa phải chữ ký. */
  approval: { approvedBy: string; approvedAt: string; reason: string } | null;
}

export const METRICS: readonly SloMetric[] = ['p50_ms', 'p95_ms', 'p99_ms', 'error_rate', 'throughput_rps', 'dropped'];
const norm = (s: string) => s.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const positive = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max;

/** Hash của PHẦN WORKLOAD (không gồm SLO/approval): hai run chỉ so được khi cùng hash này. */
export function workloadHash(p: PerfProfile): string {
  const { target, arrival, dataset, stop, kind } = p;
  return sha256(JSON.stringify({ kind, target, arrival, dataset, stop })).slice(0, 16);
}

export function validateProfile(input: unknown): string[] {
  const p = input as PerfProfile;
  if (p?.schemaVersion !== PROFILE_SCHEMA) return [`UNSUPPORTED_PROFILE: ${String(p?.schemaVersion)}`];
  const problems: string[] = [];
  if (!['load', 'spike', 'soak'].includes(p.kind)) problems.push(`INVALID_KIND: ${String(p.kind)}`);
  if (!p.author?.trim() || !p.id?.trim()) problems.push('MISSING_FIELD: id/author');
  if (!/^\/[\w\-/]*$/.test(p.target?.route ?? '')) problems.push('INVALID_TARGET: route must be a path, not a URL');
  const a = p.arrival;
  if (a?.mode !== 'constant-arrival-rate') problems.push('INVALID_ARRIVAL: only constant-arrival-rate (open model) is supported');
  if (!positive(a?.ratePerSec, 500) || !positive(a?.durationSec, 600) || !positive(a?.maxInFlight, 1000)) {
    problems.push('INVALID_ARRIVAL: rate/duration/maxInFlight out of range');
  }
  if (typeof a?.warmupSec !== 'number' || a.warmupSec < 0 || a.warmupSec >= (a.durationSec ?? 0)) {
    problems.push('INVALID_ARRIVAL: warm-up must be >= 0 and shorter than the run');
  }
  if (!Number.isInteger(p.dataset?.seed) || !p.dataset?.schema) problems.push('MISSING_FIELD: dataset seed/schema');
  if (!positive(p.stop?.minSamples, 1e6) || typeof p.stop?.maxErrorRate !== 'number') problems.push('MISSING_FIELD: stop conditions');
  if (!Array.isArray(p.slo) || p.slo.length === 0) problems.push('SPEC_GAP: no SLO rule');
  for (const r of p.slo ?? []) {
    if (!METRICS.includes(r.metric) || !['<=', '>='].includes(r.op) || typeof r.value !== 'number') {
      problems.push(`INVALID_SLO: ${JSON.stringify(r)}`);
    }
    if (!r.source?.trim()) problems.push(`SPEC_GAP: SLO ${r.metric} has no authoritative source`);
  }
  return problems;
}

/** Approval hợp lệ: có lý do, thời điểm, người duyệt khác tác giả (sau chuẩn hoá). */
export function approvalProblems(p: PerfProfile): string[] {
  if (!p.approval) return ['PROFILE_NOT_APPROVED: workload/SLO have no owner approval'];
  const problems: string[] = [];
  if (!norm(p.approval.approvedBy) || norm(p.approval.approvedBy) === norm(p.author)) {
    problems.push('SELF_APPROVAL: approver must differ from the profile author');
  }
  if (!p.approval.reason?.trim()) problems.push('APPROVAL_WITHOUT_REASON');
  if (Number.isNaN(Date.parse(p.approval.approvedAt ?? ''))) problems.push('APPROVAL_INVALID: approvedAt');
  return problems;
}
