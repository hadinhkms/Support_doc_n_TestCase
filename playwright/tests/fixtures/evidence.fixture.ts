import { test as base, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createEvidenceCollector,
  type CollectorIdentity,
  type EvidenceCollector,
} from '../support/evidence-collector';
import { sha256 } from '../support/evidence-integrity';
import { COLLECTION_ERROR_ATTACHMENT, MANIFEST_ATTACHMENT } from '../support/evidence-reporter';
import { readRunContext } from '../support/evidence-run';

/**
 * Fixture `evidence` (opt-in, không auto): mỗi attempt một collector riêng theo
 * run/shard/project/test/retry/repeat. Teardown luôn finalize manifest — kể cả khi test
 * fail — và giữ nguyên lỗi gốc. `evidenceStrict` (mặc định true) biến evidence thiếu
 * của một test đang PASS thành fail, để không có "PASS đủ bằng chứng" giả.
 */
export type EvidenceFixtures = {
  evidence: EvidenceCollector;
  evidenceStrict: boolean;
};

function configHash(testInfo: TestInfo): string | null {
  const file = testInfo.config.configFile;
  return file && fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
}

export function identityFromTestInfo(testInfo: TestInfo): CollectorIdentity {
  const use = testInfo.project.use;
  const viewport = use.viewport ? `${use.viewport.width}x${use.viewport.height}` : null;
  return {
    testId: testInfo.testId,
    title: testInfo.titlePath.slice(1).join(' > '),
    file: path.relative(testInfo.config.rootDir, testInfo.file).split(path.sep).join('/'),
    // Config không khai `projects` sinh project tên rỗng; dùng 'default' để identity không trống.
    project: testInfo.project.name || 'default',
    retryIndex: testInfo.retry,
    repeatIndex: testInfo.repeatEachIndex,
    workerIndex: testInfo.workerIndex,
    parallelIndex: testInfo.parallelIndex,
    shard: testInfo.config.shard,
    tags: testInfo.tags,
    environment: {
      os: `${process.platform} ${os.release()}`,
      node: process.version,
      playwright: testInfo.config.version,
      browser: use.browserName ?? use.defaultBrowserType ?? null,
      locale: use.locale ?? null,
      timezone: use.timezoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      viewport,
      configHash: configHash(testInfo),
    },
  };
}

export const evidenceTest = base.extend<EvidenceFixtures>({
  evidenceStrict: [true, { option: true }],

  evidence: async ({ evidenceStrict }, use, testInfo) => {
    const configDir = path.dirname(testInfo.config.configFile ?? process.cwd());
    const collector = createEvidenceCollector(readRunContext(configDir), identityFromTestInfo(testInfo));
    await use(collector);

    const result = collector.finalize({
      status: testInfo.status ?? 'failed',
      expectedStatus: testInfo.expectedStatus,
      errors: testInfo.errors.map((e) => e.message ?? e.value ?? 'unknown error'),
    });
    if (result.manifestPath && result.manifestSha256) {
      const rel = path.relative(collector.runRoot, result.manifestPath).split(path.sep).join('/');
      await testInfo.attach(MANIFEST_ATTACHMENT, {
        body: JSON.stringify({ path: rel, sha256: result.manifestSha256 }),
        contentType: 'application/json',
      });
    }
    if (collector.errors.length > 0) {
      await testInfo.attach(COLLECTION_ERROR_ATTACHMENT, {
        body: JSON.stringify(collector.errors, null, 2),
        contentType: 'application/json',
      });
      // Test đã fail thì giữ lỗi gốc; chỉ chặn trường hợp PASS mà evidence không trọn vẹn.
      if (evidenceStrict && testInfo.status === testInfo.expectedStatus) {
        const stages = collector.errors.map((e) => `${e.stage}:${e.target}`).join(', ');
        throw new Error(`EVIDENCE_INCOMPLETE: ${collector.errors.length} collection error(s) [${stages}]`);
      }
    }
  },
});
