import * as fs from 'node:fs';
import { resolveInsideRoot } from './evidence-integrity';
import type { EvidenceManifest } from './evidence-manifest';
import { verifyEvidenceBundle, type VerifyOptions } from './evidence-verify';
import { failureSignature, type ReproAttempt } from './repro-classify';

/**
 * Đọc một run evidence (Phase 1) thành dữ liệu tái hiện: verify bundle trước, rồi mới tin
 * `repro.json` mà test đã attach (scenario, state, seed, build quan sát được, actor, expected hash).
 * Không có artifact repro hoặc bundle hỏng → attempt không dùng được làm bằng chứng.
 */
export const REPRO_ARTIFACT = 'repro.json';
export const TIMELINE_ARTIFACT = 'timeline.json';

export interface ReproDetail {
  scenario: string;
  stateId: string | null;
  seed: number | null;
  appBuild: string | null;
  actor: string | null;
  expectedSha256: string | null;
  requestIds: string[];
}

export interface ReproRun {
  runRoot: string;
  runId: string | null;
  qaRevision: string | null;
  appBuild: string | null;
  actor: string | null;
  expectedSha256: string | null;
  seedProfile: string | null;
  evidenceOk: boolean;
  problems: string[];
  attempts: ReproAttempt[];
  details: Map<string, ReproDetail>;
  manifests: Map<string, EvidenceManifest>;
}

export function readAttemptJson<T>(runRoot: string, manifest: EvidenceManifest, name: string): T | null {
  const artifact = manifest.artifacts.find((a) => a.name === name && a.status === 'ACTIVE');
  if (!artifact) return null;
  return JSON.parse(fs.readFileSync(resolveInsideRoot(runRoot, artifact.path), 'utf8')) as T;
}

function single<T>(values: T[], label: string, problems: string[]): T | null {
  const unique = [...new Set(values)];
  if (unique.length > 1) problems.push(`INCONSISTENT_RUN: ${unique.length} different ${label} values in one run`);
  return unique.length === 1 ? unique[0] : null;
}

export function readReproRun(runRoot: string, options: VerifyOptions = {}): ReproRun {
  const bundle = verifyEvidenceBundle(runRoot, options);
  const problems = [...bundle.problems];
  const byPath = new Map(bundle.manifests.map((m) => [m.attempt.attemptId, m]));
  const details = new Map<string, ReproDetail>();
  const attempts: ReproAttempt[] = [];
  for (const entry of bundle.receipt?.attempts ?? []) {
    const attemptId = entry.manifest?.path.split('/')[1] ?? '';
    const manifest = byPath.get(attemptId);
    const detail = manifest ? readAttemptJson<ReproDetail>(runRoot, manifest, REPRO_ARTIFACT) : null;
    if (!detail) problems.push(`REPRO_DETAIL_MISSING: ${entry.testId} r${entry.retryIndex} p${entry.repeatIndex}`);
    if (detail) details.set(attemptId, detail);
    const sig = entry.status === 'passed' ? null : failureSignature(manifest?.outcome.errors ?? []);
    attempts.push({
      attemptId,
      runId: bundle.receipt?.runId ?? '',
      scenario: detail?.scenario ?? 'unknown',
      repeatIndex: entry.repeatIndex,
      retryIndex: entry.retryIndex,
      status: entry.status,
      signature: sig?.hash ?? null,
      signatureText: sig?.text ?? null,
      stateId: detail?.stateId ?? null,
      evidenceOk: bundle.ok && Boolean(detail),
    });
  }
  const all = [...details.values()];
  const appBuild = bundle.receipt?.source.appBuild ?? null;
  const observed = single(all.map((d) => d.appBuild), 'observed build', problems);
  if (observed && observed !== appBuild) problems.push(`BUILD_MISMATCH: receipt ${appBuild}, app reported ${observed}`);
  const seeds = all.map((d) => d.seed).filter((s): s is number => s !== null);
  return {
    runRoot,
    runId: bundle.receipt?.runId ?? null,
    qaRevision: bundle.receipt?.source.qaRevision ?? null,
    appBuild,
    actor: single(all.map((d) => d.actor), 'actor', problems),
    expectedSha256: single(all.map((d) => d.expectedSha256), 'expected hash', problems),
    seedProfile: seeds.length ? [...new Set(seeds)].sort((a, b) => a - b).join(',') : null,
    evidenceOk: bundle.ok && problems.length === 0,
    problems,
    attempts,
    details,
    manifests: byPath,
  };
}

export const attemptsFor = (run: ReproRun, scenario: string) => run.attempts.filter((a) => a.scenario === scenario);

export interface TimelineEvent {
  seq: number;
  at: number;
  requestId: string;
  event: string;
  detail?: Record<string, unknown>;
}

/** Timeline tương quan theo request ID: thứ tự seq phải tăng và mọi request của attempt đều có mặt. */
export function correlationTimeline(events: TimelineEvent[], requestIds: string[]) {
  const mine = events.filter((e) => requestIds.includes(e.requestId)).sort((a, b) => a.seq - b.seq);
  const problems: string[] = [];
  const seqs = mine.map((e) => e.seq);
  if (new Set(seqs).size !== seqs.length) problems.push('TIMELINE_DUPLICATE_SEQ');
  for (const id of requestIds) {
    if (!mine.some((e) => e.requestId === id)) problems.push(`TIMELINE_GAP: no server event for ${id}`);
  }
  return { events: mine, problems };
}
