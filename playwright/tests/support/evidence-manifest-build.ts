import {
  EVIDENCE_SCHEMA_VERSION,
  type AttemptStatus,
  type CollectionError,
  type EvidenceArtifact,
  type EvidenceManifest,
} from './evidence-manifest';
import { redactText } from './evidence-redaction';
import { shardLabel, type RunContext } from './evidence-run';

/** Danh tính attempt do fixture/caller cung cấp (lấy từ TestInfo). */
export interface CollectorIdentity {
  testId: string;
  title: string;
  file: string;
  project: string;
  retryIndex: number;
  repeatIndex: number;
  workerIndex: number;
  parallelIndex: number;
  shard: { current: number; total: number } | null;
  tags: string[];
  environment: Record<string, string | null>;
}

export interface AttemptOutcome {
  status: AttemptStatus;
  expectedStatus: AttemptStatus;
  errors: string[];
}

const TRACE_ID = /\b(REQ|AC|TC)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g;

export function traceIds(texts: string[]): EvidenceManifest['identity']['trace'] {
  const found = texts.flatMap((t) => t.match(TRACE_ID) ?? []);
  const pick = (prefix: string) => [...new Set(found.filter((id) => id.startsWith(`${prefix}-`)))];
  return { req: pick('REQ'), ac: pick('AC'), tc: pick('TC') };
}

/** Ghép manifest từ phần collector đã thu; có collection error thì luôn PARTIAL. */
export function buildAttemptManifest(input: {
  ctx: RunContext;
  id: CollectorIdentity;
  attemptId: string;
  startedAt: string;
  outcome: AttemptOutcome;
  secrets: readonly string[];
  observables: EvidenceManifest['observables'];
  artifacts: EvidenceArtifact[];
  cleanup: EvidenceManifest['cleanup'];
  errors: CollectionError[];
}): EvidenceManifest {
  const { ctx, id, outcome } = input;
  const s = ctx.source;
  const trusted = s.dirty === false && Boolean(s.qaRevision);
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    status: input.errors.length > 0 ? 'PARTIAL' : 'COMPLETE',
    identity: {
      runId: ctx.runId,
      testId: id.testId,
      title: redactText(id.title, input.secrets),
      file: id.file,
      project: id.project,
      trace: traceIds([id.title, ...id.tags]),
    },
    attempt: {
      attemptId: input.attemptId,
      retryIndex: id.retryIndex,
      repeatIndex: id.repeatIndex,
      workerIndex: id.workerIndex,
      parallelIndex: id.parallelIndex,
      shard: shardLabel(id.shard),
    },
    source: { qaRevision: s.qaRevision, appBuild: s.appBuild, appRevision: s.appRevision },
    worktree: {
      dirty: s.dirty,
      diffDigest: s.diffDigest,
      untrackedDigest: s.untrackedDigest,
      trust: trusted ? 'TRUSTED_CANDIDATE' : 'INVESTIGATION_ONLY',
    },
    environment: id.environment,
    execution: {
      argv: ctx.argv,
      cwd: ctx.cwd,
      startedAt: input.startedAt,
      finishedAt: new Date().toISOString(),
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
    },
    outcome: {
      status: outcome.status,
      expectedStatus: outcome.expectedStatus,
      errors: outcome.errors.map((e) => redactText(e, input.secrets).slice(0, 2000)),
    },
    observables: input.observables,
    artifacts: input.artifacts,
    cleanup: input.cleanup,
    collection: { errors: input.errors, redaction: 'APPLIED' },
  };
}
