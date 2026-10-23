'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  renderRequirementTemplate,
  renderTestCaseTemplate,
  renderSpecTemplate,
} = require('./template');
const {
  loadRequirements,
  loadTestCases,
  extractVerifiedHelperImports,
  extractTestCallbackBody,
  analyzeTestAssertions,
  findMissingAwaits,
  ASYNC_MATCHERS,
} = require('../qa/lib/sources');
const { gaps } = require('../qa/lib/commands');
const { parseCatalogMarkdown } = require('../qa/lib/learner');

test('TC-14-P4-01: renderRequirementTemplate sinh đủ Canonical Metadata, Coverage notes 4 chiều và 6 AC chuẩn', () => {
  const md = renderRequirementTemplate({
    reqId: 'REQ-010',
    slug: 'checkout',
    title: 'Thanh toán đơn hàng',
    pageExposure: 'Customer',
    uiCoverage: 'Required',
    xssApplicability: 'Applicable',
  });

  assert.match(md, /- \*\*Page exposure\*\*:\s*Customer/);
  assert.match(md, /- \*\*UI coverage\*\*:\s*Required/);
  assert.match(md, /- \*\*XSS applicability\*\*:\s*Applicable/);
  assert.match(md, /## Coverage notes/);
  assert.match(md, /\|\s*UI\/UX Geometry\s*\|\s*Required\s*\|/);
  assert.match(md, /\|\s*XSS Security\s*\|\s*Applicable\s*\|/);
  assert.match(md, /\|\s*Idempotency\s*\|\s*Required\s*\|/);
  assert.match(md, /\|\s*State Persistence\s*\|\s*Required\s*\|/);
  for (let i = 1; i <= 6; i++) {
    const acId = `AC-00${i}`;
    assert.match(md, new RegExp(`### ${acId}:`));
  }
});

test('TC-14-P4-02: renderTestCaseTemplate sinh đủ 6 TC với Capabilities chuẩn và bảng Traceability', () => {
  const md = renderTestCaseTemplate({
    reqId: 'REQ-010',
    slug: 'checkout',
    title: 'Thanh toán đơn hàng',
    specRelPath: 'playwright/tests/checkout/checkout.spec.ts',
  });

  assert.match(md, /## Traceability/);
  assert.match(md, /- \*\*Capabilities\*\*:\s*persistence/);
  assert.match(md, /- \*\*Capabilities\*\*:\s*boundary/);
  assert.match(md, /- \*\*Capabilities\*\*:\s*idempotency/);
  assert.match(md, /- \*\*Capabilities\*\*:\s*ui-geometry,\s*a11y/);
  assert.match(md, /- \*\*Capabilities\*\*:\s*responsive/);
  assert.match(md, /- \*\*Capabilities\*\*:\s*xss/);
  for (let i = 1; i <= 6; i++) {
    assert.match(md, new RegExp(`### TC-00${i}:`));
  }
});

test('TC-14-P4-03: renderSpecTemplate import đúng test-fixtures, ui-checks, deep-guards với chữ ký v1.2', () => {
  const ts = renderSpecTemplate({
    reqId: 'REQ-010',
    slug: 'checkout',
    title: 'Thanh toán đơn hàng',
  });

  assert.match(ts, /from '\.\.\/fixtures\/test-fixtures'/);
  assert.match(ts, /from '\.\.\/support\/ui-checks'/);
  assert.match(ts, /from '\.\.\/support\/deep-guards'/);
  assert.match(ts, /await expectStatePersistence\(page,/);
  assert.match(ts, /await expectBoundaryRejected\([\s\S]*?page,/);
  assert.match(ts, /await expectIdempotentSubmit\([\s\S]*?page,/);
  assert.match(ts, /await expectNoHorizontalScroll\(page\)/);
  assert.match(ts, /await expectNoTextOverflow\(mainRegion\)/);
  assert.match(ts, /await expectNotOccluded\(page\.getByRole\('button'\)\.first\(\)\)/);
  assert.match(ts, /await expectInteractiveA11y\(mainRegion\)/);
  assert.match(ts, /await expectResponsiveIntegrity\(page,\s*\{\s*requiredLocators:/);
  assert.match(ts, /optionalLocators:/);
  assert.match(ts, /await expectSafeXssRender\([\s\S]*?sinkLocator:/);
});

test('TC-14-P4-04: Bộ 3 file từ template tương thích hoàn toàn với loadRequirements, loadTestCases, analyzeTestAssertions và gaps(checkDeepCoverage)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-p4-template-'));
  try {
    const reqDir = path.join(tmpDir, 'requirements');
    const tcDir = path.join(tmpDir, 'test-cases');
    const specDir = path.join(tmpDir, 'playwright', 'tests', 'checkout');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcDir, { recursive: true });
    fs.mkdirSync(specDir, { recursive: true });

    const reqMd = renderRequirementTemplate({
      reqId: 'REQ-010',
      slug: 'checkout',
      title: 'Thanh toán đơn hàng',
      pageExposure: 'Public',
      uiCoverage: 'Required',
      xssApplicability: 'Applicable',
    });
    const tcMd = renderTestCaseTemplate({
      reqId: 'REQ-010',
      slug: 'checkout',
      title: 'Thanh toán đơn hàng',
      specRelPath: 'playwright/tests/checkout/checkout.spec.ts',
    }).replace(/\| Candidate \|/g, '| Yes |');
    const specTs = renderSpecTemplate({
      reqId: 'REQ-010',
      slug: 'checkout',
      title: 'Thanh toán đơn hàng',
    })
      .replace(/test\.fixme\(/g, 'test(')
      .replace(/'@wip',\s*/g, '');

    fs.writeFileSync(path.join(reqDir, 'REQ-010-checkout.md'), reqMd, 'utf8');
    fs.writeFileSync(path.join(tcDir, 'REQ-010-checkout.md'), tcMd, 'utf8');
    fs.writeFileSync(path.join(specDir, 'checkout.spec.ts'), specTs, 'utf8');

    const reqs = loadRequirements(tmpDir);
    const tcs = loadTestCases(tmpDir);
    const specLines = specTs.split(/\r?\n/);

    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].pageExposure, 'Public');
    assert.deepEqual(reqs[0].uiCoverage, { status: 'Required', reason: null });
    assert.deepEqual(reqs[0].xssApplicability, { status: 'Applicable', reason: null });
    assert.equal(reqs[0].coverageNotes.length, 4);
    assert.equal(tcs.details.length, 6);

    const testLineIndices = [];
    specLines.forEach((line, idx) => {
      if (/^\s*test\(/.test(line)) testLineIndices.push(idx + 1);
    });
    assert.equal(testLineIndices.length, 6);

    const verifiedHelpers = extractVerifiedHelperImports(specLines);
    const automatedTests = testLineIndices.map((startLine, idx) => {
      const extracted = extractTestCallbackBody(specLines, startLine);
      assert.equal(extracted.ok, true);
      const assertionProfile = analyzeTestAssertions(extracted.bodyText, {
        paramsText: extracted.paramsText,
        verifiedHelpers,
      });
      const missingAwaits = findMissingAwaits(
        specLines.slice(startLine - 1, extracted.endLine),
        startLine,
        ASYNC_MATCHERS,
        verifiedHelpers,
      );
      assert.equal(missingAwaits.length, 0);
      assert.equal(assertionProfile.weakExistenceOnly, false);
      assert.equal(assertionProfile.matchers.length > 0, true);
      const tcNum = String(idx + 1).padStart(3, '0');
      return {
        title: `TC-${tcNum} - AC-${tcNum} verify scenario ${idx + 1}`,
        tcId: `TC-${tcNum}`,
        acId: `AC-${tcNum}`,
        reqId: 'REQ-010',
        tags: ['REQ-010', 'p1'],
        file: 'playwright/tests/checkout/checkout.spec.ts',
        path: 'playwright/tests/checkout/checkout.spec.ts',
        isSetup: false,
        line: startLine,
        assertionCount: assertionProfile.matchers.length,
        assertionProfile,
        onlyNavigationAssert: assertionProfile.kind === 'navigation-only',
        isSkipped: false,
        missingAwaits,
      };
    });

    const report = gaps(tmpDir, {
      checkDeepCoverage: true,
      loadAutomated: () => ({ tests: automatedTests, error: null }),
    });
    const deepFindings = report.filter((f) =>
      [
        'missing-idempotency-guard',
        'missing-ui-coverage',
        'missing-xss-coverage',
        'weak-existence-assertion',
      ].includes(f.kind),
    );
    assert.equal(deepFindings.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('TC-14-P4-05: SKILL.md, copilot-instructions.md và reference catalogs chứa 5 chiều audit, bảng ánh xạ helper và staticRule metadata', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const skillMd = fs.readFileSync(
    path.join(repoRoot, '.agents/skills/qa-logic-gaps/SKILL.md'),
    'utf8',
  );
  const copilotMd = fs.readFileSync(
    path.join(repoRoot, '.github/copilot-instructions.md'),
    'utf8',
  );
  const heuristicsMd = fs.readFileSync(
    path.join(repoRoot, '.agents/skills/qa-logic-gaps/references/bug-hunting-heuristics.md'),
    'utf8',
  );
  const antipatternMd = fs.readFileSync(
    path.join(repoRoot, '.agents/skills/qa-logic-gaps/references/anti-pattern-catalog.md'),
    'utf8',
  );

  assert.match(skillMd, /expectNoHorizontalScroll/);
  assert.match(skillMd, /expectIdempotentSubmit/);
  assert.match(skillMd, /expectSafeXssRender/);
  assert.match(copilotMd, /Page exposure/);
  assert.match(copilotMd, /Capabilities/);
  assert.match(copilotMd, /expectResponsiveIntegrity/);

  const parsedDh = parseCatalogMarkdown(heuristicsMd, 'DH', 'bug-hunting-heuristics.md');
  const parsedPa = parseCatalogMarkdown(antipatternMd, 'PA', 'anti-pattern-catalog.md');
  assert.equal(parsedDh.length, 6);
  assert.equal(parsedPa.length, 4);
  assert.equal(parsedDh[0].metadata.staticRule, 'missing-idempotency-guard');
  assert.equal(parsedDh[4].metadata.staticRule, 'missing-xss-coverage');
  assert.equal(parsedPa[3].metadata.staticRule, 'weak-existence-assertion');
});
