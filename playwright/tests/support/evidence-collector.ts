import * as fs from 'node:fs';
import * as path from 'node:path';
import { sha256 } from './evidence-integrity';
import {
  deriveAttemptId,
  safeSegment,
  type CollectionError,
  type EvidenceArtifact,
  type EvidenceManifest,
} from './evidence-manifest';
import { buildAttemptManifest, type AttemptOutcome, type CollectorIdentity } from './evidence-manifest-build';
import {
  classifySensitivity,
  findSecretsInBytes,
  isTextualMime,
  knownSecretValues,
  redactText,
  redactValue,
} from './evidence-redaction';
import { runRootFor, type RunContext } from './evidence-run';

/**
 * Collector theo attempt: redact → ghi `wx` (không bao giờ ghi đè) → đọc lại & hash.
 * Lỗi capture/write/cleanup được ghi vào manifest thay vì ném ra, để lỗi test gốc
 * không bị che; manifest có lỗi luôn là PARTIAL (evidence-contract §6).
 */
export type { CollectorIdentity };

export interface AttachOptions {
  mime?: string;
  synthetic?: boolean;
  restricted?: boolean;
  ttlDays?: number;
}

export interface EvidenceIo {
  mkdir(dir: string): void;
  writeNew(file: string, bytes: Buffer): void;
  read(file: string): Buffer;
}

export const nodeEvidenceIo: EvidenceIo = {
  mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
  writeNew: (file, bytes) => fs.writeFileSync(file, bytes, { flag: 'wx' }),
  read: (file) => fs.readFileSync(file),
};

export interface FinalizeResult {
  manifest: EvidenceManifest;
  manifestPath: string | null;
  manifestSha256: string | null;
}

type Observable = EvidenceManifest['observables'][number];
const DAY_MS = 86_400_000;

export function createEvidenceCollector(
  ctx: RunContext,
  id: CollectorIdentity,
  options: { io?: EvidenceIo; env?: NodeJS.ProcessEnv } = {},
) {
  const io = options.io ?? nodeEvidenceIo;
  const env = options.env ?? process.env;
  const secrets = knownSecretValues(env);
  const runRoot = runRootFor(ctx, id.shard);
  const attemptId = deriveAttemptId(id);
  const startedAt = new Date().toISOString();
  const errors: CollectionError[] = ctx.source.errors.map((message) => ({
    stage: 'source',
    target: 'run',
    message,
  }));
  const artifacts: EvidenceArtifact[] = [];
  const observables: Observable[] = [];
  const cleanup: EvidenceManifest['cleanup'] = [];
  const fail = (stage: CollectionError['stage'], target: string, err: unknown) => {
    const message = String((err as Error)?.message ?? err);
    errors.push({ stage, target, message: redactText(message, secrets).slice(0, 500) });
  };

  let relDir = path.posix.join('attempts', attemptId);
  if (fs.existsSync(path.join(runRoot, relDir))) {
    fail('write', relDir, 'ATTEMPT_NAMESPACE_COLLISION: directory already exists');
    relDir = `${relDir}~dup-${process.pid}-${Date.now()}`;
  }
  const attemptDir = path.join(runRoot, ...relDir.split('/'));

  function encode(body: unknown, mime: string): Buffer {
    if (Buffer.isBuffer(body)) {
      return isTextualMime(mime) ? Buffer.from(redactText(body.toString('utf8'), secrets)) : body;
    }
    if (typeof body === 'string') return Buffer.from(redactText(body, secrets));
    return Buffer.from(JSON.stringify(redactValue(body, secrets), null, 2));
  }

  function attach(name: string, body: unknown, opts: AttachOptions = {}): EvidenceArtifact | null {
    const fileName = safeSegment(name, 80);
    const rel = path.posix.join(relDir, fileName);
    const mime = opts.mime ?? (Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json');
    if (fileName === 'manifest.json') {
      fail('write', rel, 'RESERVED_NAME: manifest.json is written by finalize()');
      return null;
    }
    let bytes: Buffer;
    try {
      bytes = encode(body, mime);
    } catch (err) {
      fail('redaction', rel, err);
      return null;
    }
    const abs = path.join(attemptDir, fileName);
    try {
      io.mkdir(attemptDir);
      io.writeNew(abs, bytes);
      if (sha256(io.read(abs)) !== sha256(bytes)) throw new Error('READ_BACK_HASH_MISMATCH');
    } catch (err) {
      fail('write', rel, err);
      return null;
    }
    const ttlDays = opts.ttlDays ?? (Number(env.EVIDENCE_TTL_DAYS) || 0);
    const leakedSecrets = findSecretsInBytes(bytes, secrets).length;
    const artifact: EvidenceArtifact = {
      name: redactText(name, secrets),
      path: rel,
      sha256: sha256(bytes),
      bytes: bytes.length,
      mime,
      sensitivity: classifySensitivity({ ...opts, mime, leakedSecrets }),
      status: 'ACTIVE',
      capturedAt: new Date().toISOString(),
      expiresAt: ttlDays > 0 ? new Date(Date.now() + ttlDays * DAY_MS).toISOString() : null,
    };
    artifacts.push(artifact);
    return artifact;
  }

  async function snapshot(name: string, capture: () => unknown, opts?: AttachOptions) {
    try {
      return attach(name, await capture(), opts);
    } catch (err) {
      fail('snapshot', name, err);
      return null;
    }
  }

  /** Snapshot trạng thái TRƯỚC cleanup; cleanup fail được ghi riêng, không đổi outcome test. */
  async function runCleanup(rawLabel: string, fn: () => unknown, before?: () => unknown) {
    const label = redactText(rawLabel, secrets);
    if (before) await snapshot(`before-cleanup-${label}.json`, before);
    try {
      await fn();
      cleanup.push({ label, outcome: 'OK', error: null, at: new Date().toISOString() });
      return true;
    } catch (err) {
      const error = redactText(String((err as Error)?.message ?? err), secrets).slice(0, 500);
      cleanup.push({ label, outcome: 'FAILED', error, at: new Date().toISOString() });
      return false;
    }
  }

  function finalize(outcome: AttemptOutcome): FinalizeResult {
    const parts = { ctx, id, attemptId, startedAt, outcome, secrets, observables, artifacts, cleanup, errors };
    const manifestPath = path.join(attemptDir, 'manifest.json');
    try {
      io.mkdir(attemptDir);
      const manifest = buildAttemptManifest(parts);
      io.writeNew(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)));
      return { manifest, manifestPath, manifestSha256: sha256(io.read(manifestPath)) };
    } catch (err) {
      fail('manifest', 'manifest.json', err);
      return { manifest: buildAttemptManifest(parts), manifestPath: null, manifestSha256: null };
    }
  }

  return {
    runRoot,
    attemptDir,
    attemptId,
    get errors(): readonly CollectionError[] {
      return errors;
    },
    attach,
    snapshot,
    cleanup: runCleanup,
    observe: (o: Observable) =>
      observables.push(redactValue({ ...o }, secrets) as Observable),
    finalize,
  };
}

export type EvidenceCollector = ReturnType<typeof createEvidenceCollector>;
