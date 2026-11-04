import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FullConfig, Reporter, Suite } from '@playwright/test/reporter';
import { renderRunHealthMarkdown, summariseRunHealth, type RunHealthRow } from './run-health';

type Options = { outputFile?: string };

/**
 * Reporter ghi `run-health.json` (machine-readable) và, trên GitHub Actions, thêm bảng vào
 * job summary. Chạy được trong `playwright test` lẫn `playwright merge-reports`
 * (`--reporter=html,github,./tests/support/run-health-reporter.ts`). Không đổi exit code.
 */
export default class RunHealthReporter implements Reporter {
  private suite?: Suite;
  private readonly outputFile: string;

  constructor(options: Options = {}) {
    this.outputFile = options.outputFile ?? path.join('test-results', 'run-health.json');
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  onEnd(): void {
    const rows: RunHealthRow[] = (this.suite?.allTests() ?? []).map((test) => ({
      id: `[${test.parent.project()?.name || '-'}] ${test.titlePath().filter(Boolean).slice(1).join(' › ')}`,
      outcome: test.outcome(),
      attempts: test.results.length,
    }));
    const health = summariseRunHealth(rows);

    fs.mkdirSync(path.dirname(path.resolve(this.outputFile)), { recursive: true });
    fs.writeFileSync(this.outputFile, `${JSON.stringify(health, null, 2)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderRunHealthMarkdown(health));
    }
    const note = health.empty ? ' — NO TESTS EXECUTED' : '';
    console.log(
      `[run-health] first-attempt pass ${health.firstAttemptPass}, flaky ${health.flaky}, ` +
        `failed ${health.failed}, skipped ${health.skipped}${note} -> ${this.outputFile}`,
    );
  }
}
