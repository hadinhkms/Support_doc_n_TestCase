import * as fs from 'node:fs';
import { resolveInsideRoot, sha256 } from './evidence-integrity';
import type { EvidenceManifest } from './evidence-manifest';
import {
  RECEIPT_FILE,
  RECEIPT_SCHEMA_VERSION,
  checkIndexedEvidence,
  decideVerdict,
  runLevelProblems,
  type RunReceipt,
} from './evidence-receipt';

/**
 * Verifier cho bundle đã tải về (download drill trên runner mới): đọc lại receipt từ đĩa,
 * tính lại verdict, kiểm revision kỳ vọng (stale), trust, hash JUnit/manifest/artifact.
 * Không bao giờ exec dữ liệu đọc từ receipt/manifest.
 */
export interface BundleVerification {
  ok: boolean;
  problems: string[];
  unavailable: string[];
  receipt: RunReceipt | null;
  manifests: EvidenceManifest[];
}

export interface VerifyOptions {
  expectedRevision?: string;
  /** Gate evidence: từ chối bundle INVESTIGATION_ONLY (worktree bẩn / revision không rõ). */
  requireTrusted?: boolean;
}

function junitProblems(runRoot: string, receipt: RunReceipt): string[] {
  if (!receipt.junit) return ['JUNIT_MISSING'];
  try {
    const junit = fs.readFileSync(resolveInsideRoot(runRoot, receipt.junit.path));
    return sha256(junit) === receipt.junit.sha256 ? [] : [`HASH_MISMATCH: ${receipt.junit.path}`];
  } catch (err) {
    return [`JUNIT_UNREADABLE: ${(err as Error).message}`];
  }
}

function trustProblems(receipt: RunReceipt, options: VerifyOptions): string[] {
  const problems: string[] = [];
  const derivable = receipt.source?.dirty === false && Boolean(receipt.source?.qaRevision);
  if (receipt.trust === 'TRUSTED_CANDIDATE' && !derivable) {
    problems.push('TRUST_ESCALATION: receipt claims TRUSTED_CANDIDATE but source is dirty/unknown');
  }
  if (options.requireTrusted && receipt.trust !== 'TRUSTED_CANDIDATE') {
    problems.push(`UNTRUSTED_EVIDENCE: trust is '${receipt.trust}'`);
  }
  if (options.expectedRevision && receipt.source?.qaRevision !== options.expectedRevision) {
    problems.push(`STALE_REVISION: receipt ${receipt.source?.qaRevision} != expected ${options.expectedRevision}`);
  }
  return problems;
}

export function verifyEvidenceBundle(runRoot: string, options: VerifyOptions = {}): BundleVerification {
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
  const indexed = checkIndexedEvidence(runRoot, receipt);
  // Cùng tập vấn đề reporter đã dùng khi ghi verdict → so được verdict tự khai với verdict tính lại.
  const recomputed = [
    ...runLevelProblems(receipt.execution?.runnerStatus ?? 'unknown', receipt.counts ?? {}),
    ...junitProblems(runRoot, receipt),
    ...indexed.problems,
  ];
  const verdict = decideVerdict(receipt.counts ?? {}, recomputed);
  const problems = [...trustProblems(receipt, options), ...recomputed];
  if (verdict !== receipt.verdict?.evidence) {
    problems.push(`VERDICT_MISMATCH: receipt claims ${receipt.verdict?.evidence}, recomputed ${verdict}`);
  }
  if (verdict === 'INVALID_EMPTY_RUN') problems.push('INVALID_EMPTY_RUN: no test actually executed');
  const ok = problems.length === 0 && verdict === 'COMPLETE';
  return { ok, problems, unavailable: indexed.unavailable, receipt, manifests: indexed.manifests };
}
