'use strict';
/**
 * Unit test cho phần JOIN của tools/qa.
 *
 * Toàn bộ test chạy trên một repo giả dựng trong os.tmpdir() và một stub thay cho
 * `playwright --list` (khe cắm `options.loadAutomated`). Nhờ vậy test không cần
 * browser, không cần npm install trong playwright/, và chạy được trên CI trống.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { coverage, gaps, impact, drift, matrix, summary } = require('./commands');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-commands-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const withRepo = (files, fn) => {
  const root = makeRepo(files);
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// Stub cho nguồn thứ ba (playwright --list)
// ---------------------------------------------------------------------------

/**
 * Dựng một bản ghi test giống hệt hình dạng mà sources.js trả về, kể cả việc
 * tcId/acId được rút từ title. Nếu đổi quy ước đặt tên trong sources.js mà quên
 * đổi ở đây thì test sẽ nói dối, nên phần rút mã dùng đúng một regex như bản thật.
 */
function spec(title, opts = {}) {
  const m = /^(TC-\d{3})\s*-\s*(AC-\d{3})\b/.exec(title);
  const reqId = 'reqId' in opts ? opts.reqId : 'REQ-001';
  const file = opts.file || 'playwright/tests/login.spec.js';
  return {
    title,
    tcId: m ? m[1] : null,
    acId: m ? m[2] : null,
    reqId,
    tags: 'tags' in opts ? opts.tags : (reqId ? [reqId] : []),
    file,
    path: file,
    isSetup: Boolean(opts.isSetup),
    line: opts.line || 7,
    assertionCount: 'assertionCount' in opts ? opts.assertionCount : 1,
    isSkipped: Boolean(opts.isSkipped),
    missingAwaits: opts.missingAwaits || [],
  };
}

/** Kết quả "đọc spec thành công" mặc định; `extra` để mô phỏng chế độ hỏng. */
const stubAutomated = (tests, extra = {}) => () => ({
  tests,
  error: null,
  emptyResult: false,
  emptyMessage: null,
  ignoredCount: 0,
  ignorePrefixes: [],
  ...extra,
});

const opts = (tests, extra) => ({ loadAutomated: stubAutomated(tests, extra) });

const only = (findings, kind) => findings.filter((f) => f.kind === kind);
const kindSet = (findings) => new Set(findings.map((f) => f.kind));

/**
 * Thay chuỗi trong fixture và ném lỗi nếu không khớp. Một `.replace()` trượt sẽ
 * im lặng trả về fixture gốc, và khi đó các assert dạng "phải im lặng" vẫn xanh —
 * test xanh vì sai, kiểu hỏng khó thấy nhất trong một bộ test.
 */
function mustReplace(text, from, to) {
  if (!text.includes(from)) throw new Error(`Fixture không còn chứa: ${from}`);
  return text.replace(from, to);
}

/** Dòng traceability của TC-002 ở trạng thái gốc — điểm sửa chung của nhiều case. */
const TC_002_YES = '| TC-002 | Yes | `tests/login.spec.js` | P1 |';

// ---------------------------------------------------------------------------
// Fixture tài liệu
// ---------------------------------------------------------------------------

const REQ = `---
id: REQ-001
title: Đăng nhập
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
test_cases: test-cases/REQ-001.md
---

# REQ-001: Đăng nhập

## Acceptance criteria

### AC-001: Đăng nhập thành công với credential hợp lệ

**Given** tài khoản active **When** nhập đúng **Then** vào dashboard

### AC-002: Sai mật khẩu bị từ chối

**Given** tài khoản active **When** nhập sai password **Then** hiện lỗi chung

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | \`a@b.com\` | \`not-an-email\` | 254, 255 | Lỗi tại trường | TC-002 |
`;

const TC = `# Test cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/login.spec.js\` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | \`tests/login.spec.js\` | P1 |

## Test cases

### TC-001: Đăng nhập thành công

### TC-002: Sai mật khẩu
`;

const DOCS = { 'requirements/REQ-001.md': REQ, 'test-cases/REQ-001.md': TC };

/** Hai spec khớp đúng hai dòng traceability — trạng thái "repo sạch". */
const CLEAN_TESTS = [
  spec('TC-001 - AC-001 vào được dashboard', { line: 7 }),
  spec('TC-002 - AC-002 hiện lỗi chung', { line: 15 }),
];

// ===========================================================================
// coverage()
// ===========================================================================

test('coverage: đếm đúng requirement / AC / test case / script và dựng đủ hàng', () => {
  withRepo(DOCS, (root) => {
    const r = coverage(root, opts(CLEAN_TESTS));
    assert.equal(r.requirements, 1);
    assert.equal(r.acceptanceCriteria, 2);
    assert.equal(r.testCases, 2);
    assert.equal(r.automatedTests, 2);
    assert.equal(r.rows.length, 2);

    const ac1 = r.rows.find((row) => row.acId === 'AC-001');
    assert.equal(ac1.reqId, 'REQ-001');
    assert.equal(ac1.status, 'Ready for Test');
    assert.deepEqual(ac1.testCases, ['TC-001']);
    assert.deepEqual(ac1.automated, ['TC-001']);
    assert.ok(ac1.acTitle.includes('thành công'), 'tiêu đề AC phải lấy từ heading');
  });
});

// Đây là bug thật đã từng xảy ra: coverage đếm cả test trong file *.setup.* còn
// drift thì bỏ qua, nên hai lệnh báo lệch nhau đúng một test và không ai biết
// bên nào đúng. Case này giữ cho định nghĩa "test thật" không trượt lại.
test('coverage: test nằm trong file *.setup.* KHÔNG được tính là đã automation', () => {
  withRepo(DOCS, (root) => {
    const tests = [
      spec('TC-001 - AC-001 vào được dashboard'),
      spec('TC-002 - AC-002 hiện lỗi chung', {
        file: 'playwright/tests/auth.setup.ts',
        isSetup: true,
      }),
    ];
    const r = coverage(root, opts(tests));
    assert.equal(r.automatedTests, 1, 'file setup là hạ tầng, không phải test case');

    const ac2 = r.rows.find((row) => row.acId === 'AC-002');
    assert.deepEqual(ac2.testCases, ['TC-002']);
    assert.deepEqual(ac2.automated, [], 'TC chỉ xuất hiện trong setup thì chưa có script thật');
  });
});

test('coverage: tách riêng manualOnly và candidates để không lẫn vào nợ automation', () => {
  withRepo({
    ...DOCS,
    'test-cases/REQ-001.md': mustReplace(
      mustReplace(TC, '| TC-001 | Yes |', '| TC-001 | No |'),
      '| TC-002 | Yes |',
      '| TC-002 | Candidate |',
    ),
  }, (root) => {
    const r = coverage(root, opts([]));
    const ac1 = r.rows.find((row) => row.acId === 'AC-001');
    const ac2 = r.rows.find((row) => row.acId === 'AC-002');
    assert.deepEqual(ac1.manualOnly, ['TC-001']);
    assert.deepEqual(ac1.candidates, []);
    assert.deepEqual(ac2.candidates, ['TC-002']);
    assert.deepEqual(ac2.manualOnly, []);
  });
});

// coverage không tự sinh finding, nó chỉ chuyển tiếp cờ hỏng cho index.js in ra.
// Nếu các trường này mất đi thì cảnh báo đỏ "đọc được 0 spec" biến mất im lặng.
test('coverage: chuyển tiếp nguyên vẹn cờ emptySpecs / ignoredSpecs / playwrightError', () => {
  withRepo(DOCS, (root) => {
    const r = coverage(root, opts([], {
      emptyResult: true,
      emptyMessage: 'Đọc được 0 test',
      ignoredCount: 3,
      ignorePrefixes: ['tests/e2e'],
    }));
    assert.equal(r.emptySpecs, true);
    assert.equal(r.emptyMessage, 'Đọc được 0 test');
    assert.equal(r.ignoredSpecs, 3);
    assert.deepEqual(r.ignorePrefixes, ['tests/e2e']);
    assert.equal(r.playwrightError, null);

    const broken = coverage(root, opts([], { error: 'npx không chạy được' }));
    assert.equal(broken.playwrightError, 'npx không chạy được');
  });
});

// ===========================================================================
// gaps()
// ===========================================================================

// Mốc im lặng: repo đủ tài liệu và đủ script thì KHÔNG kind nào được nổ. Mọi case
// "nổ" bên dưới chỉ có nghĩa khi mốc này sạch — nếu không thì không phân biệt được
// finding thật với nhiễu nền.
test('gaps: repo đầy đủ REQ -> AC -> TC -> script không sinh finding nào', () => {
  withRepo(DOCS, (root) => {
    assert.deepEqual(gaps(root, opts(CLEAN_TESTS)), []);
  });
});

test('gaps: requirement thiếu front-matter -> blocker requirement-khong-co-front-matter', () => {
  withRepo({
    ...DOCS,
    'requirements/REQ-002-khong-header.md': '# Một requirement viết tay\n\n### AC-001: gì đó\n',
  }, (root) => {
    const found = only(gaps(root, opts(CLEAN_TESTS)), 'requirement-khong-co-front-matter');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.equal(found[0].where, 'requirements/REQ-002-khong-header.md');
    assert.ok(found[0].action.includes('template'), 'phải chỉ được nơi copy khuôn mẫu');
  });
});

test('gaps: AC chưa ai thiết kế test case -> blocker ac-khong-co-test-case', () => {
  withRepo({
    ...DOCS,
    'requirements/REQ-001.md': `${REQ}\n### AC-003: Khoá tài khoản sau 5 lần sai\n\n**Given** x\n`,
  }, (root) => {
    const found = only(gaps(root, opts(CLEAN_TESTS)), 'ac-khong-co-test-case');
    assert.equal(found.length, 1, 'chỉ AC-003 thiếu, AC-001/AC-002 đã có TC');
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('AC-003'));
    assert.ok(found[0].where.startsWith('requirements/REQ-001.md:'));
  });
});

test('gaps: AC có test case nhưng chưa script nào -> major ac-chua-co-script', () => {
  withRepo({
    ...DOCS,
    'test-cases/REQ-001.md': mustReplace(TC, TC_002_YES, '| TC-002 | Candidate | - | P2 |'),
  }, (root) => {
    const found = only(gaps(root, opts([CLEAN_TESTS[0]])), 'ac-chua-co-script');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('TC-002'));
    assert.ok(
      !kindSet(gaps(root, opts([CLEAN_TESTS[0]]))).has('p0-p1-con-dang-candidate'),
      'P2 là candidate hợp lệ, không được lẫn thêm finding khác vào case này',
    );
  });
});

// Ranh giới quan trọng: "chưa automation" khác "đã quyết định làm thủ công".
// Nếu mất phân biệt này thì mọi case thủ công có chủ ý đều thành nợ giả.
test('gaps: ac-chua-co-script im lặng khi MỌI test case của AC đều Automation=No', () => {
  withRepo({
    ...DOCS,
    'test-cases/REQ-001.md': `${mustReplace(TC, TC_002_YES, '| TC-002 | No | - | P2 |')}
## Case không automation

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-002 | Cần tua thời gian server, staging chưa hỗ trợ | Test ở tầng API |
`,
  }, (root) => {
    const found = gaps(root, opts([CLEAN_TESTS[0]]));
    assert.deepEqual(only(found, 'ac-chua-co-script'), []);
    assert.deepEqual(only(found, 'khong-automation-nhung-khong-co-ly-do'), []);
  });
});

test('gaps: khai Automation=Yes nhưng không có script -> blocker (traceability nói dối)', () => {
  withRepo(DOCS, (root) => {
    const found = only(gaps(root, opts([CLEAN_TESTS[0]])), 'khai-automation-nhung-khong-co-script');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.equal(found[0].where, 'test-cases/REQ-001.md');
    assert.ok(found[0].message.includes('TC-002'));
  });
});

test('gaps: Automation=No mà không ghi lý do -> major khong-automation-nhung-khong-co-ly-do', () => {
  withRepo({
    ...DOCS,
    'test-cases/REQ-001.md': mustReplace(TC, TC_002_YES, '| TC-002 | No | - | P2 |'),
  }, (root) => {
    const found = only(gaps(root, opts([CLEAN_TESTS[0]])), 'khong-automation-nhung-khong-co-ly-do');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('TC-002'));
  });
});

// Lý do phải có cả cột "Bù đắp bằng gì"; một dòng chỉ có mã TC là dòng rỗng trá hình.
test('gaps: dòng lý do bỏ trống cột thứ hai không được tính là đã giải trình', () => {
  withRepo({
    ...DOCS,
    'test-cases/REQ-001.md': `${mustReplace(TC, TC_002_YES, '| TC-002 | No | - | P2 |')}
## Case không automation

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-002 |  |  |
`,
  }, (root) => {
    const found = only(gaps(root, opts([CLEAN_TESTS[0]])), 'khong-automation-nhung-khong-co-ly-do');
    assert.equal(found.length, 1, 'ô lý do rỗng thì nợ vẫn là nợ');
  });
});

test('gaps: P0/P1 còn Candidate -> major, nhưng P2 Candidate thì im lặng', () => {
  const asCandidate = (priority) =>
    mustReplace(TC, TC_002_YES, `| TC-002 | Candidate | - | ${priority} |`);

  withRepo({ ...DOCS, 'test-cases/REQ-001.md': asCandidate('P1') }, (root) => {
    const found = only(gaps(root, opts([CLEAN_TESTS[0]])), 'p0-p1-con-dang-candidate');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('P1'));
  });

  withRepo({ ...DOCS, 'test-cases/REQ-001.md': asCandidate('P2') }, (root) => {
    assert.deepEqual(
      only(gaps(root, opts([CLEAN_TESTS[0]])), 'p0-p1-con-dang-candidate'),
      [],
      'P2 nằm chờ là lựa chọn hợp lệ, không phải nợ',
    );
  });
});

test('gaps: dòng rule để trống cột Test cases -> major kèm gợi ý EP/BVA cần có', () => {
  withRepo({
    ...DOCS,
    'requirements/REQ-001.md': mustReplace(REQ, '| 254, 255 | Lỗi tại trường | TC-002 |', '| 254, 255 | Lỗi tại trường |  |'),
  }, (root) => {
    const found = only(gaps(root, opts(CLEAN_TESTS)), 'rule-chua-map-toi-test-case');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('Email'));
    // action phải liệt kê đủ ba lớp suy ra từ chính dòng rule, nếu không thì
    // người đọc vẫn không biết phải thêm case gì.
    assert.ok(found[0].action.includes('lớp hợp lệ'));
    assert.ok(found[0].action.includes('lớp không hợp lệ'));
    assert.ok(found[0].action.includes('giá trị biên'));
  });
});

test('gaps: dòng rule trỏ tới TC không tồn tại -> blocker rule-tro-toi-tc-khong-ton-tai', () => {
  withRepo({
    ...DOCS,
    'requirements/REQ-001.md': mustReplace(REQ, '| TC-002 |\n', '| TC-002, TC-999 |\n'),
  }, (root) => {
    const found = only(gaps(root, opts(CLEAN_TESTS)), 'rule-tro-toi-tc-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('TC-999'));
    assert.ok(!found[0].message.includes('TC-002'), 'chỉ nêu mã sai, không đổ lỗi cho mã đúng');
  });
});

// Chế độ hỏng nguy hiểm nhất: sai projectDir/project thì đọc được 0 spec, mọi phép
// đối chiếu đều xanh vì không có gì để so, và báo cáo trông y hệt một repo sạch.
test('gaps: repo CÓ test case mà đọc được 0 spec -> blocker doc-duoc-0-spec', () => {
  withRepo(DOCS, (root) => {
    const found = only(
      gaps(root, { ...opts([], { emptyResult: true, emptyMessage: 'Đọc được 0 test' }), projectDir: 'e2e' }),
      'doc-duoc-0-spec',
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.equal(found[0].where, 'e2e', 'phải chỉ đúng thư mục đang bị nghi sai');
    assert.equal(found[0].message, 'Đọc được 0 test');
    assert.ok(found[0].action.includes('qa.config.json'));
  });
});

// Mặt còn lại và cũng là lý do finding này khó: repo mới dựng chưa có test case nào
// thì 0 spec là đúng sự thật. Bật gate đỏ ngay ngày đầu sẽ khiến cả đội quen bỏ qua nó.
test('gaps: repo CHƯA có test case nào thì doc-duoc-0-spec phải im lặng', () => {
  withRepo({ 'requirements/REQ-001.md': REQ }, (root) => {
    const found = gaps(root, opts([], { emptyResult: true, emptyMessage: 'Đọc được 0 test' }));
    assert.deepEqual(only(found, 'doc-duoc-0-spec'), []);
    assert.ok(
      found.every((f) => f.severity !== 'blocker' || f.kind !== 'doc-duoc-0-spec'),
      'repo đang dựng dở không được nhận gate đỏ vì lý do này',
    );
  });
});

test('gaps: khi playwright lỗi hẳn thì báo khong-doc-duoc-playwright, không báo doc-duoc-0-spec', () => {
  withRepo(DOCS, (root) => {
    const found = gaps(root, opts([], { error: 'Không thấy thư mục playwright', emptyResult: true }));
    assert.deepEqual(only(found, 'doc-duoc-0-spec'), [], 'hai finding cùng nói một chuyện là nhiễu');
    const err = only(found, 'khong-doc-duoc-playwright');
    assert.equal(err.length, 1);
    assert.equal(err[0].severity, 'blocker');
    assert.equal(err[0].message, 'Không thấy thư mục playwright');
  });
});

// ===========================================================================
// drift()
// ===========================================================================

test('drift: repo sạch không sinh finding nào', () => {
  withRepo(DOCS, (root) => {
    assert.deepEqual(drift(root, opts(CLEAN_TESTS)), []);
  });
});

test('drift: test không mở đầu bằng TC-xxx -> major test-khong-co-ma-tc', () => {
  withRepo(DOCS, (root) => {
    const tests = [...CLEAN_TESTS, spec('đăng nhập rồi làm gì đó', { file: 'playwright/tests/lac.spec.js', line: 4 })];
    const found = only(drift(root, opts(tests)), 'test-khong-co-ma-tc');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.equal(found[0].where, 'playwright/tests/lac.spec.js:4', 'where phải mở được từ gốc repo');
    // Không có mã TC thì dừng luôn, không đổ thêm finding về REQ/AC lên cùng một test.
    assert.deepEqual(only(drift(root, opts(tests)), 'script-khong-co-trong-test-case'), []);
  });
});

test('drift: test có mã TC nhưng thiếu tag @REQ -> major test-thieu-tag-req', () => {
  withRepo(DOCS, (root) => {
    const tests = [CLEAN_TESTS[0], spec('TC-002 - AC-002 hiện lỗi chung', { reqId: null, line: 15 })];
    const found = only(drift(root, opts(tests)), 'test-thieu-tag-req');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('TC-002'));
  });
});

test('drift: test gắn REQ đã bị xoá -> blocker test-tro-toi-req-khong-ton-tai', () => {
  withRepo(DOCS, (root) => {
    const tests = [CLEAN_TESTS[0], spec('TC-002 - AC-002 hiện lỗi chung', { reqId: 'REQ-404' })];
    const found = only(drift(root, opts(tests)), 'test-tro-toi-req-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('REQ-404'));
  });
});

// AC bị xoá hoặc đổi số là cách traceability mục âm thầm nhất: script vẫn chạy,
// vẫn xanh, nhưng đang phủ một điều khoản không còn tồn tại trong requirement.
test('drift: test trỏ tới AC đã biến mất -> blocker test-tro-toi-ac-khong-ton-tai', () => {
  withRepo(DOCS, (root) => {
    const tests = [CLEAN_TESTS[0], spec('TC-002 - AC-009 hiện lỗi chung')];
    const found = only(drift(root, opts(tests)), 'test-tro-toi-ac-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('AC-009'));
  });
});

test('drift: script có mã TC lạ so với bảng traceability -> major script-khong-co-trong-test-case', () => {
  withRepo(DOCS, (root) => {
    const tests = [...CLEAN_TESTS, spec('TC-777 - AC-001 case ai đó thêm tay', { line: 30 })];
    const found = only(drift(root, opts(tests)), 'script-khong-co-trong-test-case');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('TC-777'));
  });
});

test('drift: front-matter test_cases trỏ sai file -> blocker test-case-file-khong-ton-tai', () => {
  withRepo({
    ...DOCS,
    'requirements/REQ-001.md': mustReplace(REQ, 'test_cases: test-cases/REQ-001.md', 'test_cases: test-cases/da-doi-ten.md'),
  }, (root) => {
    const found = only(drift(root, opts(CLEAN_TESTS)), 'test-case-file-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.equal(found[0].where, 'requirements/REQ-001.md');
    assert.ok(found[0].message.includes('test-cases/da-doi-ten.md'));
  });

  // Mặt im lặng: `test_cases` là đường dẫn tương đối gốc repo. Ai đó đổi sang
  // path tuyệt đối hay quên join với root thì case này đỏ ngay.
  withRepo(DOCS, (root) => {
    assert.deepEqual(only(drift(root, opts(CLEAN_TESTS)), 'test-case-file-khong-ton-tai'), []);
  });
});

test('drift: requirement còn Draft mà đã có script -> major requirement-draft-nhung-da-co-script', () => {
  withRepo({ ...DOCS, 'requirements/REQ-001.md': mustReplace(REQ, 'status: Ready for Test', 'status: Draft') }, (root) => {
    const found = only(drift(root, opts(CLEAN_TESTS)), 'requirement-draft-nhung-da-co-script');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.equal(found[0].where, 'requirements/REQ-001.md');
  });

  withRepo(DOCS, (root) => {
    assert.deepEqual(
      only(drift(root, opts(CLEAN_TESTS)), 'requirement-draft-nhung-da-co-script'),
      [],
      'status Ready for Test thì có script là đúng, không phải drift',
    );
  });
});

// File setup là hạ tầng đăng nhập/seed nên không có mã TC và không có tag REQ.
// Nếu drift ngừng bỏ qua nó thì mọi repo dùng storageState sẽ đỏ vĩnh viễn.
test('drift: file *.setup.* được bỏ qua hoàn toàn, không đòi mã TC hay tag REQ', () => {
  withRepo(DOCS, (root) => {
    const tests = [
      ...CLEAN_TESTS,
      spec('đăng nhập lấy storageState', { file: 'playwright/tests/auth.setup.ts', reqId: null, isSetup: true }),
    ];
    assert.deepEqual(drift(root, opts(tests)), []);
  });
});

test('drift: cũng phải hét lên khi đọc được 0 spec mà repo đã có test case', () => {
  withRepo(DOCS, (root) => {
    const found = only(
      drift(root, opts([], { emptyResult: true, emptyMessage: 'Đọc được 0 test' })),
      'doc-duoc-0-spec',
    );
    assert.equal(found.length, 1, 'drift im lặng khi không đọc được spec chính là xanh giả');
    assert.equal(found[0].severity, 'blocker');
  });
});

// ===========================================================================
// impact()
// ===========================================================================

test('impact: trả về cây AC -> TC -> spec và danh sách file cần mở', () => {
  withRepo(DOCS, (root) => {
    const r = impact(root, 'REQ-001', opts(CLEAN_TESTS));
    assert.equal(r.error, undefined);
    assert.equal(r.requirement.id, 'REQ-001');
    assert.equal(r.requirement.status, 'Ready for Test');
    assert.equal(r.requirement.version, '1.0');
    assert.equal(r.requirement.file, 'requirements/REQ-001.md');

    assert.deepEqual(r.acs.map((ac) => ac.acId), ['AC-001', 'AC-002']);
    const ac1 = r.acs[0];
    assert.deepEqual(ac1.testCases.map((tc) => tc.tcId), ['TC-001']);
    assert.equal(ac1.testCases[0].automation, 'Yes');
    assert.equal(ac1.testCases[0].priority, 'P0');
    assert.deepEqual(ac1.testCases[0].specs, ['playwright/tests/login.spec.js:7']);

    // Hai file tài liệu luôn phải có mặt, nếu không thì người sửa requirement
    // sẽ chỉ mở script mà quên cập nhật chính bảng traceability.
    assert.ok(r.filesToReview.includes('requirements/REQ-001.md'));
    assert.ok(r.filesToReview.includes('test-cases/REQ-001.md'));
    assert.ok(r.filesToReview.includes('playwright/tests/login.spec.js:7'));
  });
});

test('impact: AC chưa có script thì specs rỗng chứ không phải thiếu nhánh', () => {
  withRepo(DOCS, (root) => {
    const r = impact(root, 'REQ-001', opts([CLEAN_TESTS[0]]));
    const ac2 = r.acs.find((ac) => ac.acId === 'AC-002');
    assert.equal(ac2.testCases.length, 1);
    assert.deepEqual(ac2.testCases[0].specs, [], 'index.js dựa vào đây để in "khai Yes nhưng không có script"');
  });
});

test('impact: REQ không tồn tại -> trả error, không ném exception', () => {
  withRepo(DOCS, (root) => {
    const r = impact(root, 'REQ-404', opts(CLEAN_TESTS));
    assert.ok(r.error, 'phải trả lỗi để index.js đặt exit code 2');
    assert.ok(r.error.includes('REQ-404'));
    assert.equal(r.acs, undefined);
  });
});

test('gaps: phát hiện spec thiếu assertion (assertionCount = 0)', () => {
  withRepo(DOCS, (root) => {
    const tests = [
      spec('TC-001 - AC-001 login', { assertionCount: 0 }),
      spec('TC-002 - AC-002 wrong pass', { assertionCount: 1 }),
    ];
    const findings = gaps(root, opts(tests));
    const f = findings.find((x) => x.kind === 'spec-thieu-assertion');
    assert.ok(f, 'phải có finding spec-thieu-assertion');
    assert.equal(f.severity, 'major');
    assert.match(f.message, /TC-001/);
  });
});

test('gaps: phát hiện test bị skip âm thầm không có @wip', () => {
  withRepo(DOCS, (root) => {
    const tests = [
      spec('TC-001 - AC-001 login', { isSkipped: true }),
      spec('TC-002 - AC-002 wrong pass', { isSkipped: true, reqId: 'REQ-001' }),
    ];
    // Gắn tag @wip cho TC-002
    tests[1].tags = ['@wip'];
    const findings = gaps(root, opts(tests));
    const skippedFindings = findings.filter((x) => x.kind === 'test-bi-skip-am-tham');
    assert.equal(skippedFindings.length, 1);
    assert.match(skippedFindings[0].message, /TC-001/);
  });
});

test('gaps: phát hiện rule có nhiều giá trị biên nhưng chỉ gán 1 test case', () => {
  const repoWithMultiBoundary = {
    ...DOCS,
    'requirements/REQ-001.md': `---
id: REQ-001
status: Ready for Test
test_cases: test-cases/REQ-001.md
---
# REQ-001
## Acceptance criteria
### AC-001: Happy path
### AC-002: Error
## Rules and validation
| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Age | 18-65 | <18, >65 | 17, 18, 65, 66 | Valid/Invalid | TC-001 |
`,
  };
  withRepo(repoWithMultiBoundary, (root) => {
    const findings = gaps(root, { ...opts(CLEAN_TESTS), checkBoundaryRules: true });
    const f = findings.find((x) => x.kind === 'rule-thieu-boundary-test');
    assert.ok(f, 'phải có finding rule-thieu-boundary-test mức minor');
    assert.equal(f.severity, 'minor');
    assert.match(f.message, /Age/);
  });
});

test('matrix: sinh file traceability.md với đầy đủ cột và đúng số dòng', () => {
  withRepo(DOCS, (root) => {
    const res = matrix(root, opts(CLEAN_TESTS));
    assert.equal(res.ok, true);
    assert.equal(res.rowsCount, 2);
    const traceFile = path.join(root, 'test-cases/traceability.md');
    assert.ok(fs.existsSync(traceFile));
    const content = fs.readFileSync(traceFile, 'utf8');
    assert.match(content, /# Ma Trận Truy Vết Kiểm Thử/);
    assert.match(content, /TC-001.*Yes \(Automated\)/);
    assert.match(content, /TC-002.*Yes \(Automated\)/);
  });
});

test('matrix: hoàn toàn tất định (không có timestamp, 2 lần sinh cho kết quả byte khớp 100%)', () => {
  withRepo(DOCS, (root) => {
    matrix(root, opts(CLEAN_TESTS));
    const traceFile = path.join(root, 'test-cases/traceability.md');
    const content1 = fs.readFileSync(traceFile, 'utf8');
    assert.equal(content1.includes('Sinh tự động lúc:'), false, 'không được chứa timestamp ISO');

    // Chạy lại lần 2
    matrix(root, opts(CLEAN_TESTS));
    const content2 = fs.readFileSync(traceFile, 'utf8');
    assert.equal(content1, content2, 'hai lần sinh phải cho byte giống hệt nhau');
  });
});

test('gaps: hai file cùng id REQ -> ma-req-trung mức blocker', () => {
  const repo = {
    ...DOCS,
    'requirements/REQ-001-dup.md': REQ.replace('title: Đăng nhập', 'title: Đăng nhập bản sao'),
  };
  withRepo(repo, (root) => {
    const findings = gaps(root, opts(CLEAN_TESTS));
    const f = findings.find((x) => x.kind === 'ma-req-trung');
    assert.ok(f, 'phải có finding ma-req-trung');
    assert.equal(f.severity, 'blocker');
    assert.match(f.message, /REQ-001/);
  });
});

test('gaps: trùng mã TC trong bảng traceability -> ma-tc-trung mức major', () => {
  const dupTcDoc = TC.replace('| REQ-001 | AC-002 | TC-002 |', '| REQ-001 | AC-002 | TC-001 |');
  const repo = {
    ...DOCS,
    'test-cases/REQ-001.md': dupTcDoc,
  };
  withRepo(repo, (root) => {
    const findings = gaps(root, opts(CLEAN_TESTS));
    const f = findings.find((x) => x.kind === 'ma-tc-trung');
    assert.ok(f, 'phải có finding ma-tc-trung');
    assert.equal(f.severity, 'major');
    assert.match(f.message, /TC-001/);
  });
});

test('gaps: trùng mã AC trong cùng một requirement -> ma-ac-trung mức major', () => {
  const dupAcReq = mustReplace(REQ, '### AC-002: Sai mật khẩu bị từ chối', '### AC-001: Sai mật khẩu bị từ chối');
  const repo = {
    ...DOCS,
    'requirements/REQ-001.md': dupAcReq,
  };
  withRepo(repo, (root) => {
    const findings = gaps(root, opts(CLEAN_TESTS));
    const f = findings.find((x) => x.kind === 'ma-ac-trung');
    assert.ok(f, 'phải có finding ma-ac-trung');
    assert.equal(f.severity, 'major');
    assert.match(f.message, /AC-001/);
  });
});

test('gaps: AC chỉ có script mang tag @wip -> ac-chi-co-script-wip mức minor', () => {
  const wipTests = [
    { ...spec('TC-001 - AC-001 valid'), tags: ['@REQ-001', '@wip'] },
    { ...spec('TC-002 - AC-002 invalid'), tags: ['@REQ-001', '@wip'] },
  ];
  withRepo(DOCS, (root) => {
    const findings = gaps(root, opts(wipTests));
    const f = findings.find((x) => x.kind === 'ac-chi-co-script-wip');
    assert.ok(f, 'phải có finding ac-chi-co-script-wip');
    assert.equal(f.severity, 'minor');
  });
});

test('drift: requirement Draft có script nhưng toàn bộ mang tag @wip -> requirement-moi-scaffold-chua-hoan-thien mức minor', () => {
  const draftReq = REQ.replace('status: Ready for Test', 'status: Draft');
  const wipTests = [
    { ...spec('TC-001 - AC-001 valid'), tags: ['@REQ-001', '@wip'] },
    { ...spec('TC-002 - AC-002 invalid'), tags: ['@REQ-001', '@wip'] },
  ];
  const repo = {
    ...DOCS,
    'requirements/REQ-001.md': draftReq,
  };
  withRepo(repo, (root) => {
    const findings = drift(root, opts(wipTests));
    const f = findings.find((x) => x.kind === 'requirement-moi-scaffold-chua-hoan-thien');
    assert.ok(f, 'phải có finding requirement-moi-scaffold-chua-hoan-thien');
    assert.equal(f.severity, 'minor');
    const major = findings.find((x) => x.kind === 'requirement-draft-nhung-da-co-script');
    assert.equal(major, undefined, 'không được báo major khi script toàn @wip');
  });
});

test('gaps: rule có nhiều giá trị Invalid (phân tách bởi dấu phẩy) chỉ gán 1 TC -> rule-thieu-boundary-test', () => {
  const repoWithMultiInvalid = {
    ...DOCS,
    'requirements/REQ-001.md': `---
id: REQ-001
title: Đăng nhập
status: Ready for Test
test_cases: test-cases/REQ-001.md
---
# REQ-001
## Acceptance criteria
### AC-001: Happy path
### AC-002: Error
## Rules and validation
| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | user@example.com | missing-at, missing-domain, spaces | - | Báo lỗi định dạng | TC-002 |
`,
  };
  withRepo(repoWithMultiInvalid, (root) => {
    const findings = gaps(root, { ...opts(CLEAN_TESTS), checkBoundaryRules: true });
    const f = findings.find((x) => x.kind === 'rule-thieu-boundary-test');
    assert.ok(f, 'phải có finding rule-thieu-boundary-test khi Invalid có nhiều giá trị');
    assert.equal(f.severity, 'minor');
    assert.match(f.message, /Email/);
    assert.match(f.message, /nhiều giá trị không hợp lệ/);
  });
});

test('gaps: spec khai đường dẫn không tồn tại -> spec-khong-ton-tai mức major', () => {
  const ghostSpecTc = mustReplace(TC, '`tests/login.spec.js`', '`tests/ghost-file.spec.js`');
  const repo = {
    ...DOCS,
    'test-cases/REQ-001.md': ghostSpecTc,
  };
  withRepo(repo, (root) => {
    const findings = gaps(root, opts(CLEAN_TESTS));
    const f = findings.find((x) => x.kind === 'spec-khong-ton-tai');
    assert.ok(f, 'phải có finding spec-khong-ton-tai');
    assert.equal(f.severity, 'major');
    assert.match(f.message, /ghost-file\.spec\.js/);
  });
});

test('summary: trả về đúng cấu trúc schema và các metrics cơ bản', () => {
  withRepo(DOCS, (root) => {
    const res = summary(root, opts(CLEAN_TESTS));
    assert.equal(res.schemaVersion, '1.0.0');
    assert.ok(res.timestamp);
    assert.equal(typeof res.metrics.coveragePercent, 'number');
    assert.equal(res.metrics.requirements, 1);
    assert.equal(res.metrics.acceptanceCriteria, 2);
    assert.ok(res.health);
    assert.ok(res.boundary);
    assert.ok(res.decisions);
    assert.ok(Array.isArray(res.findings));
  });
});

test('summary: phân loại HEALTHY khi không có blocker/major và decisions sạch', () => {
  // Manifest phải khai đúng những gì DOCS tạo ra. Trước đây test dùng manifest RỖNG
  // và vẫn xanh, vì summary() không hề chạy analyse() — chính là lỗi đang sửa.
  const cleanManifest = JSON.stringify({
    ship: [],
    seed: [],
    own: [
      { path: 'requirements', reason: 'x' },
      { path: 'test-cases', reason: 'x' },
      { path: 'decisions.json', reason: 'x' },
    ],
  });
  const repo = {
    ...DOCS,
    'sync-manifest.json': cleanManifest,
    'decisions.json': JSON.stringify({ decisions: [{ id: 'D-1', severity: 'soon', answer: { optionId: 'opt-1' } }] }),
  };
  withRepo(repo, (root) => {
    const res = summary(root, opts(CLEAN_TESTS));
    assert.equal(res.health.status, 'HEALTHY');
    assert.equal(res.systemHealth, 'HEALTHY');
  });
});

test('summary: phân loại WARNING khi có major finding hoặc blocking decision chờ duyệt', () => {
  const repo = {
    ...DOCS,
    'sync-manifest.json': JSON.stringify({
      ship: [],
      seed: [],
      own: [
      { path: 'requirements', reason: 'x' },
      { path: 'test-cases', reason: 'x' },
      { path: 'decisions.json', reason: 'x' },
    ],
    }),
    'decisions.json': JSON.stringify({ decisions: [{ id: 'D-1', severity: 'blocking', answer: null }] }),
  };
  withRepo(repo, (root) => {
    const res = summary(root, opts(CLEAN_TESTS));
    assert.equal(res.health.status, 'WARNING');
    assert.equal(res.systemHealth, 'WARNING');
    assert.equal(res.decisions.blocking, 1);
  });
});

test('gaps: phát hiện finding assertion-thieu-await khi matcher async thiếu await', () => {
  withRepo(DOCS, (root) => {
    const testsWithMissingAwait = [
      ...CLEAN_TESTS,
      spec('TC-004 - AC-001 kiểm tra thiếu await', {
        missingAwaits: [{ line: 20, text: "expect(page.locator('#btn')).toBeVisible();" }],
      }),
    ];
    const findings = gaps(root, opts(testsWithMissingAwait));
    const f = findings.find((x) => x.kind === 'assertion-thieu-await');
    assert.ok(f, 'phải có finding assertion-thieu-await');
    assert.equal(f.severity, 'major');
    assert.match(f.message, /thiếu "await"/);
  });
});

test('collect/coverage: bộ lọc filterReq chỉ tính requirement được chỉ định', () => {
  const repoWithTwoReqs = {
    ...DOCS,
    'requirements/REQ-002.md': '---\nid: REQ-002\ntitle: Hai\nstatus: Approved\n---\n\n### AC-001\n',
    'test-cases/REQ-002.md': '# TC 2\n\n## Traceability\n| Req | AC | TC | Status | Spec | Priority |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| REQ-002 | AC-001 | TC-020 | Yes | `tests/two.spec.js` | P1 |\n',
  };
  withRepo(repoWithTwoReqs, (root) => {
    const res = coverage(root, { ...opts(CLEAN_TESTS), filterReq: 'REQ-002' });
    assert.equal(res.requirements, 1);
    assert.equal(res.rows[0].reqId, 'REQ-002');
  });
});

test('collect/coverage: bộ lọc filterDomain chỉ tính các test thuộc domain', () => {
  const tests = [
    spec('TC-001 - AC-001 login', { file: 'playwright/tests/auth/login.spec.js' }),
    spec('TC-002 - AC-002 cart', { file: 'playwright/tests/cart/cart.spec.js' }),
  ];
  withRepo(DOCS, (root) => {
    const res = coverage(root, { ...opts(tests), filterDomain: 'auth' });
    const tcIds = res.rows.flatMap((r) => r.testCases);
    assert.ok(tcIds.includes('TC-001'));
  });
});

test('collect/coverage: bộ lọc filterTag chỉ tính các test có tag chỉ định', () => {
  const tests = [
    spec('TC-001 - AC-001 login', { tags: ['@smoke', 'REQ-001'] }),
    spec('TC-002 - AC-002 other', { tags: ['@regression', 'REQ-001'] }),
  ];
  withRepo(DOCS, (root) => {
    const res = coverage(root, { ...opts(tests), filterTag: '@smoke' });
    const automatedIds = res.rows.flatMap((r) => r.automated);
    assert.ok(automatedIds.includes('TC-001'));
    assert.equal(automatedIds.includes('TC-002'), false);
  });
});




// --- Plan 13 / fix 1: summary phải CHẠY kiểm tra ranh giới, không được mặc định ---
// Bản cũ chỉ đếm số mục ship/seed/own rồi luôn báo 'ALIGNED', nên `boundary --strict`
// exit 1 mà dashboard vẫn in đèn xanh.

const MANIFEST_OK = JSON.stringify({
  ship: [{ path: 'templates', reason: 'x' }],
  seed: [{ path: 'qa.config.json', reason: 'x' }],
  own: [{ path: 'requirements', reason: 'x' }, { path: 'test-cases', reason: 'x' }],
});

test('summary: manifest khớp thực tế -> boundary ALIGNED, không có problem', () => {
  withRepo(
    {
      'sync-manifest.json': MANIFEST_OK,
      'templates/a.md': 'x',
      'qa.config.json': '{}',
      'requirements/REQ-001-x.md': '---\nid: REQ-001\n---\n\n## AC-001: a\n',
      'test-cases/REQ-001-x.md': '# t\n\n## Traceability\n\n| R | A | T | Au | S | P |\n|---|---|---|---|---|---|\n| REQ-001 | AC-001 | TC-001 | Yes | `x` | P0 |\n',
    },
    (root) => {
      const res = summary(root, opts([
        { tcId: 'TC-001', acId: 'AC-001', reqId: 'REQ-001', tags: ['@REQ-001'], path: 'x.spec.ts', line: 1, assertionCount: 1 },
      ]));
      assert.equal(res.boundary.status, 'ALIGNED');
      assert.deepEqual(res.boundary.problems, []);
      assert.equal(res.boundary.ownCount, 2);
    },
  );
});

test('summary: có thư mục business nằm trong vùng sync -> DRIFTED kèm lý do', () => {
  withRepo(
    {
      'sync-manifest.json': MANIFEST_OK,
      // `templates` là ship; nhét một thư mục business vào trong -> Hub sẽ ghi đè.
      'templates/requirements/leak.md': 'x',
      'qa.config.json': '{}',
      'requirements/REQ-001-x.md': '---\nid: REQ-001\n---\n\n## AC-001: a\n',
      'test-cases/REQ-001-x.md': '# t\n\n## Traceability\n\n| R | A | T | Au | S | P |\n|---|---|---|---|---|---|\n| REQ-001 | AC-001 | TC-001 | Yes | `x` | P0 |\n',
    },
    (root) => {
      const res = summary(root, opts([
        { tcId: 'TC-001', acId: 'AC-001', reqId: 'REQ-001', tags: ['@REQ-001'], path: 'x.spec.ts', line: 1, assertionCount: 1 },
      ]));
      assert.equal(res.boundary.status, 'DRIFTED');
      assert.ok(res.boundary.problems.some((p) => p.kind === 'business-nam-trong-vung-sync'));
      // Ranh giới hỏng phải kéo sức khoẻ hệ thống xuống, không chỉ đổi một nhãn.
      assert.equal(res.health.status, 'CRITICAL');
    },
  );
});

test('summary: thiếu sync-manifest.json -> MISSING, không phải ALIGNED', () => {
  withRepo(
    {
      'requirements/REQ-001-x.md': '---\nid: REQ-001\n---\n\n## AC-001: a\n',
      'test-cases/REQ-001-x.md': '# t\n\n## Traceability\n\n| R | A | T | Au | S | P |\n|---|---|---|---|---|---|\n| REQ-001 | AC-001 | TC-001 | Yes | `x` | P0 |\n',
    },
    (root) => {
      const res = summary(root, opts([
        { tcId: 'TC-001', acId: 'AC-001', reqId: 'REQ-001', tags: ['@REQ-001'], path: 'x.spec.ts', line: 1, assertionCount: 1 },
      ]));
      assert.equal(res.boundary.status, 'MISSING');
    },
  );
});
