'use strict';
/**
 * Đọc 3 nguồn dữ liệu và chuẩn hoá thành object để join:
 *   1. requirements/*.md   -> REQ + AC + bảng rules
 *   2. test-cases/*.md     -> TC, ánh xạ TC->AC, trạng thái automation
 *   3. playwright --list   -> test thật sự tồn tại trong code
 *
 * Không dùng dependency ngoài: file này phải chạy được ở bất kỳ repo nào
 * chỉ với Node, kể cả repo thuần JavaScript.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** Doc file va chuan hoa CRLF + BOM. Repo Windows rat hay co CRLF. */
function readText(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
}

// Nới khuôn heading: chấp nhận ##..#####, và dấu ngăn là `:` `-` `–` `—` hoặc không có.
// Khuôn quá chặt là fail-open nguy hiểm: `### AC-008 - tiêu đề` làm AC đó VÔ HÌNH,
// nên blocker `ac-khong-co-test-case` không thể bắn mà coverage vẫn in số AC cũ.
// `\s{0,3}` và `#{2,6}`: CommonMark cho phép heading thụt lề tới 3 dấu cách và tới cấp 6.
// Neo cứng vào đầu dòng khiến AC viết kiểu đó vừa không đọc được vừa không vào nearMisses.
const RE_AC_HEADING = /^\s{0,3}#{2,6}\s*(AC-\d{3})\b\s*[:\-–—]?\s*(.*?)\s*$/;
const RE_TC_HEADING = /^\s{0,3}#{2,6}\s*(TC-\d{3})\b\s*[:\-–—]?\s*(.*?)\s*$/;
// Mã gần giống nhưng sai quy ước: AC-8, AC_012, ac-001, AC-0012. Phải BÁO chứ không
// được im lặng bỏ qua — im lặng nghĩa là một acceptance criterion biến mất khỏi mọi
// báo cáo mà không ai biết.
const RE_ID_NEAR_MISS = /^\s{0,3}#{2,6}\s*((?:AC|TC|REQ)[-_]?\d{1,4})\b/i;
const RE_ID_CANONICAL = /^(AC|TC|REQ)-\d{3}$/;
const RE_TC_AC_TITLE = /^(TC-\d{3})\s*-\s*(AC-\d{3})\b/;
// File setup là hạ tầng đăng nhập/seed, không phải test case. Phải bắt được cả
// `auth.setup.ts` lẫn `auth.setup.spec.js` — thiếu biến thể thứ hai thì coverage và
// drift đếm lệch nhau đúng một test, và không ai biết bên nào đúng.
const RE_SETUP_FILE = /\.setup\.(spec\.)?[jt]sx?$/;

/** Front-matter phẳng `key: value`. Đủ dùng và không cần thư viện YAML. */
function parseFrontMatter(text) {
  if (!text.startsWith('---')) return { data: {}, body: text, offset: 0 };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: text, offset: 0 };
  const raw = text.slice(3, end);
  const body = text.slice(end + 4);
  const data = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (m) data[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  // offset = số dòng front-matter đã ăn mất. Không cộng lại thì mọi finding trỏ vào
  // AC đều lệch đúng bằng chừng đó, và càng thêm metadata vào front-matter càng lệch xa.
  return { data, body, offset: text.slice(0, end + 4).split('\n').length - 1 };
}

/**
 * Chuẩn hoá cột Automation. So sánh `=== 'Yes'` với ô lấy nguyên văn từ markdown là
 * fail-open: 'yes', '**Yes**', 'Yes ✅' hay 'Có' đều làm rule quan trọng nhất
 * (khai automation nhưng không có script) im lặng. Trả về null khi không nhận ra,
 * để commands.js báo thành finding thay vì bỏ qua.
 */
const AUTOMATION_ALIASES = new Map([
  ['yes', 'Yes'], ['co', 'Yes'], ['có', 'Yes'], ['done', 'Yes'],
  ['no', 'No'], ['khong', 'No'], ['không', 'No'], ['manual', 'No'],
  ['thu cong', 'No'], ['thủ công', 'No'], ['n/a', 'No'],
  ['candidate', 'Candidate'], ['ung vien', 'Candidate'], ['ứng viên', 'Candidate'],
  ['planned', 'Candidate'], ['todo', 'Candidate'],
]);

function normalizeAutomation(raw) {
  const original = String(raw || '').trim();
  // Bóc trang trí markdown trước. `**  **` hay `` `` `` là ô KHÔNG ai điền gì, khác hẳn
  // một ô có nội dung thật.
  const undecorated = original.replace(/[*`_~]/g, '').trim();
  const cleaned = undecorated
    .replace(/[^\p{L}\p{N}\/ ]/gu, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  // Ô trống thật sự là ''. Nhưng ô CÓ nội dung mà chỉ gồm dấu câu hoặc emoji
  // (`-`, `✅`, `???`) từng cũng ra '' — và vì commands.js không có rule nào cho '',
  // chúng lọt qua cả bốn rule automation. `-` lại đúng là cách viết "không có gì"
  // phổ biến nhất trong chính các bảng của repo này.
  if (!cleaned) return { value: undecorated ? null : '', raw: original };
  const hit = AUTOMATION_ALIASES.get(cleaned);
  return { value: hit || null, raw: original };
}

/** Tách các dòng dữ liệu của bảng markdown nằm dưới một heading. */
function tableRowsUnder(lines, headingRe) {
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) inSection = headingRe.test(line);
    if (!inSection) continue;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // dòng phân cách
    out.push(cells);
  }
  return out;
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => path.join(dir, f));
}

/** requirements/*.md -> [{ id, title, status, acs: [...], rules: [...] }] */
function loadRequirements(root, options = {}) {
  const reqs = [];
  const dir = options.requirementsDir || 'requirements';
  for (const file of listMarkdown(path.join(root, dir))) {
    const text = readText(file);
    const { data, body, offset } = parseFrontMatter(text);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (!data.id) {
      reqs.push({ id: null, file: rel, missingFrontMatter: true, acs: [], rules: [] });
      continue;
    }
    const lines = body.split('\n');
    const acs = [];
    const nearMisses = [];
    lines.forEach((line, i) => {
      const m = line.match(RE_AC_HEADING);
      if (m) {
        acs.push({ id: m[1], title: m[2], line: i + 1 + (offset || 0) });
        return;
      }
      const near = line.match(RE_ID_NEAR_MISS);
      if (near && !RE_ID_CANONICAL.test(near[1])) {
        nearMisses.push({ raw: near[1], line: i + 1 + (offset || 0) });
      }
    });
    const rules = tableRowsUnder(lines, /Rules and validation/i)
      .filter((cells) => !/^Field\/rule$/i.test(cells[0]))
      .map((cells) => ({
        field: cells[0],
        valid: cells[1] || '',
        invalid: cells[2] || '',
        boundary: cells[3] || '',
        expected: cells[4] || '',
        testCases: (cells[5] || '').match(/TC-\d{3}/g) || [],
      }));
    reqs.push({
      id: data.id,
      title: data.title || '',
      status: data.status || 'Unknown',
      version: data.version || '',
      risk: data.risk || '',
      owner: data.owner || '',
      testCaseFile: data.test_cases || '',
      file: rel,
      acs,
      nearMisses,
      rules,
    });
  }
  return reqs;
}

/** test-cases/*.md -> [{ reqId, acId, tcId, automation, spec, priority }] + chi tiết TC */
function loadTestCases(root, options = {}) {
  const dir = options.testCasesDir || 'test-cases';
  const links = [];
  const nearMisses = [];
  const details = [];
  const noAutomationReasons = new Set();

  for (const file of listMarkdown(path.join(root, dir))) {
    const base = path.basename(file).toLowerCase();
    if (base === 'traceability.md') continue; // file sinh ra, không phải nguồn
    const text = readText(file);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const lines = text.split('\n');

    for (const cells of tableRowsUnder(lines, /^##\s+Traceability/i)) {
      const [reqId, acId, tcId, automation, spec, priority] = cells;
      if (!/^REQ-\d{3}$/.test(reqId || '')) {
        // Mã REQ gõ sai (REQ-1, req-001) từng làm CẢ DÒNG biến mất im lặng, nên mọi rule
        // automation không chạy cho TC đó. Bỏ qua hàng header là đúng; bỏ qua một dòng
        // trông như dữ liệu thật thì phải báo.
        const looksLikeData =
          /^req[-_ ]?\d+/i.test(reqId || '') || /^tc[-_]?\d+/i.test(tcId || '');
        if (looksLikeData) nearMisses.push({ raw: `${reqId} | ${tcId}`, file: rel });
        continue;
      }
      const auto = normalizeAutomation(automation);
      links.push({
        reqId,
        acId,
        tcId,
        automation: auto.value,
        automationRaw: auto.raw,
        spec: (spec || '').replace(/`/g, '').trim(),
        priority: (priority || '').trim(),
        file: rel,
      });
    }

    for (const cells of tableRowsUnder(lines, /Case không automation/i)) {
      const m = (cells[0] || '').match(/TC-\d{3}/);
      if (m && (cells[1] || '').trim()) noAutomationReasons.add(m[0]);
    }

    lines.forEach((line, i) => {
      const m = line.match(RE_TC_HEADING);
      if (m) details.push({ tcId: m[1], title: m[2], file: rel, line: i + 1 });
    });
  }
  return { links, details, noAutomationReasons, nearMisses };
}

/**
 * Chạy `playwright test --list --reporter=json` và rút ra test thật.
 * REQ lấy từ tag (`test.describe(..., { tag: '@REQ-001' })`),
 * TC/AC lấy từ title (`TC-001 - AC-001 ...`, đã được ESLint ép).
 */
/**
 * Matcher bất đồng bộ của Playwright — gọi mà quên `await` thì assertion không bao giờ
 * được chờ, test xanh giả. Để thành hằng số đặt tên và cho phép ghi đè qua
 * `options.asyncMatchers`, vì danh sách này là API của Playwright chứ không phải
 * quy ước của repo; Playwright thêm matcher mới thì không phải sửa code.
 */
const ASYNC_MATCHERS = new Set([
  'toBeVisible', 'toBeHidden', 'toHaveText', 'toContainText', 'toBeEnabled',
  'toBeDisabled', 'toHaveValue', 'toHaveValues', 'toBeChecked', 'toHaveCount',
  'toHaveAttribute', 'toHaveURL', 'toHaveTitle', 'toBeAttached', 'toBeInViewport',
  'toBeFocused', 'toBeEmpty', 'toBeEditable', 'toHaveClass', 'toHaveId',
  'toHaveCSS', 'toHaveJSProperty', 'toHaveScreenshot', 'toHaveAccessibleName',
  'toHaveAccessibleDescription', 'toHaveRole', 'toPass',
]);

/**
 * Tìm dấu `)` đóng cho dấu `(` ở vị trí `open`, có nhận biết chuỗi và comment.
 * Dùng regex `[^)]*` thay cho việc này là fail-open: nó dừng ở `)` ĐẦU TIÊN, nên
 * `expect(page.getByRole('button'))` không bao giờ khớp — tức là bỏ lọt đúng dạng
 * locator viết inline, dạng phổ biến nhất và cũng dễ quên `await` nhất.
 */
function matchingParen(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '/' && text[i + 1] === '/') { // comment dòng
      const nl = text.indexOf('\n', i);
      if (nl === -1) return -1;
      i = nl;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Quét thân một test, trả về các lời gọi `expect(...).<matcher bất đồng bộ>(...)`
 * thiếu `await`/`return`. Quét trên toàn thân (đã nối dòng) nên bắt được cả
 * `expect(...)` trải nhiều dòng.
 */
function findMissingAwaits(bodyLines, firstLineNo, asyncMatchers = ASYNC_MATCHERS) {
  const text = bodyLines.join('\n');
  const out = [];
  const re = /\bexpect(?:\.soft)?\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = text.indexOf('(', m.index);
    const close = matchingParen(text, open);
    if (close === -1) continue;
    // Bỏ qua `.not`, `.resolves`, `.rejects` chen giữa để không bỏ lọt phủ định.
    const after = text.slice(close + 1);
    const tail = after.match(/^(?:\s*\.\s*(?:not|resolves|rejects))*\s*\.\s*([A-Za-z][A-Za-z0-9]*)\s*\(/);
    if (!tail || !asyncMatchers.has(tail[1])) continue;
    // `await`/`return` phải đứng NGAY trước expect. Kiểm cả dòng như trước đây sẽ
    // bỏ sót `expect(a).toBeVisible(); await foo();` viết chung một dòng.
    if (/\b(?:await|return|yield)\s*$/.test(text.slice(0, m.index))) continue;
    const lineOffset = text.slice(0, m.index).split('\n').length - 1;
    out.push({
      line: firstLineNo + lineOffset,
      matcher: tail[1],
      text: (bodyLines[lineOffset] || '').trim(),
    });
  }
  return out;
}

function loadAutomatedTests(root, options = {}) {
  // `.` = gốc repo, cho repo để playwright.config ngay ở root.
  const rel = options.projectDir || 'playwright';
  const project = options.project || 'chromium';
  const projectDir = path.resolve(root, rel);
  if (!fs.existsSync(projectDir)) {
    return {
      tests: [],
      error:
        `Không thấy thư mục Playwright "${rel}" — khai "projectDir" trong qa.config.json ` +
        'hoặc chạy lại với --project-dir=<đường dẫn>',
    };
  }

  // Windows: npx là .cmd, spawn thẳng sẽ EINVAL -> phải qua shell.
  const useShell = process.platform === 'win32';
  // --pass-with-no-tests: không có nó thì Playwright exit 1 khi 0 test, nên nhánh
  // "đọc được 0 spec" rơi vào error và finding doc-duoc-0-spec trở thành code chết.
  const args = [
    'playwright', 'test', '--list', '--reporter=json',
    `--project=${project}`, '--pass-with-no-tests',
  ];
  // shell: true nối args thành MỘT chuỗi, nên giá trị có khoảng trắng
  // (vd project tên "Desktop Chrome") bị tách thành hai tham số. Phải tự bọc ngoặc kép.
  const argv = useShell ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args;

  let raw;
  try {
    raw = execFileSync('npx', argv, {
      cwd: projectDir,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: useShell,
    });
  } catch (err) {
    return {
      tests: [],
      error:
        `Không chạy được playwright --list trong "${rel}": ${String(err.message).split(/\r?\n/)[0]} ` +
        `(project đang dùng: "${project}" — đổi "project" trong qa.config.json nếu tên khác)`,
    };
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return { tests: [], error: 'Output của playwright --list không phải JSON hợp lệ' };
  }

  // spec.file tương đối với rootDir của Playwright (testDir), không phải gốc repo.
  // Lấy rootDir thật từ output thay vì đoán, để đường dẫn in ra luôn mở được từ gốc repo.
  let rootRel = '';
  if (json.config && json.config.rootDir) {
    rootRel = path.relative(root, json.config.rootDir).replace(/\\/g, '/');
    if (rootRel === '.' || rootRel.startsWith('..')) rootRel = '';
  }
  const toRepoPath = (file) => {
    const f = (file || '').replace(/\\/g, '/');
    return rootRel ? `${rootRel}/${f}` : f;
  };

  const fileCache = new Map();
  const getFileLines = (relPath) => {
    if (!fileCache.has(relPath)) {
      const absPath = path.resolve(root, relPath);
      if (fs.existsSync(absPath)) {
        try {
          fileCache.set(relPath, readText(absPath).split('\n'));
        } catch {
          fileCache.set(relPath, null);
        }
      } else {
        fileCache.set(relPath, null);
      }
    }
    return fileCache.get(relPath);
  };

  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      const m = spec.title.match(RE_TC_AC_TITLE);
      const tags = spec.tags || [];
      const testPath = toRepoPath(spec.file);
      let assertionCount = null;
      let isSkipped = false;

      const fileLines = getFileLines(testPath);
      let missingAwaits = [];

      if (fileLines && spec.line > 0) {
        const start = spec.line - 1;
        const lineText = fileLines[start] || '';
        if (/test\.(?:skip|fixme)\b/.test(lineText)) {
          isSkipped = true;
        }
        let count = 0;
        let end = fileLines.length;
        for (let i = start; i < fileLines.length; i++) {
          const l = fileLines[i];
          if (i > start && /^\s{0,6}test(?:\.describe|\.only|\.skip|\.fixme)?\s*\(/.test(l)) {
            end = i;
            break;
          }
          const mExpect = l.match(/\bexpect(?:\.soft)?\s*\(/g);
          if (mExpect) count += mExpect.length;
        }
        assertionCount = count;
        missingAwaits = findMissingAwaits(
          fileLines.slice(start, end),
          start + 1,
          (options && options.asyncMatchers) || ASYNC_MATCHERS,
        );
      }

      const reqTag = tags.find((t) => /^@?REQ-\d{3}$/.test(t));
      const reqId = reqTag ? (reqTag.startsWith('@') ? reqTag.slice(1) : reqTag) : null;

      tests.push({
        title: spec.title,
        tcId: m ? m[1] : null,
        acId: m ? m[2] : null,
        reqId,
        tags,
        file: (spec.file || '').replace(/\\/g, '/'),
        // Đường dẫn tính từ gốc repo — dùng cho mọi thông báo và bảng traceability.
        path: testPath,
        isSetup: RE_SETUP_FILE.test(spec.file || ''),
        line: spec.line || 0,
        assertionCount,
        isSkipped,
        missingAwaits,
      });
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of json.suites || []) walk(suite);

  // Khoanh vùng spec nằm ngoài gate. KHÔNG im lặng: trả về số lượng và danh sách
  // tiền tố đã dùng để mọi lệnh in ra được.
  const ignorePrefixes = (options.ignoreSpecs || []).filter(Boolean);
  const kept = ignorePrefixes.length
    ? tests.filter((t) => !ignorePrefixes.some((p) => t.path === p || t.path.startsWith(p.endsWith('/') ? p : `${p}/`)))
    : tests;
  const ignoredCount = tests.length - kept.length;

  // Đọc được 0 test là chế độ hỏng NGUY HIỂM NHẤT: mọi báo cáo sẽ xanh vì không có
  // gì để đối chiếu. Phải phân biệt với repo mới tinh chưa có spec nào, nên chỉ
  // đánh dấu ở đây; commands.js quyết định có thành finding hay không.
  const emptyResult = tests.length === 0;

  return {
    tests: kept,
    error: null,
    emptyResult,
    emptyMessage: emptyResult
      ? `Đọc được 0 test từ "${rel}" với project "${project}". Playwright chạy được nhưng không ` +
        'thấy spec nào — nhiều khả năng sai "projectDir" hoặc "project" trong qa.config.json. ' +
        'Mọi báo cáo dưới đây sẽ xanh giả vì không có gì để đối chiếu.'
      : null,
    ignoredCount,
    ignorePrefixes,
  };
}

module.exports = {
  loadRequirements,
  loadTestCases,
  loadAutomatedTests,
  parseFrontMatter,
  findMissingAwaits,
  ASYNC_MATCHERS,
};
