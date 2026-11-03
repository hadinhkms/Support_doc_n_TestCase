import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Quét accessibility tự động (axe) cho PLAN-16 Phase 3. Report KHÔNG BAO GIỜ là WCAG conformance:
 * `conformanceClaim` cố định `NONE`, kèm checklist screen reader thủ công ở trạng thái NOT_RUN
 * cho tới khi có người chạy và ghi kết quả. 0 violation chỉ nghĩa là "axe không tìm thấy lỗi".
 */
export const SCAN_STATEMENT =
  'Automated scan only: covers a subset of WCAG success criteria and is NOT a WCAG conformance claim.';

export const SCREEN_READER_SCRIPT = [
  'Open the dialog from the keyboard: role "dialog" and its name are announced',
  'Tab through the dialog: every control has a spoken name and role; focus never leaves',
  'Press Escape: the dialog closes and focus is announced on the trigger again',
  'Submit the empty form: the error is announced once without moving the virtual cursor manually',
  'Navigate to the invalid field: "invalid entry" and the linked message are announced',
] as const;

export interface ManualCheck {
  step: string;
  status: 'NOT_RUN' | 'PASS' | 'FAIL';
  tester: string | null;
  assistiveTech: string | null;
}

export interface AutomatedScanReport {
  schemaVersion: 'a11y-scan/1';
  tool: string;
  tags: string[];
  url: string;
  violations: { id: string; impact: string | null; nodes: number; targets: string[] }[];
  incomplete: number;
  passes: number;
  conformanceClaim: 'NONE';
  statement: string;
  manualChecks: ManualCheck[];
}

export const DEFAULT_SCAN_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function runAutomatedScan(page: Page, options: { include?: string; tags?: string[] } = {}): Promise<AutomatedScanReport> {
  const tags = options.tags ?? DEFAULT_SCAN_TAGS;
  let builder = new AxeBuilder({ page }).withTags(tags);
  if (options.include) builder = builder.include(options.include);
  const res = await builder.analyze();
  return {
    schemaVersion: 'a11y-scan/1',
    tool: `axe-core@${res.testEngine.version}`,
    tags,
    url: res.url,
    violations: res.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    })),
    incomplete: res.incomplete.length,
    passes: res.passes.length,
    conformanceClaim: 'NONE',
    statement: SCAN_STATEMENT,
    manualChecks: SCREEN_READER_SCRIPT.map((step) => ({ step, status: 'NOT_RUN', tester: null, assistiveTech: null })),
  };
}

/** Bản text cho người đọc; dòng đầu luôn là statement, manual check chưa chạy hiện rõ NOT_RUN. */
export function formatScanReport(r: AutomatedScanReport): string {
  const lines = [
    r.statement,
    `Tool: ${r.tool} · tags: ${r.tags.join(', ')} · url: ${r.url}`,
    `Violations: ${r.violations.length} · incomplete (needs review): ${r.incomplete} · passes: ${r.passes}`,
    ...r.violations.map((v) => `- ${v.id} (${v.impact ?? 'n/a'}) x${v.nodes}: ${v.targets.join(' | ')}`),
    'Manual screen reader checks:',
    ...r.manualChecks.map((m) => `- [${m.status}] ${m.step}`),
  ];
  return lines.join('\n');
}

/** Chặn mọi report/text tự nhận conformance (vd "WCAG 2.1 AA compliant") từ kết quả quét tự động. */
export function conformanceClaimProblems(text: string): string[] {
  const claim = /\b(WCAG[\s\d.]*(A{1,3})?\s*(conformant|compliant|certified)|fully accessible|conforms to WCAG)\b/i;
  return claim.test(text) ? ['CONFORMANCE_OVERCLAIM: automated results must not be reported as WCAG conformance'] : [];
}
