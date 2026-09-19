'use strict';
/**
 * Unit test cho tools/decisions.
 *
 * GIỚI HẠN CỦA CÁCH TEST NÀY (đọc trước khi sửa):
 * index.js không export gì, tự gọi main() khi require, và ROOT được suy ra từ __dirname
 * (`path.resolve(__dirname, '..', '..')`). Không thể require nó để gọi hàm trực tiếp:
 * require sẽ đọc decisions.json THẬT của repo và gọi process.exit.
 * Nên test chạy công cụ như CI chạy: copy nguyên index.js vào một repo giả trong os.tmpdir()
 * (<tmp>/tools/decisions/index.js -> ROOT = <tmp>), ghi fixture decisions.json cạnh đó,
 * rồi spawn node và soi exit code + stdout/stderr + DECISIONS.md sinh ra.
 * Hệ quả: chậm hơn unit test thuần (một process/ca), và chỉ kiểm được thứ công cụ
 * phát ra ra ngoài — không kiểm được hàm nội bộ như isAnswered() một cách cô lập.
 * Bù lại: --json cho ra object có field rõ ràng để assert, và đây đúng là bề mặt mà
 * dashboard lẫn CI thật sự tiêu thụ.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SOURCE = path.join(__dirname, 'index.js');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'decisions-'));
  fs.mkdirSync(path.join(root, 'tools', 'decisions'), { recursive: true });
  fs.copyFileSync(SOURCE, path.join(root, 'tools', 'decisions', 'index.js'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
  }
  return root;
}

const withRepo = (files, fn) => {
  const root = makeRepo(files);
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  }
};

function run(root, args = []) {
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'decisions', 'index.js'), ...args], {
    encoding: 'utf8',
    cwd: root,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/** Chạy --json rồi parse: dashboard tiêu thụ đúng cái object này. */
function asJson(root) {
  const r = run(root, ['--json']);
  assert.equal(r.code, 0, `--json phải thành công, stderr: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function render(root) {
  const r = run(root, ['render']);
  return { result: r, md: fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf8') };
}

// --- fixture builders ----------------------------------------------------

const decision = (over = {}) => ({
  id: 'D-01',
  title: 'Giữ analyzer nào',
  severity: 'blocking',
  blocks: 'lần sync đầu tiên',
  context: 'hai tool cùng làm một việc',
  repos: ['D:\\repo-a'],
  status: 'pending',
  options: [
    { id: 'a', label: 'Phương án A', consequence: 'hệ quả A' },
    { id: 'b', label: 'Phương án B', consequence: 'hệ quả B' },
  ],
  recommended: 'a',
  recommendationReason: 'rẻ hơn',
  evidence: [{ claim: 'có 378 dòng test', source: 'scripts/lib/qaTrace.test.js' }],
  answer: { optionId: null, note: '', confirmedBy: '', confirmedAt: '' },
  ...over,
});

/** Một quyết định đã xác nhận hợp lệ: đủ optionId VÀ người ký tên. */
const answered = (over = {}) => decision({
  status: 'confirmed',
  answer: { optionId: 'a', note: 'chốt', confirmedBy: 'Ha Dinh', confirmedAt: '2026-01-02' },
  ...over,
});

const doc = (decisions, over = {}) => ({
  version: 1,
  createdAt: '2026-01-01',
  source: 'unit test',
  decisions,
  ...over,
});

// Hàng trong bảng tổng hợp đầu DECISIONS.md — mỗi quyết định đúng một hàng.
const summaryRows = (md) => md.split('\n').filter((l) => /^\| D-\d+ \|/.test(l));
const summaryIds = (md) => summaryRows(md).map((l) => l.match(/^\| (D-\d+) \|/)[1]);
// Thứ tự id trong output `list` (tag đã bỏ màu nhờ NO_COLOR).
const listIds = (stdout) => stdout.split('\n')
  .map((l) => l.match(/^(?:CHẶN|GẤP|SỚM)\s+(D-\d+)\s/))
  .filter(Boolean)
  .map((m) => m[1]);

// =========================================================================
// QUY TẮC SỐNG CÒN: đã xác nhận <=> answer.optionId truthy VÀ answer.confirmedBy
// là chuỗi không rỗng sau khi trim. Field `status` chỉ là sổ sách.
// =========================================================================

test('answer đủ optionId + người ký -> tính là đã xác nhận', () => {
  withRepo({ 'decisions.json': doc([answered()]) }, (root) => {
    const out = asJson(root);
    assert.equal(out.total, 1);
    assert.deepEqual(out.pending, []);
  });
});

test('BẪY: confirmedBy toàn khoảng trắng vẫn là CHỜ xác nhận', () => {
  // Ca này chặn regression kiểu `Boolean(a.confirmedBy)`: chuỗi '   ' là truthy,
  // nên nếu ai đó bỏ .trim() thì một quyết định chưa ai ký sẽ lọt thành đã chốt.
  withRepo({
    'decisions.json': doc([decision({ answer: { optionId: 'a', confirmedBy: '   ' } })]),
  }, (root) => {
    assert.deepEqual(asJson(root).pending, ['D-01']);
  });
});

test('có người ký nhưng chưa chọn option -> vẫn CHỜ xác nhận', () => {
  // Nửa còn lại của quy tắc: ký tên suông không phải là một quyết định.
  withRepo({
    'decisions.json': doc([
      decision({ id: 'D-01', answer: { optionId: null, confirmedBy: 'Ha Dinh' } }),
      decision({ id: 'D-02', answer: { optionId: '', confirmedBy: 'Ha Dinh' } }),
    ]),
  }, (root) => {
    assert.deepEqual(asJson(root).pending, ['D-01', 'D-02']);
  });
});

test('status="confirmed" nhưng answer rỗng -> vẫn CHỜ (không tin sổ sách)', () => {
  // Dashboard ghi ngược vào file này; nếu nó set status trước rồi mới ghi answer
  // (hoặc ghi lỗi giữa chừng) thì công cụ tin status sẽ tuyên bố xanh khống.
  withRepo({
    'decisions.json': doc([decision({ status: 'confirmed' })]),
  }, (root) => {
    assert.deepEqual(asJson(root).pending, ['D-01']);
  });
});

test('status="pending" nhưng answer đủ -> tính là ĐÃ xác nhận', () => {
  // Chiều ngược lại: sổ sách cũ không được phép giữ một quyết định đã ký ở trạng thái chờ.
  withRepo({
    'decisions.json': doc([answered({ status: 'pending' })]),
  }, (root) => {
    assert.deepEqual(asJson(root).pending, []);
  });
});

test('--json giữ nguyên toàn bộ decisions cho dashboard', () => {
  // Dashboard render generic từ chính mảng này: mất field nào là hỏng UI ở đó.
  const list = [decision({ id: 'D-01' }), answered({ id: 'D-02', severity: 'soon' })];
  withRepo({ 'decisions.json': doc(list) }, (root) => {
    const out = asJson(root);
    assert.deepEqual(Object.keys(out).sort(), ['decisions', 'pending', 'total']);
    assert.equal(out.total, 2);
    assert.deepEqual(out.pending, ['D-01']);
    assert.deepEqual(out.decisions, list);
  });
});

// =========================================================================
// render()
// =========================================================================

test('render: bảng tổng hợp có đúng một hàng cho mỗi quyết định', () => {
  const list = [decision({ id: 'D-01' }), decision({ id: 'D-02' }), decision({ id: 'D-03' })];
  withRepo({ 'decisions.json': doc(list) }, (root) => {
    const { result, md } = render(root);
    assert.equal(result.code, 0);
    assert.equal(summaryRows(md).length, 3);
    assert.deepEqual(summaryIds(md), ['D-01', 'D-02', 'D-03']);
  });
});

test('render: đánh dấu đã xác nhận khác chờ xác nhận, và hiện nhãn option đã chọn', () => {
  withRepo({
    'decisions.json': doc([
      answered({ id: 'D-01', answer: { optionId: 'b', confirmedBy: 'Ha Dinh', confirmedAt: '2026-01-02', note: 'lý do' } }),
      decision({ id: 'D-02' }),
    ]),
  }, (root) => {
    const { md } = render(root);
    const [rowAnswered, rowPending] = summaryRows(md);
    assert.match(rowAnswered, /✅/);
    assert.match(rowAnswered, /Phương án B/, 'phải hiện nhãn option chứ không phải id thô');
    assert.doesNotMatch(rowAnswered, /⬜/);
    assert.match(rowPending, /⬜/);
    assert.doesNotMatch(rowPending, /✅/);
    // Phần chi tiết: mục đã chốt in người ký + ngày; mục chờ in checklist để tick.
    assert.match(md, /ĐÃ XÁC NHẬN: Phương án B/);
    assert.match(md, /Người xác nhận: Ha Dinh\s+Ngày: 2026-01-02/);
    assert.match(md, /Ghi chú: lý do/);
    assert.match(md, /\[ \] a — Phương án A/);
  });
});

test('render: field `table` là tuỳ chọn, có thì sinh bảng riêng, không có thì thôi', () => {
  const table = { columns: ['Tiêu chí', 'Bên A', 'Bên B'], rows: [['Quy mô', '452 dòng', '1066 dòng']] };
  const seps = (md) => md.split('\n').filter((l) => /^\|(-{3}\|)+$/.test(l)).length;
  withRepo({ 'decisions.json': doc([decision({ table })]) }, (root) => {
    const { md } = render(root);
    assert.match(md, /\| Tiêu chí \| Bên A \| Bên B \|/);
    assert.match(md, /\| Quy mô \| 452 dòng \| 1066 dòng \|/);
    assert.equal(seps(md), 2, 'bảng tổng hợp + bảng của decision');
  });
  withRepo({ 'decisions.json': doc([decision()]) }, (root) => {
    const { md } = render(root);
    assert.equal(seps(md), 1, 'không khai `table` thì không được tự sinh bảng rỗng');
  });
});

test('render: đánh dấu _(đề xuất)_ đúng option và in lý do', () => {
  withRepo({ 'decisions.json': doc([decision({ recommended: 'b' })]) }, (root) => {
    const { md } = render(root);
    assert.match(md, /\*\*Phương án B\*\* _\(đề xuất\)_/);
    assert.doesNotMatch(md, /\*\*Phương án A\*\* _\(đề xuất\)_/);
    assert.match(md, /\*\*Đề xuất:\*\* Phương án B\. rẻ hơn/);
  });
});

test('render: không có đề xuất thì nói rõ cần người quyết, không để trống', () => {
  withRepo({
    'decisions.json': doc([decision({ recommended: null, recommendationReason: '' })]),
  }, (root) => {
    const { md } = render(root);
    assert.match(md, /\*\*Không đề xuất\.\*\* Cần người quyết\./);
  });
});

test('render: orderingNotes được in khi có', () => {
  withRepo({
    'decisions.json': doc([decision()], { orderingNotes: ['D-01 phải chốt trước D-02'] }),
  }, (root) => {
    const { md } = render(root);
    assert.match(md, /## Thứ tự bắt buộc/);
    assert.match(md, /- D-01 phải chốt trước D-02/);
  });
});

// =========================================================================
// Sắp xếp theo mức: blocking > urgent > soon
// =========================================================================

test('DECISIONS.md sắp xếp blocking > urgent > soon, giữ thứ tự gốc khi cùng mức', () => {
  // Thứ tự trong file cố tình ngược lại để bắt được trường hợp quên sort.
  withRepo({
    'decisions.json': doc([
      decision({ id: 'D-09', severity: 'soon' }),
      decision({ id: 'D-04', severity: 'urgent' }),
      decision({ id: 'D-02', severity: 'blocking' }),
      decision({ id: 'D-01', severity: 'blocking' }),
    ]),
  }, (root) => {
    const { md } = render(root);
    assert.deepEqual(summaryIds(md), ['D-02', 'D-01', 'D-04', 'D-09']);
  });
});

test('`list` cũng sắp xếp theo mức, mục chặn nằm trên cùng', () => {
  withRepo({
    'decisions.json': doc([
      decision({ id: 'D-09', severity: 'soon' }),
      decision({ id: 'D-04', severity: 'urgent' }),
      decision({ id: 'D-01', severity: 'blocking' }),
    ]),
  }, (root) => {
    const r = run(root, []);
    assert.equal(r.code, 0, 'không có --strict thì list không được đỏ');
    assert.deepEqual(listIds(r.stdout), ['D-01', 'D-04', 'D-09']);
    assert.match(r.stdout, /3\/3/, 'phải báo số mục chờ trên tổng');
  });
});

test('list: mục đã xác nhận không xuất hiện trong danh sách chờ', () => {
  withRepo({
    'decisions.json': doc([answered({ id: 'D-01' }), decision({ id: 'D-02', severity: 'urgent' })]),
  }, (root) => {
    const r = run(root, []);
    assert.deepEqual(listIds(r.stdout), ['D-02']);
    assert.match(r.stdout, /1\/2/);
  });
});

// =========================================================================
// --strict: cổng gác CI
// =========================================================================

test('--strict đỏ khi còn mục blocking chưa trả lời', () => {
  withRepo({ 'decisions.json': doc([decision({ severity: 'blocking' })]) }, (root) => {
    assert.equal(run(root, ['--strict']).code, 1);
  });
});

test('--strict đỏ khi còn mục urgent chưa trả lời', () => {
  withRepo({ 'decisions.json': doc([decision({ severity: 'urgent' })]) }, (root) => {
    assert.equal(run(root, ['--strict']).code, 1);
  });
});

test('--strict XANH khi chỉ còn mức soon chưa trả lời', () => {
  // Mức `soon` là nợ có chủ ý, không được phép làm đỏ CI mỗi ngày — nếu nó đỏ,
  // đội sẽ gỡ cổng gác và cổng gác mất luôn tác dụng với blocking/urgent.
  withRepo({
    'decisions.json': doc([
      answered({ id: 'D-01', severity: 'blocking' }),
      answered({ id: 'D-02', severity: 'urgent' }),
      decision({ id: 'D-09', severity: 'soon' }),
      decision({ id: 'D-10', severity: 'soon' }),
    ]),
  }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.code, 0);
    assert.deepEqual(listIds(r.stdout), ['D-09', 'D-10'], 'vẫn phải liệt kê ra cho người đọc');
  });
});

test('--strict XANH khi mọi mục đã được xác nhận', () => {
  withRepo({
    'decisions.json': doc([answered({ id: 'D-01' }), answered({ id: 'D-02', severity: 'urgent' })]),
  }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /Tất cả 2 quyết định đã được xác nhận/);
  });
});

test('--strict vẫn đỏ với answer bẫy: optionId có, confirmedBy toàn khoảng trắng', () => {
  // Đây là ca ghép hai rủi ro: cổng gác phải dựa vào isAnswered() chứ không dựa
  // vào `status`, nếu không một lần ghi hụt từ dashboard sẽ mở toang cổng.
  withRepo({
    'decisions.json': doc([
      decision({ severity: 'blocking', status: 'confirmed', answer: { optionId: 'a', confirmedBy: '   ' } }),
    ]),
  }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.code, 1);
    assert.deepEqual(listIds(r.stdout), ['D-01']);
  });
});

test('--json kết hợp --strict: vẫn xuất JSON sạch và vẫn đỏ', () => {
  // Dashboard/CI có thể lấy dữ liệu và gác cổng trong cùng một lần chạy.
  withRepo({ 'decisions.json': doc([decision({ severity: 'blocking' })]) }, (root) => {
    const r = run(root, ['--json', '--strict']);
    assert.equal(r.code, 1);
    assert.deepEqual(JSON.parse(r.stdout).pending, ['D-01'], 'stdout phải là JSON thuần, không lẫn log');
  });
});

// =========================================================================
// Dữ liệu hỏng: phải là thông báo cho người đọc, không phải stack trace
// =========================================================================

test('decisions.json sai cú pháp -> exit 2, báo lỗi rõ, không stack trace', () => {
  withRepo({ 'decisions.json': '{ "decisions": [ broken' }, (root) => {
    const r = run(root, []);
    assert.equal(r.code, 2, 'mã 2 = lỗi dữ liệu, phân biệt với mã 1 = còn mục chưa chốt');
    assert.match(r.stderr, /decisions\.json không phải JSON hợp lệ/);
    assert.doesNotMatch(r.stderr, /\n\s+at /, 'không được ném stack trace vào mặt người dùng');
  });
});

test('thiếu hẳn decisions.json -> exit 2 và nói rõ thiếu file nào', () => {
  withRepo({}, (root) => {
    const r = run(root, []);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /Không thấy decisions\.json/);
    assert.doesNotMatch(r.stderr, /\n\s+at /);
  });
});

test('decisions.json có BOM vẫn đọc được', () => {
  // Người sửa tay bằng Notepad/PowerShell trên Windows rất hay để lại BOM.
  withRepo({ 'decisions.json': '\uFEFF' + JSON.stringify(doc([answered()])) }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.code, 0);
    assert.equal(asJson(root).total, 1);
  });
});

test('lệnh không hợp lệ -> exit 2 và chỉ ra lệnh đúng', () => {
  withRepo({ 'decisions.json': doc([decision()]) }, (root) => {
    const r = run(root, ['rende']);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /Lệnh không hợp lệ: rende/);
    assert.match(r.stderr, /list \| render/);
  });
});

// =========================================================================
// Dữ liệu lệch nhưng không được làm sập công cụ
// =========================================================================

test('recommended trỏ tới option không tồn tại -> không crash, in id thô', () => {
  // Lỗi dữ liệu người gõ tay. Công cụ là nơi báo cáo, không phải nơi từ chối làm việc.
  withRepo({ 'decisions.json': doc([decision({ recommended: 'khong-ton-tai' })]) }, (root) => {
    const { result, md } = render(root);
    assert.equal(result.code, 0);
    assert.match(md, /\*\*Đề xuất:\*\* khong-ton-tai\./);
    assert.equal(summaryRows(md).length, 1);

    const r = run(root, []);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /đề xuất: khong-ton-tai/);
  });
});

test('answer.optionId trỏ tới option không tồn tại -> KHÔNG tính là đã chốt', () => {
  // Dashboard ghi ngược vào decisions.json. Một optionId cũ/gõ sai từng đóng dấu
  // "ĐÃ XÁC NHẬN: zz" lên tài liệu chính thức cho một lựa chọn không ai chọn được,
  // và làm mục blocking biến mất khỏi danh sách chờ.
  withRepo({
    'decisions.json': doc([answered({ answer: { optionId: 'zz', confirmedBy: 'Ha Dinh' } })]),
  }, (root) => {
    const { md } = render(root);
    assert.deepEqual(asJson(root).pending, ['D-01'], 'phải vẫn nằm trong danh sách chờ');
    assert.match(summaryRows(md)[0], /⬜/);
    assert.equal(run(root, ['--strict']).code, 1, 'gate phải còn đỏ');
  });
});

test('thiếu options / evidence -> không crash', () => {
  withRepo({
    'decisions.json': doc([{ id: 'D-01', title: 'Trống', severity: 'blocking', blocks: 'x', context: 'y' }]),
  }, (root) => {
    const { result, md } = render(root);
    assert.equal(result.code, 0);
    assert.equal(summaryRows(md).length, 1);
    assert.doesNotMatch(md, /\*\*Bằng chứng\.\*\*/);
  });
});

test('severity lạ -> từ chối thẳng, không im lặng hạ cấp thành "nên sớm"', () => {
  // Trước đây severity gõ sai fail OPEN: mục đó rơi khỏi blockingPending nên gate xanh,
  // và còn bị in ra với nhãn dim "SỚM" — một blocker bị dán nhãn ưu tiên thấp.
  withRepo({
    'decisions.json': doc([decision({ id: 'D-01', severity: 'blocking' }), decision({ id: 'D-77', severity: 'someday' })]),
  }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.code, 2, 'lỗi dữ liệu phải là exit 2, khác hẳn exit 1 của gate');
    assert.match(r.stderr, /D-77/, 'phải nêu đích danh mục sai');
    assert.doesNotMatch(r.stderr, /at Object/, 'không được là stack trace');
  });
});

test('mảng decisions rỗng -> báo lỗi dữ liệu, KHÔNG báo "tất cả đã xác nhận"', () => {
  // Đây là kết quả rất dễ xảy ra khi dashboard ghi đè hỏng. Trước đây nó đi qua mọi
  // cổng êm ru và còn tự khẳng định "OK Tất cả 0 quyết định đã được xác nhận".
  withRepo({ 'decisions.json': doc([]) }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /rỗng/);
    assert.doesNotMatch(r.stdout, /Tất cả 0 quyết định/);
  });
});

test('thiếu hẳn mảng decisions -> lỗi có địa chỉ, không phải stack trace', () => {
  withRepo({ 'decisions.json': JSON.stringify({ version: 1 }) }, (root) => {
    const r = run(root, []);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /thiếu mảng "decisions"/);
    assert.doesNotMatch(r.stderr, /TypeError/);
  });
});

// =========================================================================
// An toàn: JSON là nguồn sự thật, công cụ không được tự sửa nó
// =========================================================================

test('render chỉ ghi DECISIONS.md, không đụng vào decisions.json', () => {
  const data = doc([decision({ id: 'D-01' }), answered({ id: 'D-02' })]);
  withRepo({ 'decisions.json': data }, (root) => {
    const src = path.join(root, 'decisions.json');
    const before = fs.readFileSync(src, 'utf8');
    const snapshot = () => fs.readdirSync(root).sort();
    const filesBefore = snapshot();

    assert.equal(run(root, ['render']).code, 0);
    assert.equal(run(root, ['--json']).code, 0);
    assert.equal(run(root, []).code, 0);

    assert.equal(fs.readFileSync(src, 'utf8'), before, 'decisions.json là nguồn sự thật, chỉ người/dashboard được ghi');
    assert.deepEqual(snapshot(), [...filesBefore, 'DECISIONS.md'].sort());
  });
});

test('render là idempotent: chạy hai lần cho ra cùng nội dung', () => {
  // DECISIONS.md được commit vào repo; nếu render không ổn định thì mỗi lần chạy
  // lại đẻ ra một diff rác và người ta sẽ ngừng chạy nó.
  withRepo({
    'decisions.json': doc([decision({ id: 'D-01' }), answered({ id: 'D-02', severity: 'urgent' })]),
  }, (root) => {
    const first = render(root).md;
    const second = render(root).md;
    assert.equal(second, first);
    assert.ok(first.endsWith('\n'), 'file phải kết thúc bằng newline');
  });
});

test('render báo đúng số lượng tổng và số mục còn chờ', () => {
  withRepo({
    'decisions.json': doc([decision({ id: 'D-01' }), answered({ id: 'D-02' }), decision({ id: 'D-03', severity: 'soon' })]),
  }, (root) => {
    const r = run(root, ['render']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /3 quyết định · 2 chờ xác nhận/);
  });
});
