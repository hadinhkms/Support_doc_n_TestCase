import { isSafeRelativePath } from './evidence-integrity';
import { redactArgv, type Sensitivity } from './evidence-redaction';

/**
 * Evidence Manifest per attempt — schema `1.1` (evidence-contract §2).
 * `1.0` là bản Phase 0 (reader nằm trong evidence-contract.spec.ts); validator này
 * fail-closed: version lạ, thiếu field hoặc sai kiểu đều là lỗi, không suy ra PASS.
 */
export const EVIDENCE_SCHEMA_VERSION = '1.1';

export type AttemptStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
export type WorktreeTrust = 'TRUSTED_CANDIDATE' | 'INVESTIGATION_ONLY';

export interface EvidenceArtifact {
  name: string;
  path: string;
  sha256: string;
  bytes: number;
  mime: string;
  sensitivity: Sensitivity;
  status: 'ACTIVE' | 'EXPIRED_UNAVAILABLE';
  capturedAt: string;
  expiresAt: string | null;
}

export interface CollectionError {
  stage: 'source' | 'write' | 'verify' | 'snapshot' | 'redaction' | 'manifest';
  target: string;
  message: string;
}

export interface EvidenceManifest {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  status: 'COMPLETE' | 'PARTIAL';
  identity: {
    runId: string;
    testId: string;
    title: string;
    file: string;
    project: string;
    trace: { req: string[]; ac: string[]; tc: string[] };
  };
  attempt: {
    attemptId: string;
    retryIndex: number;
    repeatIndex: number;
    workerIndex: number;
    parallelIndex: number;
    shard: string;
  };
  source: { qaRevision: string | null; appBuild: string | null; appRevision: string | null };
  worktree: {
    dirty: boolean | null;
    diffDigest: string | null;
    untrackedDigest: string | null;
    trust: WorktreeTrust;
  };
  environment: Record<string, string | null>;
  execution: { argv: string[]; cwd: string; startedAt: string; finishedAt: string; tzOffsetMinutes: number };
  outcome: { status: AttemptStatus; expectedStatus: AttemptStatus; errors: string[] };
  observables: { expectedSource: string; expected: string; actual: string; anchor: string }[];
  artifacts: EvidenceArtifact[];
  cleanup: { label: string; outcome: 'OK' | 'FAILED'; error: string | null; at: string }[];
  collection: { errors: CollectionError[]; redaction: 'APPLIED' };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA1_FULL = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const STATUSES = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const SAFE_SEGMENT = /[^A-Za-z0-9_.-]+/g;

export function safeSegment(value: string, max = 48): string {
  return value.replace(SAFE_SEGMENT, '_').slice(0, max) || '_';
}

/** ID attempt duy nhất theo project + test + retry + repeat; worker không tham gia khóa. */
export function deriveAttemptId(input: {
  project: string;
  testId: string;
  retryIndex: number;
  repeatIndex: number;
}): string {
  return `${safeSegment(input.project, 32)}~${safeSegment(input.testId, 64)}~r${input.retryIndex}~p${input.repeatIndex}`;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isIndex = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0;

function checkSourceAndWorktree(m: EvidenceManifest, errors: string[]): void {
  if (!m.source || !SHA1_FULL.test(m.source.qaRevision ?? '')) {
    errors.push('SOURCE_UNKNOWN: source.qaRevision must be a full 40-hex SHA');
  }
  const wt = m.worktree;
  if (!wt || typeof wt.dirty !== 'boolean') {
    errors.push('WORKTREE_UNKNOWN: worktree.dirty must be boolean');
    return;
  }
  if (wt.dirty && !SHA256.test(wt.diffDigest ?? '')) {
    errors.push('WORKTREE_DIGEST_MISSING: dirty worktree requires diffDigest');
  }
  if (wt.dirty && wt.trust !== 'INVESTIGATION_ONLY') {
    errors.push('DIRTY_TRUST_VIOLATION: dirty worktree must be INVESTIGATION_ONLY');
  }
}

function checkArtifacts(m: EvidenceManifest, errors: string[]): void {
  if (!Array.isArray(m.artifacts)) {
    errors.push("Missing 'artifacts' list");
    return;
  }
  const seen = new Set<string>();
  for (const art of m.artifacts) {
    if (!isSafeRelativePath(art?.path)) {
      errors.push(`PATH_TRAVERSAL_DETECTED: artifact path '${String(art?.path)}' escapes run root`);
      continue;
    }
    if (seen.has(art.path)) errors.push(`DUPLICATE_ARTIFACT_PATH: '${art.path}'`);
    seen.add(art.path);
    if (!SHA256.test(art.sha256 ?? '')) errors.push(`INVALID_SHA256: '${art.path}'`);
    if (!isIndex(art.bytes)) errors.push(`INVALID_BYTES: '${art.path}'`);
    if (art.sensitivity !== 'SHAREABLE' && art.sensitivity !== 'RESTRICTED') {
      errors.push(`INVALID_SENSITIVITY: '${art.path}'`);
    }
    if (art.status !== 'ACTIVE' && art.status !== 'EXPIRED_UNAVAILABLE') errors.push(`INVALID_ARTIFACT_STATUS: '${art.path}'`);
    if (art.expiresAt !== null && Number.isNaN(Date.parse(art.expiresAt))) {
      errors.push(`INVALID_EXPIRES_AT: '${art.path}'`);
      continue;
    }
    const expired = art.expiresAt !== null && new Date(art.expiresAt).getTime() < Date.now();
    if (expired && art.status !== 'EXPIRED_UNAVAILABLE') {
      errors.push(`EXPIRED_ARTIFACT_VIOLATION: '${art.path}' is past TTL but status is '${art.status}'`);
    }
  }
}

export function validateEvidenceManifest(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'] };
  }
  const m = input as EvidenceManifest;
  const errors: string[] = [];
  if (m.schemaVersion !== EVIDENCE_SCHEMA_VERSION) {
    errors.push(`UNSUPPORTED_SCHEMA: expected '${EVIDENCE_SCHEMA_VERSION}', got '${String(m.schemaVersion)}'`);
    return { valid: false, errors };
  }
  for (const key of ['runId', 'testId', 'title', 'file', 'project'] as const) {
    if (!isStr(m.identity?.[key])) errors.push(`Missing required field: 'identity.${key}'`);
  }
  const a = m.attempt;
  const indexesOk =
    a && [a.retryIndex, a.repeatIndex, a.workerIndex, a.parallelIndex].every(isIndex);
  if (!indexesOk || !isStr(a.shard)) {
    errors.push("Missing or invalid 'attempt' block");
  } else if (m.identity && a.attemptId !== deriveAttemptId({ ...m.identity, ...a })) {
    errors.push('ATTEMPT_ID_MISMATCH: attemptId does not match identity/attempt fields');
  }
  checkSourceAndWorktree(m, errors);
  if (!Array.isArray(m.execution?.argv) || !isStr(m.execution?.cwd)) {
    errors.push("Missing or invalid 'execution' block");
  } else if (redactArgv(m.execution.argv).some((arg, i) => arg !== m.execution.argv[i])) {
    errors.push('SECRET_LEAK_DETECTED: execution.argv contains unredacted sensitive values');
  }
  if (!STATUSES.has(m.outcome?.status) || !STATUSES.has(m.outcome?.expectedStatus)) {
    errors.push("Missing or invalid 'outcome.status/expectedStatus'");
  }
  if (m.status !== 'COMPLETE' && m.status !== 'PARTIAL') errors.push(`INVALID_STATUS: '${String(m.status)}'`);
  checkArtifacts(m, errors);
  const collectionErrors = m.collection?.errors;
  if (!Array.isArray(collectionErrors)) errors.push("Missing 'collection.errors'");
  else if (collectionErrors.length > 0 && m.status !== 'PARTIAL') {
    errors.push('FALSE_COMPLETE: manifest has collection errors but status is not PARTIAL');
  }
  if (!Array.isArray(m.cleanup)) errors.push("Missing 'cleanup' list");
  return { valid: errors.length === 0, errors };
}

/** Export/share chỉ cho phép khi mọi artifact SHAREABLE; còn lại phải ở kho hạn chế. */
export function evaluateExport(manifests: readonly EvidenceManifest[]): {
  allowed: boolean;
  blocked: string[];
} {
  const blocked = manifests.flatMap((m) =>
    m.artifacts.filter((a) => a.sensitivity !== 'SHAREABLE').map((a) => a.path),
  );
  return { allowed: blocked.length === 0, blocked };
}
