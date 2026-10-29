'use strict';
/**
 * Khám phá file automation & đo chỉ số vật lý của file (số dòng khớp Python splitlines,
 * dòng dài nhất, độ dài trung bình dòng không rỗng và số bytes).
 */

const fs = require('node:fs');
const path = require('node:path');
const { isJunkAutomationPath } = require('./code-limits-policy');

const ROOT_AUTOMATION_DIRS = new Set([
  'playwright', 'tests', 'test', 'e2e', 'specs', 'spec', '__tests__', 'deep-engine-tests',
]);
const ROOT_AUTOMATION_FILE_RE = /(^playwright\.config\.|^deep-engine\.config\.|\.(test|spec)\.[cm]?[jt]sx?$)/i;

function splitPhysicalLines(text) {
  if (!text) return [];
  return String(text).replace(/(?:\r\n|\n|\r)$/, '').split(/\r\n|\n|\r/);
}

function measureContent(rawBuffer) {
  const text = rawBuffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = splitPhysicalLines(text);
  let longest = 0;
  let nonEmptyChars = 0;
  let nonEmptyCount = 0;
  for (const line of lines) {
    if (line.length > longest) longest = line.length;
    if (line.trim().length > 0) {
      nonEmptyChars += line.length;
      nonEmptyCount += 1;
    }
  }
  const avgLength = nonEmptyCount > 0 ? nonEmptyChars / nonEmptyCount : 0;
  return {
    text,
    lineCount: lines.length,
    longestLine: longest,
    avgLineLength: avgLength,
    byteLength: rawBuffer.length,
  };
}

function isIgnoredByPrefix(relPath, ignorePrefixes) {
  return ignorePrefixes.some((p) => relPath === p || relPath.startsWith(`${p}/`));
}

function collectAutomationFiles(root, projectDir, policy, ignoreSpecs, gitCtx) {
  const excludedSet = new Set(policy.excludedFolders);
  const extSet = new Set(policy.extensions.map((e) => e.toLowerCase()));
  const normalizedProject =
    (projectDir || 'playwright').replace(/\\/g, '/').replace(/^\.\/+|\/+$/g, '') || '.';
  const startDir = normalizedProject === '.' ? root : path.join(root, normalizedProject);
  const files = [];
  const skippedByIgnoreSpecs = [];

  if (!fs.existsSync(startDir)) {
    return { files, skippedByIgnoreSpecs, scanRoot: normalizedProject };
  }

  const walk = (absDir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absChild = path.join(absDir, entry.name);
      const relPosix = path.relative(root, absChild).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (gitCtx.ignored.has(relPosix) && !gitCtx.tracked.has(relPosix)) continue;
        if (excludedSet.has(entry.name) && !isJunkAutomationPath(relPosix)) continue;
        if (normalizedProject === '.' && depth === 0 && !ROOT_AUTOMATION_DIRS.has(entry.name)) {
          continue;
        }
        walk(absChild, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (
        gitCtx.ignored.has(relPosix) &&
        !gitCtx.tracked.has(relPosix) &&
        !gitCtx.staged.has(relPosix)
      ) {
        continue;
      }
      if (normalizedProject === '.' && depth === 0 && !ROOT_AUTOMATION_FILE_RE.test(entry.name)) {
        continue;
      }
      if (isIgnoredByPrefix(relPosix, ignoreSpecs)) {
        skippedByIgnoreSpecs.push(relPosix);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (extSet.has(ext) || isJunkAutomationPath(relPosix)) {
        files.push(relPosix);
      }
    }
  };

  walk(startDir, 0);
  return { files: files.sort(), skippedByIgnoreSpecs, scanRoot: normalizedProject };
}

module.exports = {
  splitPhysicalLines,
  measureContent,
  collectAutomationFiles,
};

