'use strict';
/**
 * Engine Học Chọn Lọc Xuyên Trung Gian (Multi-Hop Selective Learning) — Plan 13 v1.2.
 *
 * Nguyên tắc cốt lõi:
 *   1. Shared Catalog (.agents/skills/qa-logic-gaps/references/*.md) thuộc nhóm `ship`:
 *      Learner CHỈ ĐỌC, tuyệt đối không tự ghi đè hay nối thêm vào file Markdown của Hub.
 *   2. Project Knowledge Overlay (<testCasesDir>/_learning/knowledge.json) thuộc nhóm `own`:
 *      Mọi bài học được duyệt (approved) hoặc từ chối (rejected) thông qua Review Artifact
 *      được cập nhật nguyên tử (atomic JSON replace) tại đây.
 *   3. Engine tĩnh (Node.js core, 0 external dependency) chỉ đóng vai trò sàng lọc qua
 *      4 Cổng (Generality, Novelty, Impact, Distillability) để trả về:
 *      `proposed` | `needsReview` | `rejected`. Chỉ Reviewer mới tạo `approved` cuối cùng.
 *   4. Diff và decisions.json là dữ liệu không đáng tin cậy (untrusted input): luôn redact
 *      PII/secret/token và không bao giờ thực thi nội dung bên trong.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { loadConfig } = require('./config');

const SCHEMA_VERSION = '1.0.0';
const POLICY_VERSION = '1.2.0';
const STOPWORDS_VERSION = '1.0.0';
const STATIC_MAPPING_VERSION = '1.0.0';
const MAX_CATALOG_ENTRIES = 25;
const MAX_EFFECTIVE_BEFORE_DEDUP = 50;
const MAX_TITLE_LENGTH = 120;
const MAX_FIELD_LENGTH = 500;
const MAX_PROVENANCE_PER_ENTRY = 5;
const MAX_EXCERPT_LENGTH = 300;
const MAX_DIFF_BYTES = 8 * 1024 * 1024; // 8 MiB
const MAX_SIGNALS = 1000;
const GIT_TIMEOUT_MS = 15000;
const JACCARD_THRESHOLD = 0.65;

const SHARED_DEFECT_REL = '.agents/skills/qa-logic-gaps/references/defect-heuristics-catalog.md';
const SHARED_ANTIPATTERN_REL = '.agents/skills/qa-logic-gaps/references/playwright-antipatterns-catalog.md';
const SHARED_POLICY_REL = '.agents/skills/qa-logic-gaps/references/SELECTIVE-LEARNING-POLICY.md';

const VALID_CATEGORIES = {
  DH: new Set([
    'State & Concurrency',
    'Data & BVA',
    'Security & Access',
    'Resilience & Recovery',
  ]),
  PA: new Set([
    'Superficial Assertion',
    'Async & Timing',
    'Parallel Isolation',
    'Selector Fragility',
    'Negative Side Effects',
  ]),
};

const REQUIRED_FIELDS = ['Category', 'Trigger', 'Failure Mode', 'Actionable Check'];

/**
 * Ánh xạ phiên bản hoá giữa bài học và các rule tĩnh đã có trong tools/qa.
 * - coverage: 'full' -> tín hiệu chỉ lặp lại đúng lỗi cú pháp mà tool đã bắt 100%.
 * - coverage: 'partial' -> rule tĩnh chỉ bắt bề mặt cú pháp, giữ phần ngữ nghĩa cho review.
 */
const STATIC_RULE_MAPPING = [
  {
    findingKind: 'assertion-thieu-await',
    coverage: 'full',
    targetCatalog: 'antipattern',
    description: 'expect(...) trên matcher bất đồng bộ thiếu await/return',
  },
  {
    findingKind: 'spec-thieu-assertion',
    coverage: 'full',
    targetCatalog: 'antipattern',
    description: 'Test block có 0 lệnh expect(...)',
  },
  {
    findingKind: 'spec-chi-assert-url',
    relatedEntryId: 'PA-01',
    coverage: 'partial',
    targetCatalog: 'antipattern',
    description: 'Test chỉ assert toHaveURL/toHaveTitle, phần đối chiếu kết quả nghiệp vụ thuộc semantic audit',
  },
  {
    findingKind: 'weak-existence-assertion',
    relatedEntryId: 'PA-04',
    coverage: 'partial',
    targetCatalog: 'antipattern',
    description: 'Test chỉ dùng toBeDefined/toBeTruthy yếu, thiếu đối chiếu giá trị hoặc trạng thái cụ thể',
  },
  {
    findingKind: 'missing-idempotency-guard',
    relatedEntryId: 'DH-01',
    coverage: 'partial',
    targetCatalog: 'defect',
    description: 'Test kịch bản chống bấm đúp/idempotency nhưng thiếu expectIdempotentSubmit',
  },
];

/**
 * Danh sách stopword Tiếng Việt & Tiếng Anh cố định (Version 1.0.0) phục vụ Lexical Jaccard.
 */
const STOPWORDS_EN_VI = new Set([
  // English
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'not', 'are',
  'was', 'were', 'will', 'would', 'should', 'could', 'can', 'may', 'into', 'when', 'where',
  'which', 'while', 'after', 'before', 'under', 'over', 'between', 'through', 'during',
  'without', 'within', 'only', 'also', 'than', 'then', 'there', 'their', 'they', 'them',
  'these', 'those', 'some', 'such', 'each', 'every', 'other', 'more', 'most', 'very',
  'just', 'about', 'above', 'below', 'does', 'did', 'done', 'make', 'made', 'using', 'used',
  // Vietnamese
  'của', 'và', 'các', 'có', 'được', 'trong', 'cho', 'với', 'không', 'khi', 'này', 'đó',
  'để', 'những', 'một', 'như', 'là', 'thì', 'mà', 'ở', 'tại', 'về', 'theo', 'từ', 'đến',
  'hoặc', 'nhưng', 'nếu', 'vì', 'do', 'bị', 'đã', 'đang', 'sẽ', 'cần', 'phải', 'trên',
  'dưới', 'giữa', 'sau', 'trước', 'ngoài', 'ra', 'vào', 'lên', 'xuống', 'cùng', 'vẫn',
  'chỉ', 'cũng', 'rất', 'quá', 'hơn', 'nhất', 'mọi', 'mỗi', 'bất', 'kỳ', 'nào', 'việc',
]);

class LearnerError extends Error {
  constructor(message, code = 'LEARNER_ERROR', details = null) {
    super(message);
    this.name = 'LearnerError';
    this.code = code;
    if (details) this.details = details;
  }
}

function sha256(content) {
  return crypto.createHash('sha256').update(String(content), 'utf8').digest('hex');
}

function unicodeLength(str) {
  return [...String(str || '')].length;
}

function stripBomAndNormalizeLf(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
}

/**
 * Redact PII, URL credentials/tokens, Auth headers, secret assignments và đường dẫn máy cá nhân.
 */
function redactSensitiveText(input) {
  let s = String(input || '');
  // 1. URL có user:pass@host
  s = s.replace(/\b(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[REDACTED_URL_CRED]@');
  // 2. Query params nhạy cảm
  s = s.replace(
    /([?&](?:token|access_token|refresh_token|api_key|apikey|secret|password|passwd|pwd|auth|signature|sig|key)=)[^&\s'")\]]+/gi,
    '$1[REDACTED_PARAM]',
  );
  // 3. Authorization / API key headers
  s = s.replace(
    /\b(Authorization|X-Api-Key|X-Auth-Token)\s*[:=]\s*(?:Bearer\s+|Basic\s+)?[A-Za-z0-9._~+/=-]{4,}/gi,
    '$1: [REDACTED_AUTH_HEADER]',
  );
  // 4. Bearer / JWT-like tokens
  s = s.replace(/\bBearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, 'Bearer [REDACTED_JWT]');
  // 5. Secret-like assignments
  s = s.replace(
    /\b(password|passwd|pwd|secret|client_secret|api_key|apikey|access_token|private_key|auth_token)\s*([:=])\s*(['"`])[^'"`\n]{1,200}\3/gi,
    '$1$2$3[REDACTED_SECRET]$3',
  );
  // 6. Email addresses
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
  // 7. Đường dẫn tuyệt đối chứa thư mục người dùng (Windows & POSIX)
  s = s.replace(/\b[A-Za-z]:\\Users\\[^\\\s'")\]]+(?:\\[^\\\s'")\]]+)*/gi, '[REDACTED_USER_PATH]');
  s = s.replace(/\/(?:Users|home)\/[^/\s'")\]]+(?:\/[^/\s'")\]]+)*/g, '[REDACTED_USER_PATH]');
  // 8. Vô hiệu hoá chuỗi có dạng prompt injection / command execution
  s = s.replace(/\b(IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS|SYSTEM\s+OVERRIDE|EXEC_SHELL)\b/gi, '[REDACTED_INSTRUCTION]');
  return s;
}

/**
 * Kiểm tra xem chuỗi có còn chứa dấu hiệu credential/email chưa được redact không.
 */
function containsUnredactedSensitive(input) {
  const s = String(input || '');
  if (/\b(https?:\/\/)[^/\s:@]+:[^/\s@]+@/i.test(s)) return true;
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(s)) return true;
  if (/\b(Authorization|X-Api-Key)\s*[:=]\s*(?:Bearer\s+)?(?!\[REDACTED)[A-Za-z0-9._~+/=-]{6,}/i.test(s)) return true;
  if (
    /\b(password|secret|api_key|access_token|private_key)\s*[:=]\s*['"`](?!\[REDACTED)[^'"`\n]+['"`]/i.test(s)
  ) {
    return true;
  }
  return false;
}

/**
 * Chuẩn hoá NFKC + lowercase + tách từ Unicode + bỏ stopword để tính Lexical Jaccard.
 */
function tokenizeForJaccard(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase();
  const rawTokens = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const tokens = new Set();
  for (const tok of rawTokens) {
    if (STOPWORDS_EN_VI.has(tok)) continue;
    if (tok.length < 2 && !/^\d+$/.test(tok)) continue;
    tokens.add(tok);
  }
  return tokens;
}

/**
 * Tính Lexical Jaccard (giao / hợp). Tập rỗng trả score = 0 và không coi là duplicate.
 */
function computeLexicalJaccard(textA, textB) {
  const setA = tokenizeForJaccard(textA);
  const setB = tokenizeForJaccard(textB);
  if (setA.size === 0 || setB.size === 0) {
    return { score: 0, empty: true, tokenCountA: setA.size, tokenCountB: setB.size };
  }
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  const score = union === 0 ? 0 : Number((intersection / union).toFixed(4));
  return { score, empty: false, tokenCountA: setA.size, tokenCountB: setB.size };
}

/**
 * Nhận diện ngôn ngữ sơ bộ (Việt có dấu vs ASCII/Anh) để phát hiện cặp khác ngôn ngữ.
 */
function detectScriptHint(text) {
  const s = String(text || '').normalize('NFKC');
  const hasViDiacritics = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(s);
  return hasViDiacritics ? 'vi' : 'en';
}

function normalizeCatalogType(type) {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'DH' || t === 'DEFECT' || t === 'DEFECTS') return { prefix: 'DH', targetCatalog: 'defect' };
  if (t === 'PA' || t === 'ANTIPATTERN' || t === 'ANTIPATTERNS') {
    return { prefix: 'PA', targetCatalog: 'antipattern' };
  }
  throw new LearnerError(`Loại catalog không hợp lệ: "${type}" (chỉ nhận DH/defect hoặc PA/antipattern)`, 'INVALID_CATALOG_TYPE');
}

/**
 * Parse và validate nghiêm ngặt file Shared Catalog Markdown (Phase 1 & 2).
 * - Hỗ trợ BOM/CRLF.
 * - Bỏ qua các ví dụ trong fenced code block (``` ... ```).
 * - Báo lỗi duplicate ID, sai prefix, field thiếu/trống/lặp, heading malformed, sai enum, vượt cap.
 */
function parseCatalogMarkdown(rawText, type, fileLabel = 'catalog.md') {
  const { prefix, targetCatalog } = normalizeCatalogType(type);
  const allowedCategories = VALID_CATEGORIES[prefix];
  const text = stripBomAndNormalizeLf(rawText);
  const lines = text.split('\n');

  let inFence = false;
  let fenceMarker = null;
  const entryBlocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;

    if (/^\s*###\s+/.test(line)) {
      const validHeading = line.match(/^###\s+\[([A-Za-z]+-\d{2,3})\]\s+(.+?)\s*$/);
      if (!validHeading) {
        throw new LearnerError(
          `${fileLabel}:${lineNo}: Heading entry sai quy ước "${line.trim()}". Phải theo mẫu "### [${prefix}-01] <Tiêu đề>".`,
          'MALFORMED_CATALOG_HEADING',
        );
      }
      const id = validHeading[1];
      const title = validHeading[2].trim();
      if (!id.startsWith(`${prefix}-`)) {
        throw new LearnerError(
          `${fileLabel}:${lineNo}: Mã "${id}" sai tiền tố cho catalog ${prefix} (yêu cầu "${prefix}-xx").`,
          'WRONG_CATALOG_PREFIX',
        );
      }
      if (unicodeLength(title) === 0 || unicodeLength(title) > MAX_TITLE_LENGTH) {
        throw new LearnerError(
          `${fileLabel}:${lineNo}: Tiêu đề của "${id}" phải từ 1..${MAX_TITLE_LENGTH} ký tự Unicode.`,
          'INVALID_TITLE_LENGTH',
        );
      }
      if (current) entryBlocks.push(current);
      current = { id, title, line: lineNo, rawLines: [] };
      continue;
    }

    if (current) {
      // Nếu gặp heading cấp 1 hoặc cấp 2 mới thì kết thúc block hiện tại
      if (/^\s*#{1,2}\s+/.test(line)) {
        entryBlocks.push(current);
        current = null;
        continue;
      }
      current.rawLines.push({ lineNo, text: line });
    }
  }
  if (current) entryBlocks.push(current);

  const seenIds = new Set();
  const entries = [];

  for (const block of entryBlocks) {
    if (seenIds.has(block.id)) {
      throw new LearnerError(
        `${fileLabel}:${block.line}: Trùng mã ID "${block.id}" trong catalog.`,
        'DUPLICATE_CATALOG_ID',
      );
    }
    seenIds.add(block.id);

    const fields = new Map();
    const metadata = { staticRule: null, coverage: null };

    for (const item of block.rawLines) {
      const trimmed = item.text.trim();
      if (!trimmed || trimmed === '---') continue;

      // Cho phép comment metadata được định nghĩa (ví dụ: <!-- staticRule: spec-chi-assert-url | coverage: partial -->)
      const commentMatch = trimmed.match(/^<!--\s*(.*?)\s*-->$/);
      if (commentMatch) {
        const parts = commentMatch[1].split('|').map((p) => p.trim());
        for (const part of parts) {
          const kv = part.match(/^(staticRule|coverage)\s*:\s*(.+)$/i);
          if (kv) {
            const key = kv[1].toLowerCase() === 'staticrule' ? 'staticRule' : 'coverage';
            metadata[key] = kv[2].trim();
          }
        }
        continue;
      }

      const fieldMatch = item.text.match(/^\s*-\s*\*\*([^*]+)\*\*\s*:\s*(.*?)\s*$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].trim();
        const fieldValue = fieldMatch[2].trim();
        if (!REQUIRED_FIELDS.includes(fieldName)) {
          throw new LearnerError(
            `${fileLabel}:${item.lineNo}: Trường không hợp lệ "${fieldName}" ở mục ${block.id}. Chỉ nhận: ${REQUIRED_FIELDS.join(', ')}.`,
            'UNKNOWN_CATALOG_FIELD',
          );
        }
        if (fields.has(fieldName)) {
          throw new LearnerError(
            `${fileLabel}:${item.lineNo}: Trường "${fieldName}" bị lặp lại ở mục ${block.id}.`,
            'DUPLICATE_CATALOG_FIELD',
          );
        }
        if (!fieldValue) {
          throw new LearnerError(
            `${fileLabel}:${item.lineNo}: Trường "${fieldName}" ở mục ${block.id} không được để trống.`,
            'EMPTY_CATALOG_FIELD',
          );
        }
        fields.set(fieldName, fieldValue);
        continue;
      }

      throw new LearnerError(
        `${fileLabel}:${item.lineNo}: Dòng không hợp lệ trong mục ${block.id}: "${trimmed}".`,
        'MALFORMED_CATALOG_CONTENT',
      );
    }

    for (const reqField of REQUIRED_FIELDS) {
      if (!fields.has(reqField)) {
        throw new LearnerError(
          `${fileLabel}:${block.line}: Mục ${block.id} thiếu trường bắt buộc "${reqField}".`,
          'MISSING_CATALOG_FIELD',
        );
      }
    }

    const category = fields.get('Category');
    if (!allowedCategories.has(category)) {
      throw new LearnerError(
        `${fileLabel}:${block.line}: Mục ${block.id} có Category "${category}" không hợp lệ. Chỉ nhận: ${[...allowedCategories].join(', ')}.`,
        'INVALID_CATEGORY_ENUM',
      );
    }

    const trigger = fields.get('Trigger');
    const failureMode = fields.get('Failure Mode');
    const actionableCheck = fields.get('Actionable Check');

    for (const [label, val] of [
      ['Trigger', trigger],
      ['Failure Mode', failureMode],
      ['Actionable Check', actionableCheck],
    ]) {
      if (unicodeLength(val) > MAX_FIELD_LENGTH) {
        throw new LearnerError(
          `${fileLabel}:${block.line}: Trường "${label}" của mục ${block.id} vượt quá ${MAX_FIELD_LENGTH} ký tự Unicode.`,
          'FIELD_TOO_LONG',
        );
      }
    }

    entries.push({
      id: block.id,
      type: prefix,
      targetCatalog,
      title: block.title,
      category,
      trigger,
      failureMode,
      actionableCheck,
      metadata,
      layer: 'shared',
      status: 'active',
    });
  }

  if (entries.length > MAX_CATALOG_ENTRIES) {
    throw new LearnerError(
      `${fileLabel}: Số lượng mục (${entries.length}) vượt quá trần cho phép (${MAX_CATALOG_ENTRIES}).`,
      'CATALOG_CAP_EXCEEDED',
    );
  }

  return entries;
}

/**
 * Kiểm tra một đường dẫn không thoát khỏi repo root (kể cả qua symlink/junction)
 * và nếu kiểm tra vùng `own`, xác nhận nằm trong nhóm `own` của sync-manifest.json.
 */
function resolveAndValidateRepoPath(root, relPath, options = {}) {
  const realRoot = fs.realpathSync(root);
  const targetAbs = path.resolve(realRoot, relPath);

  // Tìm tổ tiên gần nhất đã tồn tại trên đĩa để lấy realpath chính xác
  let probe = targetAbs;
  const tailSegments = [];
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    tailSegments.unshift(path.basename(probe));
    probe = parent;
  }
  const realExisting = fs.realpathSync(probe);
  const resolvedReal = tailSegments.length > 0 ? path.join(realExisting, ...tailSegments) : realExisting;

  const relFromRoot = path.relative(realRoot, resolvedReal).replace(/\\/g, '/');
  if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    throw new LearnerError(
      `Đường dẫn "${relPath}" trỏ ra ngoài phạm vi repo root (phát hiện symlink/junction hoặc path traversal).`,
      'PATH_ESCAPES_ROOT',
    );
  }

  if (options.requireOwn) {
    const manifestPath = path.join(realRoot, 'sync-manifest.json');
    if (fs.existsSync(manifestPath)) {
      let manifest;
      try {
        manifest = JSON.parse(stripBomAndNormalizeLf(fs.readFileSync(manifestPath, 'utf8')));
      } catch (err) {
        throw new LearnerError(`Không đọc được sync-manifest.json: ${err.message}`, 'INVALID_MANIFEST');
      }
      const ownPaths = (manifest.own || []).map((item) =>
        String(item.path || '')
          .replace(/\\/g, '/')
          .replace(/\/+$/, ''),
      );
      const normalizedRel = relFromRoot.replace(/\/+$/, '');
      const isInsideOwn = ownPaths.some(
        (ownP) => ownP && (normalizedRel === ownP || normalizedRel.startsWith(`${ownP}/`)),
      );
      if (!isInsideOwn) {
        throw new LearnerError(
          `Đường dẫn lưu trữ bài học "${relFromRoot}" không thuộc vùng "own" trong sync-manifest.json. Cấm ghi bài học vào vùng ship/seed.`,
          'STORAGE_NOT_IN_OWN',
        );
      }
    }
  }

  return { absPath: resolvedReal, relPath: relFromRoot };
}

function emptyProjectKnowledge() {
  return {
    schemaVersion: SCHEMA_VERSION,
    nextIds: { DH: 1, PA: 1 },
    entries: [],
    processed: [],
    graduations: [],
  };
}

/**
 * Validate cấu trúc <testCasesDir>/_learning/knowledge.json.
 */
function validateProjectKnowledgeObject(data, fileLabel = 'knowledge.json') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new LearnerError(`${fileLabel} phải là một JSON object.`, 'INVALID_KNOWLEDGE_SCHEMA');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new LearnerError(
      `${fileLabel}: schemaVersion "${data.schemaVersion}" không khớp "${SCHEMA_VERSION}".`,
      'UNSUPPORTED_SCHEMA_VERSION',
    );
  }
  if (
    !data.nextIds ||
    typeof data.nextIds !== 'object' ||
    !Number.isInteger(data.nextIds.DH) ||
    data.nextIds.DH < 1 ||
    !Number.isInteger(data.nextIds.PA) ||
    data.nextIds.PA < 1
  ) {
    throw new LearnerError(
      `${fileLabel}: nextIds.DH và nextIds.PA phải là số nguyên dương >= 1.`,
      'INVALID_KNOWLEDGE_NEXT_IDS',
    );
  }
  if (!Array.isArray(data.entries) || !Array.isArray(data.processed) || !Array.isArray(data.graduations)) {
    throw new LearnerError(
      `${fileLabel}: entries, processed và graduations phải là mảng.`,
      'INVALID_KNOWLEDGE_ARRAYS',
    );
  }

  const seenIds = new Set();
  let maxDhNum = 0;
  let maxPaNum = 0;
  let activeDh = 0;
  let activePa = 0;

  for (let i = 0; i < data.entries.length; i++) {
    const e = data.entries[i];
    if (!e || typeof e !== 'object') {
      throw new LearnerError(`${fileLabel}: entries[${i}] không hợp lệ.`, 'INVALID_PROJECT_ENTRY');
    }
    const idMatch = String(e.id || '').match(/^(PDH|PPA)-(\d{3,4})$/);
    if (!idMatch) {
      throw new LearnerError(
        `${fileLabel}: entries[${i}].id "${e.id}" sai định dạng (phải là PDH-001 hoặc PPA-001).`,
        'INVALID_PROJECT_ENTRY_ID',
      );
    }
    if (seenIds.has(e.id)) {
      throw new LearnerError(`${fileLabel}: Trùng mã project entry "${e.id}".`, 'DUPLICATE_PROJECT_ENTRY_ID');
    }
    seenIds.add(e.id);

    const prefix = idMatch[1] === 'PDH' ? 'DH' : 'PA';
    const num = Number.parseInt(idMatch[2], 10);
    if (prefix === 'DH') maxDhNum = Math.max(maxDhNum, num);
    else maxPaNum = Math.max(maxPaNum, num);

    const expectedTarget = prefix === 'DH' ? 'defect' : 'antipattern';
    if (e.targetCatalog !== expectedTarget) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có targetCatalog "${e.targetCatalog}" không khớp "${expectedTarget}".`,
        'MISMATCHED_TARGET_CATALOG',
      );
    }
    if (!VALID_CATEGORIES[prefix].has(e.category)) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có category "${e.category}" không hợp lệ.`,
        'INVALID_PROJECT_CATEGORY',
      );
    }
    if (!e.title || unicodeLength(e.title) > MAX_TITLE_LENGTH) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có title trống hoặc vượt ${MAX_TITLE_LENGTH} ký tự.`,
        'INVALID_PROJECT_TITLE',
      );
    }
    for (const f of ['trigger', 'failureMode', 'actionableCheck']) {
      if (!e[f] || typeof e[f] !== 'string' || unicodeLength(e[f]) > MAX_FIELD_LENGTH) {
        throw new LearnerError(
          `${fileLabel}: Mục ${e.id} có trường "${f}" trống hoặc vượt ${MAX_FIELD_LENGTH} ký tự.`,
          'INVALID_PROJECT_FIELD',
        );
      }
      if (containsUnredactedSensitive(e[f])) {
        throw new LearnerError(
          `${fileLabel}: Mục ${e.id} chứa thông tin nhạy cảm chưa redact ở trường "${f}".`,
          'UNREDACTED_SENSITIVE_DATA',
        );
      }
    }
    if (e.status !== 'active' && e.status !== 'retired') {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} có status "${e.status}" không hợp lệ (chỉ nhận active | retired).`,
        'INVALID_PROJECT_STATUS',
      );
    }
    if (e.status === 'active') {
      if (prefix === 'DH') activeDh++;
      else activePa++;
    }
    if (
      !Array.isArray(e.provenance) ||
      e.provenance.length === 0 ||
      e.provenance.length > MAX_PROVENANCE_PER_ENTRY
    ) {
      throw new LearnerError(
        `${fileLabel}: Mục ${e.id} phải có từ 1..${MAX_PROVENANCE_PER_ENTRY} provenance.`,
        'INVALID_PROVENANCE_COUNT',
      );
    }
    for (const p of e.provenance) {
      if (!p || typeof p !== 'object' || !p.source) {
        throw new LearnerError(`${fileLabel}: Provenance của ${e.id} thiếu source.`, 'INVALID_PROVENANCE_ITEM');
      }
      if (p.excerpt && unicodeLength(p.excerpt) > MAX_EXCERPT_LENGTH) {
        throw new LearnerError(
          `${fileLabel}: Provenance excerpt của ${e.id} vượt ${MAX_EXCERPT_LENGTH} ký tự.`,
          'PROVENANCE_EXCERPT_TOO_LONG',
        );
      }
    }
  }

  if (activeDh > MAX_CATALOG_ENTRIES || activePa > MAX_CATALOG_ENTRIES) {
    throw new LearnerError(
      `${fileLabel}: Số mục active vượt trần ${MAX_CATALOG_ENTRIES} (DH=${activeDh}, PA=${activePa}).`,
      'PROJECT_CAP_EXCEEDED',
    );
  }
  if (data.nextIds.DH <= maxDhNum || data.nextIds.PA <= maxPaNum) {
    throw new LearnerError(
      `${fileLabel}: nextIds (${JSON.stringify(data.nextIds)}) không lớn hơn ID lớn nhất đã cấp (DH=${maxDhNum}, PA=${maxPaNum}) — vi phạm nguyên tắc không tái sử dụng ID retired.`,
      'NON_MONOTONIC_NEXT_IDS',
    );
  }

  return data;
}

function canonicalBusinessText(entryOrCandidate) {
  return [
    entryOrCandidate.title || '',
    entryOrCandidate.trigger || '',
    entryOrCandidate.failureMode || '',
    entryOrCandidate.actionableCheck || '',
  ]
    .map((s) => String(s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '))
    .join(' | ');
}

/**
 * Đọc Shared Catalog + Project Knowledge Overlay -> tạo Effective View, Stats và SnapshotHash.
 */
function loadCatalog(root, options = {}) {
  const cfg = { ...loadConfig(root), ...options };
  const defectPath = path.resolve(root, options.sharedDefectCatalog || SHARED_DEFECT_REL);
  const antipatternPath = path.resolve(root, options.sharedAntipatternCatalog || SHARED_ANTIPATTERN_REL);

  if (!fs.existsSync(defectPath)) {
    throw new LearnerError(`Thiếu file Shared Defect Catalog: ${SHARED_DEFECT_REL}`, 'MISSING_SHARED_CATALOG');
  }
  if (!fs.existsSync(antipatternPath)) {
    throw new LearnerError(
      `Thiếu file Shared Playwright Antipattern Catalog: ${SHARED_ANTIPATTERN_REL}`,
      'MISSING_SHARED_CATALOG',
    );
  }

  let rawDefects;
  let rawAntipatterns;
  try {
    rawDefects = fs.readFileSync(defectPath, 'utf8');
    rawAntipatterns = fs.readFileSync(antipatternPath, 'utf8');
  } catch (err) {
    throw new LearnerError(`Lỗi đọc Shared Catalog: ${err.message}`, 'SHARED_CATALOG_READ_ERROR');
  }

  const sharedDefects = parseCatalogMarkdown(rawDefects, 'DH', SHARED_DEFECT_REL);
  const sharedAntipatterns = parseCatalogMarkdown(rawAntipatterns, 'PA', SHARED_ANTIPATTERN_REL);

  const learningRelDir = `${cfg.testCasesDir || 'test-cases'}/_learning`;
  const knowledgeRelPath = `${learningRelDir}/knowledge.json`;
  const { absPath: knowledgeAbsPath, relPath: validatedKnowledgeRel } = resolveAndValidateRepoPath(
    root,
    knowledgeRelPath,
    { requireOwn: Boolean(options.requireOwnOverlay) },
  );

  let projectKnowledge = emptyProjectKnowledge();
  let projectOverlayPresent = false;

  if (fs.existsSync(knowledgeAbsPath)) {
    projectOverlayPresent = true;
    let rawJson;
    try {
      rawJson = fs.readFileSync(knowledgeAbsPath, 'utf8');
    } catch (err) {
      throw new LearnerError(
        `Không đọc được ${validatedKnowledgeRel}: ${err.message}`,
        'PROJECT_OVERLAY_READ_ERROR',
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(stripBomAndNormalizeLf(rawJson));
    } catch (err) {
      throw new LearnerError(
        `${validatedKnowledgeRel} không phải JSON hợp lệ: ${err.message}`,
        'PROJECT_OVERLAY_INVALID_JSON',
      );
    }
    projectKnowledge = validateProjectKnowledgeObject(parsed, validatedKnowledgeRel);
  }

  const projectActiveDefects = projectKnowledge.entries
    .filter((e) => e.targetCatalog === 'defect' && e.status === 'active')
    .map((e) => ({ ...e, type: 'DH', layer: 'project' }));
  const projectActiveAntipatterns = projectKnowledge.entries
    .filter((e) => e.targetCatalog === 'antipattern' && e.status === 'active')
    .map((e) => ({ ...e, type: 'PA', layer: 'project' }));

  const shadowed = [];
  const effectiveDefects = [...sharedDefects];
  for (const pe of projectActiveDefects) {
    if (effectiveDefects.length >= MAX_EFFECTIVE_BEFORE_DEDUP) break;
    const peText = canonicalBusinessText(pe);
    const matchShared = sharedDefects.find((se) => {
      if (canonicalBusinessText(se) === peText) return true;
      const jac = computeLexicalJaccard(peText, canonicalBusinessText(se));
      return !jac.empty && jac.score >= JACCARD_THRESHOLD;
    });
    if (matchShared) {
      shadowed.push({ projectEntryId: pe.id, shadowedBySharedId: matchShared.id, targetCatalog: 'defect' });
    } else {
      effectiveDefects.push(pe);
    }
  }

  const effectiveAntipatterns = [...sharedAntipatterns];
  for (const pe of projectActiveAntipatterns) {
    if (effectiveAntipatterns.length >= MAX_EFFECTIVE_BEFORE_DEDUP) break;
    const peText = canonicalBusinessText(pe);
    const matchShared = sharedAntipatterns.find((se) => {
      if (canonicalBusinessText(se) === peText) return true;
      const jac = computeLexicalJaccard(peText, canonicalBusinessText(se));
      return !jac.empty && jac.score >= JACCARD_THRESHOLD;
    });
    if (matchShared) {
      shadowed.push({ projectEntryId: pe.id, shadowedBySharedId: matchShared.id, targetCatalog: 'antipattern' });
    } else {
      effectiveAntipatterns.push(pe);
    }
  }

  const canonicalProjectState = JSON.stringify({
    schemaVersion: projectKnowledge.schemaVersion,
    nextIds: projectKnowledge.nextIds,
    entries: projectKnowledge.entries,
    processed: projectKnowledge.processed,
    graduations: projectKnowledge.graduations,
  });

  const snapshotHash = sha256(
    [
      `schema:${SCHEMA_VERSION}`,
      `policy:${POLICY_VERSION}`,
      `sharedDH:${stripBomAndNormalizeLf(rawDefects)}`,
      `sharedPA:${stripBomAndNormalizeLf(rawAntipatterns)}`,
      `project:${canonicalProjectState}`,
    ].join('\n---\n'),
  );

  const retiredCount = projectKnowledge.entries.filter((e) => e.status === 'retired').length;

  return {
    schemaVersion: SCHEMA_VERSION,
    maxEntriesPerCatalog: MAX_CATALOG_ENTRIES,
    overlayPath: validatedKnowledgeRel,
    overlayPresent: projectOverlayPresent,
    shared: {
      defects: sharedDefects,
      antipatterns: sharedAntipatterns,
    },
    project: projectKnowledge,
    effective: {
      defects: effectiveDefects,
      antipatterns: effectiveAntipatterns,
      shadowed,
    },
    stats: {
      shared: {
        DH: sharedDefects.length,
        PA: sharedAntipatterns.length,
        total: sharedDefects.length + sharedAntipatterns.length,
      },
      project: {
        DH: projectActiveDefects.length,
        PA: projectActiveAntipatterns.length,
        active: projectActiveDefects.length + projectActiveAntipatterns.length,
        retired: retiredCount,
        processed: projectKnowledge.processed.length,
        graduations: projectKnowledge.graduations.length,
      },
      effective: {
        DH: effectiveDefects.length,
        PA: effectiveAntipatterns.length,
        total: effectiveDefects.length + effectiveAntipatterns.length,
        shadowed: shadowed.length,
      },
    },
    snapshotHash,
  };
}

/**
 * Chạy lệnh git an toàn với argv array, shell: false và timeout 15 giây.
 */
function runGit(root, args, options = {}) {
  const runner = options.gitRunner || spawnSync;
  const res = runner('git', args, {
    cwd: root,
    shell: false,
    timeout: options.gitTimeoutMs || GIT_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    encoding: 'buffer',
     input: options.stdinBuffer || undefined,
    windowsHide: true,
  });

  if (res.error) {
    if (res.error.code === 'ETIMEDOUT') {
      throw new LearnerError(`Lệnh git quá thời gian chờ (${GIT_TIMEOUT_MS}ms): git ${args.join(' ')}`, 'GIT_TIMEOUT');
    }
    throw new LearnerError(`Không chạy được git: ${res.error.message}`, 'GIT_EXEC_ERROR');
  }
  const stdout = res.stdout ? res.stdout.toString('utf8') : '';
  const stderr = res.stderr ? res.stderr.toString('utf8') : '';
  return { status: res.status, stdout, stderr, rawStdout: res.stdout || Buffer.alloc(0) };
}

function classifyRepoFile(relPath, cfg) {
  const p = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const reqDir = (cfg.requirementsDir || 'requirements').replace(/\\/g, '/').replace(/\/+$/, '');
  const tcDir = (cfg.testCasesDir || 'test-cases').replace(/\\/g, '/').replace(/\/+$/, '');
  const projDir = (cfg.projectDir || 'playwright').replace(/\\/g, '/').replace(/\/+$/, '');
  const ignorePrefixes = (cfg.ignoreSpecs || []).map((x) => x.replace(/\\/g, '/').replace(/\/+$/, ''));

  if (p === `${tcDir}/traceability.md`) {
    return { eligible: false, skipReason: 'generated-traceability' };
  }
  if (p === `${tcDir}/_learning` || p.startsWith(`${tcDir}/_learning/`)) {
    return { eligible: false, skipReason: 'learning-overlay-artifact' };
  }
  if (ignorePrefixes.some((pref) => pref && (p === pref || p.startsWith(`${pref}/`)))) {
    return { eligible: false, skipReason: 'ignored-spec-prefix' };
  }

  if (p.startsWith(`${reqDir}/`) && p.toLowerCase().endsWith('.md')) {
    if (path.basename(p).toLowerCase() === 'readme.md') return { eligible: false, skipReason: 'readme-doc' };
    return { eligible: true, kind: 'requirement' };
  }
  if (p.startsWith(`${tcDir}/`) && p.toLowerCase().endsWith('.md')) {
    if (path.basename(p).toLowerCase() === 'readme.md') return { eligible: false, skipReason: 'readme-doc' };
    return { eligible: true, kind: 'test-case' };
  }
  const inProj = projDir === '.' ? true : p.startsWith(`${projDir}/`);
  if (inProj && /\.spec\.[jt]sx?$/i.test(p) && !/\.setup\.(?:spec\.)?[jt]sx?$/i.test(p)) {
    return { eligible: true, kind: 'playwright-spec' };
  }

  return { eligible: false, skipReason: null };
}

/**
 * Thu thập Git diff an toàn (không dùng shell, hỗ trợ NUL-delimited path inventory).
 */
function collectDiff(root, options = {}) {
  const cfg = { ...loadConfig(root), ...options };

  // Validate các thư mục nguồn nếu đang tồn tại không trỏ ra ngoài repo qua junction/symlink
  for (const dirRel of [cfg.requirementsDir, cfg.testCasesDir, cfg.projectDir]) {
    if (dirRel && fs.existsSync(path.join(root, dirRel))) {
      resolveAndValidateRepoPath(root, dirRel);
    }
  }

  const checkRepo = runGit(root, ['rev-parse', '--is-inside-work-tree'], options);
  if (checkRepo.status !== 0 || checkRepo.stdout.trim() !== 'true') {
    throw new LearnerError(
      `Thư mục "${root}" không phải là một Git repository hợp lệ: ${checkRepo.stderr.trim()}`,
      'NOT_A_GIT_REPO',
    );
  }

  let baseSha = null;
  let scopeMode = 'working-tree';
  const sinceRef = options.since !== undefined && options.since !== null ? String(options.since).trim() : null;

  if (sinceRef !== null) {
    if (!sinceRef || sinceRef.startsWith('-')) {
      throw new LearnerError(`Giá trị --since không hợp lệ: "${options.since}"`, 'INVALID_SINCE_REF');
    }
    const rev = runGit(root, ['rev-parse', '--verify', '--end-of-options', `${sinceRef}^{commit}`], options);
    if (rev.status !== 0) {
      throw new LearnerError(
        `Không tìm thấy Git ref "${sinceRef}": ${rev.stderr.trim() || 'ref không tồn tại'}`,
        'UNKNOWN_GIT_REF',
      );
    }
    baseSha = rev.stdout.trim();
    scopeMode = 'since';
  } else {
    const headRev = runGit(root, ['rev-parse', '--verify', 'HEAD^{commit}'], options);
    if (headRev.status === 0 && headRev.stdout.trim()) {
      baseSha = headRev.stdout.trim();
      scopeMode = 'working-tree';
    } else {
      const emptyTree = runGit(root, ['hash-object', '-t', 'tree', '--stdin'], {
        ...options,
        stdinBuffer: Buffer.alloc(0),
      });
      if (emptyTree.status !== 0) {
        throw new LearnerError(`Không tạo được empty tree SHA: ${emptyTree.stderr.trim()}`, 'GIT_EMPTY_TREE_ERROR');
      }
      baseSha = emptyTree.stdout.trim();
      scopeMode = 'unborn-head';
    }
  }

  const pathspecs = [cfg.requirementsDir || 'requirements', cfg.testCasesDir || 'test-cases'];
  const projDir = cfg.projectDir || 'playwright';
  if (projDir === '.') pathspecs.push('.');
  else pathspecs.push(projDir);

  // Đếm các file untracked phù hợp bị bỏ qua theo quy ước (diff HEAD chỉ quét tracked)
  const untrackedRes = runGit(
    root,
    ['ls-files', '--others', '--exclude-standard', '-z', '--', ...pathspecs],
    options,
  );
  const untrackedRaw = untrackedRes.rawStdout.toString('utf8').split('\0').filter(Boolean);
  const untrackedEligible = [];
  for (const uFile of untrackedRaw) {
    const cls = classifyRepoFile(uFile, cfg);
    if (cls.eligible) untrackedEligible.push(uFile.replace(/\\/g, '/'));
  }

  // Lấy danh sách file thay đổi bằng NUL-delimited
  const statusRes = runGit(
    root,
    ['diff', '--name-status', '--no-renames', '--no-ext-diff', '--no-color', '-z', baseSha, '--', ...pathspecs],
    options,
  );
  if (statusRes.status !== 0) {
    throw new LearnerError(`Lỗi khi lấy danh sách diff từ Git: ${statusRes.stderr.trim()}`, 'GIT_DIFF_ERROR');
  }

  const tokens = statusRes.rawStdout.toString('utf8').split('\0').filter(Boolean);
  const changedItems = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const st = tokens[i];
    const filePath = tokens[i + 1];
    if (!st || !filePath) continue;
    changedItems.push({ status: st[0], file: filePath.replace(/\\/g, '/') });
  }

  const skipped = [];
  const diffChunks = [];
  let totalDiffBytes = 0;

  for (const item of changedItems) {
    const cls = classifyRepoFile(item.file, cfg);
    if (!cls.eligible) {
      if (cls.skipReason) {
        skipped.push({ file: item.file, reason: cls.skipReason });
      }
      continue;
    }

    // Kiểm tra symlink/junction trên từng file không thoát khỏi repo
    resolveAndValidateRepoPath(root, item.file);

    if (item.status === 'D') {
      skipped.push({ file: item.file, reason: 'deleted-file' });
      continue;
    }

    const fileDiff = runGit(
      root,
      [
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--no-color',
        '--no-renames',
        '--unified=8',
        baseSha,
        '--',
        item.file,
      ],
      options,
    );
    if (fileDiff.status !== 0) {
      throw new LearnerError(`Lỗi diff file "${item.file}": ${fileDiff.stderr.trim()}`, 'GIT_FILE_DIFF_ERROR');
    }

    const chunkBuf = fileDiff.rawStdout;
    totalDiffBytes += chunkBuf.length;
    if (totalDiffBytes > MAX_DIFF_BYTES) {
      throw new LearnerError(
        `Tổng dung lượng diff (${totalDiffBytes} bytes) vượt quá giới hạn an toàn (${MAX_DIFF_BYTES} bytes / 8 MiB).`,
        'DIFF_SIZE_LIMIT_EXCEEDED',
      );
    }

    const chunkText = chunkBuf.toString('utf8');
    if (/^Binary files .* differ$/m.test(chunkText) || chunkBuf.includes(0)) {
      skipped.push({ file: item.file, reason: 'binary-file' });
      continue;
    }

    if (chunkText.trim()) {
      diffChunks.push(chunkText);
    }
  }

  return {
    diffText: diffChunks.join('\n'),
    totalDiffBytes,
    skipped,
    scope: {
      mode: scopeMode,
      since: sinceRef,
      resolvedBaseSha: baseSha,
      layout: {
        requirementsDir: cfg.requirementsDir,
        testCasesDir: cfg.testCasesDir,
        projectDir: cfg.projectDir,
        ignoreSpecs: cfg.ignoreSpecs,
      },
      untrackedSkippedCount: untrackedEligible.length,
      untrackedFiles: untrackedEligible,
    },
  };
}

function isCommentOrBlankLine(line, fileKind) {
  const t = String(line || '').trim();
  if (!t) return true;
  if (fileKind === 'playwright-spec') {
    return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/');
  }
  return /^<!--.*-->$/.test(t);
}

function isConfigOrEnvOnlyLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  return /\b(?:process\.env\.|requireEnv\s*\(|dotenv|BASE_URL|PLAYWRIGHT_)/i.test(t) && !/\bexpect\b/.test(t);
}

/**
 * Phân tích unified diff theo từng hunk và gộp ngữ cảnh old/new.
 */
function parseUnifiedDiffHunks(diffText) {
  const text = stripBomAndNormalizeLf(diffText);
  const lines = text.split('\n');
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
      currentHunk = null;
      if (currentFile) files.push(currentFile);
      currentFile = { oldPath: null, newPath: null, isNewFile: false, isDeletedFile: false, hunks: [] };
      continue;
    }

    if (line.startsWith('new file mode ')) {
      if (currentFile) currentFile.isNewFile = true;
      continue;
    }
    if (line.startsWith('deleted file mode ')) {
      if (currentFile) currentFile.isDeletedFile = true;
      continue;
    }
    if (line.startsWith('--- ')) {
      const p = line.slice(4).trim();
      if (!currentFile) {
        currentFile = { oldPath: null, newPath: null, isNewFile: false, isDeletedFile: false, hunks: [] };
      }
      if (p === '/dev/null') currentFile.isNewFile = true;
      else currentFile.oldPath = p.replace(/^a\//, '').replace(/^"|"$/g, '');
      continue;
    }
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      if (!currentFile) {
        currentFile = { oldPath: null, newPath: null, isNewFile: false, isDeletedFile: false, hunks: [] };
      }
      if (p === '/dev/null') currentFile.isDeletedFile = true;
      else currentFile.newPath = p.replace(/^b\//, '').replace(/^"|"$/g, '');
      continue;
    }

    const hunkHeader = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);
    if (hunkHeader) {
      if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
      currentHunk = {
        oldStart: Number.parseInt(hunkHeader[1], 10),
        newStart: Number.parseInt(hunkHeader[3], 10),
        sectionHint: (hunkHeader[5] || '').trim(),
        added: [],
        removed: [],
        context: [],
        allNewAndContext: [],
      };
      continue;
    }

    if (!currentHunk) continue;
    if (line.startsWith('+')) {
      const content = line.slice(1);
      currentHunk.added.push(content);
      currentHunk.allNewAndContext.push(content);
    } else if (line.startsWith('-')) {
      const content = line.slice(1);
      currentHunk.removed.push(content);
    } else if (line.startsWith(' ')) {
      const content = line.slice(1);
      currentHunk.context.push(content);
      currentHunk.allNewAndContext.push(content);
    }
  }

  if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
  if (currentFile) files.push(currentFile);
  return files;
}

/**
 * Phân tích rủi ro kiểm thử trong ngữ cảnh của hunk (dùng từ nguyên vẹn \b, không bắt 'min' trong 'admin').
 */
function analyzeRiskIndicators(text) {
  const s = String(text || '');
  const tags = [];
  let suggestedCategory = null;

  if (/\b(?:double[-_\s]?submit|idempoten\w*|rapid\s+click|race\s+condition|concurrent|aria-busy|back\s+button|browser\s+back|session\s+expir\w*|lockout|locked)\b/i.test(s) || /(?:bấm\s+đúp|gửi\s+trùng|phiên\s+hết\s+hạn|khóa\s+tài\s+khoản|nút\s+back)/i.test(s)) {
    tags.push('state-concurrency');
    suggestedCategory = suggestedCategory || 'State & Concurrency';
  }
  if (/\b(?:whitespace|trim|minlength|maxlength|boundary|bva|min\s*-\s*1|max\s*\+\s*1|paste|negative\s+number|decimal|nan|overflow)\b/i.test(s) || /(?:khoảng\s+trắng|giá\s+trị\s+biên|biên\s+dưới|biên\s+trên|số\s+âm|dán\s+chuỗi)/i.test(s)) {
    tags.push('data-bva');
    suggestedCategory = suggestedCategory || 'Data & BVA';
  }
  if (/\b(?:xss|script\s*injection|idor|privilege|unauthorized|forbidden|csrf|sql\s*injection|sanitiz\w*|public\s+exposure)\b/i.test(s) || /(?:mã\s+độc|phân\s+quyền|truy\s+cập\s+trái\s+phép|bảo\s+mật)/i.test(s)) {
    tags.push('security-access');
    suggestedCategory = suggestedCategory || 'Security & Access';
  }
  if (/\b(?:preserve\s+input|retain\s+value|5xx|500|502|503|timeout|retry|rollback|recovery|network\s+error)\b/i.test(s) || /(?:bảo\s+toàn\s+dữ\s+liệu|giữ\s+nguyên\s+giá\s+trị|lỗi\s+máy\s+chủ|khôi\s+phục)/i.test(s)) {
    tags.push('resilience-recovery');
    suggestedCategory = suggestedCategory || 'Resilience & Recovery';
  }

  return { tags, suggestedCategory };
}

/**
 * Bóc tách tín hiệu học tập từ unified diff (Hunk-aware, tôn trọng config layout).
 */
function extractSignalsFromDiff(diffInput, options = {}) {
  const cfg = { ...loadConfig(options.root || process.cwd()), ...options };
  const diffText = typeof diffInput === 'string' ? diffInput : (diffInput && diffInput.diffText) || '';
  const skipped = Array.isArray(diffInput && diffInput.skipped) ? [...diffInput.skipped] : [];
  const parsedFiles = parseUnifiedDiffHunks(diffText);
  const signals = [];

  const HeadingRe = /^\s{0,3}#{2,6}\s*((?:AC|TC)-\d{3})\b\s*[:\-–—]?\s*(.*?)\s*$/;

  for (const f of parsedFiles) {
    const filePath = (f.newPath || f.oldPath || '').replace(/\\/g, '/');
    if (!filePath) continue;

    if (f.isDeletedFile && !f.newPath) {
      skipped.push({ file: filePath, reason: 'deleted-file' });
      continue;
    }

    const cls = classifyRepoFile(filePath, cfg);
    if (!cls.eligible) {
      if (cls.skipReason) skipped.push({ file: filePath, reason: cls.skipReason });
      continue;
    }

    for (const hunk of f.hunks) {
      if (hunk.added.length === 0 && hunk.removed.length === 0) continue;

      const changedLines = [...hunk.added, ...hunk.removed];
      const allCommentsOrBlank = changedLines.every((l) => isCommentOrBlankLine(l, cls.kind));
      if (allCommentsOrBlank) {
        signals.push({
          source: `git-diff:${cls.kind}`,
          file: filePath,
          line: hunk.newStart,
          targetCatalog: cls.kind === 'playwright-spec' ? 'antipattern' : 'defect',
          isNoise: true,
          noiseReason: 'comment-or-whitespace-only',
          rawExcerpt: redactSensitiveText(hunk.added.join('\n').slice(0, MAX_EXCERPT_LENGTH)),
          sourceHash: sha256(`${filePath}:${hunk.newStart}:${hunk.added.join('\n')}`),
        });
        continue;
      }

      // Kiểm tra format-only (nội dung sau khi xoá khoảng trắng không đổi)
      const normAdded = hunk.added.map((l) => l.trim()).filter(Boolean).join(' ');
      const normRemoved = hunk.removed.map((l) => l.trim()).filter(Boolean).join(' ');
      if (normAdded && normAdded === normRemoved) {
        signals.push({
          source: `git-diff:${cls.kind}`,
          file: filePath,
          line: hunk.newStart,
          targetCatalog: cls.kind === 'playwright-spec' ? 'antipattern' : 'defect',
          isNoise: true,
          noiseReason: 'formatting-only',
          rawExcerpt: redactSensitiveText(normAdded.slice(0, MAX_EXCERPT_LENGTH)),
          sourceHash: sha256(`${filePath}:${hunk.newStart}:${normAdded}`),
        });
        continue;
      }

      // Kiểm tra thay đổi chỉ liên quan tới biến môi trường / config
      const nonBlankAdded = hunk.added.filter((l) => l.trim() !== '');
      if (nonBlankAdded.length > 0 && nonBlankAdded.every((l) => isConfigOrEnvOnlyLine(l))) {
        signals.push({
          source: `git-diff:${cls.kind}`,
          file: filePath,
          line: hunk.newStart,
          targetCatalog: cls.kind === 'playwright-spec' ? 'antipattern' : 'defect',
          isNoise: true,
          noiseReason: 'config-or-env-only',
          rawExcerpt: redactSensitiveText(nonBlankAdded.join('\n').slice(0, MAX_EXCERPT_LENGTH)),
          sourceHash: sha256(`${filePath}:${hunk.newStart}:${nonBlankAdded.join('\n')}`),
        });
        continue;
      }

      if (cls.kind === 'requirement' || cls.kind === 'test-case') {
        const fullHunkText = hunk.allNewAndContext.join('\n');
        const addedText = hunk.added.join('\n');

        // Kiểm tra bảng Rules and validation hoặc bảng Test Cases / Heading AC/TC
        const headings = [];
        for (const l of hunk.allNewAndContext) {
          const hm = l.match(HeadingRe);
          if (hm) headings.push({ id: hm[1], title: hm[2] });
        }

        const tableRowsAdded = hunk.added
          .filter((l) => l.trim().startsWith('|') && !/^\s*\|[\s:-]+\|\s*$/.test(l))
          .map((l) =>
            l
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim()),
          )
          .filter((cells) => cells.length >= 3 && !/^(?:Field\/rule|ID|REQ|TC)$/i.test(cells[0] || ''));

        const hasExpectedInContext =
          /\bexpected\b\s*[:|]/i.test(fullHunkText) ||
          /kết\s+quả\s+mong\s+đợi/i.test(fullHunkText) ||
          tableRowsAdded.some((cells) => cells.length >= 5 && Boolean(cells[4]));

        const riskInfo = analyzeRiskIndicators(addedText + '\n' + hunk.sectionHint);
        const hasTypeKeywordOnly =
          /\b(?:Type\s*:\s*Security|Security|Edge|Boundary|Negative)\b/i.test(addedText) &&
          riskInfo.tags.length === 0;

        const headingSummary = headings.length > 0 ? `${headings[0].id}: ${headings[0].title}` : '';
        const redactedAdded = redactSensitiveText(addedText.trim());
        const redactedContext = redactSensitiveText(fullHunkText.trim());

        const onlyHeadingAdded =
          nonBlankAdded.length === 1 && HeadingRe.test(nonBlankAdded[0]) && !hasExpectedInContext;

        signals.push({
          source: `git-diff:${cls.kind}`,
          file: filePath,
          line: hunk.newStart,
          targetCatalog: 'defect',
          isNoise: false,
          headingSummary,
          hasExpectedInContext,
          onlyHeadingAdded,
          hasTypeKeywordOnly,
          riskTags: riskInfo.tags,
          suggestedCategory: riskInfo.suggestedCategory || 'Data & BVA',
          tableRowsAdded,
          addedText: redactedAdded,
          contextText: redactedContext,
          rawExcerpt: redactedAdded.slice(0, MAX_EXCERPT_LENGTH),
          sourceHash: sha256(`${filePath}:${hunk.newStart}:${addedText}`),
        });
      } else if (cls.kind === 'playwright-spec') {
        const oldCode = hunk.removed.join('\n');
        const newCode = hunk.added.join('\n');
        const fullSpecHunk = hunk.allNewAndContext.join('\n');

        const oldHasExpect = /\bexpect(?:\.soft)?\s*\(/.test(oldCode);
        const newHasExpect = /\bexpect(?:\.soft)?\s*\(/.test(newCode);
        const oldMissingAwait =
          oldHasExpect &&
          !/\b(?:await|return)\s+expect/.test(oldCode) &&
          /\bawait\s+expect/.test(newCode);
        const oldUrlOnly =
          oldHasExpect &&
          /\btoHave(?:URL|Title)\s*\(/.test(oldCode) &&
          !/\bto(?:BeVisible|HaveText|ContainText|HaveValue|BeDisabled|HaveAttribute)\s*\(/.test(oldCode);
        const newAddsDeeperAssert =
          newHasExpect &&
          /\bto(?:BeVisible|HaveText|ContainText|HaveValue|BeDisabled|HaveAttribute|HaveCount)\s*\(/.test(newCode);
        const newAddsNegativeSideEffectCheck =
          /\b(?:waitForRequest|on\(['"]request|toBeDisabled|aria-busy|requestCount)\b/.test(newCode);
        const newAddsParallelIsolation =
          /\b(?:test\.describe\.configure|unique|randomUUID|createIsolated|seedUser)\b/i.test(newCode);

        const isAssertionFix =
          !f.isNewFile &&
          ((oldHasExpect && newHasExpect && oldCode.trim() !== newCode.trim()) ||
            (oldUrlOnly && newAddsDeeperAssert) ||
            newAddsNegativeSideEffectCheck ||
            newAddsParallelIsolation);

        const isPureMissingAwaitFix =
          oldMissingAwait &&
          oldCode.replace(/\bawait\s+/g, '').trim() === newCode.replace(/\bawait\s+/g, '').trim();

        const isNewSpecOrAssertionOnly =
          (f.isNewFile || !oldHasExpect) &&
          newHasExpect &&
          !newAddsNegativeSideEffectCheck &&
          !newAddsParallelIsolation;

        const hasOpaqueHelperCall =
          !oldHasExpect &&
          !newHasExpect &&
          /\b(?:verify|assert|check)[A-Z][A-Za-z0-9_]*\s*\(/.test(newCode);

        let suggestedCategory = 'Superficial Assertion';
        if (newAddsNegativeSideEffectCheck) suggestedCategory = 'Negative Side Effects';
        else if (newAddsParallelIsolation) suggestedCategory = 'Parallel Isolation';
        else if (oldMissingAwait) suggestedCategory = 'Async & Timing';

        const redactedNew = redactSensitiveText(newCode.trim());
        const redactedOld = redactSensitiveText(oldCode.trim());

        signals.push({
          source: 'git-diff:playwright-spec',
          file: filePath,
          line: hunk.newStart,
          targetCatalog: 'antipattern',
          isNoise: false,
          isNewFile: f.isNewFile,
          isAssertionFix,
          isPureMissingAwaitFix,
          isNewSpecOrAssertionOnly,
          hasOpaqueHelperCall,
          suggestedCategory,
          oldCode: redactedOld,
          addedText: redactedNew,
          contextText: redactSensitiveText(fullSpecHunk.trim()),
          rawExcerpt: redactedNew.slice(0, MAX_EXCERPT_LENGTH),
          sourceHash: sha256(`${filePath}:${hunk.newStart}:${oldCode}->${newCode}`),
        });
      }

      if (signals.length > MAX_SIGNALS) {
        throw new LearnerError(
          `Số lượng tín hiệu bóc tách vượt quá giới hạn an toàn (${MAX_SIGNALS}). Hãy thu hẹp phạm vi --since.`,
          'SIGNAL_LIMIT_EXCEEDED',
        );
      }
    }
  }

  return { signals, skipped };
}

/**
 * Bóc tách tín hiệu từ decisions.json.
 * - File không tồn tại -> nguồn absent hợp lệ.
 * - JSON hỏng hoặc sai schema -> ném lỗi LearnerError.
 * - Chỉ nhận decision có status === 'confirmed' và answer.optionId hợp lệ nằm trong options.
 */
function extractSignalsFromDecisions(root) {
  const decisionsPath = path.join(root, 'decisions.json');
  if (!fs.existsSync(decisionsPath)) {
    return { present: false, signals: [], skipped: [] };
  }

  let raw;
  try {
    raw = fs.readFileSync(decisionsPath, 'utf8');
  } catch (err) {
    throw new LearnerError(`Không đọc được decisions.json: ${err.message}`, 'DECISIONS_READ_ERROR');
  }

  let data;
  try {
    data = JSON.parse(stripBomAndNormalizeLf(raw));
  } catch (err) {
    throw new LearnerError(`decisions.json không phải JSON hợp lệ: ${err.message}`, 'DECISIONS_INVALID_JSON');
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.decisions)) {
    throw new LearnerError('decisions.json thiếu mảng "decisions" ở cấp root.', 'DECISIONS_INVALID_SCHEMA');
  }

  const signals = [];
  const skipped = [];

  for (let i = 0; i < data.decisions.length; i++) {
    const d = data.decisions[i];
    if (!d || typeof d !== 'object' || !d.id || !d.title || !Array.isArray(d.options)) {
      throw new LearnerError(
        `decisions.json: mục tại vị trí ${i} (${(d && d.id) || 'thiếu id'}) sai schema bắt buộc.`,
        'DECISIONS_ITEM_INVALID_SCHEMA',
      );
    }

    if (d.status !== 'confirmed') {
      skipped.push({ decisionId: d.id, file: 'decisions.json', reason: 'decision-not-confirmed' });
      continue;
    }

    if (!d.answer || typeof d.answer !== 'object' || Array.isArray(d.answer)) {
      throw new LearnerError(
        `decisions.json: mục "${d.id}" có status="confirmed" nhưng trường answer không phải object.`,
        'DECISION_CONFIRMED_MISSING_ANSWER',
      );
    }

    const optionId = typeof d.answer.optionId === 'string' ? d.answer.optionId.trim() : '';
    if (!optionId) {
      throw new LearnerError(
        `decisions.json: mục "${d.id}" có status="confirmed" nhưng thiếu answer.optionId.`,
        'DECISION_CONFIRMED_EMPTY_OPTION',
      );
    }

    const matchedOption = d.options.find((opt) => opt && opt.id === optionId);
    if (!matchedOption || typeof matchedOption.label !== 'string' || !matchedOption.label.trim()) {
      throw new LearnerError(
        `decisions.json: mục "${d.id}" có answer.optionId="${optionId}" không tồn tại trong danh sách options.`,
        'DECISION_CONFIRMED_INVALID_OPTION',
      );
    }

    const noteText = typeof d.answer.note === 'string' ? d.answer.note.trim() : '';
    const consequenceText = typeof matchedOption.consequence === 'string' ? matchedOption.consequence.trim() : '';
    const combinedEvidence = redactSensitiveText(
      [
        `Decision ${d.id}: ${d.title}`,
        `Chosen Option (${optionId}): ${matchedOption.label.trim()}`,
        consequenceText ? `Consequence: ${consequenceText}` : '',
        noteText ? `Note: ${noteText}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );

    const riskInfo = analyzeRiskIndicators(`${d.title} ${matchedOption.label} ${consequenceText} ${noteText}`);

    signals.push({
      source: 'decisions.json',
      file: 'decisions.json',
      line: 1,
      decisionId: d.id,
      severity: d.severity || 'soon',
      targetCatalog: 'defect',
      isNoise: false,
      title: redactSensitiveText(d.title.trim()),
      chosenOptionLabel: redactSensitiveText(matchedOption.label.trim()),
      note: redactSensitiveText(noteText),
      consequence: redactSensitiveText(consequenceText),
      hasExpectedInContext: Boolean(noteText || consequenceText),
      riskTags: riskInfo.tags,
      suggestedCategory: riskInfo.suggestedCategory || 'State & Concurrency',
      addedText: combinedEvidence,
      contextText: combinedEvidence,
      rawExcerpt: combinedEvidence.slice(0, MAX_EXCERPT_LENGTH),
      sourceHash: sha256(`decision:${d.id}:${optionId}:${noteText}`),
    });
  }

  return { present: true, signals, skipped };
}

function buildProposedDraft(signal) {
  const targetCatalog = signal.targetCatalog === 'antipattern' ? 'antipattern' : 'defect';
  const type = targetCatalog === 'antipattern' ? 'PA' : 'DH';
  const category =
    signal.suggestedCategory && VALID_CATEGORIES[type].has(signal.suggestedCategory)
      ? signal.suggestedCategory
      : type === 'PA'
      ? 'Superficial Assertion'
      : 'Data & BVA';

  let title = '';
  let trigger = '';
  let failureMode = '';
  let actionableCheck = '';

  if (signal.source === 'decisions.json') {
    title = `Quyết định ${signal.decisionId}: ${signal.title}`.slice(0, MAX_TITLE_LENGTH);
    trigger = `Khi kiểm thử phạm vi liên quan tới quyết định "${signal.title}".`.slice(0, MAX_FIELD_LENGTH);
    failureMode = (
      signal.consequence ||
      `Triển khai hoặc viết test lệch với phương án đã chốt (${signal.chosenOptionLabel}).`
    ).slice(0, MAX_FIELD_LENGTH);
    actionableCheck = (
      signal.note
        ? `Áp dụng phương án "${signal.chosenOptionLabel}" — Lưu ý: ${signal.note}`
        : `Đối chiếu AC/TC/Spec tuân thủ phương án "${signal.chosenOptionLabel}".`
    ).slice(0, MAX_FIELD_LENGTH);
  } else if (targetCatalog === 'antipattern') {
    const addedStr = String(signal.addedText || signal.rawExcerpt || '');
    const summaryLine = (addedStr.split('\n')[0] || 'Cải thiện assertion trong Playwright spec').trim();
    title = `Gia cố assertion kiểm thử tự động (${path.basename(signal.file || 'spec.ts')})`.slice(
      0,
      MAX_TITLE_LENGTH,
    );
    trigger = `Khi viết hoặc rà soát Playwright spec có mẫu tương tự: ${(signal.oldCode || summaryLine).slice(0, 180)}`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
    failureMode = `Assertion cũ (${(signal.oldCode || 'thiếu kiểm tra chiều sâu').slice(0, 180)}) có nguy cơ pass giả hoặc gây flaky.`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
    actionableCheck = `Áp dụng mẫu kiểm tra chặt chẽ hơn: ${summaryLine.slice(0, 220)}`.slice(0, MAX_FIELD_LENGTH);
  } else {
    const addedStr = String(signal.addedText || signal.rawExcerpt || '');
    const rawHeading = signal.headingSummary || (addedStr.split('\n')[0] || '').replace(/^[#|\s*-]+/, '').trim();
    title = (rawHeading || `Kiểm thử biên và ngoại lệ (${path.basename(signal.file || 'doc.md')})`).slice(
      0,
      MAX_TITLE_LENGTH,
    );
    trigger = `Khi rà soát requirement/test-case có ngữ cảnh: ${title}`.slice(0, MAX_FIELD_LENGTH);
    failureMode = `Bỏ sót kịch bản kiểm thử hoặc quy tắc biên được bổ sung trong: ${String(signal.rawExcerpt || '').slice(0, 200)}`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
    actionableCheck = `Đảm bảo AC, bảng Rules và Test Case bao phủ đầy đủ điều kiện: ${String(signal.rawExcerpt || '').slice(0, 220)}`.slice(
      0,
      MAX_FIELD_LENGTH,
    );
  }

  return {
    targetCatalog,
    type,
    title: redactSensitiveText(title),
    category,
    trigger: redactSensitiveText(trigger),
    failureMode: redactSensitiveText(failureMode),
    actionableCheck: redactSensitiveText(actionableCheck),
  };
}

/**
 * Bộ lọc 4 Cổng (Gatekeeper):
 *   - Gate 1: Generality
 *   - Gate 2: Novelty (Fingerprint + Processed + Shared/Project/Batch + Lexical Jaccard >= 0.65 + Static Mapping)
 *   - Gate 3: Impact
 *   - Gate 4: Distillability
 * Không bao giờ ghi file. Trả về proposed / needsReview / rejected kèm lý do từng cổng.
 */
function evaluateGatekeeper(signals, catalog) {
  const proposed = [];
  const needsReview = [];
  const rejected = [];

  const allExistingEntries = [
    ...(catalog && catalog.shared ? catalog.shared.defects : []),
    ...(catalog && catalog.shared ? catalog.shared.antipatterns : []),
    ...((catalog && catalog.project && catalog.project.entries) || []).filter((e) => e.status === 'active'),
  ];
  const processedList = (catalog && catalog.project && catalog.project.processed) || [];
  const processedByFp = new Map(processedList.map((p) => [p.fingerprint, p]));

  const batchAcceptedByContent = new Map();
  const batchEntriesForDedup = [];

  for (const sig of signals || []) {
    const draft = buildProposedDraft(sig);
    const normEvidence = String(sig.rawExcerpt || sig.addedText || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const normBusiness = canonicalBusinessText(draft);

    // Fingerprint SHA-256 không chứa line number hay timestamp
    const fingerprint = sha256(`${sig.source}|${normEvidence}|${normBusiness}`);
    const candidateId = `CAND-${fingerprint.slice(0, 12)}`;

    const provenanceItem = {
      source: sig.source,
      file: sig.file || null,
      line: sig.line || null,
      decisionId: sig.decisionId || null,
      sourceHash: sig.sourceHash || sha256(normEvidence),
      excerpt: redactSensitiveText(sig.rawExcerpt || '').slice(0, MAX_EXCERPT_LENGTH),
    };

    const gates = {
      generality: { status: 'pass', reasonCode: 'reusable-pattern', reason: 'Có ngữ cảnh kiểm thử có thể tái sử dụng.' },
      novelty: { status: 'pass', reasonCode: 'novel-signal', reason: 'Chưa trùng với catalog hoặc lịch sử xử lý.' },
      impact: { status: 'pass', reasonCode: 'risk-evidence-present', reason: 'Có bằng chứng rủi ro kiểm thử.' },
      distillability: {
        status: 'pass',
        reasonCode: 'schema-valid',
        reason: 'Đủ trường dữ liệu chuẩn và đã redact thông tin nhạy cảm.',
      },
    };

    // --- GATE 1: GENERALITY ---
    if (sig.isNoise) {
      gates.generality = {
        status: 'fail',
        reasonCode: sig.noiseReason || 'trivial-noise',
        reason: `Thay đổi cục bộ (${sig.noiseReason || 'comment/format/config'}), không có tính tổng quát để học.`,
      };
    }

    // --- GATE 2: NOVELTY ---
    if (gates.generality.status !== 'fail') {
      // 2a. Đã xử lý trong processed[]
      if (processedByFp.has(fingerprint)) {
        const prev = processedByFp.get(fingerprint);
        gates.novelty = {
          status: 'fail',
          reasonCode: 'already-processed',
          reason: `Tín hiệu đã được xử lý trước đó với trạng thái "${prev.resolution}".`,
        };
      }
      // 2b. Đã được bắt 100% bởi static rule (ví dụ: chỉ thêm await trước expect)
      else if (sig.isPureMissingAwaitFix) {
        gates.novelty = {
          status: 'fail',
          reasonCode: 'covered-by-static-rule:assertion-thieu-await',
          reason: 'Đã được bắt tự động 100% bởi rule tĩnh "assertion-thieu-await" trong tools/qa.',
        };
      }
      // 2c. Gộp cùng bài học trong cùng batch (tối đa 5 provenance)
      else if (batchAcceptedByContent.has(normBusiness)) {
        const primary = batchAcceptedByContent.get(normBusiness);
        if (primary.provenance.length < MAX_PROVENANCE_PER_ENTRY) {
          primary.provenance.push(provenanceItem);
        }
        gates.novelty = {
          status: 'fail',
          reasonCode: 'merged-in-batch',
          reason: `Trùng nội dung với candidate "${primary.candidateId}" trong cùng batch (đã gộp provenance).`,
        };
      } else {
        // 2d. So khớp với Shared + Project Catalog + các candidate trước trong batch
        const comparePool = [...allExistingEntries, ...batchEntriesForDedup];
        let exactHit = null;
        let lexicalHit = null;
        let crossLanguageLowContext = false;

        const sigEvidenceText = `${sig.headingSummary || ''} ${sig.addedText || sig.rawExcerpt || ''}`.trim();
        const sigTextForJaccard = `${draft.title} ${draft.trigger} ${draft.failureMode} ${draft.actionableCheck} ${sig.rawExcerpt || ''}`;
        const sigTokens = tokenizeForJaccard(sigEvidenceText || sigTextForJaccard);
        const sigScript = detectScriptHint(sigEvidenceText || sigTextForJaccard);

        for (const existing of comparePool) {
          if (existing.fingerprint && existing.fingerprint === fingerprint) {
            exactHit = existing;
            break;
          }
          const existingCanonical = canonicalBusinessText(existing);
          if (existingCanonical === normBusiness) {
            exactHit = existing;
            break;
          }
          const jacDraft = computeLexicalJaccard(sigTextForJaccard, existingCanonical);
          const jacEv = sigEvidenceText ? computeLexicalJaccard(sigEvidenceText, existingCanonical) : { score: 0, empty: true };
          const bestScore = Math.max(jacDraft.score, jacEv.score);
          const isEmpty = jacDraft.empty && jacEv.empty;
          if (!isEmpty && bestScore >= JACCARD_THRESHOLD) {
            if (!lexicalHit || bestScore > lexicalHit.score) {
              lexicalHit = { id: existing.id || existing.candidateId, score: bestScore, metadata: existing.metadata };
            }
          } else if (
            !isEmpty &&
            bestScore >= 0.25 &&
            detectScriptHint(existingCanonical) !== sigScript
          ) {
            crossLanguageLowContext = true;
          }
        }

        if (exactHit) {
          gates.novelty = {
            status: 'fail',
            reasonCode: 'exact-duplicate',
            reason: `Trùng khớp hoàn toàn với mục đã có (${exactHit.id || exactHit.candidateId}).`,
          };
        } else if (lexicalHit) {
          gates.novelty = {
            status: 'unknown',
            reasonCode: 'possible-duplicate-lexical',
            reason: `Lexical Jaccard = ${lexicalHit.score} (>= ${JACCARD_THRESHOLD}) so với mục ${lexicalHit.id}. Cần Reviewer xác nhận có trùng ngữ nghĩa hay không.`,
            matchedId: lexicalHit.id,
            jaccardScore: lexicalHit.score,
          };
        } else if (
          sig.targetCatalog === 'antipattern' &&
          /\btoHave(?:URL|Title)\b/.test(sig.oldCode || sig.addedText || '')
        ) {
          // Partial static rule coverage cho PA-01 (spec-chi-assert-url)
          gates.novelty = {
            status: 'unknown',
            reasonCode: 'partial-static-coverage:spec-chi-assert-url',
            reason: 'Rule tĩnh "spec-chi-assert-url" chỉ bao phủ phần cú pháp URL-only; giữ phần ngữ nghĩa cho Reviewer đánh giá.',
          };
        } else if (sigTokens.size < 4 || crossLanguageLowContext) {
          gates.novelty = {
            status: 'unknown',
            reasonCode: crossLanguageLowContext ? 'cross-language-comparison' : 'low-lexical-context',
            reason: 'Ít ngữ cảnh từ vựng hoặc khác ngôn ngữ với catalog hiện có; cần Reviewer kiểm tra độ mới.',
          };
        }
      }
    }

    // --- GATE 3: IMPACT ---
    if (gates.generality.status !== 'fail') {
      if (sig.targetCatalog === 'antipattern') {
        if (sig.hasOpaqueHelperCall) {
          gates.impact = {
            status: 'unknown',
            reasonCode: 'opaque-helper-context',
            reason: 'Spec gọi hàm helper chưa rõ nội dung assertion bên trong; cần Reviewer kiểm tra.',
          };
        } else if (sig.isNewSpecOrAssertionOnly && !sig.isAssertionFix) {
          gates.impact = {
            status: 'unknown',
            reasonCode: 'new-assertion-not-automatically-fix',
            reason: 'Một dòng expect mới trong spec mới không mặc định là bản vá false-positive; cần Reviewer xác nhận.',
          };
        } else if (!sig.isAssertionFix) {
          gates.impact = {
            status: 'fail',
            reasonCode: 'no-assertion-or-isolation-risk',
            reason: 'Thay đổi trong spec không chứa bản sửa lỗi assertion, await hoặc cô lập trạng thái.',
          };
        }
      } else if (sig.source === 'decisions.json') {
        if (!sig.riskTags || sig.riskTags.length === 0) {
          gates.impact = {
            status: 'unknown',
            reasonCode: 'decision-impact-needs-review',
            reason: `Quyết định đã chốt (severity: ${sig.severity}) nhưng cần Reviewer xác nhận mức độ rủi ro kiểm thử (data/security/state/BVA).`,
          };
        }
      } else {
        // Nguồn requirement / test-case
        if (sig.onlyHeadingAdded || sig.hasTypeKeywordOnly) {
          gates.impact = {
            status: 'unknown',
            reasonCode: 'keyword-or-heading-only',
            reason: 'Chỉ có tiêu đề hoặc từ khoá phân loại (như Security/Edge) đơn lẻ chưa đủ bằng chứng vượt Gate 3.',
          };
        } else if (!sig.riskTags || sig.riskTags.length === 0) {
          gates.impact = {
            status: 'fail',
            reasonCode: 'happy-path-routine',
            reason: 'Thay đổi thuộc luồng happy-path thông thường, không có bằng chứng rủi ro biên/bảo mật/trạng thái.',
          };
        }
      }
    }

    // --- GATE 4: DISTILLABILITY ---
    if (gates.generality.status !== 'fail') {
      if (sig.onlyHeadingAdded || !sig.hasExpectedInContext) {
        if (sig.targetCatalog === 'defect') {
          gates.distillability = {
            status: 'unknown',
            reasonCode: 'missing-expected-outcome',
            reason: 'Thiếu thông tin kết quả kỳ vọng (Expected) trong ngữ cảnh diff; Engine không tự bịa hành vi.',
          };
        }
      }
      if (sig.hasOpaqueHelperCall) {
        gates.distillability = {
          status: 'unknown',
          reasonCode: 'insufficient-spec-context',
          reason: 'Thiếu ngữ cảnh bên trong helper để chưng cất quy tắc kiểm tra cụ thể.',
        };
      }
    }

    const gateStatuses = [
      gates.generality.status,
      gates.novelty.status,
      gates.impact.status,
      gates.distillability.status,
    ];

    let classification = 'proposed';
    if (gateStatuses.includes('fail')) {
      classification = 'rejected';
    } else if (gateStatuses.includes('unknown')) {
      classification = 'needsReview';
    }

    const candidateRecord = {
      candidateId,
      fingerprint,
      sourceHash: provenanceItem.sourceHash,
      status: classification,
      targetCatalog: draft.targetCatalog,
      type: draft.type,
      title: draft.title,
      category: draft.category,
      trigger: draft.trigger,
      failureMode: draft.failureMode,
      actionableCheck: draft.actionableCheck,
      evidence: provenanceItem.excerpt,
      provenance: [provenanceItem],
      gates,
      review: {
        status: 'pending',
        by: '',
        at: '',
        rationale: '',
      },
    };

    if (classification === 'rejected') {
      const failedEntry = Object.entries(gates).find(([, g]) => g.status === 'fail');
      rejected.push({
        ...candidateRecord,
        failedGate: failedEntry ? failedEntry[0] : 'unknown',
        reasonCode: failedEntry ? failedEntry[1].reasonCode : 'rejected',
        reason: failedEntry ? failedEntry[1].reason : 'Không vượt qua bộ lọc 4 cổng.',
      });
    } else if (classification === 'needsReview') {
      batchAcceptedByContent.set(normBusiness, candidateRecord);
      batchEntriesForDedup.push(candidateRecord);
      needsReview.push(candidateRecord);
    } else {
      batchAcceptedByContent.set(normBusiness, candidateRecord);
      batchEntriesForDedup.push(candidateRecord);
      proposed.push(candidateRecord);
    }
  }

  const sortCandidates = (arr) =>
    arr.sort((a, b) => {
      const pA = a.provenance[0] || {};
      const pB = b.provenance[0] || {};
      return (
        String(pA.source || '').localeCompare(String(pB.source || '')) ||
        String(pA.file || '').localeCompare(String(pB.file || '')) ||
        (pA.line || 0) - (pB.line || 0) ||
        String(a.fingerprint || '').localeCompare(String(b.fingerprint || ''))
      );
    });

  return {
    proposed: sortCandidates(proposed),
    needsReview: sortCandidates(needsReview),
    rejected: sortCandidates(rejected),
  };
}

function isIso8601Timestamp(val) {
  if (typeof val !== 'string' || !val.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(val.trim())) {
    return false;
  }
  const t = Date.parse(val.trim());
  return !Number.isNaN(t);
}

function computeResolutionContentHash(cand, resolution) {
  return sha256(
    [
      cand.fingerprint || '',
      resolution,
      cand.targetCatalog || '',
      canonicalBusinessText(cand),
      (cand.review && cand.review.mergeTargetId) || '',
    ].join('|'),
  );
}

/**
 * Tính sourceHash tổng hợp cho toàn bộ tín hiệu đã quét trong scope hiện tại.
 */
function computeScopeSourceHash(signals) {
  const sortedHashes = (signals || [])
    .map((s) => `${s.source}:${s.file || s.decisionId || ''}:${s.sourceHash || ''}`)
    .sort();
  return sha256(sortedHashes.join('\n'));
}

/**
 * Batch Apply Transaction (Section 5 của Phase 2):
 *   1. Validate review artifact & đường dẫn own.
 *   2. Khóa độc quyền wx (knowledge.lock) khi không phải dryRun.
 *   3. Reload catalog/knowledge, kiểm tra Replay No-op / Conflict, đối chiếu snapshotHash & sourceHash.
 *   4. Validate toàn bộ batch trước khi ghi (cap 25, schema, dedup, length, redaction).
 *   5. Cấp ID đơn điệu (PDH-001 / PPA-001) và ghi nguyên tử qua temp sibling + fsync + rename.
 */
function applyReviewedCandidates(root, reviewInput, options = {}) {
  const cfg = { ...loadConfig(root), ...options };
  const dryRun = Boolean(options.dryRun);

  let reviewObj = reviewInput;
  if (typeof reviewInput === 'string') {
    const reviewAbs = path.resolve(root, reviewInput);
    if (!fs.existsSync(reviewAbs)) {
      throw new LearnerError(`Không tìm thấy file Review Artifact: "${reviewInput}"`, 'MISSING_REVIEW_FILE');
    }
    try {
      reviewObj = JSON.parse(stripBomAndNormalizeLf(fs.readFileSync(reviewAbs, 'utf8')));
    } catch (err) {
      throw new LearnerError(`File review "${reviewInput}" không phải JSON hợp lệ: ${err.message}`, 'INVALID_REVIEW_JSON');
    }
  }

  if (!reviewObj || typeof reviewObj !== 'object' || Array.isArray(reviewObj)) {
    throw new LearnerError('Review Artifact phải là một JSON object.', 'INVALID_REVIEW_ARTIFACT');
  }
  if (reviewObj.schemaVersion !== SCHEMA_VERSION) {
    throw new LearnerError(
      `Review Artifact có schemaVersion "${reviewObj.schemaVersion}" không khớp "${SCHEMA_VERSION}".`,
      'UNSUPPORTED_REVIEW_SCHEMA',
    );
  }
  if (!reviewObj.snapshotHash || !reviewObj.sourceHash || !Array.isArray(reviewObj.candidates)) {
    throw new LearnerError(
      'Review Artifact thiếu snapshotHash, sourceHash hoặc mảng candidates.',
      'INCOMPLETE_REVIEW_ARTIFACT',
    );
  }

  // Kiểm tra layout của review artifact khớp với config hiện tại
  if (reviewObj.scope && reviewObj.scope.layout) {
    const rl = reviewObj.scope.layout;
    if (
      (rl.testCasesDir && rl.testCasesDir !== cfg.testCasesDir) ||
      (rl.requirementsDir && rl.requirementsDir !== cfg.requirementsDir) ||
      (rl.projectDir && rl.projectDir !== cfg.projectDir)
    ) {
      throw new LearnerError(
        'Layout trong Review Artifact không khớp với cấu hình repo hiện tại.',
        'LAYOUT_MISMATCH',
      );
    }
  }

  // Validate đường dẫn <testCasesDir>/_learning phải nằm trong vùng own
  const learningRelDir = `${cfg.testCasesDir || 'test-cases'}/_learning`;
  const { absPath: learningAbsDir } = resolveAndValidateRepoPath(root, learningRelDir, { requireOwn: true });
  const knowledgeAbsPath = path.join(learningAbsDir, 'knowledge.json');
  const lockAbsPath = path.join(learningAbsDir, 'knowledge.lock');

  // Bước 1: Validate từng candidate trong review artifact
  const actionable = [];
  const skipped = [];
  const seenBatchFps = new Set();

  for (let i = 0; i < reviewObj.candidates.length; i++) {
    const c = reviewObj.candidates[i];
    if (!c || typeof c !== 'object' || !c.fingerprint || !c.review || typeof c.review !== 'object') {
      throw new LearnerError(`candidates[${i}] thiếu fingerprint hoặc object review.`, 'INVALID_CANDIDATE_SCHEMA');
    }
    if (seenBatchFps.has(c.fingerprint)) {
      throw new LearnerError(
        `Trùng fingerprint "${c.fingerprint}" ngay trong cùng một Review Artifact.`,
        'DUPLICATE_BATCH_FINGERPRINT',
      );
    }
    seenBatchFps.add(c.fingerprint);

    const rStatus = c.review.status;
    if (rStatus === 'pending') {
      skipped.push({
        candidateId: c.candidateId || `CAND-${c.fingerprint.slice(0, 12)}`,
        fingerprint: c.fingerprint,
        reason: 'review-pending',
      });
      continue;
    }
    if (rStatus !== 'approved' && rStatus !== 'rejected') {
      throw new LearnerError(
        `Candidate "${c.candidateId || c.fingerprint}" có review.status="${rStatus}" không hợp lệ (chỉ nhận pending | approved | rejected).`,
        'INVALID_REVIEW_STATUS',
      );
    }

    const by = String(c.review.by || '').trim();
    const at = String(c.review.at || '').trim();
    const rationale = String(c.review.rationale || '').trim();
    if (!by || !isIso8601Timestamp(at) || !rationale) {
      throw new LearnerError(
        `Candidate "${c.candidateId || c.fingerprint}" (${rStatus}) bắt buộc phải có review.by, review.at (ISO 8601) và review.rationale không rỗng.`,
        'MISSING_REVIEW_METADATA',
      );
    }

    if (rStatus === 'approved') {
      const { prefix, targetCatalog } = normalizeCatalogType(c.targetCatalog || c.type);
      if (!VALID_CATEGORIES[prefix].has(c.category)) {
        throw new LearnerError(
          `Candidate "${c.candidateId || c.fingerprint}" có category "${c.category}" không thuộc enum hợp lệ của ${prefix}.`,
          'INVALID_APPROVED_CATEGORY',
        );
      }
      if (!c.title || unicodeLength(c.title) > MAX_TITLE_LENGTH) {
        throw new LearnerError(
          `Candidate "${c.candidateId || c.fingerprint}" có title trống hoặc vượt ${MAX_TITLE_LENGTH} ký tự.`,
          'INVALID_APPROVED_TITLE',
        );
      }
      for (const f of ['trigger', 'failureMode', 'actionableCheck']) {
        if (!c[f] || typeof c[f] !== 'string' || unicodeLength(c[f]) > MAX_FIELD_LENGTH) {
          throw new LearnerError(
            `Candidate "${c.candidateId || c.fingerprint}" có trường "${f}" trống hoặc vượt ${MAX_FIELD_LENGTH} ký tự.`,
            'INVALID_APPROVED_FIELD',
          );
        }
        if (containsUnredactedSensitive(c[f]) || containsUnredactedSensitive(c.title)) {
          throw new LearnerError(
            `Candidate "${c.candidateId || c.fingerprint}" chứa dữ liệu nhạy cảm (PII/secret/email) chưa được redact.`,
            'UNREDACTED_APPROVED_CONTENT',
          );
        }
      }
      if (
        !Array.isArray(c.provenance) ||
        c.provenance.length === 0 ||
        c.provenance.length > MAX_PROVENANCE_PER_ENTRY
      ) {
        throw new LearnerError(
          `Candidate "${c.candidateId || c.fingerprint}" phải có từ 1..${MAX_PROVENANCE_PER_ENTRY} provenance.`,
          'INVALID_APPROVED_PROVENANCE',
        );
      }
      for (const p of c.provenance) {
        if (!p || typeof p !== 'object' || !p.source || !p.sourceHash) {
          throw new LearnerError(
            `Provenance của "${c.candidateId || c.fingerprint}" thiếu source hoặc sourceHash.`,
            'INVALID_PROVENANCE_SCHEMA',
          );
        }
        if (p.excerpt && (unicodeLength(p.excerpt) > MAX_EXCERPT_LENGTH || containsUnredactedSensitive(p.excerpt))) {
          throw new LearnerError(
            `Provenance excerpt của "${c.candidateId || c.fingerprint}" vượt ${MAX_EXCERPT_LENGTH} ký tự hoặc chứa PII/secret.`,
            'INVALID_PROVENANCE_EXCERPT',
          );
        }
      }
      // Xác nhận 4 gate: nếu trong gates còn cổng fail mà không được reviewer xác nhận pass thì chặn
      if (c.gates && typeof c.gates === 'object') {
        for (const gName of ['generality', 'novelty', 'impact', 'distillability']) {
          const g = c.gates[gName];
          if (!g || (g.status !== 'pass' && g.status !== 'unknown')) {
            throw new LearnerError(
              `Candidate "${c.candidateId || c.fingerprint}" không thể approved khi cổng "${gName}" đang có trạng thái "${g && g.status}".`,
              'UNCONFIRMED_GATE_ON_APPROVAL',
            );
          }
        }
      }
      c.targetCatalog = targetCatalog;
      c.type = prefix;
    }

    actionable.push(c);
  }

  let lockFd = null;
  let tempAbsPath = null;
  const fsOps = options.fsAdapter || fs;

  try {
    // Bước 2: Acquire exclusive lock nếu không phải dryRun và có mục cần xử lý
    if (!dryRun && actionable.length > 0) {
      fsOps.mkdirSync(learningAbsDir, { recursive: true });
      try {
        lockFd = fsOps.openSync(lockAbsPath, 'wx');
        const lockPayload = JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
        });
        fsOps.writeFileSync(lockFd, lockPayload, 'utf8');
      } catch (err) {
        if (err && err.code === 'EEXIST') {
          throw new LearnerError(
            `Không thể lấy khoá ghi "${path.relative(root, lockAbsPath).replace(/\\/g, '/')}" (đang có tiến trình khác chạy hoặc lock cũ bị sót sau sự cố).`,
            'LOCK_CONTENTION',
          );
        }
        throw new LearnerError(`Lỗi khi tạo file lock: ${err.message}`, 'LOCK_ERROR');
      }
    }

    // Bước 3: Reload catalog & knowledge, kiểm tra Replay No-op / Conflict trước khi kiểm tra Stale
    const currentCatalog = loadCatalog(root, { ...cfg, requireOwnOverlay: true });
    const knowledge = JSON.parse(JSON.stringify(currentCatalog.project));
    const processedMap = new Map(knowledge.processed.map((p) => [p.fingerprint, p]));

    if (actionable.length > 0) {
      let allAlreadyProcessed = true;
      for (const c of actionable) {
        const desiredRes =
          c.review.status === 'rejected'
            ? 'rejected'
            : c.review.resolution === 'merged'
            ? 'merged'
            : 'applied';
        const expectedHash = computeResolutionContentHash(c, desiredRes);
        const existingProc = processedMap.get(c.fingerprint);

        if (!existingProc) {
          allAlreadyProcessed = false;
        } else if (
          existingProc.resolution !== desiredRes ||
          (existingProc.resolutionHash && existingProc.resolutionHash !== expectedHash)
        ) {
          throw new LearnerError(
            `Xung đột Replay: Candidate "${c.candidateId || c.fingerprint}" đã được xử lý trước đó với nội dung hoặc trạng thái khác ("${existingProc.resolution}").`,
            'REPLAY_CONFLICT',
          );
        }
      }

      if (allAlreadyProcessed) {
        return {
          schemaVersion: SCHEMA_VERSION,
          mode: dryRun ? 'apply-dry-run' : 'apply',
          replayNoOp: true,
          scope: reviewObj.scope || null,
          snapshotHash: currentCatalog.snapshotHash,
          sourceHash: reviewObj.sourceHash,
          catalogStats: currentCatalog.stats,
          proposed: [],
          needsReview: [],
          rejected: [],
          applied: [],
          skipped,
          errors: [],
        };
      }
    }

    // Đối chiếu snapshotHash
    if (reviewObj.snapshotHash !== currentCatalog.snapshotHash) {
      throw new LearnerError(
        'Review Artifact đã cũ (Stale snapshotHash): Catalog chung hoặc knowledge.json đã thay đổi kể từ lúc xuất file review.',
        'STALE_SNAPSHOT_HASH',
      );
    }

    // Đối chiếu sourceHash bằng cách quét lại scope của artifact (trừ khi toàn bộ là nguồn verify trực tiếp có hash riêng)
    const sinceScope = reviewObj.scope && reviewObj.scope.since ? reviewObj.scope.since : null;
    const currentSignals = [];
    if (options.diffText !== undefined) {
      const diffExtracted = extractSignalsFromDiff(options.diffText, { ...cfg, root });
      currentSignals.push(...diffExtracted.signals);
    } else if (!reviewObj.scope || reviewObj.scope.mode !== 'direct-verify-only') {
      const diffCollected = collectDiff(root, { ...cfg, since: sinceScope });
      const diffExtracted = extractSignalsFromDiff(diffCollected, { ...cfg, root });
      currentSignals.push(...diffExtracted.signals);
    }
    const decExtracted = extractSignalsFromDecisions(root);
    currentSignals.push(...decExtracted.signals);

    // Xác minh evidence hash cho các candidate từ nguồn verify trực tiếp
    for (const c of actionable) {
      for (const p of c.provenance || []) {
        if (p.source === 'direct-verify') {
          if (!p.file || !p.sourceHash) {
            throw new LearnerError(
              `Candidate "${c.candidateId}" từ direct-verify thiếu file hoặc sourceHash bằng chứng.`,
              'INVALID_DIRECT_VERIFY_EVIDENCE',
            );
          }
          const verifyTarget = resolveAndValidateRepoPath(root, p.file);
          if (!fs.existsSync(verifyTarget.absPath)) {
            throw new LearnerError(
              `File bằng chứng "${p.file}" của candidate "${c.candidateId}" không tồn tại.`,
              'MISSING_DIRECT_VERIFY_FILE',
            );
          }
          const fileBytesHash = sha256(stripBomAndNormalizeLf(fs.readFileSync(verifyTarget.absPath, 'utf8')));
          if (p.fileHash && p.fileHash !== fileBytesHash) {
            throw new LearnerError(
              `File bằng chứng "${p.file}" đã thay đổi so với lúc review.`,
              'STALE_DIRECT_VERIFY_FILE',
            );
          }
          currentSignals.push({
            source: 'direct-verify',
            file: p.file,
            sourceHash: p.sourceHash,
          });
        }
      }
    }

    const currentSourceHash = computeScopeSourceHash(currentSignals);
    if (reviewObj.sourceHash !== currentSourceHash) {
      throw new LearnerError(
        'Review Artifact đã cũ (Stale sourceHash): Mã nguồn diff hoặc decisions.json đã thay đổi kể từ lúc xuất file review.',
        'STALE_SOURCE_HASH',
      );
    }

    // Bước 4: Validate toàn bộ batch trước khi ghi (Cap, Duplicate/Merge, Monotonic ID)
    let activeDhCount = knowledge.entries.filter((e) => e.targetCatalog === 'defect' && e.status === 'active').length;
    let activePaCount = knowledge.entries.filter(
      (e) => e.targetCatalog === 'antipattern' && e.status === 'active',
    ).length;

    const allExistingActive = [
      ...currentCatalog.shared.defects,
      ...currentCatalog.shared.antipatterns,
      ...knowledge.entries.filter((e) => e.status === 'active'),
    ];

    const appliedItems = [];
    const rejectedItems = [];

    for (const c of actionable) {
      if (processedMap.has(c.fingerprint)) continue;

      if (c.review.status === 'rejected') {
        const resHash = computeResolutionContentHash(c, 'rejected');
        const procRecord = {
          fingerprint: c.fingerprint,
          resolution: 'rejected',
          resolutionHash: resHash,
          entryId: null,
          replacementId: null,
          reviewedBy: c.review.by.trim(),
          processedAt: c.review.at.trim(),
        };
        knowledge.processed.push(procRecord);
        processedMap.set(c.fingerprint, procRecord);
        rejectedItems.push({
          candidateId: c.candidateId || `CAND-${c.fingerprint.slice(0, 12)}`,
          fingerprint: c.fingerprint,
          resolution: 'rejected',
        });
        continue;
      }

      // Trường hợp approved
      const candCanonical = canonicalBusinessText(c);
      const duplicateEntry = allExistingActive.find((e) => canonicalBusinessText(e) === candCanonical);

      if (duplicateEntry) {
        if (c.review.resolution !== 'merged' || c.review.mergeTargetId !== duplicateEntry.id) {
          throw new LearnerError(
            `Candidate "${c.candidateId || c.fingerprint}" trùng nội dung với mục "${duplicateEntry.id}". Chỉ cho phép gộp provenance khi khai rõ review.resolution="merged" và review.mergeTargetId="${duplicateEntry.id}".`,
            'DUPLICATE_ENTRY_WITHOUT_MERGE',
          );
        }
        if (duplicateEntry.layer === 'shared' || !String(duplicateEntry.id).startsWith('P')) {
          throw new LearnerError(
            `Không thể gộp provenance trực tiếp vào mục Shared Catalog "${duplicateEntry.id}" (vùng ship chỉ đọc).`,
            'CANNOT_MUTATE_SHARED_ENTRY',
          );
        }
        const targetEntry = knowledge.entries.find((e) => e.id === duplicateEntry.id);
        const mergedProvenance = [...targetEntry.provenance];
        for (const p of c.provenance) {
          if (mergedProvenance.length >= MAX_PROVENANCE_PER_ENTRY) {
            throw new LearnerError(
              `Gộp provenance vào mục "${targetEntry.id}" vượt quá giới hạn ${MAX_PROVENANCE_PER_ENTRY} nguồn.`,
              'PROVENANCE_LIMIT_EXCEEDED',
            );
          }
          mergedProvenance.push(p);
        }
        targetEntry.provenance = mergedProvenance;
        const resHash = computeResolutionContentHash(c, 'merged');
        const procRecord = {
          fingerprint: c.fingerprint,
          resolution: 'merged',
          resolutionHash: resHash,
          entryId: targetEntry.id,
          replacementId: null,
          reviewedBy: c.review.by.trim(),
          processedAt: c.review.at.trim(),
        };
        knowledge.processed.push(procRecord);
        processedMap.set(c.fingerprint, procRecord);
        appliedItems.push({
          id: targetEntry.id,
          candidateId: c.candidateId,
          fingerprint: c.fingerprint,
          resolution: 'merged',
          targetCatalog: c.targetCatalog,
          title: targetEntry.title,
        });
        continue;
      }

      // Kiểm tra trần 25 mục active trước khi cấp ID mới
      if (c.type === 'DH') {
        if (activeDhCount + 1 > MAX_CATALOG_ENTRIES) {
          throw new LearnerError(
            `Vượt trần dung lượng Project Defect Catalog (${activeDhCount + 1}/${MAX_CATALOG_ENTRIES}). Huỷ toàn bộ batch apply.`,
            'CAP_OVERFLOW',
          );
        }
        activeDhCount++;
      } else {
        if (activePaCount + 1 > MAX_CATALOG_ENTRIES) {
          throw new LearnerError(
            `Vượt trần dung lượng Project Antipattern Catalog (${activePaCount + 1}/${MAX_CATALOG_ENTRIES}). Huỷ toàn bộ batch apply.`,
            'CAP_OVERFLOW',
          );
        }
        activePaCount++;
      }

      const nextNum = c.type === 'DH' ? knowledge.nextIds.DH++ : knowledge.nextIds.PA++;
      const newId = `P${c.type}-${String(nextNum).padStart(3, '0')}`;

      const newEntry = {
        id: newId,
        targetCatalog: c.targetCatalog,
        title: redactSensitiveText(c.title.trim()),
        category: c.category,
        trigger: redactSensitiveText(c.trigger.trim()),
        failureMode: redactSensitiveText(c.failureMode.trim()),
        actionableCheck: redactSensitiveText(c.actionableCheck.trim()),
        fingerprint: c.fingerprint,
        status: 'active',
        provenance: c.provenance.map((p) => ({
          source: p.source,
          file: p.file || null,
          line: p.line || null,
          decisionId: p.decisionId || null,
          sourceHash: p.sourceHash,
          commit: p.commit || null,
          excerpt: redactSensitiveText(p.excerpt || '').slice(0, MAX_EXCERPT_LENGTH),
        })),
        reviewedBy: c.review.by.trim(),
        reviewedAt: c.review.at.trim(),
      };

      knowledge.entries.push(newEntry);
      allExistingActive.push(newEntry);

      const resHash = computeResolutionContentHash(c, 'applied');
      const procRecord = {
        fingerprint: c.fingerprint,
        resolution: 'applied',
        resolutionHash: resHash,
        entryId: newId,
        replacementId: null,
        reviewedBy: c.review.by.trim(),
        processedAt: c.review.at.trim(),
      };
      knowledge.processed.push(procRecord);
      processedMap.set(c.fingerprint, procRecord);

      appliedItems.push({
        id: newId,
        candidateId: c.candidateId || `CAND-${c.fingerprint.slice(0, 12)}`,
        fingerprint: c.fingerprint,
        resolution: 'applied',
        targetCatalog: newEntry.targetCatalog,
        title: newEntry.title,
      });
    }

    // Validate toàn bộ object knowledge trước khi serialize
    validateProjectKnowledgeObject(knowledge, 'knowledge.json');

    // Bước 5: Ghi nguyên tử (Atomic temp sibling -> flush/close -> rename) nếu không phải dryRun
    if (!dryRun && (appliedItems.length > 0 || rejectedItems.length > 0)) {
      const serialized = JSON.stringify(knowledge, null, 2) + '\n';
      const rand = crypto.randomBytes(6).toString('hex');
      tempAbsPath = path.join(learningAbsDir, `knowledge.json.tmp.${process.pid}.${rand}`);

      const tmpFd = fsOps.openSync(tempAbsPath, 'wx');
      try {
        fsOps.writeFileSync(tmpFd, serialized, 'utf8');
        if (typeof fsOps.fsyncSync === 'function') {
          fsOps.fsyncSync(tmpFd);
        }
      } finally {
        fsOps.closeSync(tmpFd);
      }

      // Atomic replace: nếu rename lỗi (kể cả trên Windows khi file đang mở), giữ nguyên bản gốc
      fsOps.renameSync(tempAbsPath, knowledgeAbsPath);
      tempAbsPath = null;
    }

    const updatedCatalog = dryRun
      ? currentCatalog
      : loadCatalog(root, { ...cfg, requireOwnOverlay: true });

    return {
      schemaVersion: SCHEMA_VERSION,
      mode: dryRun ? 'apply-dry-run' : 'apply',
      replayNoOp: false,
      scope: reviewObj.scope || null,
      snapshotHash: updatedCatalog.snapshotHash,
      sourceHash: reviewObj.sourceHash,
      catalogStats: updatedCatalog.stats,
      proposed: [],
      needsReview: [],
      rejected: rejectedItems,
      applied: appliedItems,
      skipped,
      errors: [],
    };
  } finally {
    if (tempAbsPath && fsOps.existsSync(tempAbsPath)) {
      try {
        fsOps.unlinkSync(tempAbsPath);
      } catch {
        // Bỏ qua lỗi dọn file tạm
      }
    }
    if (lockFd !== null) {
      try {
        fsOps.closeSync(lockFd);
      } catch {
        // Bỏ qua lỗi đóng fd
      }
      try {
        if (fsOps.existsSync(lockAbsPath)) fsOps.unlinkSync(lockAbsPath);
      } catch {
        // Bỏ qua lỗi xoá lock
      }
    }
  }
}

/**
 * Hàm tổng hợp chính phục vụ CLI `node tools/qa learn` và unit tests.
 * - Mặc định là chế độ preview read-only (không tạo thư mục, file hay lock).
 * - Khi có options.apply === true, gọi applyReviewedCandidates.
 */
function learn(root, options = {}) {
  const cfg = { ...loadConfig(root), ...options };

  if (options.apply) {
    if (!options.review) {
      throw new LearnerError('Chế độ --apply bắt buộc phải chỉ định --review=<path>.', 'MISSING_REVIEW_FLAG');
    }
    return applyReviewedCandidates(root, options.review, cfg);
  }

  const catalog = loadCatalog(root, cfg);
  let diffResult;
  if (options.diffText !== undefined) {
    diffResult = {
      diffText: options.diffText,
      skipped: [],
      scope: {
        mode: options.since ? 'since' : 'injected-diff',
        since: options.since || null,
        resolvedBaseSha: 'injected',
        layout: {
          requirementsDir: cfg.requirementsDir,
          testCasesDir: cfg.testCasesDir,
          projectDir: cfg.projectDir,
          ignoreSpecs: cfg.ignoreSpecs,
        },
        untrackedSkippedCount: 0,
        untrackedFiles: [],
      },
    };
  } else {
    diffResult = collectDiff(root, cfg);
  }

  const diffExtracted = extractSignalsFromDiff(diffResult, { ...cfg, root });
  const decExtracted = extractSignalsFromDecisions(root);

  const allSignals = [...diffExtracted.signals, ...decExtracted.signals];
  if (allSignals.length > MAX_SIGNALS) {
    throw new LearnerError(
      `Tổng số tín hiệu (${allSignals.length}) vượt quá giới hạn ${MAX_SIGNALS}.`,
      'SIGNAL_LIMIT_EXCEEDED',
    );
  }

  const sourceHash = computeScopeSourceHash(allSignals);
  const evaluated = evaluateGatekeeper(allSignals, catalog);
  const allSkipped = [...diffExtracted.skipped, ...decExtracted.skipped];

  return {
    schemaVersion: SCHEMA_VERSION,
    mode: options.dryRun ? 'preview-dry-run' : 'preview',
    scope: diffResult.scope,
    snapshotHash: catalog.snapshotHash,
    sourceHash,
    catalogStats: catalog.stats,
    proposed: evaluated.proposed,
    needsReview: evaluated.needsReview,
    rejected: evaluated.rejected,
    applied: [],
    skipped: allSkipped,
    errors: [],
  };
}

/**
 * Xây dựng nội dung Review Artifact JSON chuẩn để export khi người dùng truyền --output.
 */
function buildReviewArtifact(learnReport) {
  const clonedCandidates = JSON.parse(
    JSON.stringify([...(learnReport.proposed || []), ...(learnReport.needsReview || [])]),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    scope: learnReport.scope ? JSON.parse(JSON.stringify(learnReport.scope)) : null,
    snapshotHash: learnReport.snapshotHash,
    sourceHash: learnReport.sourceHash,
    candidates: clonedCandidates,
  };
}

/**
 * Kiểm tra đường dẫn --output cho review artifact:
 * - Bắt buộc nằm bên trong <testCasesDir>/_learning
 * - Không được trùng knowledge.json / knowledge.lock
 * - Thuộc vùng own và không thoát khỏi repo qua symlink/junction
 * - Không được ghi đè file đã tồn tại
 */
function resolveAndValidateReviewOutputPath(root, outputFlag, options = {}) {
  if (!outputFlag || typeof outputFlag !== 'string' || !outputFlag.trim()) {
    throw new LearnerError('Cờ --output thiếu đường dẫn file đích.', 'INVALID_OUTPUT_PATH');
  }
  const testCasesDir = String(options.testCasesDir || 'test-cases')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  const learningRelDir = `${testCasesDir}/_learning`;

  const validatedLearning = resolveAndValidateRepoPath(root, learningRelDir, { requireOwn: true });
  const validatedOut = resolveAndValidateRepoPath(root, outputFlag.trim(), { requireOwn: true });

  const relToLearning = path
    .relative(validatedLearning.absPath, validatedOut.absPath)
    .replace(/\\/g, '/');
  if (!relToLearning || relToLearning.startsWith('..') || path.isAbsolute(relToLearning)) {
    throw new LearnerError(
      `Đường dẫn --output phải nằm bên trong "${learningRelDir}": ${outputFlag}`,
      'OUTPUT_OUTSIDE_LEARNING_DIR',
    );
  }

  const baseLower = path.basename(validatedOut.absPath).toLowerCase();
  if (
    baseLower === 'knowledge.json' ||
    baseLower === 'knowledge.lock' ||
    baseLower === 'knowledge' ||
    baseLower === 'lock' ||
    baseLower.endsWith('.lock') ||
    baseLower.startsWith('knowledge.json.')
  ) {
    throw new LearnerError(
      `Đường dẫn --output không được trùng với file hệ thống (knowledge.json / knowledge.lock): ${outputFlag}`,
      'OUTPUT_RESERVED_FILENAME',
    );
  }

  if (fs.existsSync(validatedOut.absPath)) {
    throw new LearnerError(
      `File review artifact đã tồn tại: ${outputFlag}. Vui lòng dùng tên file khác để giữ công review cũ.`,
      'OUTPUT_ALREADY_EXISTS',
    );
  }

  return validatedOut;
}

/**
 * Xuất Review Artifact (pending) ra đường dẫn hợp lệ dưới <testCasesDir>/_learning.
 */
function exportReviewArtifact(root, outputFlag, learnReport, options = {}) {
  const validatedOut = resolveAndValidateReviewOutputPath(root, outputFlag, options);
  const artifact = buildReviewArtifact(learnReport);
  const parentDir = path.dirname(validatedOut.absPath);
  fs.mkdirSync(parentDir, { recursive: true });
  resolveAndValidateRepoPath(root, path.relative(fs.realpathSync(root), parentDir), {
    requireOwn: true,
  });
  try {
    fs.writeFileSync(validatedOut.absPath, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      throw new LearnerError(
        `File review artifact đã tồn tại: ${outputFlag}. Vui lòng dùng tên file khác để giữ công review cũ.`,
        'OUTPUT_ALREADY_EXISTS',
      );
    }
    throw new LearnerError(
      `Không thể ghi review artifact "${outputFlag}": ${err.message}`,
      'OUTPUT_IO_ERROR',
    );
  }
  return {
    outputPath: validatedOut.relPath,
    artifact,
  };
}

module.exports = {
  SCHEMA_VERSION,
  POLICY_VERSION,
  STOPWORDS_VERSION,
  STATIC_MAPPING_VERSION,
  MAX_CATALOG_ENTRIES,
  JACCARD_THRESHOLD,
  VALID_CATEGORIES,
  STATIC_RULE_MAPPING,
  LearnerError,
  redactSensitiveText,
  containsUnredactedSensitive,
  computeLexicalJaccard,
  parseCatalogMarkdown,
  loadCatalog,
  collectDiff,
  extractSignalsFromDiff,
  extractSignalsFromDecisions,
  evaluateGatekeeper,
  applyReviewedCandidates,
  learn,
  buildReviewArtifact,
  resolveAndValidateReviewOutputPath,
  exportReviewArtifact,
  computeScopeSourceHash,
};
