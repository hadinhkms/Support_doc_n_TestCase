'use strict';
/**
 * Unit test cho tầng ĐỌC NGUỒN của tools/qa.
 *
 * Vì sao bộ test này tồn tại: các test của commands.js kiểm phần JOIN bằng dữ liệu
 * dựng sẵn, nên chúng mã hoá những gì sources.js ĐƯỢC TIN là trả về. Đổi hình dạng
 * đầu ra ở đây (thiếu một trường, đổi tên trường, đổi cách chuẩn hoá) sẽ để toàn bộ
 * chúng xanh nguyên trong khi tool thật đọc sai. Bộ test này chạy trên file markdown
 * thật trong thư mục tạm để đóng lỗ đó.
 *
 * Không đụng loadAutomatedTests: hàm đó gọi `npx playwright --list`, cần browser và
 * npm install nên không thuộc phạm vi unit test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadRequirements, loadTestCases, parseFrontMatter, findMissingAwaits } = require('./sources');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sources-'));
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

/**
 * Số dòng THẬT (1-based) của dòng đầu tiên chứa `needle` trong fixture.
 * Ném lỗi nếu fixture đã đổi: một helper trả về -1 âm thầm sẽ biến case số dòng
 * thành "so sánh hai con số cùng sai" — xanh vì sai, kiểu hỏng khó thấy nhất.
 */
function lineOf(text, needle) {
  const i = text.split('\n').findIndex((l) => l.includes(needle));
  if (i === -1) throw new Error(`Fixture không còn dòng nào chứa: ${needle}`);
  return i + 1;
}

/** Ghi fixture với CRLF + BOM để mô phỏng file do editor Windows lưu ra. */
const asWindowsFile = (text) => `﻿${text.replace(/\n/g, '\r\n')}`;

// ===========================================================================
// parseFrontMatter
// ===========================================================================

// `offset` là số dòng front-matter đã ăn mất. Mọi finding trỏ vào AC đều cộng con
// số này vào; trả sai thì link "mở file tại dòng N" nhảy sai chỗ đúng bằng độ dài
// front-matter — càng thêm metadata càng lệch xa.
test('parseFrontMatter: không có front-matter -> offset 0 và body giữ nguyên từng ký tự', () => {
  const text = '# REQ-001\n\n### AC-001: x\n';
  const r = parseFrontMatter(text);
  assert.deepEqual(r.data, {});
  assert.equal(r.body, text, 'không được cắt xén gì khi file không mở front-matter');
  assert.equal(r.offset, 0);
});

test('parseFrontMatter: có front-matter -> data đủ khoá, body bắt đầu sau dấu đóng, offset đếm đúng', () => {
  const r = parseFrontMatter('---\nid: REQ-001\ntitle: Đăng nhập\n---\n\n# REQ-001\n');
  assert.deepEqual(r.data, { id: 'REQ-001', title: 'Đăng nhập' });
  assert.ok(!r.body.includes('id: REQ-001'), 'front-matter không được lọt xuống body');
  assert.ok(r.body.includes('# REQ-001'));
  // Front-matter chiếm 4 dòng (---, id, title, ---), nhưng body vẫn giữ lại dòng
  // nối sau dấu đóng nên offset đúng là 3. Đây chính là con số cộng vào dòng của AC.
  assert.equal(r.offset, 3);
});

// Thêm metadata vào front-matter là việc xảy ra liên tục (owner, risk, sprint...).
// Nếu offset không lớn lên theo thì độ lệch số dòng tăng dần mà không ai để ý.
test('parseFrontMatter: offset lớn lên đúng bằng số dòng metadata thêm vào', () => {
  for (const keyCount of [1, 2, 5, 9]) {
    const keys = Array.from({ length: keyCount }, (_, i) => `k${i}: v${i}`).join('\n');
    const r = parseFrontMatter(`---\n${keys}\n---\nbody\n`);
    assert.equal(Object.keys(r.data).length, keyCount);
    assert.equal(r.offset, keyCount + 1, `front-matter ${keyCount} khoá phải cho offset ${keyCount + 1}`);
  }
});

// Quên dấu `---` đóng là lỗi gõ tay rất hay gặp. Phải coi như file không có
// front-matter (để loadRequirements báo missingFrontMatter) chứ không được nuốt
// nửa nội dung file làm metadata.
test('parseFrontMatter: mở mà không đóng -> coi như không có front-matter, body nguyên vẹn', () => {
  const text = '---\nid: REQ-001\n\n# REQ-001\n\n### AC-001: x\n';
  const r = parseFrontMatter(text);
  assert.deepEqual(r.data, {});
  assert.equal(r.body, text);
  assert.equal(r.offset, 0);
});

test('parseFrontMatter: giá trị bọc nháy đơn/kép bị bóc và cắt khoảng trắng thừa', () => {
  const r = parseFrontMatter('---\na: "Đăng nhập"\nb: \'Auth squad\'\nc:    spaced   \n---\nbody\n');
  assert.equal(r.data.a, 'Đăng nhập', 'nháy kép phải bị bóc, nếu không title in ra kèm dấu nháy');
  assert.equal(r.data.b, 'Auth squad');
  assert.equal(r.data.c, 'spaced');
});

// `id:` bỏ trống phải ra chuỗi rỗng (falsy) để loadRequirements xếp vào
// missingFrontMatter. Nếu trả undefined hay ' ' thì một requirement không có id
// vẫn trôi qua và mọi phép join theo id sẽ hụt trong im lặng.
test('parseFrontMatter: khoá khai mà bỏ trống giá trị -> chuỗi rỗng', () => {
  const r = parseFrontMatter('---\nid:\ntitle:   \n---\nbody\n');
  assert.equal(r.data.id, '');
  assert.equal(r.data.title, '');
  assert.ok('id' in r.data, 'khoá vẫn phải tồn tại để phân biệt "bỏ trống" với "không khai"');
});

test('parseFrontMatter: dòng không theo khuôn key: value bị bỏ qua, không làm hỏng khoá khác', () => {
  const r = parseFrontMatter('---\n# ghi chú\n- một gạch đầu dòng\nid: REQ-001\n---\nbody\n');
  assert.deepEqual(r.data, { id: 'REQ-001' });
});

test('parseFrontMatter: front-matter rỗng vẫn cho offset đúng', () => {
  const r = parseFrontMatter('---\n---\nbody\n');
  assert.deepEqual(r.data, {});
  assert.equal(r.offset, 1);
  assert.ok(r.body.includes('body'));
});

// ===========================================================================
// loadRequirements
// ===========================================================================

const REQ_FULL = `---
id: REQ-001
title: "Đăng nhập bằng email và mật khẩu"
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
slug: sign-in
test_cases: test-cases/REQ-001.md
---

# REQ-001: Đăng nhập

## Acceptance criteria

### AC-001: Đăng nhập thành công với credential hợp lệ

**Given** tài khoản active **Then** vào dashboard

### AC-002 - Credential sai bị từ chối

**Given** ở /login **Then** hiện lỗi chung

#### AC-003 Email sai định dạng bị chặn ở client

### AC-004

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | \`a@b.com\` | \`not-an-email\` | 254, 255 | Lỗi tại trường | TC-004, TC-012 |
| Password | 8-64 ký tự | rỗng | 8, 64, 65 | Lỗi validation | |

## Non-functional expectations

| Mục | Giá trị |
|---|---|
| Performance | p95 < 1s |
`;

test('loadRequirements: đọc đủ id/title/status/version/risk/owner/testCaseFile từ front-matter', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.id, 'REQ-001');
    assert.equal(req.title, 'Đăng nhập bằng email và mật khẩu');
    assert.equal(req.status, 'Ready for Test');
    assert.equal(req.version, '1.0');
    assert.equal(req.risk, 'High');
    assert.equal(req.owner, 'Auth squad');
    // Khoá `test_cases` được đổi tên thành `testCaseFile`: drift dùng nó để kiểm
    // requirement có trỏ tới file test case có thật hay không.
    assert.equal(req.testCaseFile, 'test-cases/REQ-001.md');
    assert.equal(req.file, 'requirements/REQ-001.md', 'đường dẫn phải tính từ gốc repo và dùng dấu /');
    assert.equal(req.missingFrontMatter, undefined);
  });
});

// Requirement thiếu metadata vẫn phải dùng được: mọi trường phải có giá trị mặc
// định xác định, nếu không thì mọi chỗ in ra sẽ hiện "undefined".
test('loadRequirements: khoá không khai -> status "Unknown", các trường còn lại là chuỗi rỗng', () => {
  withRepo({ 'requirements/a.md': '---\nid: REQ-002\n---\n\n### AC-001: x\n' }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.status, 'Unknown', '"Unknown" là cờ để drift không nhầm với Draft');
    assert.equal(req.title, '');
    assert.equal(req.version, '');
    assert.equal(req.risk, '');
    assert.equal(req.owner, '');
    assert.equal(req.testCaseFile, '');
  });
});

// File không có id là file tool KHÔNG join được. Phải trả về bản ghi có cờ để
// commands.js bắn finding `requirement-khong-co-front-matter`; bỏ qua im lặng
// nghĩa là một requirement biến mất khỏi mọi báo cáo.
test('loadRequirements: thiếu id -> { id: null, missingFrontMatter: true } với acs/rules rỗng', () => {
  withRepo({
    'requirements/a.md': '---\ntitle: Không có id\n---\n\n### AC-001: vẫn có AC\n',
    'requirements/b.md': '# Không có front-matter\n\n### AC-001: x\n',
    'requirements/c.md': '---\nid:\n---\n\n### AC-001: id bỏ trống\n',
  }, (root) => {
    const reqs = loadRequirements(root);
    assert.equal(reqs.length, 3);
    for (const req of reqs) {
      assert.equal(req.id, null, `${req.file} không có id nên id phải là null`);
      assert.equal(req.missingFrontMatter, true);
      assert.deepEqual(req.acs, [], 'không có id thì AC không gắn được vào đâu');
      assert.deepEqual(req.rules, []);
    }
  });
});

test('loadRequirements: thư mục requirements không tồn tại -> mảng rỗng, không ném', () => {
  withRepo({ 'README.md': '# repo trống' }, (root) => {
    assert.deepEqual(loadRequirements(root), []);
  });
});

// README.md là văn bản hướng dẫn, không phải requirement. Nếu lọt vào thì nó thành
// một bản ghi missingFrontMatter và finding "requirement không có front-matter"
// bắn ra ở MỌI repo — nhiễu tới mức người dùng học cách bỏ qua finding đó.
test('loadRequirements: README.md bị bỏ qua, kể cả viết hoa README.MD', () => {
  withRepo({
    'requirements/README.md': '# Hướng dẫn\n\n### AC-001: ví dụ trong tài liệu\n',
    'requirements/REQ-001.md': REQ_FULL,
  }, (root) => {
    assert.deepEqual(loadRequirements(root).map((r) => r.id), ['REQ-001']);
  });
  withRepo({
    'requirements/README.MD': '---\nid: REQ-777\n---\n',
    'requirements/REQ-001.md': REQ_FULL,
  }, (root) => {
    assert.deepEqual(loadRequirements(root).map((r) => r.id), ['REQ-001']);
  });
});

// Bug vừa sửa: lọc đuôi file phân biệt hoa thường làm `REQ-002.MD` vô hình, tức
// requirement đó không có trong bất kỳ báo cáo nào mà gate vẫn xanh.
test('loadRequirements: file .MD viết HOA vẫn phải đọc được', () => {
  withRepo({ 'requirements/REQ-002.MD': '---\nid: REQ-002\n---\n\n### AC-001: hoa\n' }, (root) => {
    const reqs = loadRequirements(root);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, 'REQ-002');
    assert.equal(reqs[0].acs.length, 1);
  });
});

test('loadRequirements: file không phải markdown bị bỏ qua', () => {
  withRepo({
    'requirements/note.txt': '---\nid: REQ-888\n---\n',
    'requirements/draft.md.bak': '---\nid: REQ-889\n---\n',
    'requirements/REQ-001.md': REQ_FULL,
  }, (root) => {
    assert.deepEqual(loadRequirements(root).map((r) => r.id), ['REQ-001']);
  });
});

// Khuôn heading quá chặt là fail-open: `### AC-002 - tiêu đề` từng làm AC đó VÔ HÌNH,
// nên blocker `ac-khong-co-test-case` không bắn được mà coverage vẫn in số AC cũ.
test('loadRequirements: ba biến thể heading AC (":", "-", không dấu ngăn) đều đọc được', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.acs.map((a) => a.id), ['AC-001', 'AC-002', 'AC-003', 'AC-004']);
    const byId = new Map(req.acs.map((a) => [a.id, a]));
    assert.equal(byId.get('AC-001').title, 'Đăng nhập thành công với credential hợp lệ');
    assert.equal(byId.get('AC-002').title, 'Credential sai bị từ chối', 'dấu ngăn "-" không được dính vào tiêu đề');
    assert.equal(byId.get('AC-003').title, 'Email sai định dạng bị chặn ở client', 'heading #### vẫn là AC');
  });
});

test('loadRequirements: heading AC không có tiêu đề -> title rỗng chứ không phải AC biến mất', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    const ac4 = req.acs.find((a) => a.id === 'AC-004');
    assert.ok(ac4, 'AC chưa kịp đặt tiêu đề vẫn là một AC phải phủ');
    assert.equal(ac4.title, '');
  });
});

// Bug vừa sửa: số dòng lấy từ `body` (đã bị cắt front-matter) nên mọi finding trỏ
// vào AC lệch đúng bằng độ dài front-matter — bấm link mở sai chỗ. Fixture dưới
// đây cố tình có front-matter 10 dòng để độ lệch đủ lớn mà thấy được.
test('loadRequirements: số dòng AC là số dòng THẬT trong file (đã cộng front-matter)', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    const byId = new Map(req.acs.map((a) => [a.id, a]));
    assert.equal(byId.get('AC-001').line, lineOf(REQ_FULL, '### AC-001:'));
    assert.equal(byId.get('AC-002').line, lineOf(REQ_FULL, '### AC-002 -'));
    assert.equal(byId.get('AC-003').line, lineOf(REQ_FULL, '#### AC-003'));
    // Khẳng định thẳng con số: nếu cả helper lẫn code cùng quên offset thì phép so
    // sánh ở trên vẫn xanh, còn hai con số cứng này thì không.
    assert.equal(byId.get('AC-001').line, 16);
    assert.equal(byId.get('AC-004').line, 26);
  });
});

// Mã gần giống nhưng sai quy ước phải BÁO chứ không được im lặng bỏ qua: im lặng
// nghĩa là một acceptance criterion biến mất khỏi mọi báo cáo mà không ai biết.
test('loadRequirements: mã sai quy ước rơi vào nearMisses chứ không biến mất', () => {
  const text = `---
id: REQ-001
---

### AC-001: đúng quy ước

### AC-8: thiếu số 0

### AC_012 dùng gạch dưới

### ac-005: viết thường

### AC-0012: bốn chữ số
`;
  withRepo({ 'requirements/a.md': text }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.acs.map((a) => a.id), ['AC-001'], 'chỉ mã đúng quy ước mới thành AC');
    assert.deepEqual(
      req.nearMisses.map((n) => n.raw),
      ['AC-8', 'AC_012', 'ac-005', 'AC-0012'],
      'bốn mã hỏng phải được nêu tên để commands.js bắn dinh-danh-sai-quy-uoc',
    );
    assert.equal(req.nearMisses[0].line, lineOf(text, '### AC-8:'), 'nearMiss cũng phải trỏ đúng dòng thật');
  });
});

test('loadRequirements: mã đúng quy ước không bị xếp nhầm vào nearMisses', () => {
  withRepo({
    'requirements/a.md': '---\nid: REQ-001\n---\n\n### AC-001: x\n\n### TC-001: tham chiếu\n\n## REQ-002 liên quan\n',
  }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.nearMisses, [], 'AC/TC/REQ viết đủ ba chữ số là hợp lệ, không phải near miss');
  });
});

test('loadRequirements: bảng Rules and validation rút đủ 6 cột, bỏ header và dòng phân cách', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.rules.length, 2, 'header "Field/rule" và dòng |---| không được thành rule');
    const email = req.rules[0];
    assert.equal(email.field, 'Email');
    assert.equal(email.valid, '`a@b.com`');
    assert.equal(email.invalid, '`not-an-email`');
    assert.equal(email.boundary, '254, 255');
    assert.equal(email.expected, 'Lỗi tại trường');
  });
});

// Cột Test cases là thứ `gaps` dùng để biết dòng rule nào chưa có case phủ.
// Rút sai ở đây thì rule-chua-map-toi-test-case hoặc câm, hoặc kêu oan.
test('loadRequirements: cột Test cases rút được nhiều mã TC, ô trống -> mảng rỗng', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(req.rules[0].testCases, ['TC-004', 'TC-012']);
    assert.deepEqual(req.rules[1].testCases, [], 'ô trống phải là mảng rỗng, không phải [""]');
  });
});

test('loadRequirements: bảng nằm dưới heading khác không bị hút vào rules', () => {
  withRepo({ 'requirements/REQ-001.md': REQ_FULL }, (root) => {
    const [req] = loadRequirements(root);
    assert.deepEqual(
      req.rules.map((r) => r.field),
      ['Email', 'Password'],
      'bảng Non-functional nằm dưới heading khác, không được lẫn vào rules',
    );
  });
});

// sources.js là tầng ĐỌC, không phải tầng chính sách: dòng mẫu của template được
// trả nguyên trạng và commands.js mới là chỗ bỏ qua nó (lọc /^<.*>$/ trên field).
// Chốt lại ở đây để nếu ai đó chuyển phép lọc xuống tầng này thì phải sửa test có
// chủ đích, chứ không để hai tầng cùng nghĩ tầng kia đang lọc.
test('loadRequirements: dòng mẫu <field> của template được trả nguyên ở tầng đọc', () => {
  withRepo({
    'requirements/a.md': `---
id: REQ-001
---

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| <field> | <...> | <...> | <...> | <...> | TC-0xx |
`,
  }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.rules.length, 1);
    assert.equal(req.rules[0].field, '<field>');
    assert.deepEqual(req.rules[0].testCases, [], 'TC-0xx không phải mã hợp lệ nên không được nhận');
  });
});

// Repo thật hay để tài liệu trong docs/. Khai sai đường dẫn mà tool vẫn chạy bằng
// mặc định là chế độ hỏng tệ nhất: gate xanh vì không đọc được gì.
test('loadRequirements: requirementsDir khai trong options được tôn trọng', () => {
  withRepo({ 'docs/requirements/REQ-001.md': REQ_FULL }, (root) => {
    assert.deepEqual(loadRequirements(root), [], 'không khai thì vẫn chỉ nhìn requirements/');
    const reqs = loadRequirements(root, { requirementsDir: 'docs/requirements' });
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, 'REQ-001');
    assert.equal(
      reqs[0].file,
      'docs/requirements/REQ-001.md',
      'file phải tính từ gốc repo, không phải từ thư mục tài liệu',
    );
  });
});

test('loadRequirements: mỗi file là một bản ghi, AC không lẫn giữa các requirement', () => {
  withRepo({
    'requirements/REQ-001.md': '---\nid: REQ-001\n---\n\n### AC-001: một\n\n### AC-002: hai\n',
    'requirements/REQ-002.md': '---\nid: REQ-002\n---\n\n### AC-001: ba\n',
  }, (root) => {
    const reqs = loadRequirements(root);
    const byId = new Map(reqs.map((r) => [r.id, r]));
    assert.equal(byId.size, 2);
    assert.equal(byId.get('REQ-001').acs.length, 2);
    assert.equal(byId.get('REQ-002').acs.length, 1);
  });
});

// Editor trên Windows lưu kèm BOM và CRLF. Không chuẩn hoá thì front-matter không
// đọc được (requirement thành missingFrontMatter một cách bí ẩn) và số dòng lệch.
test('loadRequirements: file lưu kèm BOM + CRLF vẫn đọc đủ front-matter và số dòng AC không lệch', () => {
  withRepo({ 'requirements/REQ-001.md': asWindowsFile(REQ_FULL) }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.id, 'REQ-001');
    assert.equal(req.title, 'Đăng nhập bằng email và mật khẩu');
    assert.equal(req.acs.length, 4);
    assert.equal(req.acs[0].line, lineOf(REQ_FULL, '### AC-001:'));
    assert.equal(req.acs[0].title, 'Đăng nhập thành công với credential hợp lệ', 'ký tự \\r không được dính vào tiêu đề');
    assert.equal(req.rules.length, 2, 'bảng markdown cũng phải sống sót qua CRLF');
  });
});

// ===========================================================================
// loadTestCases
// ===========================================================================

const TC_FULL = `# Test cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`tests/auth/login.spec.ts\` | P0 |
| REQ-001 | AC-002 | TC-002 | No | - | P1 |
| REQ-001 | AC-002 | TC-003 | Candidate | - |  P2  |

## Test cases

### TC-001: Đăng nhập thành công

### TC-002 - Sai mật khẩu

#### TC-003 Khoá tài khoản

## Case không automation

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-002 | Cần tua thời gian server, staging chưa hỗ trợ | Test ở tầng API |
| TC-003 |  | Chưa có |
`;

/** Một file test case tối thiểu, chỉ để thử đúng một ô Automation. */
function traceabilityFile(automation) {
  return `# TC

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | ${automation} | - | P0 |
`;
}

test('loadTestCases: bảng Traceability rút đúng reqId/acId/tcId/automation/spec/priority', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { links } = loadTestCases(root);
    assert.equal(links.length, 3, 'header và dòng phân cách không được thành link');
    const first = links[0];
    assert.equal(first.reqId, 'REQ-001');
    assert.equal(first.acId, 'AC-001');
    assert.equal(first.tcId, 'TC-001');
    assert.equal(first.automation, 'Yes');
    // Backtick phải bị bóc: drift so cột này với đường dẫn spec thật, mà chuỗi còn
    // backtick thì không bao giờ khớp nên mọi TC sẽ bị báo lệch.
    assert.equal(first.spec, 'tests/auth/login.spec.ts');
    assert.equal(first.priority, 'P0');
    assert.equal(first.file, 'test-cases/REQ-001.md', 'link phải nhớ file nguồn để finding chỉ được chỗ sửa');
  });
});

test('loadTestCases: priority có khoảng trắng thừa vẫn được cắt sạch', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { links } = loadTestCases(root);
    // `p0-p1-con-dang-candidate` khớp bằng /^P[01]$/, khoảng trắng thừa làm rule đó câm.
    assert.equal(links[2].priority, 'P2');
  });
});

// Đây là lỗ fail-open nghiêm trọng nhất: so `=== 'Yes'` với ô lấy nguyên văn từ
// markdown làm rule quan trọng nhất (khai automation nhưng không có script) im lặng.
test('loadTestCases: mọi cách viết "có automation" đều chuẩn hoá về "Yes"', () => {
  for (const raw of ['Yes', 'yes', 'YES', '**Yes**', '`Yes`', 'Yes ✅', 'Có', 'có', 'CÓ', 'Co', 'Done']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, 'Yes', `"${raw}" phải được hiểu là Yes`);
      assert.equal(links[0].automationRaw, raw, 'bản gốc phải giữ nguyên để in lại cho người sửa');
    });
  }
});

test('loadTestCases: mọi cách viết "không automation" đều chuẩn hoá về "No"', () => {
  for (const raw of ['No', 'no', 'NO', '**No**', 'Không', 'khong', 'Manual', 'thủ công', 'N/A']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, 'No', `"${raw}" phải được hiểu là No`);
      assert.equal(links[0].automationRaw, raw);
    });
  }
});

test('loadTestCases: mọi cách viết "ứng viên" đều chuẩn hoá về "Candidate"', () => {
  for (const raw of ['Candidate', 'candidate', '**Candidate**', 'Ứng viên', 'ung vien', 'Planned', 'TODO']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, 'Candidate', `"${raw}" phải được hiểu là Candidate`);
      assert.equal(links[0].automationRaw, raw);
    });
  }
});

// null = "đọc được ô này nhưng không hiểu". Phải khác hẳn chuỗi rỗng, vì commands.js
// bắn `gia-tri-automation-khong-hop-le` cho null và in lại automationRaw cho người
// sửa. Đoán bừa thành 'No' ở đây là cách êm ái nhất để giấu một TC chưa có script.
test('loadTestCases: giá trị lạ -> automation null nhưng giữ nguyên bản gốc trong automationRaw', () => {
  // Chỉ liệt kê giá trị CÓ CHỮ. Ô chỉ gồm dấu câu/emoji (`-`, `✅`, `???`) hiện ra
  // chuỗi rỗng chứ không ra null — xem ghi chú bug ở cuối file.
  for (const raw of ['maybe', 'Có thể', 'WIP', 'partial', 'chưa rõ']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, null, `"${raw}" không nằm trong từ điển nên phải là null`);
      assert.equal(links[0].automationRaw, raw, 'thông báo lỗi cần in đúng thứ người dùng đã gõ');
    });
  }
});

test('loadTestCases: ô Automation trống -> chuỗi rỗng, phân biệt với "không hiểu được"', () => {
  for (const raw of ['', '  ', '**  **']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, '', `ô "${raw}" là bỏ trống, không phải giá trị sai`);
      assert.notEqual(links[0].automation, null, 'bỏ trống và sai chính tả là hai finding khác nhau');
    });
  }
});

// traceability.md do `node tools/qa` sinh ra từ chính các file này. Đọc lại nó là
// tự nhân đôi mọi link: coverage đếm gấp đôi số test case và drift so dữ liệu với
// chính nó, nên mọi con số đều sai mà vẫn trông hợp lý.
test('loadTestCases: traceability.md bị bỏ qua vì là file sinh ra, không phải nguồn', () => {
  withRepo({
    'test-cases/REQ-001.md': TC_FULL,
    'test-cases/traceability.md': traceabilityFile('Yes').replace('TC-001', 'TC-900'),
  }, (root) => {
    const { links } = loadTestCases(root);
    assert.equal(links.length, 3);
    assert.ok(!links.some((l) => l.tcId === 'TC-900'), 'không được nạp lại file tổng hợp');
  });
});

test('loadTestCases: README.md trong test-cases cũng bị bỏ qua', () => {
  withRepo({
    'test-cases/README.md': traceabilityFile('Yes').replace('TC-001', 'TC-901'),
    'test-cases/REQ-001.md': TC_FULL,
  }, (root) => {
    const { links } = loadTestCases(root);
    assert.ok(!links.some((l) => l.tcId === 'TC-901'));
  });
});

// `khong-automation-nhung-khong-co-ly-do` đứng hay ngã hoàn toàn theo tập này.
// Nhận nhầm một dòng thiếu lý do = cho phép "Automation: No" mà không giải trình.
test('loadTestCases: mục "Case không automation" chỉ nhận dòng có lý do', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { noAutomationReasons } = loadTestCases(root);
    assert.ok(noAutomationReasons instanceof Set, 'commands.js gọi .has() nên phải là Set');
    assert.equal(noAutomationReasons.has('TC-002'), true);
    assert.equal(noAutomationReasons.has('TC-003'), false, 'cột Lý do bỏ trống thì không tính là đã giải trình');
    assert.equal(noAutomationReasons.size, 1, 'hàng header "Test case | Lý do" không được lọt vào');
  });
});

test('loadTestCases: details rút được cả ba biến thể heading TC kèm số dòng thật', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { details } = loadTestCases(root);
    assert.deepEqual(details.map((d) => d.tcId), ['TC-001', 'TC-002', 'TC-003']);
    assert.equal(details[0].title, 'Đăng nhập thành công');
    assert.equal(details[1].title, 'Sai mật khẩu', 'dấu ngăn "-" không được dính vào tiêu đề');
    assert.equal(details[2].title, 'Khoá tài khoản');
    assert.equal(details[0].line, lineOf(TC_FULL, '### TC-001:'));
    assert.equal(details[0].file, 'test-cases/REQ-001.md');
  });
});

test('loadTestCases: testCasesDir khai trong options được tôn trọng', () => {
  withRepo({ 'docs/test-cases/REQ-001.md': TC_FULL }, (root) => {
    assert.equal(loadTestCases(root).links.length, 0, 'không khai thì vẫn chỉ nhìn test-cases/');
    const r = loadTestCases(root, { testCasesDir: 'docs/test-cases' });
    assert.equal(r.links.length, 3);
    assert.equal(r.links[0].file, 'docs/test-cases/REQ-001.md');
  });
});

test('loadTestCases: thư mục không tồn tại -> links/details rỗng và Set rỗng, không ném', () => {
  withRepo({ 'README.md': '# repo trống' }, (root) => {
    const r = loadTestCases(root);
    assert.deepEqual(r.links, []);
    assert.deepEqual(r.details, []);
    assert.equal(r.noAutomationReasons.size, 0);
  });
});

test('loadTestCases: nhiều file test case gộp chung links, mỗi link nhớ đúng file nguồn', () => {
  withRepo({
    'test-cases/REQ-001.md': TC_FULL,
    'test-cases/REQ-002.md': traceabilityFile('Yes')
      .replace('REQ-001', 'REQ-002')
      .replace('TC-001', 'TC-050'),
  }, (root) => {
    const { links } = loadTestCases(root);
    assert.equal(links.length, 4);
    const tc50 = links.find((l) => l.tcId === 'TC-050');
    assert.equal(tc50.reqId, 'REQ-002');
    assert.equal(tc50.file, 'test-cases/REQ-002.md');
  });
});

// Bảng thiếu cột là chuyện thường khi người ta copy bảng cũ. Không được ném, và
// các trường thiếu phải là chuỗi rỗng để mọi phép join phía sau vẫn chạy được.
test('loadTestCases: hàng traceability thiếu cột -> spec/priority rỗng, không ném', () => {
  withRepo({
    'test-cases/a.md': `## Traceability

| Requirement | Acceptance criterion | Test case | Automation |
|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes |
`,
  }, (root) => {
    const { links } = loadTestCases(root);
    assert.equal(links.length, 1);
    assert.equal(links[0].spec, '');
    assert.equal(links[0].priority, '');
    assert.equal(links[0].automation, 'Yes');
  });
});

test('loadTestCases: bảng ngoài mục Traceability không bị hút vào links', () => {
  withRepo({
    'test-cases/a.md': `## Test data

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-099 | Yes | - | P0 |

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | - | P0 |
`,
  }, (root) => {
    const { links } = loadTestCases(root);
    assert.deepEqual(links.map((l) => l.tcId), ['TC-001'], 'chỉ bảng dưới ## Traceability mới là nguồn link');
  });
});

test('loadTestCases: file lưu kèm BOM + CRLF vẫn rút đủ links, details và lý do', () => {
  withRepo({ 'test-cases/REQ-001.md': asWindowsFile(TC_FULL) }, (root) => {
    const r = loadTestCases(root);
    assert.equal(r.links.length, 3);
    assert.equal(r.links[0].automation, 'Yes', 'ký tự \\r sót lại sẽ làm ô Automation không khớp từ điển');
    assert.equal(r.links[0].spec, 'tests/auth/login.spec.ts');
    assert.equal(r.details.length, 3);
    assert.equal(r.noAutomationReasons.has('TC-002'), true);
  });
});

// ===========================================================================
// CỐ Ý CHƯA PHỦ — hành vi hiện tại đáng ngờ, đã báo thành bug thay vì khoá lại
// bằng test. Viết test cho những chỗ này nghĩa là đóng băng một chế độ fail-open.
// ===========================================================================
//
// 1. Ô Automation chỉ gồm dấu câu/emoji (`-`, `✅`, `???`) bị chuẩn hoá thành ''
//    chứ không phải null, nên lọt qua CẢ BỐN rule automation của commands.js mà
//    không sinh finding nào. `-` là cách viết "không có gì" phổ biến nhất trong
//    chính các bảng của repo này.
// 2. Cột Requirement gõ sai (`REQ-1`, `REQ-0001`) làm cả dòng traceability biến
//    mất im lặng — loadTestCases không có cơ chế nearMisses như loadRequirements.
// 3. Heading AC thụt lề 1-3 dấu cách, hoặc dùng `######` (H6), không thành AC và
//    cũng không vào nearMisses.
// 4. listMarkdown không đệ quy: requirements/<thư mục con>/REQ-xxx.md bị bỏ qua.
// 5. parseFrontMatter gọi trực tiếp trên text CRLF chưa chuẩn hoá trả data rỗng
//    (readText mới là chỗ chuẩn hoá, nhưng hàm này được export ra ngoài).

// --- Plan 13 / fix 2: bộ bắt thiếu await phải thấy cả locator viết inline ---------
// Bản cũ dùng regex `expect\([^)]*\)` nên dừng ở `)` ĐẦU TIÊN, khiến
// `expect(page.getByRole('button'))` không bao giờ khớp — đúng dạng phổ biến nhất.

test('findMissingAwaits: bắt được expect có locator viết inline (ca từng bị bỏ sót)', () => {
  const hits = findMissingAwaits(["expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();"], 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].matcher, 'toBeVisible');
  assert.equal(hits[0].line, 1);
});

test('findMissingAwaits: không báo khi đã có await hoặc return', () => {
  assert.equal(findMissingAwaits(["await expect(page.getByRole('x')).toBeVisible();"], 1).length, 0);
  assert.equal(findMissingAwaits(['return expect(page.locator("#a")).toHaveText("x");'], 1).length, 0);
});

test('findMissingAwaits: bỏ qua matcher đồng bộ, bắt matcher có .not', () => {
  assert.equal(findMissingAwaits(['expect(cookies.length).toBeGreaterThan(0);'], 1).length, 0);
  assert.equal(findMissingAwaits(['await expect.soft(s?.secure).toBe(true);'], 1).length, 0);
  assert.equal(findMissingAwaits(['expect(page.getByTestId("x")).not.toBeVisible();'], 1).length, 1);
});

test('findMissingAwaits: dấu ngoặc nằm trong chuỗi không làm lệch bộ đếm', () => {
  const hits = findMissingAwaits(['expect(page.getByRole("link", { name: "a(b)" })).toBeVisible();'], 1);
  assert.equal(hits.length, 1);
});

test('findMissingAwaits: expect trải nhiều dòng — báo đúng dòng, không báo cái có await', () => {
  const body = [
    'await expect(page.getByRole("heading", {',
    '  name: "Dashboard",',
    '})).toBeVisible();',
    'expect(page.getByRole("alert", {',
    '  name: "Error",',
    '})).toBeVisible();',
  ];
  const hits = findMissingAwaits(body, 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 13);
});

test('findMissingAwaits: danh sách matcher ghi đè được qua tham số', () => {
  const custom = new Set(['toBeSomethingNew']);
  assert.equal(findMissingAwaits(['expect(x).toBeSomethingNew();'], 1, custom).length, 1);
  assert.equal(findMissingAwaits(['expect(x).toBeVisible();'], 1, custom).length, 0);
});
