import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { sha256 } from './evidence-integrity';
import {
  RECEIPT_FILE,
  RECEIPT_SCHEMA_VERSION,
  checkIndexedEvidence,
  decideVerdict,
  runLevelProblems,
  type AttemptIndexEntry,
  type RunReceipt,
} from './evidence-receipt';
import { classifySensitivity, findSecretsInBytes, knownSecretValues } from './evidence-redaction';
import { readRunContext, runRootFor, shardLabel, type RunContext } from './evidence-run';

/**
 * Reporter ghi `run-receipt.json` + bản sao JUnit vào run root sau khi MỌI reporter
 * đã xong `onEnd` (dùng `onExit`), để JUnit đã tồn tại khi hash.
 * Dùng trong config: `['./tests/support/evidence-reporter.ts', { junitFile: '...' }]`.
 */
export const MANIFEST_ATTACHMENT = 'evidence-manifest';
export const COLLECTION_ERROR_ATTACHMENT = 'evidence-collection-errors';

type Options = { junitFile?: string };
const EXIT_CODE: Record<string, number> = { passed: 0, failed: 1, timedout: 1, interrupted: 130 };

export default class EvidenceReporter implements Reporter {
  private config?: FullConfig;
  private suite?: Suite;
  private result?: FullResult;
  private ctx?: RunContext;
  private readonly attempts: AttemptIndexEntry[] = [];

  constructor(private readonly options: Options = {}) {}

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    this.ctx = readRunContext(path.dirname(config.configFile ?? process.cwd()));
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.ctx || !this.config) return;
    // Fixture gửi { path (tương đối run root), sha256 } qua body; hash được giữ nguyên
    // để checkIndexedEvidence phát hiện manifest bị sửa sau khi attempt kết thúc.
    const manifest = result.attachments.find((a) => a.name === MANIFEST_ATTACHMENT && a.body);
    const collectionError = result.attachments.some((a) => a.name === COLLECTION_ERROR_ATTACHMENT);
    let indexed: AttemptIndexEntry['manifest'] = null;
    try {
      const claim = manifest?.body ? JSON.parse(manifest.body.toString('utf8')) : null;
      if (typeof claim?.path === 'string' && typeof claim?.sha256 === 'string') {
        indexed = { path: claim.path, sha256: claim.sha256 };
      }
    } catch {
      indexed = null;
    }
    this.attempts.push({
      testId: test.id,
      title: test.title,
      file: path.relative(this.config.rootDir, test.location.file).split(path.sep).join('/'),
      project: test.parent.project()?.name || 'default',
      retryIndex: result.retry,
      repeatIndex: test.repeatEachIndex,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      status: result.status,
      evidence: collectionError || (manifest && !indexed) ? 'COLLECTION_ERROR' : indexed ? 'COLLECTED' : 'NOT_COLLECTED',
      manifest: indexed,
    });
  }

  onEnd(result: FullResult): void {
    this.result = result;
  }

  private copyJunit(runRoot: string): RunReceipt['junit'] {
    if (!this.options.junitFile || !this.config) return null;
    const source = path.resolve(path.dirname(this.config.configFile ?? process.cwd()), this.options.junitFile);
    if (!fs.existsSync(source)) return null;
    const target = path.join(runRoot, 'junit.xml');
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    const bytes = fs.readFileSync(target);
    const leakedSecrets = findSecretsInBytes(bytes, knownSecretValues()).length;
    const sensitivity = classifySensitivity({ mime: 'application/xml', leakedSecrets });
    return { path: 'junit.xml', sha256: sha256(bytes), bytes: bytes.length, sensitivity };
  }

  async onExit(): Promise<void> {
    if (!this.ctx || !this.config || !this.suite || !this.result) return;
    const runRoot = runRootFor(this.ctx, this.config.shard);
    fs.mkdirSync(runRoot, { recursive: true });
    const tests = this.suite.allTests();
    const outcomes = tests.map((t) => t.outcome());
    const count = (o: string) => outcomes.filter((x) => x === o).length;
    const counts: RunReceipt['counts'] = {
      matched: tests.length,
      executed: count('expected') + count('unexpected') + count('flaky'),
      notRun: tests.filter((t) => t.results.length === 0).length,
      expected: count('expected'),
      unexpected: count('unexpected'),
      flaky: count('flaky'),
      skipped: count('skipped'),
      interrupted: this.attempts.filter((a) => a.status === 'interrupted').length,
      attempts: this.attempts.length,
    };
    let junit: RunReceipt['junit'] = null;
    try {
      junit = this.copyJunit(runRoot);
    } catch (err) {
      process.stderr.write(`[evidence] JUnit copy failed: ${(err as Error).message}\n`);
    }
    const source = this.ctx.source;
    const base = { runId: this.ctx.runId, source, attempts: this.attempts };
    const indexed = checkIndexedEvidence(runRoot, base);
    const problems = [
      ...runLevelProblems(this.result.status, counts),
      ...(junit ? [] : ['JUNIT_MISSING']),
      ...indexed.problems,
    ];
    const finishedAt = new Date().toISOString();
    const receipt: RunReceipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      ...base,
      shard: shardLabel(this.config.shard),
      trust: source.dirty === false && source.qaRevision ? 'TRUSTED_CANDIDATE' : 'INVESTIGATION_ONLY',
      execution: {
        argv: this.ctx.argv,
        recordedEnv: this.ctx.recordedEnv ?? {},
        cwd: this.ctx.cwd,
        startedAt: this.ctx.startedAt,
        finishedAt,
        durationMs: Math.round(this.result.duration),
        runnerStatus: this.result.status,
        exitCode: EXIT_CODE[this.result.status] ?? 1,
        exitCodeSource: 'derived-from-runner-status',
      },
      environment: { os: `${process.platform} ${os.release()}`, node: process.version, playwright: this.config.version },
      counts,
      junit,
      // Cleanup fail độc lập outcome test và verdict evidence, nhưng phải thấy được ở cấp run.
      cleanup: { failures: indexed.cleanupFailures },
      verdict: { evidence: decideVerdict(counts, problems), problems },
    };
    const receiptPath = path.join(runRoot, RECEIPT_FILE);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { flag: 'wx' });
    process.stdout.write(`[evidence] ${receiptPath} verdict=${receipt.verdict.evidence}\n`);
  }
}
