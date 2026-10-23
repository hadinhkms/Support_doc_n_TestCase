import { test, expect } from '../tests/fixtures/test-fixtures';
import { expectNoHorizontalOverflow } from '../tests/support/ui-checks';

export interface FixtureContractEntry {
  name: 'page' | 'runtimeTrap' | 'apiClient' | 'authContext' | 'seedData';
  scope: 'test';
  auto: boolean;
  responsibility: string;
}

export const FIXTURE_OWNERSHIP_MATRIX: readonly FixtureContractEntry[] = [
  {
    name: 'page',
    scope: 'test',
    auto: false,
    responsibility: 'Playwright core browser tab isolated per test.',
  },
  {
    name: 'runtimeTrap',
    scope: 'test',
    auto: true,
    responsibility:
      'Auto-attached trap for pageerror, console.error, requestfailed, and HTTP >= 500 with event-queue flush and redaction.',
  },
  {
    name: 'apiClient',
    scope: 'test',
    auto: false,
    responsibility: 'On-demand HTTP API client separated from browser context.',
  },
  {
    name: 'authContext',
    scope: 'test',
    auto: false,
    responsibility: 'On-demand isolated multi-role authenticated context.',
  },
  {
    name: 'seedData',
    scope: 'test',
    auto: false,
    responsibility: 'On-demand test data seeding and reverse-order teardown cleanup.',
  },
];

export const CANONICAL_METADATA_PATTERNS = {
  pageExposure: /^-\s+\*\*Page exposure\*\*:\s+(Public|Authenticated)\s*$/m,
  uiCoverage: /^-\s+\*\*UI coverage\*\*:\s+(Required|Exempt\s+\(reason:\s+.+\))\s*$/m,
  xssApplicability:
    /^-\s+\*\*XSS applicability\*\*:\s+(Applicable|Not applicable\s+\(reason:\s+.+\))\s*$/m,
  coverageNotesHeading: /^##\s+Coverage notes\s*$/m,
  tcCapabilities: /^-\s+\*\*Capabilities\*\*:\s+[a-z0-9_,\s-]+\s*$/im,
} as const;

export interface HarnessMutationSpec {
  id: `HM-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  phase: 'P1' | 'P2' | 'P3';
  targetHelper: string;
  faultDescription: string;
  expectedFailureSignature: RegExp;
}

export const HM_MUTATION_CATALOG: readonly HarnessMutationSpec[] = [
  {
    id: 'HM-01',
    phase: 'P1',
    targetHelper: 'runtimeTrap',
    faultDescription: 'Unhandled Promise.reject and console.error flushed at teardown',
    expectedFailureSignature: /pageerror|console\.error/i,
  },
  {
    id: 'HM-02',
    phase: 'P1',
    targetHelper: 'runtimeTrap',
    faultDescription: 'HTTP 500 response with sensitive Authorization/token redacted',
    expectedFailureSignature: /http-5xx|500|\[REDACTED\]/i,
  },
  {
    id: 'HM-03',
    phase: 'P2',
    targetHelper: 'expectNoTextOverflow',
    faultDescription: 'Delayed horizontal text clipping (scrollWidth > clientWidth)',
    expectedFailureSignature: /overflow|scrollWidth/i,
  },
  {
    id: 'HM-04',
    phase: 'P2',
    targetHelper: 'expectPairwiseNoOverlap / expectNotOccluded',
    faultDescription: 'Sibling button overlap and sticky header / ancestor clip occlusion',
    expectedFailureSignature: /overlap|occlud|clip|đè/i,
  },
  {
    id: 'HM-05',
    phase: 'P2',
    targetHelper: 'expectResponsiveIntegrity / expectInteractiveA11y',
    faultDescription: '900px table overflowing 320px viewport and unlabeled icon button',
    expectedFailureSignature: /scrollWidth|accessible|label|tràn/i,
  },
  {
    id: 'HM-06',
    phase: 'P3',
    targetHelper: 'expectIdempotentSubmit',
    faultDescription: 'Unprotected double-click firing 2 duplicate POST mutation requests',
    expectedFailureSignature: /mutation|idempotent|2/i,
  },
  {
    id: 'HM-07',
    phase: 'P3',
    targetHelper: 'expectSafeXssRender',
    faultDescription: 'Unsanitized XSS payload triggering sentinel or dangerous DOM node',
    expectedFailureSignature: /xss|dangerous|sentinel/i,
  },
  {
    id: 'HM-08',
    phase: 'P3',
    targetHelper: 'expectStatePersistence',
    faultDescription: 'Optimistic UI state lost after page.reload()',
    expectedFailureSignature: /reload|persist/i,
  },
];

test.describe('Phase 0 - Foundational Contracts & Harness Matrix', () => {
  test('HM-00 - TC-14-P0-01 verify fixture ownership matrix enforces single auto-fixture invariant', async () => {
    const autoFixtures = FIXTURE_OWNERSHIP_MATRIX.filter((f) => f.auto);
    expect(autoFixtures).toHaveLength(1);
    expect(autoFixtures[0]?.name).toBe('runtimeTrap');
    expect(FIXTURE_OWNERSHIP_MATRIX.every((f) => f.scope === 'test')).toBe(true);
  });

  test('HM-00 - TC-14-P0-02 verify standalone harness executes setContent and route without external server', async ({
    page,
  }) => {
    await page.route('https://harness.local/api/ping', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.setContent(`
      <main>
        <h1>Deep Engine Harness</h1>
        <button type="button" data-testid="ping-btn">Ping</button>
      </main>
    `);

    await expect(page.getByRole('heading', { name: 'Deep Engine Harness' })).toBeVisible();
    await expect(page.getByTestId('ping-btn')).toBeEnabled();
  });

  test('HM-00 - TC-14-P0-03 verify custom expect* helper calls satisfy eslint expect-expect contract', async ({
    page,
  }) => {
    await page.setContent(`
      <div style="width: 300px; max-width: 100%;">
        <p>Clean layout within viewport</p>
      </div>
    `);

    await expectNoHorizontalOverflow(page);
  });

  test('HM-00 - TC-14-P0-04 verify canonical requirement and test-case metadata schema patterns', async () => {
    const sampleRequirement = [
      '# REQ-200: Checkout Flow',
      '- **Page exposure**: Authenticated',
      '- **UI coverage**: Required',
      '- **XSS applicability**: Applicable',
      '',
      '## Coverage notes',
      '| Aspect | Status | Notes |',
      '|---|---|---|',
      '| Negative / boundary | Covered | Tested via TC-200-02 |',
      '| UI / UX | Covered | Tested via TC-200-04 |',
      '| Security / XSS | Covered | Tested via TC-200-06 |',
      '| Performance | Covered | Tested via TC-200-05 |',
    ].join('\n');

    const sampleExemptRequirement = [
      '- **Page exposure**: Public',
      '- **UI coverage**: Exempt (reason: headless webhook endpoint)',
      '- **XSS applicability**: Not applicable (reason: numeric-only payload)',
    ].join('\n');

    const sampleTestCase = '- **Capabilities**: overflow, overlap, occlusion, a11y, responsive';

    expect(CANONICAL_METADATA_PATTERNS.pageExposure.test(sampleRequirement)).toBe(true);
    expect(CANONICAL_METADATA_PATTERNS.uiCoverage.test(sampleRequirement)).toBe(true);
    expect(CANONICAL_METADATA_PATTERNS.xssApplicability.test(sampleRequirement)).toBe(true);
    expect(CANONICAL_METADATA_PATTERNS.coverageNotesHeading.test(sampleRequirement)).toBe(true);
    expect(CANONICAL_METADATA_PATTERNS.uiCoverage.test(sampleExemptRequirement)).toBe(true);
    expect(CANONICAL_METADATA_PATTERNS.xssApplicability.test(sampleExemptRequirement)).toBe(true);
    expect(CANONICAL_METADATA_PATTERNS.tcCapabilities.test(sampleTestCase)).toBe(true);
  });

  test('HM-00 - TC-14-P0-05 verify HM-01..HM-08 mutation catalog completeness and phase mapping', async () => {
    expect(HM_MUTATION_CATALOG.map((item) => item.id)).toEqual([
      'HM-01',
      'HM-02',
      'HM-03',
      'HM-04',
      'HM-05',
      'HM-06',
      'HM-07',
      'HM-08',
    ]);
    expect(HM_MUTATION_CATALOG.filter((m) => m.phase === 'P1')).toHaveLength(2);
    expect(HM_MUTATION_CATALOG.filter((m) => m.phase === 'P2')).toHaveLength(3);
    expect(HM_MUTATION_CATALOG.filter((m) => m.phase === 'P3')).toHaveLength(3);
  });
});
