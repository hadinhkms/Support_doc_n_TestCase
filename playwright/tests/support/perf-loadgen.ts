import * as os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { PerfSample, PerfTelemetry } from './perf-metrics';
import type { PerfProfile } from './perf-profile';

/**
 * Load generator tham chiếu, Node core (PLAN-16 Phase 4). KHÔNG phải runner được chốt (k6 còn là
 * candidate — B4): chỉ dùng cho harness kiểm công cụ và app tham chiếu local. Mô hình mở
 * (constant arrival rate): request được lên lịch theo thời gian, không chờ request trước xong;
 * vượt `maxInFlight` → `dropped` (work bị bỏ, được đếm, không bị giấu).
 */
export interface LoadRun {
  samples: PerfSample[];
  telemetry: PerfTelemetry;
  startedAt: string;
  finishedAt: string;
}

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/;

export async function runConstantArrival(baseUrl: string, profile: PerfProfile): Promise<LoadRun> {
  // Chỉ bắn tải vào host local: quyền chạy load test trên môi trường thật là câu hỏi chặn (Q-16-P4).
  if (!LOCAL.test(baseUrl)) throw new Error(`LOAD_TARGET_NOT_ALLOWED: ${baseUrl} (local reference app only)`);
  const { ratePerSec, durationSec, warmupSec, maxInFlight } = profile.arrival;
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
    if (inFlight >= maxInFlight) {
      samples.push({ seq, scheduledMs, latencyMs: null, status: null, outcome: 'dropped', warmup });
      continue;
    }
    inFlight += 1;
    const start = performance.now();
    pending.push(
      fetch(`${baseUrl}${profile.target.route}?seq=${seq}&seed=${profile.dataset.seed}`, { headers: { 'x-request-id': `perf-${seq}` } })
        .then(async (res) => {
          await res.arrayBuffer();
          const outcome = res.ok ? 'ok' : 'error';
          samples.push({ seq, scheduledMs, latencyMs: +(performance.now() - start).toFixed(2), status: res.status, outcome, warmup });
        })
        .catch(() => {
          samples.push({ seq, scheduledMs, latencyMs: null, status: null, outcome: 'error', warmup });
        })
        .finally(() => {
          inFlight -= 1;
        }),
    );
  }
  await Promise.all(pending);
  lag.disable();
  const cpu = process.cpuUsage(cpu0);
  return {
    samples: samples.sort((a, b) => a.seq - b.seq),
    telemetry: {
      loopLagP99Ms: +(lag.percentile(99) / 1e6).toFixed(2),
      loopLagMaxMs: +(lag.max / 1e6).toFixed(2),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      cpus: os.cpus().length,
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
    },
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
