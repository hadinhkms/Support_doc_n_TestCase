import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RECEIPT_FILE } from '../tests/support/evidence-receipt';
import { verifyEvidenceBundle } from '../tests/support/evidence-verify';

/**
 * Download drill (evidence-contract §5, PLAN-16 T1.4): chạy trên runner/checkout MỚI sau khi
 * tải artifact evidence của job khác về `EVIDENCE_DRILL_ROOT`. Chỉ đăng ký khi biến được set
 * (job `evidence-drill` trong CI); thiếu bundle → không tìm thấy test → Playwright exit ≠ 0.
 */
const drillRoot = process.env.EVIDENCE_DRILL_ROOT;
const expectedRevision = process.env.EVIDENCE_EXPECTED_REVISION;
const requireTrusted = process.env.EVIDENCE_REQUIRE_TRUSTED === '1';

function findReceiptRoots(root: string): string[] {
  return (fs.readdirSync(root, { recursive: true }) as string[])
    .filter((rel) => path.basename(rel) === RECEIPT_FILE)
    .map((rel) => path.dirname(path.join(root, rel)));
}

if (drillRoot) {
  test.describe('@REQ-16-P1 Evidence download drill (TC-16-P1-3)', () => {
    test('HM-10 - TC-16-P1-3 - AC-16-P1-3: downloaded bundle exists, hashes match and revision is current', () => {
      expect(fs.existsSync(drillRoot), `drill root ${drillRoot} missing`).toBe(true);
      const roots = findReceiptRoots(drillRoot);
      expect(roots.length, 'no run-receipt.json in downloaded bundle').toBeGreaterThan(0);
      for (const root of roots) {
        const result = verifyEvidenceBundle(root, { expectedRevision, requireTrusted });
        expect(result.problems, root).toEqual([]);
        expect(result.receipt?.counts.executed, root).toBeGreaterThan(0);
        expect(result.ok, root).toBe(true);
      }
    });
  });
}
