'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  slugify,
  parseArgs,
  suggestNextReqId,
  listExistingDomains,
  runWizard,
  generateScaffold,
  inferFromSpec,
  generateRequirementContent,
  generateTestCaseContent,
  generateSpecContent,
} = require('./index');

test('slugify: chuyển tiếng Việt có dấu và ký tự đặc biệt thành slug sạch', () => {
  assert.equal(slugify('Đăng nhập hệ thống'), 'dang-nhap-he-thong');
  assert.equal(slugify('Quản lý hồ sơ & thông tin cá nhân!'), 'quan-ly-ho-so-thong-tin-ca-nhan');
  assert.equal(slugify('   REQ-002   '), 'req-002');
  assert.equal(slugify(''), 'feature');
});

test('parseArgs: cờ lạ bị ném lỗi rõ ràng', () => {
  assert.throws(() => parseArgs(['--invalid-flag']), /Tùy chọn không hợp lệ/);
  assert.throws(() => parseArgs(['--foo=bar']), /Tùy chọn không hợp lệ/);
});

test('generateRequirementContent: sinh đủ front-matter, ACs và bảng rules', () => {
  const content = generateRequirementContent({
    reqId: 'REQ-002',
    title: 'Đăng ký tài khoản',
    slug: 'sign-up',
    acCount: 2,
  });

  assert.match(content, /^id:\s*REQ-002/m);
  assert.match(content, /^test_cases:\s*test-cases\/REQ-002-sign-up\.md/m);
  assert.match(content, /### AC-001:/);
  assert.match(content, /### AC-002:/);
  assert.match(content, /\| Rule 1 \|.*\| TC-001 \|/);
  assert.match(content, /\| Rule 2 \|.*\| TC-002 \|/);
});

test('generateTestCaseContent: sinh bảng Traceability với Candidate và P2 mặc định', () => {
  const content = generateTestCaseContent({
    reqId: 'REQ-002',
    title: 'Đăng ký tài khoản',
    slug: 'sign-up',
    acCount: 2,
    specRelPath: 'playwright/tests/auth/sign-up.spec.ts',
  });

  assert.match(content, /\| REQ-002 \| AC-001 \| TC-001 \| Candidate \| `playwright\/tests\/auth\/sign-up\.spec\.ts` \| P2 \|/);
  assert.match(content, /\| REQ-002 \| AC-002 \| TC-002 \| Candidate \| `playwright\/tests\/auth\/sign-up\.spec\.ts` \| P2 \|/);
  assert.match(content, /### TC-001:/);
  assert.match(content, /### TC-002:/);
  assert.match(content, /Lưu ý: Cập nhật Priority thật/);
});

test('generateSpecContent: sinh test.fixme mang tag @wip và assertion trung thực', () => {
  const content = generateSpecContent({
    reqId: 'REQ-002',
    title: 'Đăng ký tài khoản',
    slug: 'sign-up',
    acCount: 2,
    specDomain: 'auth',
  });

  assert.match(content, /test\.describe\('REQ-002 - Đăng ký tài khoản', \{ tag: '@REQ-002' \}/);
  assert.match(content, /test\.fixme\(/);
  assert.match(content, /tag: \['@wip', '@p2'\]/);
  assert.match(content, /'TC-001 - AC-001 verify/);
  assert.match(content, /'TC-002 - AC-002 verify/);
  assert.match(content, /expect\(page\)\.toBeDefined\(\)/);
  assert.match(content, /expect\(false, 'TODO: viết assertion cho AC-001'\)\.toBe\(true\)/);
  assert.match(content, /Requirement : requirements\/REQ-002-sign-up\.md/);
});

test('generateScaffold: tạo đồng bộ 3 file trong thư mục tạm', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-scaffold-test-'));
  try {
    const res = generateScaffold({
      root: tmpRoot,
      reqId: 'REQ-003',
      slug: 'reset-password',
      title: 'Quên mật khẩu',
      acCount: 2,
      domain: 'auth',
      force: false,
    });

    assert.equal(res.ok, true);
    assert.equal(res.created.length, 3);
    assert.ok(fs.existsSync(path.join(tmpRoot, 'requirements/REQ-003-reset-password.md')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'test-cases/REQ-003-reset-password.md')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'playwright/tests/auth/reset-password.spec.ts')));

    // Chặn ghi đè khi không có cờ force
    assert.throws(() => {
      generateScaffold({
        root: tmpRoot,
        reqId: 'REQ-003',
        slug: 'reset-password',
        title: 'Quên mật khẩu',
        acCount: 2,
        domain: 'auth',
        force: false,
      });
    }, /File đã tồn tại/);

    // Cho phép ghi đè khi force: true
    const resForce = generateScaffold({
      root: tmpRoot,
      reqId: 'REQ-003',
      slug: 'reset-password',
      title: 'Quên mật khẩu',
      acCount: 2,
      domain: 'auth',
      force: true,
    });
    assert.equal(resForce.ok, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('generateScaffold: chặn ghi đè đường dẫn nguồn kể cả khi force: true', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-scaffold-guard-'));
  try {
    const fakeSource = path.join(tmpRoot, 'playwright/tests/auth/login.spec.ts');
    fs.mkdirSync(path.dirname(fakeSource), { recursive: true });
    fs.writeFileSync(fakeSource, 'console.log("source");');

    assert.throws(() => {
      generateScaffold({
        root: tmpRoot,
        reqId: 'REQ-001',
        slug: 'login',
        title: 'Đăng nhập',
        acCount: 1,
        domain: 'auth',
        force: true,
        inputPathsToCheck: [fakeSource],
      });
    }, /Đường dẫn ghi trùng với đường dẫn nguồn đầu vào/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('inferFromSpec: không đụng spec nguồn (hash và bytes nguyên vẹn)', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-nodamage-'));
  try {
    const specRel = 'playwright/tests/checkout/cart.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });

    const specContent = `import { test, expect } from '../fixtures/test-fixtures';
test.describe('REQ-005 - Giỏ hàng', { tag: '@REQ-005' }, () => {
  test('TC-001 - AC-001 thêm vào giỏ', async () => { expect(1).toBe(1); });
});
`;
    fs.writeFileSync(specFull, specContent, 'utf8');
    const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(specFull)).digest('hex');
    const statBefore = fs.statSync(specFull);

    const res = inferFromSpec({
      root: tmpRoot,
      specFile: specRel,
      force: false,
    });

    assert.equal(res.ok, true);
    const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(specFull)).digest('hex');
    const statAfter = fs.statSync(specFull);

    assert.equal(hashAfter, hashBefore);
    assert.equal(statAfter.size, statBefore.size);
    assert.equal(fs.readFileSync(specFull, 'utf8'), specContent);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('inferFromSpec: chỉ tạo đúng 2 file, không path nào nằm dưới playwright/', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-2files-'));
  try {
    const specRel = 'playwright/tests/auth/sign-in.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });

    fs.writeFileSync(
      specFull,
      `test.describe('REQ-001 - Sign In', { tag: '@REQ-001' }, () => {
  test('TC-001 - AC-001 first case', () => {});
});`,
      'utf8'
    );

    const res = inferFromSpec({
      root: tmpRoot,
      specFile: specRel,
      force: false,
    });

    assert.equal(res.created.length, 2);
    assert.ok(res.created.every((f) => !f.startsWith('playwright')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'requirements/REQ-001-sign-in.md')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'test-cases/REQ-001-sign-in.md')));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('inferFromSpec: giữ đúng ánh xạ lệch (TC-003->AC-002, TC-013->AC-001) và mã nhảy số', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-mapping-'));
  try {
    const specRel = 'playwright/tests/auth/login.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });

    const specContent = `
test.describe('REQ-001 - Đăng nhập', { tag: '@REQ-001' }, () => {
  test('TC-001 - AC-001 login valid', async () => {});
  test('TC-002 - AC-002 wrong password', async () => {});
  test('TC-003 - AC-002 unknown email', async () => {});
  test('TC-013 - AC-001 cookie security attributes', async () => {});
});`;
    fs.writeFileSync(specFull, specContent, 'utf8');

    const res = inferFromSpec({
      root: tmpRoot,
      specFile: specRel,
      force: false,
    });

    assert.equal(res.ok, true);

    const tcFileContent = fs.readFileSync(path.join(tmpRoot, 'test-cases/REQ-001-login.md'), 'utf8');
    assert.match(tcFileContent, /\| REQ-001 \| AC-001 \| TC-001 \|/);
    assert.match(tcFileContent, /\| REQ-001 \| AC-002 \| TC-002 \|/);
    assert.match(tcFileContent, /\| REQ-001 \| AC-002 \| TC-003 \|/);
    assert.match(tcFileContent, /\| REQ-001 \| AC-001 \| TC-013 \|/);
    assert.match(tcFileContent, /### TC-013:/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('inferFromSpec: gắn nhãn Inferred from automation và confidence Low', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-label-'));
  try {
    const specRel = 'playwright/tests/auth/login.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });

    fs.writeFileSync(
      specFull,
      `test.describe('REQ-001 - Login', { tag: '@REQ-001' }, () => {
  test('TC-001 - AC-001 test login', () => {});
});`,
      'utf8'
    );

    inferFromSpec({
      root: tmpRoot,
      specFile: specRel,
      force: false,
    });

    const reqContent = fs.readFileSync(path.join(tmpRoot, 'requirements/REQ-001-login.md'), 'utf8');
    assert.match(reqContent, /Source: Inferred from automation/);
    assert.match(reqContent, /Confidence \| Status/);
    assert.match(reqContent, /Low \| Needs confirmation/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('inferFromSpec: chặn trùng id REQ dù tên file khác nhau', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-dup-'));
  try {
    const reqDir = path.join(tmpRoot, 'requirements');
    fs.mkdirSync(reqDir, { recursive: true });
    // File có tên khác nhưng id: REQ-001
    fs.writeFileSync(path.join(reqDir, 'REQ-001-existing-sign-in.md'), '---\nid: REQ-001\n---\n');

    const specRel = 'playwright/tests/auth/login.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });
    fs.writeFileSync(
      specFull,
      `test.describe('REQ-001 - Login', { tag: '@REQ-001' }, () => {
  test('TC-001 - AC-001 login test', () => {});
});`,
      'utf8'
    );

    assert.throws(() => {
      inferFromSpec({
        root: tmpRoot,
        specFile: specRel,
        force: false,
      });
    }, /Mã requirement "REQ-001" đã tồn tại/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('inferFromSpec: ném lỗi khi spec không có cặp TC-AC', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-empty-'));
  try {
    const specRel = 'playwright/tests/auth/empty.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });
    fs.writeFileSync(specFull, 'test("simple test without tags", () => {});', 'utf8');

    assert.throws(() => {
      inferFromSpec({
        root: tmpRoot,
        specFile: specRel,
        force: false,
      });
    }, /Không tìm thấy cặp \(TC-xxx - AC-xxx\)/);

    // Không tạo file nào
    assert.equal(fs.existsSync(path.join(tmpRoot, 'requirements')), false);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('suggestNextReqId: trả về REQ-001 khi thư mục trống hoặc không tồn tại', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-suggest-empty-'));
  try {
    assert.equal(suggestNextReqId(path.join(tmpRoot, 'requirements')), 'REQ-001');
    fs.mkdirSync(path.join(tmpRoot, 'requirements'));
    assert.equal(suggestNextReqId(path.join(tmpRoot, 'requirements')), 'REQ-001');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('suggestNextReqId: tự động tìm mã lớn nhất và cộng thêm 1', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-suggest-seq-'));
  try {
    const reqDir = path.join(tmpRoot, 'requirements');
    fs.mkdirSync(reqDir);
    fs.writeFileSync(path.join(reqDir, 'REQ-001-sign-in.md'), '---\nid: REQ-001\n---\n');
    fs.writeFileSync(path.join(reqDir, 'REQ-005-checkout.md'), '---\nid: REQ-005\n---\n');
    assert.equal(suggestNextReqId(reqDir), 'REQ-006');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('listExistingDomains: lọc đúng thư mục domain và loại bỏ thư mục hạ tầng', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-domains-'));
  try {
    const testsDir = path.join(tmpRoot, 'playwright', 'tests');
    fs.mkdirSync(path.join(testsDir, 'auth'), { recursive: true });
    fs.mkdirSync(path.join(testsDir, 'billing'), { recursive: true });
    fs.mkdirSync(path.join(testsDir, 'pages'), { recursive: true });
    fs.mkdirSync(path.join(testsDir, 'fixtures'), { recursive: true });

    const domains = listExistingDomains(path.join(tmpRoot, 'playwright'));
    assert.deepEqual(domains.sort(), ['auth', 'billing']);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('runWizard: hoàn tất sinh 3 file khi người dùng nhập thông tin và xác nhận', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-wizard-ok-'));

  try {
    const reqDir = path.join(tmpRoot, 'requirements');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.writeFileSync(path.join(reqDir, 'REQ-001-sign-in.md'), '---\nid: REQ-001\n---\n');

    const answers = [
      '', // 1. REQ ID (Enter -> chọn mặc định REQ-002)
      'Đổi mật khẩu', // 2. Tiêu đề
      '', // 3. Slug (Enter -> chọn mặc định doi-mat-khau)
      '1', // 4. Domain
      '3', // 5. AC count
      'y', // 6. Confirm
    ];
    const promptFn = async () => answers.shift();

    const res = await runWizard({
      root: tmpRoot,
      config: { requirementsDir: 'requirements', testCasesDir: 'test-cases', projectDir: 'playwright' },
      promptFn,
      output: { write() {} },
    });

    assert.ok(res);
    assert.equal(res.ok, true);
    assert.equal(res.created.length, 3);
    assert.ok(fs.existsSync(path.join(tmpRoot, 'requirements/REQ-002-doi-mat-khau.md')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'test-cases/REQ-002-doi-mat-khau.md')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'playwright/tests/auth/doi-mat-khau.spec.ts')));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('runWizard: hủy và không tạo file khi người dùng từ chối', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-wizard-cancel-'));

  try {
    const answers = [
      'REQ-002',
      'Đổi mật khẩu',
      '',
      '1',
      '2',
      'n',
    ];
    const promptFn = async () => answers.shift();

    const res = await runWizard({
      root: tmpRoot,
      config: { requirementsDir: 'requirements', testCasesDir: 'test-cases', projectDir: 'playwright' },
      promptFn,
      output: { write() {} },
    });

    assert.equal(res, null);
    assert.equal(fs.existsSync(path.join(tmpRoot, 'requirements/REQ-002-doi-mat-khau.md')), false);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

