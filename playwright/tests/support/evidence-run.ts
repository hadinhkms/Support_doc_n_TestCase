import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sha256 } from './evidence-integrity';
import { safeSegment } from './evidence-manifest';
import { knownSecretValues, redactArgv, redactText } from './evidence-redaction';

/**
 * Run context dùng chung cho runner + mọi worker. Được tính MỘT lần trong process runner
 * (lúc load config) rồi truyền qua env `EVIDENCE_RUN_CONTEXT`, nên mọi worker/attempt
 * cùng run nhìn thấy cùng runId, command và source identity.
 * Git chỉ được gọi với argument cố định — không thực thi gì đọc từ manifest.
 */
export interface SourceIdentity {
  qaRevision: string | null;
  dirty: boolean | null;
  diffDigest: string | null;
  untrackedDigest: string | null;
  appBuild: string | null;
  appRevision: string | null;
  errors: string[];
}

export interface RunContext {
  runId: string;
  root: string;
  argv: string[];
  cwd: string;
  startedAt: string;
  source: SourceIdentity;
  /** Env input cần để replay (tên khai qua `EVIDENCE_RECORD_ENV`), giá trị đã redact; tên secret bị bỏ. */
  recordedEnv?: Record<string, string>;
}

const CONTEXT_ENV = 'EVIDENCE_RUN_CONTEXT';
const SECRET_NAME = /(PASSWORD|PASSWD|TOKEN|SECRET|API_?KEY|PRIVATE|OTP|COOKIE|CREDENTIAL|SESSION)/i;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(cwd: string, args: string[]): Buffer {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: GIT_MAX_BUFFER });
}

/** QA revision + dirty identity: SHA đơn lẻ không mô tả được working tree bẩn. */
export function readSourceIdentity(cwd: string, env: NodeJS.ProcessEnv = process.env): SourceIdentity {
  const id: SourceIdentity = {
    qaRevision: null,
    dirty: null,
    diffDigest: null,
    untrackedDigest: null,
    appBuild: env.APP_BUILD_ID || null,
    appRevision: env.APP_REVISION || null,
    errors: [],
  };
  try {
    id.qaRevision = git(cwd, ['rev-parse', 'HEAD']).toString('utf8').trim();
    const status = git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
      .toString('utf8')
      .split('\0')
      .filter(Boolean);
    id.dirty = status.length > 0;
    if (id.dirty) {
      id.diffDigest = sha256(git(cwd, ['diff', 'HEAD', '--binary']));
      const top = git(cwd, ['rev-parse', '--show-toplevel']).toString('utf8').trim();
      const untracked = status
        .filter((line) => line.startsWith('?? '))
        .map((line) => line.slice(3))
        .sort()
        .map((rel) => `${rel}:${sha256(fs.readFileSync(path.join(top, rel)))}`);
      id.untrackedDigest = sha256(untracked.join('\n'));
    }
  } catch (err) {
    id.errors.push(`GIT_IDENTITY_UNAVAILABLE: ${redactText((err as Error).message).slice(0, 300)}`);
  }
  return id;
}

function recordEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const secrets = knownSecretValues(env);
  const names = (env.EVIDENCE_RECORD_ENV ?? '').split(',').map((n) => n.trim()).filter((n) => /^[A-Z][A-Z0-9_]*$/.test(n));
  const out: Record<string, string> = {};
  for (const name of names) {
    if (env[name] !== undefined && !SECRET_NAME.test(name)) out[name] = redactText(env[name] as string, secrets);
  }
  return out;
}

function defaultRunId(env: NodeJS.ProcessEnv): string {
  if (env.GITHUB_RUN_ID) return `gh-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT ?? '1'}`;
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '-').slice(0, 15);
  return `local-${stamp}-${process.pid}`;
}

/**
 * Gọi ở đầu file config. Idempotent: process worker kế thừa env của runner nên không tính lại.
 * `EVIDENCE_ROOT` / `EVIDENCE_RUN_ID` từ shell/CI luôn thắng giá trị mặc định.
 */
export function initEvidenceRun(configDir: string, env: NodeJS.ProcessEnv = process.env): RunContext {
  const existing = env[CONTEXT_ENV];
  if (existing) return JSON.parse(existing) as RunContext;
  const ctx: RunContext = {
    runId: env.EVIDENCE_RUN_ID || defaultRunId(env),
    root: path.resolve(configDir, env.EVIDENCE_ROOT || 'test-results/evidence'),
    argv: redactArgv(['playwright', ...process.argv.slice(2)], knownSecretValues(env)),
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
    source: readSourceIdentity(configDir, env),
    recordedEnv: recordEnv(env),
  };
  env[CONTEXT_ENV] = JSON.stringify(ctx);
  return ctx;
}

/** Worker đọc context; config chưa gọi `initEvidenceRun` thì ghi nhận lỗi thay vì đoán command. */
export function readRunContext(fallbackDir: string, env: NodeJS.ProcessEnv = process.env): RunContext {
  if (env[CONTEXT_ENV]) return JSON.parse(env[CONTEXT_ENV] as string) as RunContext;
  const ctx = initEvidenceRun(fallbackDir, env);
  ctx.argv = [];
  ctx.source.errors.push('RUN_CONTEXT_NOT_INITIALISED: config did not call initEvidenceRun()');
  env[CONTEXT_ENV] = JSON.stringify(ctx);
  return ctx;
}

export function shardLabel(shard: { current: number; total: number } | null | undefined): string {
  return shard ? `shard-${shard.current}-of-${shard.total}` : 'unsharded';
}

/** Run root = `<root>/<runId>/<shard>` — shard khác nhau của cùng run không ghi đè nhau. */
export function runRootFor(ctx: RunContext, shard: { current: number; total: number } | null): string {
  return path.join(ctx.root, safeSegment(ctx.runId, 80), shardLabel(shard));
}
