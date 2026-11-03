import * as fs from 'node:fs';
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
    cwd: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    runnerStatus: string;
    exitCode: number;
    exitCodeSource: 'derived-from-runner-status';
  };
  environment: Record<string, string>;
  counts: Record<'matched' | 'expected' | 'unexpected' | 'flaky' | 'skipped' | 'attempts', number>;
  junit: { path: string; sha256: string; bytes: number; sensitivity: Sensitivity } | null;
  attempts: AttemptIndexEntry[];
  verdict: { evidence: EvidenceVerdict; problems: string[] };
}

/** Kiểm từng manifest được index: nằm trong root, hash khớp, schema hợp lệ, artifact còn nguyên. */
export function checkIndexedEvidence(
  runRoot: string,
  receipt: Pick<RunReceipt, 'runId' | 'source' | 'attempts'>,
): { problems: string[]; unavailable: string[]; manifests: EvidenceManifest[] } {
  const problems: string[] = [];
  const unavailable: string[] = [];
  const manifests: EvidenceManifest[] = [];
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
    const disk = verifyArtifactsOnDisk(runRoot, manifest.artifacts ?? []);
    problems.push(...disk.problems.map((p) => `${p.kind}: ${p.path} (${p.detail})`));
    unavailable.push(...disk.unavailable);
    manifests.push(manifest);
  }
  return { problems, unavailable, manifests };
}

export function decideVerdict(matched: number, problems: string[]): EvidenceVerdict {
  if (matched === 0) return 'INVALID_EMPTY_RUN';
  return problems.length > 0 ? 'INCOMPLETE' : 'COMPLETE';
}

export interface BundleVerification {
  ok: boolean;
  problems: string[];
  unavailable: string[];
  receipt: RunReceipt | null;
  manifests: EvidenceManifest[];
}

/**
 * Verifier cho bundle đã tải về (download drill trên runner mới): đọc lại receipt từ đĩa,
 * kiểm revision kỳ vọng (stale), hash JUnit/manifest/artifact. Không bao giờ exec dữ liệu receipt.
 */
export function verifyEvidenceBundle(
  runRoot: string,
  options: { expectedRevision?: string } = {},
): BundleVerification {
  const fail = (problem: string): BundleVerification => ({
    ok: false,
    problems: [problem],
    unavailable: [],
    receipt: null,
    manifests: [],
  });
  let receipt: RunReceipt;
  try {
    receipt = JSON.parse(fs.readFileSync(resolveInsideRoot(runRoot, RECEIPT_FILE), 'utf8')) as RunReceipt;
  } catch (err) {
    return fail(`RECEIPT_UNREADABLE: ${(err as Error).message}`);
  }
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION || !Array.isArray(receipt.attempts)) {
    return fail(`UNSUPPORTED_RECEIPT: ${String(receipt.schemaVersion)}`);
  }
  const problems: string[] = [];
  if (options.expectedRevision && receipt.source?.qaRevision !== options.expectedRevision) {
    problems.push(`STALE_REVISION: receipt ${receipt.source?.qaRevision} != expected ${options.expectedRevision}`);
  }
  if (!receipt.junit) {
    problems.push('JUNIT_MISSING');
  } else {
    try {
      const junit = fs.readFileSync(resolveInsideRoot(runRoot, receipt.junit.path));
      if (sha256(junit) !== receipt.junit.sha256) problems.push(`HASH_MISMATCH: ${receipt.junit.path}`);
    } catch (err) {
      problems.push(`JUNIT_UNREADABLE: ${(err as Error).message}`);
    }
  }
  const indexed = checkIndexedEvidence(runRoot, receipt);
  problems.push(...indexed.problems);
  const verdict = decideVerdict(receipt.counts?.matched ?? 0, problems);
  if (verdict !== receipt.verdict?.evidence) {
    problems.push(`VERDICT_MISMATCH: receipt claims ${receipt.verdict?.evidence}, recomputed ${verdict}`);
  }
  const ok = problems.length === 0 && verdict === 'COMPLETE';
  return { ok, problems, unavailable: indexed.unavailable, receipt, manifests: indexed.manifests };
}
