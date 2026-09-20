'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  slugify,
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

test('generateTestCaseContent: sinh bảng Traceability khớp mã REQ/AC/TC', () => {
  const content = generateTestCaseContent({
    reqId: 'REQ-002',
    title: 'Đăng ký tài khoản',
    slug: 'sign-up',
    acCount: 2,
    specRelPath: 'tests/auth/sign-up.spec.ts',
  });

  assert.match(content, /\| REQ-002 \| AC-001 \| TC-001 \| Yes \| `tests\/auth\/sign-up\.spec\.ts` \| P0 \|/);
  assert.match(content, /\| REQ-002 \| AC-002 \| TC-002 \| Yes \| `tests\/auth\/sign-up\.spec\.ts` \| P1 \|/);
  assert.match(content, /### TC-001:/);
  assert.match(content, /### TC-002:/);
});

test('generateSpecContent: sinh describe mang tag @REQ và các test case chuẩn regex', () => {
  const content = generateSpecContent({
    reqId: 'REQ-002',
    title: 'Đăng ký tài khoản',
    acCount: 2,
    specDomain: 'auth',
  });

  assert.match(content, /test\.describe\('REQ-002 - Đăng ký tài khoản', \{ tag: '@REQ-002' \}/);
  assert.match(content, /'TC-001 - AC-001 verify/);
  assert.match(content, /'TC-002 - AC-002 verify/);
  assert.match(content, /expect\(page\)\.toBeDefined\(\)/);
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

test('inferFromSpec: bóc tách ngược từ spec có sẵn sinh ra draft doc', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-test-'));
  try {
    const specRel = 'playwright/tests/checkout/cart.spec.ts';
    const specFull = path.join(tmpRoot, specRel);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });

    const specContent = `
import { test, expect } from '../fixtures/test-fixtures';

test.describe('REQ-005 - Giỏ hàng', { tag: '@REQ-005' }, () => {
  test('TC-001 - AC-001 thêm sản phẩm vào giỏ hàng', async ({ page }) => {
    expect(true).toBe(true);
  });
  test('TC-002 - AC-002 xoá sản phẩm khỏi giỏ hàng', async ({ page }) => {
    expect(true).toBe(true);
  });
});
    `;
    fs.writeFileSync(specFull, specContent, 'utf8');

    const res = inferFromSpec({
      root: tmpRoot,
      specFile: specRel,
      force: false,
    });

    assert.equal(res.ok, true);
    assert.ok(fs.existsSync(path.join(tmpRoot, 'requirements/REQ-005-cart.md')));
    assert.ok(fs.existsSync(path.join(tmpRoot, 'test-cases/REQ-005-cart.md')));

    const reqContent = fs.readFileSync(path.join(tmpRoot, 'requirements/REQ-005-cart.md'), 'utf8');
    assert.match(reqContent, /^id:\s*REQ-005/m);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
