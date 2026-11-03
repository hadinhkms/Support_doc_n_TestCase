import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RECEIPT_FILE, type RunReceipt } from '../tests/support/evidence-receipt';
import type { EvidenceManifest } from '../tests/support/evidence-manifest';

/**
 * Harness cho evidence-pipeline.spec.ts: dựng một Playwright run THẬT (process con)
 * với config + spec sinh tạm, đi qua public caller là fixture `evidence` + evidence-reporter.
 * Không cần browser/app: spec con không dùng `page`.
 */
const PW_ROOT = path.resolve(__dirname, '..');
const posix = (p: string) => p.split(path.sep).join('/');
const FIXTURE = posix(path.join(PW_ROOT, 'tests/fixtures/evidence.fixture'));
const RUN = posix(path.join(PW_ROOT, 'tests/support/evidence-run'));
const REPORTER = posix(path.join(PW_ROOT, 'tests/support/evidence-reporter.ts'));
const CLI = require.resolve('@playwright/test/cli');

export interface NestedRun {
  dir: string;
  runRoot: string;
  exitCode: number | null;
  output: string;
  receipt: RunReceipt | null;
}

export const SPEC_HEADER = `import { evidenceTest as test } from '${FIXTURE}';\nimport { expect } from '@playwright/test';\n`;

export function newCanary(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString('hex')}`;
}

/** Tạo thư mục run tạm (trong test-results, đã gitignore) với config + các spec con. */
export function prepareNestedRun(label: string, specs: Record<string, string>): string {
  const dir = path.join(PW_ROOT, 'test-results', 'evidence-pipeline', `${label}-${randomBytes(4).toString('hex')}`);
  fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
  const config = [
    "import { defineConfig } from '@playwright/test';",
    `import { initEvidenceRun } from '${RUN}';`,
    'initEvidenceRun(__dirname);',
    'export default defineConfig({',
    "  testDir: './specs', outputDir: './out', retries: 0, timeout: 20_000,",
    `  reporter: [['junit', { outputFile: 'junit.xml' }], ['${REPORTER}', { junitFile: 'junit.xml' }]],`,
    '});',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'nested.config.ts'), config);
  for (const [name, body] of Object.entries(specs)) {
    fs.writeFileSync(path.join(dir, 'specs', name), SPEC_HEADER + body);
  }
  return dir;
}

/** Env sạch: bỏ context evidence + chỉ số worker của run cha để run con tự chốt identity. */
function childEnv(dir: string, runId: string, extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(EVIDENCE_|PW_|TEST_WORKER_INDEX|TEST_PARALLEL_INDEX|FORCE_COLOR)/.test(key)) continue;
    env[key] = value;
  }
  return { ...env, ...extra, EVIDENCE_ROOT: path.join(dir, 'evidence'), EVIDENCE_RUN_ID: runId };
}

export function runNested(dir: string, args: string[], extraEnv: Record<string, string> = {}): NestedRun {
  const runId = `nested-${path.basename(dir)}`;
  const result = spawnSync(process.execPath, [CLI, 'test', '-c', 'nested.config.ts', ...args], {
    cwd: dir,
    env: childEnv(dir, runId, extraEnv),
    encoding: 'utf8',
    timeout: 90_000,
  });
  const runRoot = path.join(dir, 'evidence', runId, 'unsharded');
  const receiptPath = path.join(runRoot, RECEIPT_FILE);
  const receipt = fs.existsSync(receiptPath)
    ? (JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as RunReceipt)
    : null;
  const output = `${result.error ? `SPAWN_ERROR: ${result.error.message}\n` : ''}${result.stdout}\n${result.stderr}`;
  return { dir, runRoot, exitCode: result.status, output, receipt };
}

export function readManifests(run: NestedRun): EvidenceManifest[] {
  return (run.receipt?.attempts ?? [])
    .filter((a) => a.manifest)
    .map((a) => JSON.parse(fs.readFileSync(path.join(run.runRoot, a.manifest!.path), 'utf8')));
}

/** Liệt kê mọi file trong run root (dạng path tương đối POSIX). */
export function listFiles(root: string): string[] {
  return (fs.readdirSync(root, { recursive: true, withFileTypes: true }) as fs.Dirent[])
    .filter((d) => d.isFile())
    .map((d) => posix(path.relative(root, path.join(d.parentPath ?? d.path, d.name))));
}

/** Bản sao độc lập của bundle để tamper mà không đụng evidence gốc. */
export function cloneBundle(run: NestedRun, label: string): string {
  const target = path.join(run.dir, `clone-${label}`);
  fs.cpSync(run.runRoot, target, { recursive: true });
  return target;
}

export function gitHead(): string {
  const out = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: PW_ROOT, encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`git rev-parse failed: ${out.error?.message ?? out.stderr}`);
  return out.stdout.trim();
}
