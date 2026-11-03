import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveInsideRoot, sha256, verifyArtifactsOnDisk } from './evidence-integrity';
import {
  validateEvidenceManifest,
  type AttemptStatus,
  type EvidenceManifest,
  type WorktreeTrust,
} from './evidence-manifest';
import type { Sensitivity } from './evidence-redaction';
import type { SourceIdentity } from './evidence-run';

/**
 * Run receipt = index của một run/shard: command, exit, counts, revisions, JUnit và
 * danh sách attempt → manifest hash. Checksum chỉ chứng minh integrity; receipt
 * KHÔNG phải chữ ký Master và không tự nâng trust (ADR-16-02).
 */
export const RECEIPT_SCHEMA_VERSION = 'run-receipt/1';
export const RECEIPT_FILE = 'run-receipt.json';

export type EvidenceVerdict = 'COMPLETE' | 'INCOMPLETE' | 'INVALID_EMPTY_RUN';

export interface AttemptIndexEntry {
  testId: string;
  title: string;
  file: string;
  project: string;
  retryIndex: number;
  repeatIndex: number;
  workerIndex: number;
  parallelIndex: number;
  status: AttemptStatus;
  evidence: 'COLLECTED' | 'NOT_COLLECTED' | 'COLLECTION_ERROR';
  manifest: { path: string; sha256: string } | null;
}

export interface RunReceipt {
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  runId: string;
  shard: string;
  source: SourceIdentity;
  trust: WorktreeTrust;
  execution: {
    argv: string[];
    /** Env replay đã khai (EVIDENCE_RECORD_ENV), giá trị đã redact. */
    recordedEnv?: Record<string, string>;
    cwd: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    runnerStatus: string;
    exitCode: number;
    exitCodeSource: 'derived-from-runner-status';
  };
  environment: Record<string, string>;
  counts: Record<RunCountKey, number>;
  junit: { path: string; sha256: string; bytes: number; sensitivity: Sensitivity } | null;
  attempts: AttemptIndexEntry[];
  cleanup: { failures: string[] };
  verdict: { evidence: EvidenceVerdict; problems: string[] };
}

export type RunCountKey =
  | 'matched'
  | 'executed'
  | 'notRun'
  | 'expected'
  | 'unexpected'
  | 'flaky'
  | 'skipped'
  | 'interrupted'
  | 'attempts';

/**
 * Vấn đề cấp run: run bị hủy/timeout hoặc còn test chưa chạy thì evidence không trọn vẹn,
 * dù các manifest đã có đều hợp lệ (job CI bị cancel không được ra COMPLETE).
 */
export function runLevelProblems(runnerStatus: string, counts: Partial<Record<RunCountKey, number>>): string[] {
  const problems: string[] = [];
  if (runnerStatus !== 'passed' && runnerStatus !== 'failed') problems.push(`RUN_NOT_FINISHED: runner status '${runnerStatus}'`);
  if ((counts.notRun ?? 0) > 0) problems.push(`TESTS_NOT_RUN: ${counts.notRun} matched test(s) never executed`);
  return problems;
}

/** Thư mục attempt trên đĩa mà không có manifest được index (worker crash / kill cứng). */
function orphanedAttempts(runRoot: string, attempts: AttemptIndexEntry[]): string[] {
  const dir = path.join(runRoot, 'attempts');
  if (!fs.existsSync(dir)) return [];
  const indexed = new Set(attempts.filter((a) => a.manifest).map((a) => a.manifest!.path.split('/')[1]));
  return fs
    .readdirSync(dir)
    .filter((name) => !indexed.has(name))
    .map((name) => `ORPHANED_ATTEMPT: attempts/${name} has no indexed manifest (worker crash or kill?)`);
}

/** Kiểm từng manifest được index: nằm trong root, hash khớp, schema hợp lệ, artifact còn nguyên. */
export function checkIndexedEvidence(
  runRoot: string,
  receipt: Pick<RunReceipt, 'runId' | 'source' | 'attempts'>,
): { problems: string[]; unavailable: string[]; manifests: EvidenceManifest[]; cleanupFailures: string[] } {
  const problems: string[] = orphanedAttempts(runRoot, receipt.attempts);
  const unavailable: string[] = [];
  const manifests: EvidenceManifest[] = [];
  const cleanupFailures: string[] = [];
  for (const entry of receipt.attempts) {
    if (entry.evidence === 'COLLECTION_ERROR') {
      problems.push(`COLLECTION_ERROR: ${entry.testId} r${entry.retryIndex} has no usable manifest`);
    }
    if (!entry.manifest) continue;
    let manifest: EvidenceManifest;
    try {
      const bytes = fs.readFileSync(resolveInsideRoot(runRoot, entry.manifest.path));
      if (sha256(bytes) !== entry.manifest.sha256) {
        problems.push(`MANIFEST_TAMPERED: ${entry.manifest.path}`);
        continue;
      }
      manifest = JSON.parse(bytes.toString('utf8')) as EvidenceManifest;
    } catch (err) {
      problems.push(`MANIFEST_UNREADABLE: ${entry.manifest.path}: ${(err as Error).message}`);
      continue;
    }
    const validation = validateEvidenceManifest(manifest);
    problems.push(...validation.errors.map((e) => `${entry.manifest?.path}: ${e}`));
    if (manifest.status !== 'COMPLETE') problems.push(`PARTIAL_EVIDENCE: ${entry.manifest.path}`);
    const stale =
      manifest.identity?.runId !== receipt.runId ||
      manifest.source?.qaRevision !== receipt.source.qaRevision;
    if (stale) problems.push(`STALE_MANIFEST: ${entry.manifest.path} belongs to another run/revision`);
    // Fixture finalize trước các auto fixture (vd runtimeTrap) teardown; kết quả cuối khác thì manifest sai.
    if (manifest.outcome?.status !== entry.status) {
      problems.push(`OUTCOME_MISMATCH: ${entry.manifest.path} says '${manifest.outcome?.status}', runner says '${entry.status}'`);
    }
    const disk = verifyArtifactsOnDisk(runRoot, manifest.artifacts ?? []);
    problems.push(...disk.problems.map((p) => `${p.kind}: ${p.path} (${p.detail})`));
    unavailable.push(...disk.unavailable);
    for (const c of manifest.cleanup ?? []) {
      if (c.outcome === 'FAILED') cleanupFailures.push(`${entry.manifest.path}: ${c.label}: ${c.error}`);
    }
    manifests.push(manifest);
  }
  return { problems, unavailable, manifests, cleanupFailures };
}

/** Không có test nào thực sự chạy (0 matched, hoặc toàn skipped/không chạy) → không được PASS. */
export function decideVerdict(counts: Partial<Record<RunCountKey, number>>, problems: string[]): EvidenceVerdict {
  const executed = (counts.expected ?? 0) + (counts.unexpected ?? 0) + (counts.flaky ?? 0);
  if ((counts.matched ?? 0) === 0 || executed === 0) return 'INVALID_EMPTY_RUN';
  return problems.length > 0 ? 'INCOMPLETE' : 'COMPLETE';
}
