'use strict';
/**
 * Chính sách giới hạn kích thước file & phân loại role đồng bộ 1-1 với
 * Master Process `quality-policy.json` (trần cứng & vùng vàng 80%).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_POLICY = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.py'],
  excludedFolders: [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.ai',
    'scratch', '_scratch', 'out', 'vendor', 'venv', '.venv', '__pycache__', '.pytest_cache',
    'playwright-report', 'test-results', 'blob-report', '.auth', '.cache',
  ],
  limits: { test: 800, component: 150, hook: 150, service: 200, utils: 150, module: 250 },
  maxLineLength: 500,
  maxAvgLineLength: 100,
  maxFileBytes: 150000,
};

const TEST_NAME_RE = /(^test_|_test\.)|\.(test|spec)\.[cm]?[jt]sx?$/i;
const TEST_DIR_RE = /(^|\/)(tests?|specs?|e2e|__tests__|deep-engine-tests)(\/|$)/i;
const COMPONENT_EXTS = new Set(['.tsx', '.jsx', '.vue']);
const COMPONENT_DIR_RE = /(^|\/)components(\/|$)/;
const HOOK_NAME_RE = /^use[A-Z]/;
const HOOK_DIR_RE = /(^|\/)hooks(\/|$)/;
const SERVICE_NAME_RE = /(^|[.\-_])(service|api|client)([.\-_]|$)/i;
const SERVICE_DIR_RE = /(^|\/)services(\/|$)/i;
const UTILS_NAME_RE = /(^|[.\-_])(utils?|helpers?)([.\-_]|$)/i;
const UTILS_DIR_RE = /(^|\/)(utils?|helpers?)(\/|$)/i;

const JUNK_PATH_PATTERNS = [
  /(^|\/)_?scratch(\/|$)/i,
  /\.ai[-_.]test\./i,
  /\.ai\.spec\./i,
  /\.scratch\./i,
  /(^|\/)(ai_test|ai-test)[^/]*$/i,
];

function readJsonIfExists(filePath, label) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new Error(`${label} không phải JSON hợp lệ: ${err.message}`);
  }
}

function loadQualityPolicy(root) {
  const policy = {
    extensions: [...DEFAULT_POLICY.extensions],
    excludedFolders: [...DEFAULT_POLICY.excludedFolders],
    limits: { ...DEFAULT_POLICY.limits },
    maxLineLength: DEFAULT_POLICY.maxLineLength,
    maxAvgLineLength: DEFAULT_POLICY.maxAvgLineLength,
    maxFileBytes: DEFAULT_POLICY.maxFileBytes,
  };
  for (const rel of ['.quality-policy.json', '.ai/quality-policy.json']) {
    const custom = readJsonIfExists(path.join(root, rel), rel);
    if (!custom) continue;
    const code = custom.code || {};
    for (const ext of code.extensions || []) {
      if (typeof ext === 'string' && ext.startsWith('.') && !policy.extensions.includes(ext)) {
        policy.extensions.push(ext.toLowerCase());
      }
    }
    for (const folder of code.excludedFolders || []) {
      if (typeof folder === 'string' && folder.trim() && !policy.excludedFolders.includes(folder)) {
        policy.excludedFolders.push(folder.trim());
      }
    }
    if (code.limits && typeof code.limits === 'object') {
      for (const [role, val] of Object.entries(code.limits)) {
        if (Number.isInteger(val) && val > 0) policy.limits[role] = val;
      }
    }
    for (const key of ['maxLineLength', 'maxAvgLineLength', 'maxFileBytes']) {
      if (Number.isInteger(code[key]) && code[key] > 0) policy[key] = code[key];
    }
    break;
  }
  return policy;
}

function loadSizeExemptions(root) {
  const map = new Map();
  for (const rel of ['.ai/size-exemptions.json', '.size-exemptions.json']) {
    const parsed = readJsonIfExists(path.join(root, rel), rel);
    if (!parsed || !Array.isArray(parsed.exemptions)) continue;
    for (const entry of parsed.exemptions) {
      if (entry && typeof entry.path === 'string') map.set(entry.path.replace(/\\/g, '/'), entry);
    }
    break;
  }
  return map;
}

function checkFileExemption(relPath, rawBuffer, lineCount, exemptions, todayIso) {
  const entry = exemptions.get(relPath);
  if (!entry) return null;
  if (entry.expires && String(entry.expires) < todayIso) return null;
  if (Number.isInteger(entry.maxLines) && lineCount > entry.maxLines) return null;
  if (typeof entry.sha256 === 'string') {
    const actualSha = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    if (actualSha.toLowerCase() !== entry.sha256.toLowerCase()) return null;
  }
  return entry.reason || 'exempted';
}

function determineAutomationRole(relPath) {
  const posixPath = relPath.replace(/\\/g, '/');
  const baseName = path.posix.basename(posixPath);
  const ext = path.posix.extname(baseName).toLowerCase();

  if (TEST_NAME_RE.test(baseName)) return 'test';
  if (TEST_DIR_RE.test(posixPath)) return 'module';
  if (COMPONENT_EXTS.has(ext) || COMPONENT_DIR_RE.test(posixPath)) return 'component';
  if (HOOK_NAME_RE.test(baseName) || HOOK_DIR_RE.test(posixPath)) return 'hook';
  if (SERVICE_NAME_RE.test(baseName) || SERVICE_DIR_RE.test(posixPath)) return 'service';
  if (UTILS_NAME_RE.test(baseName) || UTILS_DIR_RE.test(posixPath)) return 'utils';
  return 'module';
}

function isJunkAutomationPath(relPath) {
  const posixPath = relPath.replace(/\\/g, '/');
  return JUNK_PATH_PATTERNS.some((re) => re.test(posixPath));
}

function splitGuidanceForRole(role, relPath) {
  if (role === 'test') {
    return 'Tách spec theo nhóm luồng/chiều kiểm thử (*.happy.spec.ts, *.validation.spec.ts, *.security.spec.ts), giữ tag @REQ-xxx ở test.describe và title TC-xxx - AC-yyy.';
  }
  if (/\/pages\//i.test(relPath) || /\.page\.[cm]?[jt]s$/i.test(relPath)) {
    return 'Tách Page Object theo màn hình con hoặc khối giao diện độc lập (Modal, FormSection, Table, FilterBar), mỗi file < 200 dòng.';
  }
  if (/\/(data|fixtures)\//i.test(relPath)) {
    return 'Tách payload/dataset lớn sang file .json riêng hoặc chia module fixture/data theo domain nghiệp vụ (< 200 dòng/file).';
  }
  if (role === 'service' || /\/api\//i.test(relPath)) {
    return 'Phân rã API client/service theo từng domain resource (vd: auth.api.ts, users.api.ts, orders.api.ts).';
  }
  if (role === 'utils' || /\/support\//i.test(relPath)) {
    return 'Phân rã helper/support theo miền chức năng và dùng barrel re-export nếu cần giữ nguyên đường dẫn import.';
  }
  return 'Phân rã module thành các file nhỏ đơn trách nhiệm (dưới mốc vùng vàng 80% của role).';
}

module.exports = {
  DEFAULT_POLICY,
  loadQualityPolicy,
  loadSizeExemptions,
  checkFileExemption,
  determineAutomationRole,
  isJunkAutomationPath,
  splitGuidanceForRole,
};
