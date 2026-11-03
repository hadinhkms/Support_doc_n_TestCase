import { sha256 } from './evidence-integrity';

/**
 * Workload profile `perf-profile/1` (PLAN-16 Phase 4, T4.3). Profile là DỮ LIỆU đã được owner
 * duyệt: arrival rate, warm-up, dataset seed, stop conditions và SLO có nguồn. Approval gắn với
 * hash nội dung (workload + SLO): sửa ngưỡng sau khi duyệt làm approval mất hiệu lực. Không có
 * approval hợp lệ → kết quả chỉ là "kiểm ngưỡng", không bao giờ là tuyên bố đạt SLO/SLA (AC-16-P4-1).
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
  stop: { maxErrorRate: number; minSamples: number; requestTimeoutMs?: number };
  slo: SloRule[];
  /** Owner duyệt workload + SLO (`contentHash`); người duyệt khác tác giả. Tên là tự khai — chưa phải chữ ký. */
  approval: { approvedBy: string; approvedAt: string; reason: string; contentHash: string } | null;
}

export const METRICS: readonly SloMetric[] = ['p50_ms', 'p95_ms', 'p99_ms', 'error_rate', 'throughput_rps', 'dropped'];
/** Chiều hợp lệ của từng metric: ngưỡng ngược chiều (vd p95 >= 0) không bao giờ fail. */
const DIRECTION: Record<SloMetric, '<=' | '>='> = {
  p50_ms: '<=', p95_ms: '<=', p99_ms: '<=', error_rate: '<=', dropped: '<=', throughput_rps: '>=',
};
const actor = (s: unknown) => (typeof s === 'string' ? s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : '');
const positive = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max;

/** JSON với key sắp xếp: hash không phụ thuộc thứ tự key khi profile được ghi lại. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Hash PHẦN WORKLOAD (không SLO/approval/alias): hai run chỉ so được khi cùng hash này. */
export function workloadHash(p: PerfProfile): string {
  return sha256(stableStringify({ kind: p.kind, route: p.target.route, arrival: p.arrival, dataset: p.dataset, stop: p.stop })).slice(0, 16);
}

/** Hash nội dung được duyệt = workload + SLO. */
export function approvalHash(p: PerfProfile): string {
  return sha256(stableStringify({ workload: workloadHash(p), slo: p.slo })).slice(0, 32);
}

export function approveProfile(p: PerfProfile, by: { approvedBy: string; reason: string; at?: string }): PerfProfile {
  return { ...p, approval: { approvedBy: by.approvedBy, reason: by.reason, approvedAt: by.at ?? new Date().toISOString(), contentHash: approvalHash(p) } };
}

function sloProblems(p: PerfProfile): string[] {
  if (!Array.isArray(p.slo) || p.slo.length === 0) return ['SPEC_GAP: no SLO rule'];
  const problems: string[] = [];
  for (const r of p.slo) {
    if (!METRICS.includes(r.metric) || typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0) {
      problems.push(`INVALID_SLO: ${JSON.stringify(r)}`);
    } else if (r.op !== DIRECTION[r.metric]) {
      problems.push(`INVALID_SLO: ${r.metric} must use '${DIRECTION[r.metric]}' (a '${r.op}' rule can never fail)`);
    } else if (r.metric === 'error_rate' && r.value > 1) problems.push('INVALID_SLO: error_rate is a ratio in [0, 1]');
    if (!r.source?.trim()) problems.push(`SPEC_GAP: SLO ${r.metric} has no authoritative source`);
  }
  // Thiếu rule cho latency, lỗi hoặc work bị bỏ → một phần hành vi không được kiểm mà vẫn "đạt".
  const has = (m: SloMetric[]) => p.slo.some((r) => m.includes(r.metric));
  if (!has(['p95_ms', 'p99_ms'])) problems.push('SPEC_GAP: SLO set has no p95/p99 latency rule');
  if (!has(['error_rate'])) problems.push('SPEC_GAP: SLO set has no error_rate rule');
  if (!has(['dropped'])) problems.push('SPEC_GAP: SLO set has no dropped-work rule');
  return problems;
}

export function validateProfile(input: unknown): string[] {
  const p = input as PerfProfile;
  if (p?.schemaVersion !== PROFILE_SCHEMA) return [`UNSUPPORTED_PROFILE: ${String(p?.schemaVersion)}`];
  const problems: string[] = [];
  if (!['load', 'spike', 'soak'].includes(p.kind)) problems.push(`INVALID_KIND: ${String(p.kind)}`);
  if (!p.author?.trim?.() || !p.id?.trim?.()) problems.push('MISSING_FIELD: id/author');
  if (!/^\/[\w\-/]*$/.test(p.target?.route ?? '')) problems.push('INVALID_TARGET: route must be a path, not a URL');
  const a = p.arrival;
  if (a?.mode !== 'constant-arrival-rate') problems.push('INVALID_ARRIVAL: only constant-arrival-rate (open model) is supported');
  if (!positive(a?.ratePerSec, 500) || !positive(a?.durationSec, 600) || !Number.isInteger(a?.maxInFlight) || !positive(a?.maxInFlight, 1000)) {
    problems.push('INVALID_ARRIVAL: rate/duration/maxInFlight out of range');
  }
  if (typeof a?.warmupSec !== 'number' || !(a.warmupSec >= 0) || a.warmupSec >= (a.durationSec ?? 0)) {
    problems.push('INVALID_ARRIVAL: warm-up must be >= 0 and shorter than the run');
  }
  if (!Number.isInteger(p.dataset?.seed) || !p.dataset?.schema) problems.push('MISSING_FIELD: dataset seed/schema');
  const s = p.stop;
  if (!Number.isInteger(s?.minSamples) || !positive(s?.minSamples, 1e6)) problems.push('MISSING_FIELD: stop.minSamples');
  if (typeof s?.maxErrorRate !== 'number' || !(s.maxErrorRate >= 0 && s.maxErrorRate <= 1)) problems.push('INVALID_STOP: maxErrorRate must be in [0, 1]');
  if (s?.requestTimeoutMs !== undefined && !positive(s.requestTimeoutMs, 60_000)) problems.push('INVALID_STOP: requestTimeoutMs');
  problems.push(...sloProblems(p));
  return problems;
}

/** Approval hợp lệ: đúng nội dung đang chạy, có lý do, thời điểm ISO không ở tương lai, người duyệt khác tác giả. */
export function approvalProblems(p: PerfProfile, now = Date.now()): string[] {
  if (!p.approval) return ['PROFILE_NOT_APPROVED: workload/SLO have no owner approval'];
  const problems: string[] = [];
  const by = actor(p.approval.approvedBy);
  if (!by || by === actor(p.author)) problems.push('SELF_APPROVAL: approver must differ from the profile author');
  if (typeof p.approval.reason !== 'string' || !p.approval.reason.trim()) problems.push('APPROVAL_WITHOUT_REASON');
  const at = Date.parse(p.approval.approvedAt ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(p.approval.approvedAt)) || Number.isNaN(at) || at > now) {
    problems.push('APPROVAL_INVALID: approvedAt must be an ISO time not in the future');
  }
  if (p.approval.contentHash !== approvalHash(p)) problems.push('APPROVAL_STALE: workload or SLO changed after approval');
  return problems;
}
