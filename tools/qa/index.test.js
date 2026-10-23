'use strict';
/**
 * Integration & CLI Subprocess Tests cho tools/qa/index.js (Phase 3 - Plan 13 v1.2).
 * Bao phủ đầy đủ ma trận tích hợp C01 -> C08.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const CLI_SOURCE = path.join(__dirname, 'index.js');
const LIB_DIR = path.join(__dirname, 'lib');
const BOUNDARY_SOURCE = path.join(WORKSPACE_ROOT, 'tools', 'boundary', 'index.js');
const REFS_DIR = path.join(WORKSPACE_ROOT, '.agents', 'skills', 'qa-logic-gaps', 'references');

const ANSI_REGEX = /\u001b\[[0-9;]*m/;

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function hashDirectoryState(dir) {
  const entries = [];
  function walk(curr) {
    const items = fs.readdirSync(curr, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      if (item.name === '.git') continue;
      const full = path.join(curr, item.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      if (item.isDirectory()) {
        entries.push(`D:${rel}`);
        walk(full);
      } else if (item.isFile()) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        entries.push(`F:${rel}:${hash}`);
      }
    }
  }
  walk(dir);
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

/**
 * Dựng repo Git tạm đầy đủ CLI tools/qa, tools/boundary, catalog references,
 * sync-manifest.json, qa.config.json, requirements, test-cases, playwright specs và decisions.json.
 */
function createCliRepo(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-cli-p3-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  // Copy tools/qa/index.js & tools/qa/lib/*
  const targetQaDir = path.join(root, 'tools', 'qa');
  const targetLibDir = path.join(targetQaDir, 'lib');
  fs.mkdirSync(targetLibDir, { recursive: true });
  fs.copyFileSync(CLI_SOURCE, path.join(targetQaDir, 'index.js'));
  for (const f of fs.readdirSync(LIB_DIR)) {
    if (f.endsWith('.js') && !f.endsWith('.test.js')) {
      fs.copyFileSync(path.join(LIB_DIR, f), path.join(targetLibDir, f));
    }
  }

  // Copy tools/boundary/index.js để lệnh summary gọi được require('../../boundary')
  const targetBoundaryDir = path.join(root, 'tools', 'boundary');
  fs.mkdirSync(targetBoundaryDir, { recursive: true });
  if (fs.existsSync(BOUNDARY_SOURCE)) {
    fs.copyFileSync(BOUNDARY_SOURCE, path.join(targetBoundaryDir, 'index.js'));
  }

  // Copy shared catalog references (ship)
  const targetRefsDir = path.join(root, '.agents', 'skills', 'qa-logic-gaps', 'references');
  fs.mkdirSync(targetRefsDir, { recursive: true });
  for (const f of fs.readdirSync(REFS_DIR)) {
    fs.copyFileSync(path.join(REFS_DIR, f), path.join(targetRefsDir, f));
  }

  // sync-manifest.json & qa.config.json
  const manifest = options.manifest || {
    ship: [
      { path: 'tools/qa', reason: 'analyzer' },
      { path: 'tools/boundary', reason: 'boundary' },
      { path: '.agents', reason: 'shared skills' },
    ],
    seed: [
      { path: 'qa.config.json', reason: 'config' },
      { path: 'playwright', reason: 'playwright' },
    ],
    own: [
      { path: 'requirements', reason: 'business', hubModule: 'requirements' },
      { path: 'test-cases', reason: 'business', hubModule: 'test-cases' },
      { path: 'decisions.json', reason: 'decisions' },
    ],
  };
  fs.writeFileSync(path.join(root, 'sync-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const qaConfig = options.qaConfig || {
    projectDir: 'playwright',
    project: 'chromium',
    requirementsDir: 'requirements',
    testCasesDir: 'test-cases',
    ignoreSpecs: ['playwright/tests/scratch'],
  };
  fs.writeFileSync(path.join(root, 'qa.config.json'), JSON.stringify(qaConfig, null, 2), 'utf8');

  // Baseline files cho commit đầu tiên (HEAD~1)
  const reqDir = path.join(root, qaConfig.requirementsDir || 'requirements');
  const tcDir = path.join(root, qaConfig.testCasesDir || 'test-cases');
  const specDir = path.join(root, qaConfig.projectDir || 'playwright', 'tests', 'auth');
  fs.mkdirSync(reqDir, { recursive: true });
  fs.mkdirSync(tcDir, { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });

  fs.writeFileSync(
    path.join(reqDir, 'REQ-001-sign-in.md'),
    [
      '---',
      'id: REQ-001',
      'title: Đăng nhập hệ thống',
      'status: Approved',
      'version: 1.0',
      'test_cases: test-cases/REQ-001-sign-in.md',
      '---',
      '',
      '## Acceptance Criteria',
      '### AC-001: Đăng nhập hợp lệ chuyển vào trang chủ',
      '### AC-002: Khoá tài khoản khi nhập sai mật khẩu quá giới hạn',
      '',
      '## Rules and validation',
      '| Rule | Valid | Invalid | Boundary | Error message | Test cases |',
      '|---|---|---|---|---|---|',
      '| Email format | validdomain | plain | 254 chars | Email không hợp lệ | TC-001 |',
      '',
    ].join('\n'),
    'utf8',
  );

  fs.writeFileSync(
    path.join(tcDir, 'REQ-001-sign-in.md'),
    [
      '# Test Cases: REQ-001',
      '',
      '## Traceability',
      '| REQ | AC | TC | Automation | Spec | Priority |',
      '|---|---|---|---|---|---|',
      '| REQ-001 | AC-001 | TC-001 | Yes | `playwright/tests/auth/sign-in.spec.ts` | P0 |',
      '| REQ-001 | AC-002 | TC-002 | Yes | `playwright/tests/auth/sign-in.spec.ts` | P1 |',
      '',
      '### TC-001: Đăng nhập thành công',
      '- **Steps:** Nhập thông tin hợp lệ.',
      '- **Expected:** Hiển thị dashboard.',
      '',
    ].join('\n'),
    'utf8',
  );

  fs.writeFileSync(
    path.join(specDir, 'sign-in.spec.ts'),
    [
      "import { test, expect } from '@playwright/test';",
      "test.describe('REQ-001 - Sign in', { tag: '@REQ-001' }, () => {",
      "  test('TC-001 - AC-001 valid login', { tag: ['@smoke', '@p0'] }, async ({ page }) => {",
      "    await page.goto('/login');",
      "    await expect(page.locator('#banner')).toBeTruthy();",
      '  });',
      '});',
      '',
    ].join('\n'),
    'utf8',
  );

  fs.writeFileSync(
    path.join(root, 'decisions.json'),
    JSON.stringify(
      {
        version: 1,
        createdAt: '2026-10-20',
        source: 'cli-test',
        decisions: [
          {
            id: 'D-01',
            title: 'Chính sách khoá đồng thời khi nhiều thiết bị đăng nhập sai',
            severity: 'blocking',
            blocks: 'REQ-001',
            context: 'Khi gửi song song request đăng nhập sai ở biên tối đa, bộ đếm có nguy cơ bị race condition.',
            status: 'confirmed',
            options: [
              {
                id: 'atomic-lock',
                label: 'Khoá nguyên tử ở tầng DB và trả mã 429 ngay lập tức',
                consequence: 'Chặn đứng vượt ngưỡng thử mật khẩu khi gửi request song song',
              },
              {
                id: 'eventual',
                label: 'Đếm bất đồng bộ qua hàng đợi',
                consequence: 'Có độ trễ',
              },
            ],
            recommended: 'atomic-lock',
            recommendationReason: 'An toàn bảo mật',
            evidence: [{ claim: 'Kiểm thử race condition', source: 'requirements/REQ-001-sign-in.md' }],
            answer: {
              optionId: 'atomic-lock',
              note: 'Bắt buộc kiểm tra trạng thái khoá ở DB và thông báo lỗi 429 khi gửi 2 request đồng thời.',
              confirmedBy: 'QA Lead',
              confirmedAt: '2026-10-22',
            },
          },
          {
            id: 'D-02',
            title: 'Quyết định đang chờ chưa duyệt',
            severity: 'soon',
            blocks: 'none',
            context: 'Chưa chốt',
            status: 'pending',
            options: [{ id: 'opt1', label: 'Phương án 1', consequence: 'Hệ quả 1' }],
            recommended: 'opt1',
            recommendationReason: 'N/A',
            evidence: [],
            answer: { optionId: 'opt1', note: 'Ghi chú nháp', confirmedBy: '', confirmedAt: '' },
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  if (options.initGit !== false) {
    git(root, ['init']);
    git(root, ['config', 'user.name', 'QA Test Bot']);
    git(root, ['config', 'user.email', 'qa-bot@example.local']);
    git(root, ['config', 'commit.gpgsign', 'false']);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', 'Initial baseline commit']);

    if (options.createSecondCommit !== false) {
      // Thêm thay đổi ở commit thứ 2 (HEAD) để test --since=HEAD~1
      fs.writeFileSync(
        path.join(reqDir, 'REQ-001-sign-in.md'),
        [
          '---',
          'id: REQ-001',
          'title: Đăng nhập hệ thống',
          'status: Approved',
          'version: 1.1',
          'test_cases: test-cases/REQ-001-sign-in.md',
          '---',
          '',
          '## Acceptance Criteria',
          '### AC-001: Đăng nhập hợp lệ chuyển vào trang chủ',
          '### AC-002: Khoá tài khoản khi nhập sai mật khẩu quá giới hạn',
          '',
          '## Rules and validation',
          '| Rule | Valid | Invalid | Boundary | Error message | Test cases |',
          '|---|---|---|---|---|---|',
          '| Email format | validdomain | plain | 254 chars | Email không hợp lệ | TC-001 |',
          '| Rate limit login | <= 5 lần | >= 6 lần liên tiếp | đúng 5 và 6 lần trong 60 giây | Tài khoản tạm khoá 15 phút | TC-002 |',
          '',
        ].join('\n'),
        'utf8',
      );

      // Thay thế assertion yếu toBeTruthy() bằng toHaveText() -> vượt đủ 4 cổng thành proposed PA
      fs.writeFileSync(
        path.join(specDir, 'sign-in.spec.ts'),
        [
          "import { test, expect } from '@playwright/test';",
          "test.describe('REQ-001 - Sign in', { tag: '@REQ-001' }, () => {",
          "  test('TC-001 - AC-001 valid login', { tag: ['@smoke', '@p0'] }, async ({ page }) => {",
          "    await page.goto('/login');",
          "    await expect(page.locator('#banner')).toHaveText('Welcome Dashboard');",
          '  });',
          '});',
          '',
        ].join('\n'),
        'utf8',
      );

      git(root, ['add', '.']);
      git(root, ['commit', '-m', 'Add boundary rate limit rule and replace weak toBeTruthy assertion']);
    }
  }

  return root;
}

function runCli(root, args = [], opts = {}) {
  const cliPath = path.join(root, 'tools', 'qa', 'index.js');
  const env = { ...process.env, ...opts.env };
  if (opts.forceColor) {
    delete env.NO_COLOR;
    env.FORCE_COLOR = '1';
  }
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env,
  });
  assert.equal(res.error, undefined, `Lỗi spawn CLI: ${res.error}`);
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

// ============================================================================
// C01: Import không chạy; root injection dùng repo tạm; default root không đổi
// ============================================================================
test('C01: Import tools/qa/index.js không tự thực thi; hỗ trợ root injection qua main({root, argv}) và giữ nguyên default ROOT', (t) => {
  const prevExitCode = process.exitCode;
  t.after(() => {
    process.exitCode = prevExitCode;
  });

  // Require trực tiếp không được tự chạy lệnh hay đổi exitCode
  const cliModule = require('./index');
  assert.equal(typeof cliModule.main, 'function');
  assert.equal(typeof cliModule.parseArgs, 'function');
  assert.equal(typeof cliModule.renderLearnReport, 'function');
  assert.equal(cliModule.ROOT, WORKSPACE_ROOT, 'Default ROOT phải giữ nguyên path.resolve(__dirname, "..", "..")');

  // Kiểm tra root injection trên repo tạm độc lập với cwd
  const tmpRepo = createCliRepo(t);
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  let exitCode;
  try {
    exitCode = cliModule.main({
      root: tmpRepo,
      argv: ['learn', '--since=HEAD~1', '--json'],
    });
  } finally {
    console.log = origLog;
    process.exitCode = 0;
  }

  assert.equal(exitCode, 0);
  assert.equal(logs.length, 1);
  const report = JSON.parse(logs[0]);
  assert.equal(report.mode, 'preview');
  assert.equal(report.scope.since, 'HEAD~1');
  assert.ok(report.proposed.length >= 1, 'Phải có tối thiểu 1 proposed candidate');
  assert.ok(report.needsReview.length >= 1, 'Phải có tối thiểu 1 needsReview candidate');
});

// ============================================================================
// C02: Hai cú pháp since; unknown/empty/missing value/tổ hợp sai exit 2
// ============================================================================
test('C02: Hỗ trợ --since=REF và --since REF; từ chối cờ lạ, giá trị thiếu/rỗng và tổ hợp cờ sai với exit 2', (t) => {
  const root = createCliRepo(t);

  // Hai cú pháp --since=HEAD~1 và --since HEAD~1 cho kết quả tương đương
  const eqRun = runCli(root, ['learn', '--since=HEAD~1', '--json']);
  const spaceRun = runCli(root, ['learn', '--since', 'HEAD~1', '--json']);
  assert.equal(eqRun.status, 0);
  assert.equal(spaceRun.status, 0);
  const eqReport = JSON.parse(eqRun.stdout);
  const spaceReport = JSON.parse(spaceRun.stdout);
  assert.equal(eqReport.sourceHash, spaceReport.sourceHash);
  assert.equal(eqReport.proposed.length, spaceReport.proposed.length);

  // Danh sách các trường hợp lỗi cờ phải trả về exit 2
  const invalidFlagCases = [
    ['learn', '--unknown-flag'],
    ['learn', '--since'],
    ['learn', '--since='],
    ['learn', '--since', '   '],
    ['learn', '--since', '--json'],
    ['learn', '--review'],
    ['learn', '--review='],
    ['learn', '--review', '   '],
    ['learn', '--output'],
    ['learn', '--output='],
    ['learn', 'unexpected-arg'],
    ['learn', '--apply'], // thiếu --review
    ['learn', '--review=test-cases/_learning/review.json'], // thiếu --apply
    ['learn', '--apply', '--review=test-cases/_learning/review.json', '--since=HEAD~1'], // apply + since
    ['learn', '--apply', '--review=test-cases/_learning/review.json', '--output=test-cases/_learning/out.json'], // apply + output
    ['learn', '--dry-run', '--output=test-cases/_learning/out.json'], // dry-run + output
    ['learn', '--req=REQ-001'],
    ['learn', '--domain=auth'],
    ['learn', '--tag=@smoke'],
    ['learn', '--strict'],
    ['learn', '--boundary-rules'],
    ['learn', '--no-boundary-rules'],
    ['gaps', '--apply'], // cờ của learn truyền vào lệnh khác
    ['coverage', '--since=HEAD~1'],
  ];

  for (const args of invalidFlagCases) {
    const res = runCli(root, args);
    assert.equal(
      res.status,
      2,
      `Kỳ vọng exit 2 cho bộ tham số [${args.join(' ')}], nhưng nhận được status=${res.status}`,
    );
  }
});

// ============================================================================
// C03: JSON success/error parse được, không ANSI/banner/stack trace
// ============================================================================
test('C03: Chế độ --json luôn xuất đúng 1 JSON object cho cả success lẫn error, không lẫn ANSI, banner hay stack trace', (t) => {
  const root = createCliRepo(t);

  // 1. Success JSON (kể cả khi bật ignoreSpecs và FORCE_COLOR)
  const okRes = runCli(root, ['learn', '--since=HEAD~1', '--json'], { forceColor: true });
  assert.equal(okRes.status, 0);
  assert.equal(ANSI_REGEX.test(okRes.stdout), false, 'stdout JSON không được chứa mã màu ANSI');
  assert.equal(okRes.stdout.includes('ignoreSpecs đang bật'), false, 'stdout JSON không được lẫn banner');
  const parsedOk = JSON.parse(okRes.stdout);
  assert.equal(parsedOk.schemaVersion, '1.0.0');
  assert.equal(parsedOk.mode, 'preview');

  // 2. Error JSON khi sai cờ CLI (pre-detect --json trước khi parseArgs hoàn tất)
  const flagErrRes = runCli(root, ['learn', '--unknown-xyz', '--json'], { forceColor: true });
  assert.equal(flagErrRes.status, 2);
  assert.equal(ANSI_REGEX.test(flagErrRes.stdout), false);
  assert.doesNotMatch(flagErrRes.stdout, /\n\s*at\s+/, 'stdout JSON không được chứa stack trace');
  assert.doesNotMatch(flagErrRes.stderr, /\n\s*at\s+/, 'stderr không được chứa stack trace');
  const parsedFlagErr = JSON.parse(flagErrRes.stdout);
  assert.equal(parsedFlagErr.ok, false);
  assert.match(parsedFlagErr.error, /Cờ không hợp lệ/);

  // 3. Error JSON khi truyền Git ref không tồn tại
  const gitErrRes = runCli(root, ['learn', '--since=non-existent-ref-999', '--json'], { forceColor: true });
  assert.equal(gitErrRes.status, 2);
  const parsedGitErr = JSON.parse(gitErrRes.stdout);
  assert.equal(parsedGitErr.ok, false);
  assert.ok(parsedGitErr.error.length > 0);
  assert.doesNotMatch(gitErrRes.stderr, /\n\s*at\s+/);

  // 4. Error JSON khi qa.config.json bị hỏng
  fs.writeFileSync(path.join(root, 'qa.config.json'), '{ broken json ', 'utf8');
  const cfgErrRes = runCli(root, ['learn', '--json'], { forceColor: true });
  assert.equal(cfgErrRes.status, 2);
  const parsedCfgErr = JSON.parse(cfgErrRes.stdout);
  assert.equal(parsedCfgErr.ok, false);
  assert.match(parsedCfgErr.error, /qa\.config\.json/);
});

// ============================================================================
// C04: Terminal/JSON apply cùng knowledge bytes/IDs
// ============================================================================
test('C04: Chạy --apply ở chế độ Terminal và --json tạo ra knowledge.json có cùng IDs và cấu trúc dữ liệu chuẩn', (t) => {
  const rootTerminal = createCliRepo(t);
  const rootJson = createCliRepo(t);

  const reviewRel = 'test-cases/_learning/review.json';

  for (const repo of [rootTerminal, rootJson]) {
    const exp = runCli(repo, ['learn', '--since', 'HEAD~1', `--output=${reviewRel}`]);
    assert.equal(exp.status, 0, exp.stderr);
    const reviewAbs = path.join(repo, reviewRel);
    const reviewData = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
    assert.ok(reviewData.candidates.length >= 1);
    for (const c of reviewData.candidates) {
      c.review = {
        status: 'approved',
        by: 'QA Reviewer',
        at: '2026-10-22T16:00:00.000Z',
        rationale: 'Phê duyệt đồng bộ cho C04.',
      };
    }
    fs.writeFileSync(reviewAbs, JSON.stringify(reviewData, null, 2), 'utf8');
  }

  // Hỗ trợ cả --review PATH (cách khoảng trắng) và --review=PATH
  const termApply = runCli(rootTerminal, ['learn', '--apply', '--review', reviewRel]);
  const jsonApply = runCli(rootJson, ['learn', '--apply', `--review=${reviewRel}`, '--json']);

  assert.equal(termApply.status, 0, termApply.stderr);
  assert.equal(jsonApply.status, 0, jsonApply.stderr);

  const knowledgeTermRaw = fs.readFileSync(
    path.join(rootTerminal, 'test-cases', '_learning', 'knowledge.json'),
    'utf8',
  );
  const knowledgeJsonRaw = fs.readFileSync(
    path.join(rootJson, 'test-cases', '_learning', 'knowledge.json'),
    'utf8',
  );

  const kTerm = JSON.parse(knowledgeTermRaw);
  const kJson = JSON.parse(knowledgeJsonRaw);

  assert.deepEqual(kTerm.nextIds, kJson.nextIds);
  assert.deepEqual(
    kTerm.entries.map((e) => ({
      id: e.id,
      type: e.type,
      targetCatalog: e.targetCatalog,
      title: e.title,
      category: e.category,
      fingerprint: e.fingerprint,
    })),
    kJson.entries.map((e) => ({
      id: e.id,
      type: e.type,
      targetCatalog: e.targetCatalog,
      title: e.title,
      category: e.category,
      fingerprint: e.fingerprint,
    })),
  );

  // Normalize appliedAt timestamp để so sánh toàn bộ byte còn lại
  for (const e of kTerm.entries) e.appliedAt = 'FIXED_TIME';
  for (const e of kJson.entries) e.appliedAt = 'FIXED_TIME';
  for (const p of kTerm.processed) p.reviewedAt = 'FIXED_TIME';
  for (const p of kJson.processed) p.reviewedAt = 'FIXED_TIME';
  assert.equal(JSON.stringify(kTerm, null, 2), JSON.stringify(kJson, null, 2));
});

// ============================================================================
// C05: Preview/dry-run read-only; output tạo artifact pending, không overwrite
// ============================================================================
test('C05: Preview và --dry-run tuyệt đối read-only; --output chỉ ghi dưới _learning, giữ trạng thái pending và chặn overwrite', (t) => {
  const root = createCliRepo(t);

  // Thêm 1 file untracked để kiểm tra hiển thị untrackedSkipped khi dùng --since
  fs.writeFileSync(
    path.join(root, 'requirements', 'REQ-099-untracked.md'),
    '---\nid: REQ-099\nstatus: Draft\n---\n### AC-001: Untracked\n',
    'utf8',
  );

  const hashBefore = hashDirectoryState(root);

  // 1. Preview terminal & JSON
  const prevTerm = runCli(root, ['learn', '--since=HEAD~1']);
  assert.equal(prevTerm.status, 0);
  assert.match(prevTerm.stdout, /Shared Catalog \(ship\)/);
  assert.match(prevTerm.stdout, /Project Overlay \(own\)/);
  assert.match(prevTerm.stdout, /Effective Knowledge/);
  assert.match(prevTerm.stdout, /Untracked skipped\s*:\s*1/);
  assert.match(prevTerm.stdout, /CHƯA học \/ CHƯA ghi vào kho tri thức/);
  assert.doesNotMatch(prevTerm.stdout, /Đã học thành công/);

  const prevDry = runCli(root, ['learn', '--since=HEAD~1', '--dry-run', '--json']);
  assert.equal(prevDry.status, 0);
  assert.equal(
    fs.existsSync(path.join(root, 'test-cases', '_learning')),
    false,
    'Preview và dry-run không được tạo thư mục _learning',
  );
  assert.equal(hashDirectoryState(root), hashBefore, 'Cây thư mục phải giữ nguyên hash sau preview');

  // 2. Chặn --output nằm ngoài <testCasesDir>/_learning hoặc trùng tên knowledge.json / knowledge.lock
  assert.equal(runCli(root, ['learn', '--output=review.json']).status, 2);
  assert.equal(runCli(root, ['learn', '--output=test-cases/review.json']).status, 2);
  assert.equal(runCli(root, ['learn', '--output=test-cases/_learning/knowledge.json']).status, 2);
  assert.equal(runCli(root, ['learn', '--output=test-cases/_learning/knowledge.lock']).status, 2);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning')), false);

  // 3. Xuất --output hợp lệ tạo review artifact với toàn bộ candidate ở trạng thái pending
  const reviewRel = 'test-cases/_learning/review-batch-1.json';
  const outRes = runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  assert.equal(outRes.status, 0, outRes.stderr);
  const reviewAbs = path.join(root, reviewRel);
  assert.equal(fs.existsSync(reviewAbs), true);
  const artifact = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
  assert.ok(artifact.candidates.length >= 1);
  assert.ok(artifact.candidates.every((c) => c.review && c.review.status === 'pending'));

  // 4. Không cho phép ghi đè file review đã tồn tại
  fs.writeFileSync(reviewAbs, JSON.stringify({ ...artifact, customNote: 'reviewer-work-in-progress' }), 'utf8');
  const overwriteRes = runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  assert.equal(overwriteRes.status, 2);
  assert.equal(
    JSON.parse(fs.readFileSync(reviewAbs, 'utf8')).customNote,
    'reviewer-work-in-progress',
    'Tuyệt đối không được ghi đè làm mất công review cũ',
  );

  // 5. Apply --dry-run không tạo knowledge.json
  const dryApplyRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--dry-run', '--json']);
  assert.equal(dryApplyRes.status, 0);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning', 'knowledge.json')), false);
});

// ============================================================================
// C06: Thiếu review/metadata không ghi; approved ghi entry, pending skipped, rejected ghi processed
// ============================================================================
test('C06: Kiểm tra chặt metadata duyệt: thiếu metadata báo lỗi exit 2; approved ghi entry, pending bị skip, rejected chỉ ghi vào processed', (t) => {
  const root = createCliRepo(t);
  const reviewRel = 'test-cases/_learning/review.json';

  const expRes = runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  assert.equal(expRes.status, 0, expRes.stderr);

  const reviewAbs = path.join(root, reviewRel);
  const baseArtifact = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
  assert.ok(baseArtifact.candidates.length >= 2, 'Cần tối thiểu 2 candidates từ diff + decisions');

  // 1. Nếu tất cả đều pending -> không tạo knowledge.json, toàn bộ nằm ở skipped
  const allPendingRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(allPendingRes.status, 0);
  const allPendingReport = JSON.parse(allPendingRes.stdout);
  assert.equal(allPendingReport.applied.length, 0);
  assert.equal(allPendingReport.skipped.length, baseArtifact.candidates.length);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning', 'knowledge.json')), false);

  // 2. Approved nhưng thiếu người duyệt (by) hoặc lý do (rationale) -> exit 2, không ghi file
  const brokenArtifact = JSON.parse(JSON.stringify(baseArtifact));
  brokenArtifact.candidates[0].review = { status: 'approved', by: '', at: '2026-10-22', rationale: '' };
  fs.writeFileSync(reviewAbs, JSON.stringify(brokenArtifact, null, 2), 'utf8');
  const missingMetaRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(missingMetaRes.status, 2);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning', 'knowledge.json')), false);

  // 3. Candidate 0 = approved, Candidate 1 = rejected, còn lại (nếu có) = pending
  const mixedArtifact = JSON.parse(JSON.stringify(baseArtifact));
  mixedArtifact.candidates[0].review = {
    status: 'approved',
    by: 'Alice QA',
    at: '2026-10-22T10:00:00Z',
    rationale: 'Heuristic biên có tính tổng quát cao.',
  };
  mixedArtifact.candidates[1].review = {
    status: 'rejected',
    by: 'Alice QA',
    at: '2026-10-22T10:05:00Z',
    rationale: 'Đã có rule tương đương trong checklist nội bộ.',
  };
  fs.writeFileSync(reviewAbs, JSON.stringify(mixedArtifact, null, 2), 'utf8');

  const mixedRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(mixedRes.status, 0, mixedRes.stderr);
  const mixedReport = JSON.parse(mixedRes.stdout);
  assert.equal(mixedReport.applied.length, 1);
  assert.equal(mixedReport.rejected.length, 1);
  assert.equal(mixedReport.skipped.length, mixedArtifact.candidates.length - 2);

  const knowledgePath = path.join(root, 'test-cases', '_learning', 'knowledge.json');
  const knowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
  assert.equal(knowledge.entries.length, 1);
  assert.equal(knowledge.entries[0].fingerprint, mixedArtifact.candidates[0].fingerprint);
  assert.equal(knowledge.processed.length, 2);
  const procApproved = knowledge.processed.find((p) => p.fingerprint === mixedArtifact.candidates[0].fingerprint);
  const procRejected = knowledge.processed.find((p) => p.fingerprint === mixedArtifact.candidates[1].fingerprint);
  assert.equal(procApproved.resolution, 'applied');
  assert.equal(procRejected.resolution, 'rejected');
});

// ============================================================================
// C07: Replay no-op; stale/cap/lock/I/O exit 2, không partial write
// ============================================================================
test('C07: Replay trả về no-op giữ nguyên byte-identical; chặn stale snapshot/source, vượt trần cap 25 và lock contention với exit 2', (t) => {
  const root = createCliRepo(t);
  const reviewRel = 'test-cases/_learning/review.json';

  runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  const reviewAbs = path.join(root, reviewRel);
  const artifact = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
  for (const c of artifact.candidates) {
    c.review = {
      status: 'approved',
      by: 'Bob QA',
      at: '2026-10-22T11:00:00Z',
      rationale: 'Duyệt toàn bộ để test Replay.',
    };
  }
  fs.writeFileSync(reviewAbs, JSON.stringify(artifact, null, 2), 'utf8');

  // Lần apply 1: thành công
  const firstApply = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(firstApply.status, 0, firstApply.stderr);
  const knowledgeAbs = path.join(root, 'test-cases', '_learning', 'knowledge.json');
  const bytesAfterFirst = fs.readFileSync(knowledgeAbs, 'utf8');

  // Lần apply 2 (Replay y hệt): exit 0, replayNoOp = true, file byte-identical
  const replayApply = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(replayApply.status, 0, replayApply.stderr);
  const replayReport = JSON.parse(replayApply.stdout);
  assert.equal(replayReport.replayNoOp, true);
  assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), bytesAfterFirst);

  // Stale sourceHash: tạo review mới rồi sửa requirement trước khi apply
  const reviewStaleRel = 'test-cases/_learning/review-stale.json';
  fs.appendFileSync(
    path.join(root, 'requirements', 'REQ-001-sign-in.md'),
    '| Timeout session | <= 15m | > 15m | đúng 15m và 16m | Hết phiên đăng nhập | TC-001 |\n',
    'utf8',
  );
  const staleOutRes = runCli(root, ['learn', `--output=${reviewStaleRel}`]);
  assert.equal(staleOutRes.status, 0, staleOutRes.stderr);
  const staleAbs = path.join(root, reviewStaleRel);
  const staleArtifact = JSON.parse(fs.readFileSync(staleAbs, 'utf8'));
  for (const c of staleArtifact.candidates) {
    c.review = {
      status: 'approved',
      by: 'Bob QA',
      at: '2026-10-22T11:30:00Z',
      rationale: 'Duyệt trước khi source bị đổi.',
    };
  }
  fs.writeFileSync(staleAbs, JSON.stringify(staleArtifact, null, 2), 'utf8');

  // Sửa file requirement sau khi đã xuất review -> làm lệch sourceHash
  fs.appendFileSync(
    path.join(root, 'requirements', 'REQ-001-sign-in.md'),
    '| OTP retry | <= 3 | >= 4 | 3 và 4 lần | Khoá OTP | TC-002 |\n',
    'utf8',
  );
  const staleRes = runCli(root, ['learn', '--apply', `--review=${reviewStaleRel}`, '--json']);
  assert.equal(staleRes.status, 2);
  assert.match(JSON.parse(staleRes.stdout).error, /Stale/i);
  assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), bytesAfterFirst, 'Stale apply không được sửa knowledge.json');

  // Lock contention: tạo sẵn knowledge.lock -> apply phải báo lỗi exit 2 và giữ nguyên knowledge.json
  const lockAbs = path.join(root, 'test-cases', '_learning', 'knowledge.lock');
  fs.writeFileSync(lockAbs, 'locked-by-another-pid', 'utf8');
  try {
    const lockRes = runCli(root, ['learn', '--apply', `--review=${reviewStaleRel}`, '--json']);
    assert.equal(lockRes.status, 2);
    assert.match(JSON.parse(lockRes.stdout).error, /knowledge\.lock/i);
    assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), bytesAfterFirst);
  } finally {
    fs.unlinkSync(lockAbs);
  }

  // Cap 25: bơm 24 active DH vào knowledge.json, xuất review có >= 2 DH rồi approve cả 2 (24 + 2 > 25) -> abort toàn batch exit 2
  const reviewCapRel = 'test-cases/_learning/review-cap.json';
  const kData = JSON.parse(bytesAfterFirst);
  kData.entries = [];
  kData.processed = [];
  for (let i = 1; i <= 24; i++) {
    kData.entries.push({
      id: `PDH-${String(i).padStart(3, '0')}`,
      type: 'DH',
      targetCatalog: 'defect',
      title: `Existing heuristic number ${i} for cap test`,
      category: 'Data & BVA',
      trigger: `Trigger condition unique ${i}`,
      failureMode: `Failure mode unique ${i}`,
      actionableCheck: `Actionable check unique ${i}`,
      evidence: `requirements/REQ-001-sign-in.md:${i}`,
      status: 'active',
      appliedAt: '2026-10-22T00:00:00.000Z',
      fingerprint: `fp-cap-${i}`,
      provenance: [
        {
          source: 'git-diff-req-tc',
          file: 'requirements/REQ-001-sign-in.md',
          line: i,
          sourceHash: `sh-${i}`,
          excerpt: `excerpt ${i}`,
        },
      ],
    });
  }
  kData.nextIds.DH = 25;
  kData.nextIds.PA = 1;
  const fullKnowledgeBytes = JSON.stringify(kData, null, 2) + '\n';
  fs.writeFileSync(knowledgeAbs, fullKnowledgeBytes, 'utf8');

  const capOutRes = runCli(root, ['learn', `--output=${reviewCapRel}`]);
  assert.equal(capOutRes.status, 0, capOutRes.stderr);
  const capAbs = path.join(root, reviewCapRel);
  const capArt = JSON.parse(fs.readFileSync(capAbs, 'utf8'));
  const dhCandidates = capArt.candidates.filter((c) => c.targetCatalog === 'defect');
  assert.ok(dhCandidates.length >= 2, 'Cần tối thiểu 2 DH candidates để thử vượt trần 24 + 2 > 25');
  for (const c of dhCandidates) {
    c.review = {
      status: 'approved',
      by: 'Bob QA',
      at: '2026-10-22T12:00:00Z',
      rationale: 'Thử vượt trần 24 + 2 > 25.',
    };
  }
  fs.writeFileSync(capAbs, JSON.stringify(capArt, null, 2), 'utf8');

  const capRes = runCli(root, ['learn', '--apply', `--review=${reviewCapRel}`, '--json']);
  assert.equal(capRes.status, 2);
  assert.match(JSON.parse(capRes.stdout).error, /25/);
  assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), fullKnowledgeBytes, 'Khi vượt cap không được ghi một phần');
});

// ============================================================================
// C08: Regression coverage/gaps/drift/summary/fix và flag cũ không đổi
// ============================================================================
test('C08: Các lệnh truyền thống (coverage, gaps, drift, impact, matrix, summary, fix) và cờ cũ hoạt động không hồi quy', (t) => {
  const root = createCliRepo(t);

  // Dựng mock npx nhẹ trong thư mục bin tạm để các lệnh gọi playwright --list chạy tức thời và độc lập
  const mockBinDir = path.join(root, '.mock-bin');
  fs.mkdirSync(mockBinDir, { recursive: true });
  const mockPlaywrightJson = JSON.stringify({
    config: { rootDir: path.join(root, 'playwright', 'tests') },
    suites: [
      {
        title: 'auth/sign-in.spec.ts',
        file: 'auth/sign-in.spec.ts',
        suites: [
          {
            title: 'REQ-001 - Sign in',
            specs: [
              {
                title: 'TC-001 - AC-001 valid login',
                tags: ['@REQ-001', '@smoke', '@p0'],
                file: 'auth/sign-in.spec.ts',
                line: 3,
              },
            ],
          },
        ],
      },
    ],
  });
  const mockScriptJs = path.join(mockBinDir, 'pw-list.js');
  fs.writeFileSync(mockScriptJs, `process.stdout.write(${JSON.stringify(mockPlaywrightJson)});\n`, 'utf8');
  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(mockBinDir, 'npx.cmd'),
      `@echo off\r\n"${process.execPath}" "${mockScriptJs}"\r\n`,
      'utf8',
    );
  } else {
    const shPath = path.join(mockBinDir, 'npx');
    fs.writeFileSync(shPath, `#!/bin/sh\n"${process.execPath}" "${mockScriptJs}"\n`, 'utf8');
    fs.chmodSync(shPath, 0o755);
  }

  const fastEnv = {
    PATH: `${mockBinDir}${path.delimiter}${process.env.PATH || ''}`,
  };

  // 1. impact REQ-001
  const impRes = runCli(root, ['impact', 'REQ-001', '--json'], { env: fastEnv });
  assert.equal(impRes.status, 0, impRes.stderr);
  const impJson = JSON.parse(impRes.stdout);
  assert.equal(impJson.requirement.id, 'REQ-001');

  // impact thiếu mã REQ -> exit 2
  const impMissing = runCli(root, ['impact', '--json'], { env: fastEnv });
  assert.equal(impMissing.status, 2);
  assert.equal(JSON.parse(impMissing.stdout).ok, false);

  // 2. matrix
  const matRes = runCli(root, ['matrix', '--json'], { env: fastEnv });
  assert.equal(matRes.status, 0, matRes.stderr);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', 'traceability.md')), true);

  // 3. fix --dry-run
  const fixRes = runCli(root, ['fix', '--dry-run', '--json'], { env: fastEnv });
  assert.equal(fixRes.status, 0, fixRes.stderr);
  const fixJson = JSON.parse(fixRes.stdout);
  assert.equal(fixJson.dryRun, true);

  // 4. coverage, gaps, drift, summary với các cờ lọc cũ (--req, --domain, --no-boundary-rules)
  const covRes = runCli(root, ['coverage', '--req=REQ-001', '--json'], { env: fastEnv });
  assert.equal(covRes.status, 0, covRes.stderr);
  assert.equal(JSON.parse(covRes.stdout).requirements, 1);

  const gapsRes = runCli(root, ['gaps', '--no-boundary-rules', '--json'], { env: fastEnv });
  assert.equal(gapsRes.status, 0, gapsRes.stderr);
  assert.ok(Array.isArray(JSON.parse(gapsRes.stdout)));

  const driftRes = runCli(root, ['drift', '--domain=auth', '--json'], { env: fastEnv });
  assert.equal(driftRes.status, 0, driftRes.stderr);
  assert.ok(Array.isArray(JSON.parse(driftRes.stdout)));

  const sumOutRel = 'test-cases/summary-report.json';
  const sumRes = runCli(root, ['summary', `--output=${sumOutRel}`, '--json'], { env: fastEnv });
  assert.equal(sumRes.status, 0, sumRes.stderr);
  assert.equal(fs.existsSync(path.join(root, sumOutRel)), true);
  assert.ok(JSON.parse(sumRes.stdout).metrics);
});
