'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkCodeLimits } = require('./lib/code-limits');
const { determineAutomationRole } = require('./lib/code-limits-policy');
const { runCli } = require('./limits');

function makeTmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-code-limits-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return dir;
}

function makeLines(count, lineText = 'const stepValue = 1;') {
  return Array.from({ length: count }, (_, idx) => `${lineText} // L${idx + 1}`).join('\n') + '\n';
}

test('determineAutomationRole: phân loại đúng spec (800) vs hạ tầng trong tests/ (module 250) vs utils/service ngoài tests/', () => {
  assert.equal(determineAutomationRole('playwright/tests/auth/login.spec.ts'), 'test');
  assert.equal(determineAutomationRole('playwright/tests/pages/login.page.ts'), 'module');
  assert.equal(determineAutomationRole('playwright/tests/fixtures/base.fixture.ts'), 'module');
  assert.equal(determineAutomationRole('playwright/tests/support/ui-checks.ts'), 'module');
  assert.equal(determineAutomationRole('playwright/tests/api/api-client.ts'), 'module');
  assert.equal(determineAutomationRole('playwright/tests/auth.setup.ts'), 'module');
  assert.equal(determineAutomationRole('playwright/helpers/format.helper.ts'), 'utils');
  assert.equal(determineAutomationRole('playwright/services/user.api.ts'), 'service');
  assert.equal(determineAutomationRole('playwright/components/Badge.tsx'), 'component');
});

test('checkCodeLimits: repo sạch dưới ngưỡng 80% trả về 0 finding và exit 0 ở --strict', () => {
  const dir = makeTmpRepo({
    'playwright/tests/auth/login.spec.ts': makeLines(300),
    'playwright/tests/pages/login.page.ts': makeLines(120),
  });
  try {
    const res = checkCodeLimits(dir);
    assert.equal(res.scannedCount, 2);
    assert.equal(res.findings.length, 0);
    assert.equal(runCli(['--strict'], dir), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkCodeLimits: bắt đúng vượt trần cứng cho spec (>800), POM trong tests/ (>250 kể cả có regex.test), service (>200), utils (>150)', () => {
  const dir = makeTmpRepo({
    'playwright/tests/auth/giant.spec.ts': makeLines(801),
    'playwright/tests/pages/checkout.page.ts': `${makeLines(250)}const ok = /abc/.test('abc');\n`,
    'playwright/services/billing.api.ts': makeLines(201),
    'playwright/helpers/string.helper.ts': makeLines(151),
  });
  try {
    const res = checkCodeLimits(dir);
    const byPath = new Map(res.findings.map((f) => [f.where, f]));
    assert.equal(byPath.get('playwright/tests/auth/giant.spec.ts')?.kind, 'vuot-tran-so-dong');
    assert.equal(byPath.get('playwright/tests/pages/checkout.page.ts')?.kind, 'vuot-tran-so-dong');
    assert.match(byPath.get('playwright/tests/pages/checkout.page.ts')?.message || '', /role "module"/);
    assert.equal(byPath.get('playwright/services/billing.api.ts')?.kind, 'vuot-tran-so-dong');
    assert.equal(byPath.get('playwright/helpers/string.helper.ts')?.kind, 'vuot-tran-so-dong');
    assert.equal(runCli(['--strict'], dir), 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkCodeLimits: vùng vàng >= 80% phân biệt file chưa chạm (minor), sửa nhỏ <=10 dòng (minor) và thêm logic/test mới (major chặn --strict)', () => {
  const dir = makeTmpRepo({
    'playwright/tests/pages/untouched.page.ts': makeLines(210),
    'playwright/tests/pages/minor-edit.page.ts': makeLines(210),
    'playwright/tests/pages/added-fn.page.ts': makeLines(205),
    'playwright/tests/auth/added-tc.spec.ts': makeLines(645),
  });
  try {
    const res = checkCodeLimits(dir, {
      diffByFile: {
        'playwright/tests/pages/minor-edit.page.ts': [
          '+// chỉ sửa 2 dòng hằng số, không thêm hàm mới',
          '+const timeoutMs = 3000;',
          '+const label = "Submit";',
        ].join('\n'),
        'playwright/tests/pages/added-fn.page.ts': '+export async function submitOrder() { return true; }\n',
        'playwright/tests/auth/added-tc.spec.ts': "+test('TC-099 - AC-001 new case', async () => {});\n",
      },
    });
    const byPath = new Map(res.findings.map((f) => [f.where, f]));
    assert.equal(byPath.get('playwright/tests/pages/untouched.page.ts')?.kind, 'cham-vung-vang-80');
    assert.equal(byPath.get('playwright/tests/pages/untouched.page.ts')?.severity, 'minor');
    assert.equal(byPath.get('playwright/tests/pages/minor-edit.page.ts')?.kind, 'cham-vung-vang-80');
    assert.equal(byPath.get('playwright/tests/pages/added-fn.page.ts')?.kind, 'vuot-vung-vang-80-them-logic');
    assert.equal(byPath.get('playwright/tests/pages/added-fn.page.ts')?.severity, 'major');
    assert.equal(byPath.get('playwright/tests/auth/added-tc.spec.ts')?.kind, 'vuot-vung-vang-80-them-logic');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkCodeLimits: bắt dòng đơn >500 ký tự, mật độ dòng trung bình >100 (>=50 dòng) và file nháp *.ai-test.*', () => {
  const denseLines = Array.from({ length: 55 }, (_, i) => `const x${i} = "${'a'.repeat(105)}";`).join('\n');
  const dir = makeTmpRepo({
    'playwright/tests/data/long-line.ts': `export const huge = "${'x'.repeat(505)}";\n`,
    'playwright/tests/data/dense-pack.ts': denseLines,
    'playwright/tests/auth/probe.ai-test.spec.ts': 'test("probe", async () => {});\n',
  });
  try {
    const res = checkCodeLimits(dir);
    const kinds = new Set(res.findings.map((f) => `${f.where}:${f.kind}`));
    assert.equal(kinds.has('playwright/tests/data/long-line.ts:dong-qua-dai'), true);
    assert.equal(kinds.has('playwright/tests/data/dense-pack.ts:mat-do-dong-qua-day'), true);
    assert.equal(kinds.has('playwright/tests/auth/probe.ai-test.spec.ts:file-rac-khong-duoc-commit'), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkCodeLimits: tôn trọng .size-exemptions.json đúng sha256 và vô hiệu khi nội dung file đã bị sửa', () => {
  const contentValid = makeLines(270);
  const shaValid = crypto.createHash('sha256').update(Buffer.from(contentValid, 'utf8')).digest('hex');
  const dir = makeTmpRepo({
    'playwright/tests/pages/legacy-ok.page.ts': contentValid,
    'playwright/tests/pages/legacy-tampered.page.ts': `${contentValid}// edited\n`,
    '.size-exemptions.json': JSON.stringify({
      exemptions: [
        {
          path: 'playwright/tests/pages/legacy-ok.page.ts',
          sha256: shaValid,
          maxLines: 300,
          reason: 'Legacy page pending split',
          expires: '2028-12-31',
        },
        {
          path: 'playwright/tests/pages/legacy-tampered.page.ts',
          sha256: shaValid,
          maxLines: 300,
          reason: 'Hash mismatch after edit',
          expires: '2028-12-31',
        },
      ],
    }),
  });
  try {
    const res = checkCodeLimits(dir, { todayIso: '2026-10-29' });
    assert.equal(res.exemptedCount, 1);
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].where, 'playwright/tests/pages/legacy-tampered.page.ts');
    assert.equal(res.findings[0].kind, 'vuot-tran-so-dong');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

