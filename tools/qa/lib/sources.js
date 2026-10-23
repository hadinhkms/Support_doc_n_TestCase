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

    let pageExposure = null;
    let uiCoverage = null;
    let xssApplicability = null;
    for (const line of lines) {
      const mExp = line.match(/^\s*-\s*\*\*Page exposure\*\*\s*:\s*(Public|Authenticated)\b/i);
      if (mExp) {
        pageExposure = /^public$/i.test(mExp[1]) ? 'Public' : 'Authenticated';
      }
      const mUi = line.match(
        /^\s*-\s*\*\*UI coverage\*\*\s*:\s*(Required|Exempt)(?:\s*\(\s*reason\s*:\s*([^)]+?)\s*\))?/i,
      );
      if (mUi) {
        uiCoverage = {
          status: /^required$/i.test(mUi[1]) ? 'Required' : 'Exempt',
          reason: mUi[2] ? mUi[2].trim() : null,
        };
      }
      const mXss = line.match(
        /^\s*-\s*\*\*XSS applicability\*\*\s*:\s*(Applicable|Not applicable)(?:\s*\(\s*reason\s*:\s*([^)]+?)\s*\))?/i,
      );
      if (mXss) {
        xssApplicability = {
          status: /^applicable$/i.test(mXss[1]) ? 'Applicable' : 'Not applicable',
          reason: mXss[2] ? mXss[2].trim() : null,
        };
      }
    }

    const coverageNotes = tableRowsUnder(lines, /Coverage notes/i)
      .filter((cells) => !/^Aspect$/i.test(cells[0]))
      .map((cells) => ({
        aspect: cells[0] || '',
        status: cells[1] || '',
        notes: cells[2] || '',
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
      pageExposure,
      uiCoverage,
      xssApplicability,
      coverageNotes,
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

    let currentDetail = null;
    lines.forEach((line, i) => {
      const m = line.match(RE_TC_HEADING);
      if (m) {
        currentDetail = { tcId: m[1], title: m[2], file: rel, line: i + 1, capabilities: [] };
        details.push(currentDetail);
        return;
      }
      if (/^\s{0,3}#{2,6}\s/.test(line)) {
        currentDetail = null;
        return;
      }
      if (currentDetail) {
        const mCap = line.match(/^\s*-\s*\*\*Capabilities\*\*\s*:\s*(.+)$/i);
        if (mCap) {
          currentDetail.capabilities = mCap[1]
            .split(',')
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean);
        }
      }
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

const NAVIGATION_MATCHERS = new Set(['toHaveURL', 'toHaveTitle']);

const WEAK_EXISTENCE_MATCHERS = new Set(['toBeDefined', 'toBeTruthy']);

const VERIFIED_UI_HELPERS = new Set([
  'expectNoHorizontalScroll',
  'expectNoHorizontalOverflow',
  'expectNoTextOverflow',
  'expectPairwiseNoOverlap',
  'expectNoOverlap',
  'expectContainedIn',
  'expectContainedWithin',
  'expectNotOccluded',
  'expectInteractiveA11y',
  'expectResponsiveIntegrity',
  'expectNoBrokenImages',
  'expectMaxLengthEnforced',
]);

const VERIFIED_GUARD_HELPERS = new Set([
  'expectIdempotentSubmit',
  'expectSafeXssRender',
  'expectStatePersistence',
  'expectBoundaryRejected',
  'expectPerformanceBudget',
]);

const VERIFIED_FIXTURE_HELPERS = new Set(['expectExpectedError']);

const VERIFIED_DEEP_HELPERS = new Set([
  ...VERIFIED_UI_HELPERS,
  ...VERIFIED_GUARD_HELPERS,
  ...VERIFIED_FIXTURE_HELPERS,
]);

/**
 * Phân giải danh sách helper được import hợp lệ từ `support/ui-checks`, `support/deep-guards`,
 * hoặc `fixtures/base.fixture` / `fixtures/test-fixtures` (hỗ trợ cả multiline import và `as` alias).
 * Trả về `Map<localName, canonicalName>`.
 */
function extractVerifiedHelperImports(fileInput) {
  const raw = Array.isArray(fileInput) ? fileInput.join('\n') : String(fileInput || '');
  const map = new Map();
  if (!raw) return map;

  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  const importRe = /\bimport\s+(?!type\b)\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(stripped)) !== null) {
    const specifiersBlock = m[1];
    const modulePath = m[2].trim().replace(/\\/g, '/');

    let allowedSet = null;
    if (/(?:^|\/|@)support\/ui-checks(?:\.[jt]s)?$/.test(modulePath)) {
      allowedSet = VERIFIED_UI_HELPERS;
    } else if (/(?:^|\/|@)support\/deep-guards(?:\.[jt]s)?$/.test(modulePath)) {
      allowedSet = VERIFIED_GUARD_HELPERS;
    } else if (/(?:^|\/|@)fixtures\/(?:base\.fixture|test-fixtures)(?:\.[jt]s)?$/.test(modulePath)) {
      allowedSet = VERIFIED_DEEP_HELPERS;
    }
    if (!allowedSet) continue;

    for (const part of specifiersBlock.split(',')) {
      const cleaned = part.trim();
      if (!cleaned || /^type\s+/.test(cleaned)) continue;
      const mSpec = cleaned.match(/^([A-Za-z_$][A-Za-z0-9_$]*)(?:\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))?$/);
      if (!mSpec) continue;
      const canonical = mSpec[1];
      const local = mSpec[2] || mSpec[1];
      if (allowedSet.has(canonical)) {
        map.set(local, canonical);
      }
    }
  }
  return map;
}

const KNOWN_NON_NAVIGATION_MATCHERS = new Set([
  'toBeVisible', 'toBeHidden', 'toHaveText', 'toContainText', 'toBeEnabled',
  'toBeDisabled', 'toHaveValue', 'toHaveValues', 'toBeChecked', 'toHaveCount',
  'toHaveAttribute', 'toBeAttached', 'toBeInViewport', 'toBeFocused',
  'toBeEmpty', 'toBeEditable', 'toHaveClass', 'toHaveId', 'toHaveCSS',
  'toHaveJSProperty', 'toHaveScreenshot', 'toHaveAccessibleName',
  'toHaveAccessibleDescription', 'toHaveRole', 'toPass', 'toBeOK',
  'toBe', 'toEqual', 'toStrictEqual', 'toContain', 'toContainEqual',
  'toHaveLength', 'toBeTruthy', 'toBeFalsy', 'toBeNull', 'toBeUndefined',
  'toBeDefined', 'toBeNaN', 'toBeInstanceOf', 'toBeGreaterThan',
  'toBeGreaterThanOrEqual', 'toBeLessThan', 'toBeLessThanOrEqual',
  'toBeCloseTo', 'toMatch', 'toMatchObject', 'toHaveProperty',
  'toThrow', 'toThrowError',
]);

/**
 * Whitelist các thao tác điều hướng, tương tác, dựng locator, chờ đợi và tiện ích
 * không tự chứa assertion của Playwright/JS. Khi test không có UI/data matcher
 * trực tiếp, bất kỳ lời gọi hàm/method nào nằm ngoài whitelist này đều có thể
 * che giấu assertion bên trong helper/POM -> phân loại là `unknown` thay vì đoán.
 */
const PLAYWRIGHT_SAFE_CALL_WHITELIST = new Set([
  // Page / Frame navigation & lifecycle
  'goto', 'reload', 'goBack', 'goForward', 'setContent', 'bringToFront', 'close',
  'isClosed', 'pause', 'setViewportSize', 'viewportSize', 'setExtraHTTPHeaders',
  'setDefaultTimeout', 'setDefaultNavigationTimeout', 'addInitScript',
  'addScriptTag', 'addStyleTag', 'exposeFunction', 'exposeBinding',
  'route', 'unroute', 'unrouteAll', 'routeFromHAR', 'continue', 'fulfill',
  'abort', 'fallback', 'screenshot', 'pdf', 'video',
  // Locators & selectors
  'locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder',
  'getByAltText', 'getByTitle', 'getByTestId', 'frameLocator', 'frame', 'frames',
  'mainFrame', 'contentFrame', 'ownerFrame', 'first', 'last', 'nth', 'filter',
  'and', 'or', ' describe',
  // User actions
  'click', 'dblclick', 'tap', 'fill', 'type', 'press', 'pressSequentially',
  'clear', 'check', 'uncheck', 'setChecked', 'selectOption', 'setInputFiles',
  'focus', 'blur', 'hover', 'dragTo', 'scrollIntoViewIfNeeded', 'dispatchEvent',
  'down', 'up', 'move', 'wheel', 'insertText',
  // Waiting & non-asserting queries
  'waitForURL', 'waitForLoadState', 'waitForSelector', 'waitForFunction',
  'waitForTimeout', 'waitForEvent', 'waitForRequest', 'waitForResponse', 'waitFor',
  'evaluate', 'evaluateHandle', 'evaluateAll',
  'title', 'url', 'content', 'innerText', 'textContent', 'innerHTML',
  'inputValue', 'getAttribute', 'isVisible', 'isHidden', 'isEnabled',
  'isDisabled', 'isChecked', 'isEditable', 'count', 'all', 'allInnerTexts',
  'allTextContents', 'boundingBox',
  // Context / Browser / APIRequest
  'context', 'page', 'pages', 'browser', 'newPage', 'newContext',
  'cookies', 'addCookies', 'clearCookies', 'storageState', 'grantPermissions',
  'clearPermissions', 'setGeolocation', 'setOffline',
  'request', 'fetch', 'get', 'post', 'put', 'delete', 'patch', 'head', 'dispose',
  'json', 'text', 'body', 'headers', 'headersArray', 'status', 'statusText', 'ok',
  // Safe JS / env utilities
  'requireEnv', 'trim', 'toLowerCase', 'toUpperCase', 'slice', 'substring',
  'replace', 'replaceAll', 'split', 'join', 'includes', 'startsWith', 'endsWith',
  'match', 'exec', 'padStart', 'padEnd', 'charAt', 'indexOf', 'lastIndexOf',
  'map', 'forEach', 'find', 'findIndex', 'some', 'every', 'reduce', 'flat',
  'flatMap', 'push', 'pop', 'shift', 'unshift', 'concat', 'sort', 'reverse',
  'keys', 'values', 'entries', 'from', 'isArray', 'parse', 'stringify', 'now',
  'floor', 'ceil', 'round', 'max', 'min', 'abs', 'random', 'toString', 'valueOf',
  'log', 'warn', 'error', 'debug', 'info',
  'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'RegExp', 'Error',
  'URL', 'URLSearchParams', 'Map', 'Set', 'Promise', 'resolve', 'reject', 'race',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout',
]);

const SAFE_STANDALONE_CALLS = new Set([
  'requireEnv', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date',
  'RegExp', 'Error', 'URL', 'URLSearchParams', 'Map', 'Set', 'Promise',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout',
]);

const JS_CONTROL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'await',
  'typeof', 'void', 'delete', 'throw', 'case', 'new', 'async', 'yield',
]);

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'case', 'throw', 'typeof', 'void', 'delete', 'in',
  'instanceof', 'of', 'await', 'yield', 'new', 'else', 'do',
]);

const REGEX_PRECEDING_PUNCT = new Set([
  '(', '[', '{', ',', ';', ':', '?', '=', '!', '&', '|', '^', '~',
  '+', '-', '*', '%', '/', '<', '>',
]);

const SAFE_EXPECT_HELPERS = new Set([
  'any', 'anything', 'arrayContaining', 'objectContaining',
  'stringContaining', 'stringMatching', 'closeTo',
]);

/**
 * Tìm dấu `)` đóng cho dấu `(` ở vị trí `open`, có nhận biết chuỗi và comment.
 * Dùng regex `[^)]*` thay cho việc này là fail-open: nó dừng ở `)` ĐẦU TIÊN, nên
 * `expect(page.getByRole('button'))` không bao giờ khớp — tức là bỏ lọt đúng dạng
 * locator viết inline, dạng phổ biến nhất và cũng dễ quên `await` nhất.
 */
/**
 * Quét chuỗi nguồn JS/TS từ vị trí `openBraceIdx` (trỏ vào `{`) để tìm `}` đóng tương ứng,
 * có nhận biết comment, string, template literal và regex literal.
 */
function canStartRegex(prevToken) {
  return (
    prevToken === '' ||
    REGEX_PRECEDING_PUNCT.has(prevToken) ||
    REGEX_PRECEDING_KEYWORDS.has(prevToken)
  );
}

/**
 * Quét và làm sạch một đoạn mã JS/TS:
 * - Kiểm tra tính cân bằng của `()`, `{}`, `[]` và đóng mở hợp lệ của string/comment/template/regex.
 * - Thay nội dung comment, string literal, regex literal, và template literal an toàn bằng khoảng trắng
 *   (giữ nguyên `\n` để bảo toàn số dòng) nhằm tránh đếm nhầm `expect(...)` giả trong chuỗi/comment.
 * - Nếu template interpolation `${...}` chứa `expect` hoặc lời gọi hàm mơ hồ -> trả `ok: false`.
 */
function tokenizeAndSanitize(code) {
  const len = code.length;
  const cleanChars = new Array(len);
  for (let k = 0; k < len; k++) {
    cleanChars[k] = code[k] === '\n' ? '\n' : ' ';
  }

  const stack = [];
  let prevToken = '';
  let i = 0;

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // 1. Line comment
    if (ch === '/' && next === '/') {
      const nl = code.indexOf('\n', i + 2);
      if (nl === -1) break;
      i = nl + 1;
      continue;
    }

    // 2. Block comment
    if (ch === '/' && next === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) {
        return { ok: false, reason: 'unclosed-block-comment' };
      }
      i = close + 2;
      continue;
    }

    // 3. Single or double quoted string
    if (ch === "'" || ch === '"') {
      const quote = ch;
      cleanChars[i] = '"';
      let j = i + 1;
      let closed = false;
      while (j < len) {
        const c = code[j];
        if (c === '\\') {
          if (j + 1 >= len) return { ok: false, reason: 'unclosed-string-literal' };
          j += 2;
          continue;
        }
        if (c === '\n' || c === '\r') {
          return { ok: false, reason: 'unclosed-string-literal' };
        }
        if (c === quote) {
          cleanChars[j] = '"';
          closed = true;
          i = j + 1;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return { ok: false, reason: 'unclosed-string-literal' };
      continue;
    }

    // 4. Template literal
    if (ch === '`') {
      cleanChars[i] = '"';
      let j = i + 1;
      let closed = false;
      while (j < len) {
        const c = code[j];
        if (c === '\\') {
          if (j + 1 >= len) return { ok: false, reason: 'unclosed-template-literal' };
          j += 2;
          continue;
        }
        if (c === '$' && code[j + 1] === '{') {
          const exprEnd = findMatchingDelimiter(code, j + 1, '{', '}');
          if (exprEnd === -1) {
            return { ok: false, reason: 'unclosed-template-interpolation' };
          }
          const exprCode = code.slice(j + 2, exprEnd);
          const sub = tokenizeAndSanitize(exprCode);
          if (!sub.ok) return sub;
          if (
            /\bexpect\b/.test(sub.cleanText) ||
            /(?:^|[^A-Za-z0-9_$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.test(sub.cleanText) ||
            /\]\s*\(/.test(sub.cleanText)
          ) {
            return { ok: false, reason: 'ambiguous-template-interpolation' };
          }
          j = exprEnd + 1;
          continue;
        }
        if (c === '`') {
          cleanChars[j] = '"';
          closed = true;
          i = j + 1;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return { ok: false, reason: 'unclosed-template-literal' };
      continue;
    }

    // 5. Regex literal
    if (ch === '/' && canStartRegex(prevToken)) {
      cleanChars[i] = '"';
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < len) {
        const c = code[j];
        if (c === '\\') {
          if (j + 1 >= len || code[j + 1] === '\n' || code[j + 1] === '\r') {
            return { ok: false, reason: 'unclosed-regex-literal' };
          }
          j += 2;
          continue;
        }
        if (c === '\n' || c === '\r') {
          return { ok: false, reason: 'unclosed-regex-literal' };
        }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) {
          cleanChars[j] = '"';
          let k = j + 1;
          while (k < len && /[A-Za-z0-9_$]/.test(code[k])) {
            if (!/[dgimsuvy]/.test(code[k])) {
              return { ok: false, reason: 'invalid-regex-flags' };
            }
            k++;
          }
          closed = true;
          i = k;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return { ok: false, reason: 'unclosed-regex-literal' };
      continue;
    }

    // 6. Delimiters
    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push(ch);
      cleanChars[i] = ch;
      prevToken = ch;
      i++;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      const expected = ch === ')' ? '(' : ch === '}' ? '{' : '[';
      if (stack.length === 0 || stack[stack.length - 1] !== expected) {
        return { ok: false, reason: 'mismatched-delimiter' };
      }
      stack.pop();
      cleanChars[i] = ch;
      prevToken = ch;
      i++;
      continue;
    }

    // 7. Identifier or keyword
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(code[j])) j++;
      for (let k = i; k < j; k++) cleanChars[k] = code[k];
      prevToken = code.slice(i, j);
      i = j;
      continue;
    }

    // 8. Numbers
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9A-Za-z_.]/.test(code[j])) j++;
      for (let k = i; k < j; k++) cleanChars[k] = code[k];
      prevToken = '0';
      i = j;
      continue;
    }

    cleanChars[i] = ch;
    prevToken = ch;
    i++;
  }

  if (stack.length > 0) {
    return { ok: false, reason: 'unclosed-delimiter' };
  }

  return { ok: true, cleanText: cleanChars.join('') };
}

/**
 * Tìm vị trí đóng cho delimiter mở tại `openIdx` (ví dụ `(` -> `)` hoặc `{` -> `}`),
 * có nhận biết comment, string, template literal và regex literal.
 */
function findMatchingDelimiter(code, openIdx, openChar = '(', closeChar = ')') {
  const len = code.length;
  if (code[openIdx] !== openChar) return -1;
  const stack = [openChar];
  let prevToken = openChar;
  let i = openIdx + 1;

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      const nl = code.indexOf('\n', i + 2);
      if (nl === -1) return -1;
      i = nl + 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) return -1;
      i = close + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      let closed = false;
      while (j < len) {
        if (code[j] === '\\') {
          if (j + 1 >= len) return -1;
          j += 2;
          continue;
        }
        if (code[j] === '\n' || code[j] === '\r') return -1;
        if (code[j] === quote) {
          closed = true;
          i = j + 1;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return -1;
      continue;
    }
    if (ch === '`') {
      let j = i + 1;
      let closed = false;
      while (j < len) {
        if (code[j] === '\\') {
          if (j + 1 >= len) return -1;
          j += 2;
          continue;
        }
        if (code[j] === '$' && code[j + 1] === '{') {
          const exprEnd = findMatchingDelimiter(code, j + 1, '{', '}');
          if (exprEnd === -1) return -1;
          j = exprEnd + 1;
          continue;
        }
        if (code[j] === '`') {
          closed = true;
          i = j + 1;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return -1;
      continue;
    }
    if (ch === '/' && canStartRegex(prevToken)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < len) {
        if (code[j] === '\\') {
          if (j + 1 >= len || code[j + 1] === '\n' || code[j + 1] === '\r') return -1;
          j += 2;
          continue;
        }
        if (code[j] === '\n' || code[j] === '\r') return -1;
        if (code[j] === '[') inClass = true;
        else if (code[j] === ']') inClass = false;
        else if (code[j] === '/' && !inClass) {
          let k = j + 1;
          while (k < len && /[A-Za-z0-9_$]/.test(code[k])) k++;
          closed = true;
          i = k;
          prevToken = '"';
          break;
        }
        j++;
      }
      if (!closed) return -1;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push(ch);
      prevToken = ch;
      i++;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      const expected = ch === ')' ? '(' : ch === '}' ? '{' : '[';
      if (stack.length === 0 || stack[stack.length - 1] !== expected) return -1;
      stack.pop();
      prevToken = ch;
      if (stack.length === 0) return i;
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(code[j])) j++;
      prevToken = code.slice(i, j);
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9A-Za-z_.]/.test(code[j])) j++;
      prevToken = '0';
      i = j;
      continue;
    }
    prevToken = ch;
    i++;
  }
  return -1;
}

/**
 * Rút phần tham số và thân hàm callback của một lời gọi `test(...)` bắt đầu tại
 * dòng `startLine` (1-based). Không dựa vào indentation của test kế tiếp.
 */
function extractTestCallbackBody(fileLines, startLine = 1) {
  const lines = Array.isArray(fileLines) ? fileLines : String(fileLines || '').split('\n');
  const startIdx = Math.max(0, (startLine || 1) - 1);
  const tailText = lines.slice(startIdx).join('\n');
  const mTest = tailText.match(/^\s*(?:test|it)(?:\s*\.\s*(?:only|skip|fixme|fail))?\s*\(/);
  if (!mTest) {
    return { ok: false, reason: 'cannot-locate-test-call' };
  }
  const openParen = tailText.indexOf('(', mTest.index);
  const closeParen = findMatchingDelimiter(tailText, openParen, '(', ')');
  if (closeParen === -1) {
    return { ok: false, reason: 'unclosed-test-call' };
  }

  const callInner = tailText.slice(openParen + 1, closeParen);
  const sanitizedCall = tokenizeAndSanitize(callInner);
  if (!sanitizedCall.ok) {
    return { ok: false, reason: sanitizedCall.reason };
  }

  // Tìm các dấu phẩy ở mức đỉnh (top-level) của danh sách đối số test(...)
  const topCommas = [];
  let pDepth = 0;
  let bDepth = 0;
  let kDepth = 0;
  for (let i = 0; i < sanitizedCall.cleanText.length; i++) {
    const ch = sanitizedCall.cleanText[i];
    if (ch === '(') pDepth++;
    else if (ch === ')') pDepth--;
    else if (ch === '{') bDepth++;
    else if (ch === '}') bDepth--;
    else if (ch === '[') kDepth++;
    else if (ch === ']') kDepth--;
    else if (ch === ',' && pDepth === 0 && bDepth === 0 && kDepth === 0) {
      topCommas.push(i);
    }
  }

  if (topCommas.length === 0) {
    return { ok: false, reason: 'missing-test-callback' };
  }

  const argRanges = [];
  let prev = 0;
  for (const commaIdx of topCommas) {
    argRanges.push([prev, commaIdx]);
    prev = commaIdx + 1;
  }
  argRanges.push([prev, callInner.length]);

  // Bỏ đối số rỗng cuối nếu có trailing comma
  while (
    argRanges.length > 0 &&
    !sanitizedCall.cleanText.slice(argRanges[argRanges.length - 1][0], argRanges[argRanges.length - 1][1]).trim()
  ) {
    argRanges.pop();
  }
  if (argRanges.length < 2) {
    return { ok: false, reason: 'missing-test-callback' };
  }

  const [cbRelStart, cbRelEnd] = argRanges[argRanges.length - 1];
  const cbRaw = callInner.slice(cbRelStart, cbRelEnd);
  const cbClean = sanitizedCall.cleanText.slice(cbRelStart, cbRelEnd);
  const endLine = startIdx + tailText.slice(0, closeParen + 1).split('\n').length;

  // Tìm `=>` ở mức đỉnh của đối số callback
  let arrowIdx = -1;
  pDepth = 0;
  bDepth = 0;
  kDepth = 0;
  for (let i = 0; i < cbClean.length - 1; i++) {
    const ch = cbClean[i];
    if (ch === '(') pDepth++;
    else if (ch === ')') pDepth--;
    else if (ch === '{') bDepth++;
    else if (ch === '}') bDepth--;
    else if (ch === '[') kDepth++;
    else if (ch === ']') kDepth--;
    else if (ch === '=' && cbClean[i + 1] === '>' && pDepth === 0 && bDepth === 0 && kDepth === 0) {
      arrowIdx = i;
      break;
    }
  }

  if (arrowIdx !== -1) {
    const headRaw = cbRaw.slice(0, arrowIdx);
    const headClean = cbClean.slice(0, arrowIdx);
    let paramsText = '';
    const pOpen = headClean.indexOf('(');
    if (pOpen !== -1) {
      const pClose = findMatchingDelimiter(headClean, pOpen, '(', ')');
      if (pClose === -1) return { ok: false, reason: 'unclosed-callback-params' };
      paramsText = headRaw.slice(pOpen + 1, pClose).trim();
    } else {
      const mIdent = headClean.match(/^\s*(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
      if (!mIdent) return { ok: false, reason: 'invalid-arrow-params' };
      paramsText = mIdent[1];
    }

    const afterArrowClean = cbClean.slice(arrowIdx + 2);
    const firstNonWs = afterArrowClean.search(/\S/);
    if (firstNonWs === -1) return { ok: false, reason: 'empty-arrow-body' };
    const bodyStartInCb = arrowIdx + 2 + firstNonWs;

    if (cbClean[bodyStartInCb] === '{') {
      const bodyCloseInCb = findMatchingDelimiter(cbClean, bodyStartInCb, '{', '}');
      if (bodyCloseInCb === -1) return { ok: false, reason: 'unclosed-callback-body' };
      if (cbClean.slice(bodyCloseInCb + 1).trim() !== '') {
        return { ok: false, reason: 'unexpected-tokens-after-callback-body' };
      }
      const bodyOffsetInTail = openParen + 1 + cbRelStart + bodyStartInCb + 1;
      const bodyStartLine = startIdx + tailText.slice(0, bodyOffsetInTail).split('\n').length;
      return {
        ok: true,
        paramsText,
        bodyText: cbRaw.slice(bodyStartInCb + 1, bodyCloseInCb),
        bodyStartLine,
        endLine,
      };
    }

    const bodyOffsetInTail = openParen + 1 + cbRelStart + bodyStartInCb;
    const bodyStartLine = startIdx + tailText.slice(0, bodyOffsetInTail).split('\n').length;
    return {
      ok: true,
      paramsText,
      bodyText: cbRaw.slice(bodyStartInCb),
      bodyStartLine,
      endLine,
    };
  }

  // Hỗ trợ `async function({ page }) { ... }` hoặc `function({ page }) { ... }`
  const mFn = cbClean.match(/^\s*(?:async\s+)?function(?:\s+[A-Za-z_$][A-Za-z0-9_$]*)?\s*\(/);
  if (mFn) {
    const pOpen = cbClean.indexOf('(', mFn.index);
    const pClose = findMatchingDelimiter(cbClean, pOpen, '(', ')');
    if (pClose === -1) return { ok: false, reason: 'unclosed-callback-params' };
    const paramsText = cbRaw.slice(pOpen + 1, pClose).trim();
    const bOpen = cbClean.indexOf('{', pClose + 1);
    if (bOpen === -1) return { ok: false, reason: 'missing-function-body' };
    const bClose = findMatchingDelimiter(cbClean, bOpen, '{', '}');
    if (bClose === -1) return { ok: false, reason: 'unclosed-callback-body' };
    if (cbClean.slice(bClose + 1).trim() !== '') {
      return { ok: false, reason: 'unexpected-tokens-after-callback-body' };
    }
    const bodyOffsetInTail = openParen + 1 + cbRelStart + bOpen + 1;
    const bodyStartLine = startIdx + tailText.slice(0, bodyOffsetInTail).split('\n').length;
    return {
      ok: true,
      paramsText,
      bodyText: cbRaw.slice(bOpen + 1, bClose),
      bodyStartLine,
      endLine,
    };
  }

  return { ok: false, reason: 'non-inline-callback' };
}

/**
 * Rút tập tên biến đại diện cho `page` fixture của Playwright từ danh sách tham số
 * callback và các phép gán alias trực tiếp trong thân test.
 */
function extractPageAliases(paramsText, cleanBodyText) {
  const aliases = new Set();
  const rawParams = paramsText === undefined ? '{ page }' : String(paramsText).trim();

  if (rawParams.includes('{')) {
    const braceOpen = rawParams.indexOf('{');
    const braceClose = findMatchingDelimiter(rawParams, braceOpen, '{', '}');
    const destructured = braceClose !== -1 ? rawParams.slice(braceOpen + 1, braceClose) : rawParams;
    const mAlias = destructured.match(/(?:^|[,{\s])page\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (mAlias) {
      aliases.add(mAlias[1]);
    } else if (/(?:^|[,{\s])page(?:\s*=|\s*[,}\s]|$)/.test(destructured)) {
      aliases.add('page');
    }
  } else if (rawParams === 'page') {
    aliases.add('page');
  }

  // Nhận diện alias đơn giản `const userPage = page;` hoặc phát hiện biến `page` bị ghi đè
  const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;,\n]+)/g;
  let m;
  while ((m = declRe.exec(cleanBodyText)) !== null) {
    const lhs = m[1];
    const rhs = m[2].trim();
    if (aliases.has(rhs)) {
      aliases.add(lhs);
    } else if (aliases.has(lhs)) {
      aliases.delete(lhs);
    }
  }

  return aliases;
}

function normalizePageReceiver(rawReceiver) {
  let r = String(rawReceiver || '').trim();
  while (r.startsWith('(') && r.endsWith(')') && findMatchingDelimiter(r, 0, '(', ')') === r.length - 1) {
    r = r.slice(1, -1).trim();
  }
  r = r.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$.<>]*$/, '').trim();
  return r;
}

function blankOutImports(text) {
  return String(text || '').replace(
    /\bimport\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;?|\bimport\s+[^;\n]+from\s*['"][^'"]+['"]\s*;?/g,
    (match) => match.replace(/[^\n]/g, ' '),
  );
}

function isInsidePromiseCombinator(text, targetIdx) {
  const combRe = /\bPromise\s*\.\s*(?:all|allSettled)\s*\(/g;
  let m;
  while ((m = combRe.exec(text)) !== null) {
    if (m.index >= targetIdx) break;
    const open = text.indexOf('(', m.index);
    if (open === -1 || open >= targetIdx) continue;
    const close = matchingParen(text, open);
    if (close !== -1 && close > targetIdx) {
      return true;
    }
  }
  return false;
}

/**
 * Phân tích hồ sơ assertion của một test Playwright theo hợp đồng Phase 5 & Plan 14 Phase 3:
 * Trả về `{ kind: 'navigation-only' | 'mixed' | 'none' | 'unknown', matchers: string[], reason: string, weakExistenceOnly?: boolean, verifiedHelperCalls?: string[] }`.
 */
function analyzeTestAssertions(bodyInput, options = {}) {
  const rawText = Array.isArray(bodyInput) ? bodyInput.join('\n') : String(bodyInput || '');
  const verifiedHelpers = extractVerifiedHelperImports(rawText);
  if (options && options.fileLines) {
    for (const [k, v] of extractVerifiedHelperImports(options.fileLines)) {
      verifiedHelpers.set(k, v);
    }
  }
  if (options && options.fileText) {
    for (const [k, v] of extractVerifiedHelperImports(options.fileText)) {
      verifiedHelpers.set(k, v);
    }
  }
  if (options && options.verifiedHelpers instanceof Map) {
    for (const [k, v] of options.verifiedHelpers) {
      verifiedHelpers.set(k, v);
    }
  }

  let bodyText = blankOutImports(rawText);
  let paramsText = options.paramsText;

  // Nếu đầu vào là nguyên khối `test('...', async ({ page }) => { ... })`, bóc callback trước
  if (paramsText === undefined) {
    const bodyLines = bodyText.split('\n');
    const testStartLineIdx = bodyLines.findIndex((l) =>
      /^\s*(?:test|it)(?:\s*\.\s*(?:only|skip|fixme|fail))?\s*\(/.test(l),
    );
    if (testStartLineIdx !== -1) {
      const extracted = extractTestCallbackBody(bodyLines, testStartLineIdx + 1);
      if (!extracted.ok) {
        return { kind: 'unknown', matchers: [], reason: extracted.reason, weakExistenceOnly: false };
      }
      bodyText = extracted.bodyText;
      paramsText = extracted.paramsText;
    }
  }

  const sanitized = tokenizeAndSanitize(bodyText);
  if (!sanitized.ok) {
    return { kind: 'unknown', matchers: [], reason: sanitized.reason, weakExistenceOnly: false };
  }

  const cleanText = sanitized.cleanText;
  const pageAliases = extractPageAliases(paramsText, cleanText);
  const allMatchers = [];
  const navMatchers = [];
  const nonNavMatchers = [];
  const strongNonNavMatchers = [];
  const verifiedHelperCalls = [];
  const consumedSpans = [];

  const expectWordRe = /(?<![A-Za-z0-9_$.])\bexpect\b/g;
  let m;
  while ((m = expectWordRe.exec(cleanText)) !== null) {
    const idx = m.index;
    const afterExpect = cleanText.slice(idx + 6);

    // Kiểm tra `expect.<prop>`
    const mProp = afterExpect.match(/^\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    let openParen = -1;
    if (mProp) {
      const prop = mProp[1];
      if (prop === 'soft') {
        const afterSoft = afterExpect.slice(mProp[0].length);
        const mParen = afterSoft.match(/^\s*\(/);
        if (!mParen) {
          return { kind: 'unknown', matchers: allMatchers, reason: 'incomplete-expect-soft', weakExistenceOnly: false };
        }
        openParen = idx + 6 + mProp[0].length + mParen[0].length - 1;
      } else if (SAFE_EXPECT_HELPERS.has(prop)) {
        const afterHelper = afterExpect.slice(mProp[0].length);
        const mParen = afterHelper.match(/^\s*\(/);
        if (mParen) {
          const hOpen = idx + 6 + mProp[0].length + mParen[0].length - 1;
          const hClose = findMatchingDelimiter(cleanText, hOpen, '(', ')');
          if (hClose === -1) {
            return { kind: 'unknown', matchers: allMatchers, reason: 'unclosed-expect-helper', weakExistenceOnly: false };
          }
          consumedSpans.push([idx, hClose + 1]);
          continue;
        }
        return { kind: 'unknown', matchers: allMatchers, reason: `unsupported-expect-property:${prop}`, weakExistenceOnly: false };
      } else {
        return { kind: 'unknown', matchers: allMatchers, reason: `unsupported-expect-variant:expect.${prop}`, weakExistenceOnly: false };
      }
    } else {
      const mParen = afterExpect.match(/^\s*\(/);
      if (!mParen) {
        return { kind: 'unknown', matchers: allMatchers, reason: 'unsupported-expect-usage', weakExistenceOnly: false };
      }
      openParen = idx + 6 + mParen[0].length - 1;
    }

    const closeParen = findMatchingDelimiter(cleanText, openParen, '(', ')');
    if (closeParen === -1) {
      return { kind: 'unknown', matchers: allMatchers, reason: 'unclosed-expect-paren', weakExistenceOnly: false };
    }

    const receiver = normalizePageReceiver(cleanText.slice(openParen + 1, closeParen));
    const afterTarget = cleanText.slice(closeParen + 1);
    const tailMatch = afterTarget.match(
      /^(?:\s*\.\s*(?:not|resolves|rejects))*\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/,
    );
    if (!tailMatch) {
      return {
        kind: 'unknown',
        matchers: allMatchers,
        reason: 'dynamic-or-incomplete-expect-chain',
        weakExistenceOnly: false,
      };
    }

    const chainPrefix = tailMatch[0];
    const hasNotModifier = /\.\s*not\b/.test(chainPrefix);
    const matcher = tailMatch[1];
    const matcherOpenParen = closeParen + 1 + tailMatch[0].length - 1;
    const matcherCloseParen = findMatchingDelimiter(cleanText, matcherOpenParen, '(', ')');
    if (matcherCloseParen === -1) {
      return { kind: 'unknown', matchers: allMatchers, reason: 'unclosed-matcher-paren', weakExistenceOnly: false };
    }

    consumedSpans.push([idx, closeParen + 1]);
    consumedSpans.push([closeParen + 1, matcherOpenParen + 1]);

    if (NAVIGATION_MATCHERS.has(matcher)) {
      if (!pageAliases.has(receiver)) {
        return {
          kind: 'unknown',
          matchers: [...allMatchers, matcher],
          reason: `non-page-navigation-receiver:${receiver || 'unknown'}`,
          weakExistenceOnly: false,
        };
      }
      navMatchers.push(matcher);
      allMatchers.push(matcher);
    } else if (KNOWN_NON_NAVIGATION_MATCHERS.has(matcher)) {
      nonNavMatchers.push(matcher);
      allMatchers.push(matcher);
      const isWeakExistence =
        (!hasNotModifier && WEAK_EXISTENCE_MATCHERS.has(matcher)) ||
        (hasNotModifier && (matcher === 'toBeNull' || matcher === 'toBeUndefined'));
      if (!isWeakExistence) {
        strongNonNavMatchers.push(matcher);
      }
    } else {
      return {
        kind: 'unknown',
        matchers: [...allMatchers, matcher],
        reason: `custom-or-unknown-matcher:${matcher}`,
        weakExistenceOnly: false,
      };
    }
  }

  // Quét các lời gọi tới verified helpers đã được import hợp lệ từ support/ui-checks, support/deep-guards, fixtures/base.fixture
  if (verifiedHelpers.size > 0) {
    const helperCallRe = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let hm;
    while ((hm = helperCallRe.exec(cleanText)) !== null) {
      const isMethod = Boolean(hm[1]);
      const callName = hm[2];
      if (isMethod || !verifiedHelpers.has(callName)) continue;
      const prefix = cleanText.slice(0, hm.index);
      if (/\b(?:function|new)\s+$/.test(prefix)) continue;
      const canonical = verifiedHelpers.get(callName);
      const tag = `helper:${canonical}`;
      allMatchers.push(tag);
      nonNavMatchers.push(tag);
      strongNonNavMatchers.push(tag);
      verifiedHelperCalls.push(canonical);
      consumedSpans.push([hm.index, hm.index + hm[0].length - 1]);
    }
  }

  // Nếu đã có ít nhất 1 UI/data matcher chuẩn (hoặc verified helper) và không vướng expect mơ hồ -> mixed
  if (nonNavMatchers.length > 0) {
    const weakExistenceOnly = strongNonNavMatchers.length === 0;
    return {
      kind: 'mixed',
      matchers: allMatchers,
      reason: weakExistenceOnly ? 'only-weak-existence-matchers' : 'has-non-navigation-matchers',
      weakExistenceOnly,
      verifiedHelperCalls,
    };
  }

  // Khi chưa có UI/data matcher trực tiếp, kiểm tra mọi lời gọi hàm/method còn lại:
  // Bất kỳ lời gọi động `obj[m]()` hoặc hàm/method nằm ngoài whitelist đều có thể ẩn chứa assertion.
  const maskedChars = Array.from(cleanText);
  for (const [s, e] of consumedSpans) {
    for (let k = s; k < e; k++) {
      if (maskedChars[k] !== '\n') maskedChars[k] = ' ';
    }
  }
  const remainderText = maskedChars.join('');

  if (/\]\s*\(/.test(remainderText)) {
    return {
      kind: 'unknown',
      matchers: allMatchers,
      reason: 'dynamic-bracket-call',
      weakExistenceOnly: false,
    };
  }

  const callRe = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let cm;
  while ((cm = callRe.exec(remainderText)) !== null) {
    const isMethod = Boolean(cm[1]);
    const name = cm[2];

    if (!isMethod && JS_CONTROL_KEYWORDS.has(name)) continue;

    // Bỏ qua định nghĩa hàm `function foo(` hoặc constructor `new Foo(`
    const prefix = remainderText.slice(0, cm.index);
    if (!isMethod && /\b(?:function|new)\s+$/.test(prefix)) continue;

    if (isMethod) {
      if (!PLAYWRIGHT_SAFE_CALL_WHITELIST.has(name)) {
        return {
          kind: 'unknown',
          matchers: allMatchers,
          reason: `unresolved-method-call:${name}`,
          weakExistenceOnly: false,
        };
      }
    } else if (!SAFE_STANDALONE_CALLS.has(name)) {
      return {
        kind: 'unknown',
        matchers: allMatchers,
        reason: `unresolved-helper-call:${name}`,
        weakExistenceOnly: false,
      };
    }
  }

  if (navMatchers.length > 0) {
    return {
      kind: 'navigation-only',
      matchers: allMatchers,
      reason: 'only-page-navigation-matchers',
      weakExistenceOnly: false,
    };
  }

  return {
    kind: 'none',
    matchers: [],
    reason: 'no-assertions',
    weakExistenceOnly: false,
  };
}

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
 * hoặc lời gọi verified async helper (`support/ui-checks`, `support/deep-guards`, `fixtures/base.fixture`)
 * thiếu `await`/`return`/`Promise.all`. Quét trên toàn thân (đã nối dòng) nên bắt được cả
 * `expect(...)` trải nhiều dòng.
 */
function findMissingAwaits(bodyLines, firstLineNo, asyncMatchers = ASYNC_MATCHERS, verifiedHelpers = null) {
  const linesArr = Array.isArray(bodyLines) ? bodyLines : String(bodyLines || '').split('\n');
  const text = linesArr.join('\n');
  const effectiveMatchers = asyncMatchers instanceof Set ? asyncMatchers : ASYNC_MATCHERS;
  const effectiveHelpers = extractVerifiedHelperImports(text);
  if (asyncMatchers instanceof Map) {
    for (const [k, v] of asyncMatchers) effectiveHelpers.set(k, v);
  }
  if (verifiedHelpers instanceof Map) {
    for (const [k, v] of verifiedHelpers) effectiveHelpers.set(k, v);
  }

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
    if (!tail || !effectiveMatchers.has(tail[1])) continue;
    // `await`/`return` phải đứng NGAY trước expect. Kiểm cả dòng như trước đây sẽ
    // bỏ sót `expect(a).toBeVisible(); await foo();` viết chung một dòng.
    if (/(?:\b(?:await|return|yield)|=>)\s*$/.test(text.slice(0, m.index))) continue;
    if (isInsidePromiseCombinator(text, m.index)) continue;
    const lineOffset = text.slice(0, m.index).split('\n').length - 1;
    out.push({
      line: firstLineNo + lineOffset,
      matcher: tail[1],
      text: (linesArr[lineOffset] || '').trim(),
    });
  }

  if (effectiveHelpers.size > 0) {
    const noImportsText = blankOutImports(text);
    const sanitized = tokenizeAndSanitize(noImportsText);
    const scanText = sanitized.ok ? sanitized.cleanText : noImportsText;
    const helperRe = /(\.\s*)?\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let hm;
    while ((hm = helperRe.exec(scanText)) !== null) {
      const isMethod = Boolean(hm[1]);
      const localName = hm[2];
      if (isMethod || !effectiveHelpers.has(localName)) continue;
      const prefix = scanText.slice(0, hm.index);
      if (/\b(?:function|new)\s+$/.test(prefix)) continue;
      if (/(?:\b(?:await|return|yield)|=>)\s*$/.test(prefix)) continue;
      if (isInsidePromiseCombinator(scanText, hm.index)) continue;

      const canonicalName = effectiveHelpers.get(localName);
      const lineOffset = text.slice(0, hm.index).split('\n').length - 1;
      out.push({
        line: firstLineNo + lineOffset,
        matcher: `helper:${canonicalName}`,
        helper: canonicalName,
        localName,
        text: (linesArr[lineOffset] || '').trim(),
      });
    }
  }

  out.sort((a, b) => a.line - b.line);
  return out;
}

function loadAutomatedTests(root, options = {}) {
  // `.` = gốc repo, cho repo để playwright.config ngay ở root.
  const rel = options.projectDir || 'playwright';
  const project = options.project || 'chromium';
  const projectDir = path.resolve(root, rel);

  let json;
  if (options && options.listJson) {
    try {
      json = typeof options.listJson === 'string' ? JSON.parse(options.listJson) : options.listJson;
    } catch {
      return { tests: [], error: 'Output của playwright --list không phải JSON hợp lệ' };
    }
  } else {
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

    try {
      json = JSON.parse(raw);
    } catch {
      return { tests: [], error: 'Output của playwright --list không phải JSON hợp lệ' };
    }
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
      let assertionProfile = { kind: 'unknown', matchers: [], reason: 'no-source-file' };
      let onlyNavigationAssert = false;

      const fileLines = getFileLines(testPath);
      let missingAwaits = [];

      if (fileLines && spec.line > 0) {
        const verifiedHelpers = extractVerifiedHelperImports(fileLines);
        const start = spec.line - 1;
        const lineText = fileLines[start] || '';
        if (/test\.(?:skip|fixme)\b/.test(lineText)) {
          isSkipped = true;
        }
        const extracted = extractTestCallbackBody(fileLines, spec.line);
        let end = fileLines.length;
        if (extracted.ok) {
          end = extracted.endLine;
          assertionProfile = analyzeTestAssertions(extracted.bodyText, {
            paramsText: extracted.paramsText,
            verifiedHelpers,
          });
        } else {
          assertionProfile = {
            kind: 'unknown',
            matchers: [],
            reason: extracted.reason,
          };
          for (let i = start; i < fileLines.length; i++) {
            const l = fileLines[i];
            if (i > start && /^\s{0,6}test(?:\.describe|\.only|\.skip|\.fixme)?\s*\(/.test(l)) {
              end = i;
              break;
            }
          }
        }
        onlyNavigationAssert = assertionProfile.kind === 'navigation-only';

        let count = 0;
        for (let i = start; i < end; i++) {
          const l = fileLines[i] || '';
          const mExpect = l.match(/\bexpect(?:\.soft)?\s*\(/g);
          if (mExpect) count += mExpect.length;
        }
        assertionCount =
          assertionProfile.kind !== 'unknown' ? assertionProfile.matchers.length : count;

        missingAwaits = findMissingAwaits(
          fileLines.slice(start, end),
          start + 1,
          (options && options.asyncMatchers) || ASYNC_MATCHERS,
          verifiedHelpers,
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
        assertionProfile,
        onlyNavigationAssert,
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
  extractTestCallbackBody,
  extractVerifiedHelperImports,
  analyzeTestAssertions,
  ASYNC_MATCHERS,
  PLAYWRIGHT_SAFE_CALL_WHITELIST,
  VERIFIED_DEEP_HELPERS,
};
