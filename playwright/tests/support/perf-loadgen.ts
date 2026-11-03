import * as os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { percentile, type PerfSample, type PerfTelemetry } from './perf-metrics';
import { validateProfile, type PerfProfile } from './perf-profile';

/**
 * Load generator tham chiếu, Node core (PLAN-16 Phase 4). KHÔNG phải runner được chốt (k6 còn là
 * candidate — B4): chỉ dùng cho harness kiểm công cụ và app tham chiếu local. Mô hình mở
 * (constant arrival rate): request được lên lịch theo thời gian, không chờ request trước xong;
 * vượt `maxInFlight` → `dropped`. Latency tính từ THỜI ĐIỂM LÊN LỊCH (chống coordinated omission):
 * generator gửi trễ thì độ trễ đó nằm trong latency và trong `sendLagMs`, không bị giấu.
 */
export interface LoadRun {
  samples: PerfSample[];
  telemetry: PerfTelemetry;
  startedAt: string;
  finishedAt: string;
}

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/;
const DEFAULT_TIMEOUT_MS = 5_000;

export async function runConstantArrival(baseUrl: string, profile: PerfProfile): Promise<LoadRun> {
  // Chỉ bắn tải vào host local: quyền chạy load test trên môi trường thật là câu hỏi chặn (Q-16-P4).
  if (!LOCAL.test(baseUrl)) throw new Error(`LOAD_TARGET_NOT_ALLOWED: ${baseUrl} (local reference app only)`);
  // Validate TRƯỚC khi gửi request nào: route/rate/maxInFlight sai không được tạo tải rồi mới báo lỗi.
  const invalid = validateProfile(profile);
  if (invalid.length > 0) throw new Error(`PROFILE_REJECTED: ${invalid.join('; ')}`);
  const origin = new URL(baseUrl).origin;
  const { ratePerSec, durationSec, warmupSec, maxInFlight } = profile.arrival;
  const timeoutMs = profile.stop.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const total = Math.round(ratePerSec * durationSec);
  const interval = 1000 / ratePerSec;
  const samples: PerfSample[] = [];
  const pending: Promise<void>[] = [];
  const lag = monitorEventLoopDelay({ resolution: 10 });
  const cpu0 = process.cpuUsage();
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  let inFlight = 0;
  lag.enable();
  for (let seq = 0; seq < total; seq++) {
    const scheduledMs = seq * interval;
    const wait = t0 + scheduledMs - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const warmup = scheduledMs < warmupSec * 1000;
    const sentMs = +(performance.now() - t0).toFixed(2);
    const base = { seq, scheduledMs: +scheduledMs.toFixed(2), sentMs, warmup };
    if (inFlight >= maxInFlight) {
      samples.push({ ...base, latencyMs: null, status: null, outcome: 'dropped' });
      continue;
    }
    const url = new URL(`${profile.target.route}?seq=${seq}&seed=${profile.dataset.seed}`, origin);
    if (url.origin !== origin) throw new Error(`LOAD_TARGET_NOT_ALLOWED: route resolves to ${url.origin}`);
    inFlight += 1;
    const record = (status: number | null, outcome: PerfSample['outcome']) => {
      samples.push({ ...base, latencyMs: +(performance.now() - t0 - scheduledMs).toFixed(2), status, outcome });
    };
    pending.push(
      // redirect 'manual': app không thể chuyển tải sang host khác; 3xx tính là lỗi.
      fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'x-request-id': `perf-${seq}` } })
        .then(async (res) => {
          await res.arrayBuffer();
          record(res.status, res.status >= 200 && res.status < 300 ? 'ok' : 'error');
        })
        .catch(() => record(null, 'error'))
        .finally(() => {
          inFlight -= 1;
        }),
    );
  }
  await Promise.all(pending);
  lag.disable();
  const cpu = process.cpuUsage(cpu0);
  const sendLag = samples.map((s) => (s.sentMs ?? 0) - s.scheduledMs);
  return {
    samples: samples.sort((a, b) => a.seq - b.seq),
    telemetry: {
      loopLagP99Ms: +(lag.percentile(99) / 1e6).toFixed(2),
      loopLagMaxMs: +(lag.max / 1e6).toFixed(2),
      sendLagP95Ms: +(percentile(sendLag, 95) ?? 0).toFixed(2),
      sendLagMaxMs: +Math.max(0, ...sendLag).toFixed(2),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      cpus: os.cpus().length,
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
    },
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
