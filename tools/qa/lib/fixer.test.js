'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fixTraceability } = require('./fixer');

function makeTempRepo(files = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixer-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(tmp, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return {
    root: tmp,
    cleanup: () => {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

test('fixer: chuẩn hoá đường dẫn spec thiếu tiền tố playwright/', () => {
  const sampleTc = `# REQ-001 Test Cases

## Traceability
| Req | AC | TC | Status | Spec | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/auth/login.spec.ts\` | P1 |
`;

  const repo = makeTempRepo({
    'test-cases/REQ-001-login.md': sampleTc,
    'playwright/tests/auth/login.spec.ts': '// spec file',
    'requirements/REQ-001-login.md': '---\nid: REQ-001\ntitle: Login\n---\n\n### AC-001\n',
  });

  try {
    const res = fixTraceability(repo.root, {
      projectDir: 'playwright',
      testCasesDir: 'test-cases',
      loadAutomated: () => ({ tests: [] }),
    });

    assert.equal(res.ok, true);
    assert.equal(res.fixedCount, 1);
    assert.equal(res.changes[0].kind, 'chuan-hoa-duong-dan-spec');
    assert.equal(res.changes[0].to, '`playwright/tests/auth/login.spec.ts`');

    const updated = fs.readFileSync(path.join(repo.root, 'test-cases/REQ-001-login.md'), 'utf8');
    assert.ok(updated.includes('`playwright/tests/auth/login.spec.ts`'));
  } finally {
    repo.cleanup();
  }
});

test('fixer: dryRun không làm thay đổi file trên đĩa', () => {
  const sampleTc = `# REQ-001 Test Cases

## Traceability
| Req | AC | TC | Status | Spec | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/auth/login.spec.ts\` | P1 |
`;

  const repo = makeTempRepo({
    'test-cases/REQ-001-login.md': sampleTc,
    'playwright/tests/auth/login.spec.ts': '// spec file',
    'requirements/REQ-001-login.md': '---\nid: REQ-001\ntitle: Login\n---\n\n### AC-001\n',
  });

  try {
    const res = fixTraceability(repo.root, {
      dryRun: true,
      projectDir: 'playwright',
      testCasesDir: 'test-cases',
      loadAutomated: () => ({ tests: [] }),
    });

    assert.equal(res.ok, true);
    assert.equal(res.dryRun, true);
    assert.equal(res.fixedCount, 1);

    const onDisk = fs.readFileSync(path.join(repo.root, 'test-cases/REQ-001-login.md'), 'utf8');
    assert.equal(onDisk, sampleTc, 'File trên đĩa phải giữ nguyên 100% khi có cờ dryRun');
  } finally {
    repo.cleanup();
  }
});

test('fixer: tự động bổ sung test case mới phát hiện từ automation script', () => {
  const sampleTc = `# REQ-001 Test Cases

## Traceability
| Req | AC | TC | Status | Spec | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-001 | AC-001 | TC-001 | Yes | \`playwright/tests/auth/login.spec.ts\` | P1 |

## Details
### TC-001
`;

  const repo = makeTempRepo({
    'test-cases/REQ-001-login.md': sampleTc,
    'requirements/REQ-001-login.md': '---\nid: REQ-001\ntitle: Login\n---\n\n### AC-001\n### AC-002\n',
  });

  try {
    const mockTests = [
      {
        title: 'TC-002 - AC-002: Kiểm tra đăng nhập sai mật khẩu',
        tcId: 'TC-002',
        acId: 'AC-002',
        reqId: 'REQ-001',
        tags: ['REQ-001'],
        path: 'playwright/tests/auth/login.spec.ts',
        line: 25,
        isSetup: false,
      },
    ];

    const res = fixTraceability(repo.root, {
      projectDir: 'playwright',
      testCasesDir: 'test-cases',
      loadAutomated: () => ({ tests: mockTests }),
    });

    assert.equal(res.ok, true);
    assert.equal(res.fixedCount, 1);
    assert.equal(res.changes[0].kind, 'them-test-case-chua-khai-bao');
    assert.equal(res.changes[0].tcId, 'TC-002');

    const updated = fs.readFileSync(path.join(repo.root, 'test-cases/REQ-001-login.md'), 'utf8');
    assert.ok(updated.includes('| REQ-001 | AC-002 | TC-002 | Candidate | `playwright/tests/auth/login.spec.ts` | P2 |'));
  } finally {
    repo.cleanup();
  }
});

test('fixer: tính chất idempotent - chạy 2 lần cho kết quả không đổi', () => {
  const sampleTc = `# REQ-001 Test Cases

## Traceability
| Req | AC | TC | Status | Spec | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/auth/login.spec.ts\` | P1 |
`;

  const repo = makeTempRepo({
    'test-cases/REQ-001-login.md': sampleTc,
    'playwright/tests/auth/login.spec.ts': '// spec file',
    'requirements/REQ-001-login.md': '---\nid: REQ-001\ntitle: Login\n---\n\n### AC-001\n',
  });

  try {
    const opts = {
      projectDir: 'playwright',
      testCasesDir: 'test-cases',
      loadAutomated: () => ({ tests: [] }),
    };

    const res1 = fixTraceability(repo.root, opts);
    assert.equal(res1.fixedCount, 1);

    const res2 = fixTraceability(repo.root, opts);
    assert.equal(res2.fixedCount, 0, 'Lần chạy thứ 2 không có gì cần sửa thêm');
  } finally {
    repo.cleanup();
  }
});
