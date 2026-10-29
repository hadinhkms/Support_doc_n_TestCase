'use strict';
/**
 * Phân tích Git diff & phát hiện thêm logic trong vùng vàng 80%
 * (đồng bộ hành vi với Master Process `split_check.py` & `diff_logic.py`).
 */

const { spawnSync } = require('node:child_process');

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const NEW_CONSTRUCT_PATTERNS = [
  /^\+\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/,
  /^\+\s*class\s+([A-Za-z0-9_]+)/,
  /^\+\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*([A-Za-z0-9_]*)\s*\(/,
  /^\+\s*(?:export\s+)?class\s+([A-Za-z0-9_]+)/,
  /^\+\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/,
  /^\+\s*(?:test|it)(?:\.(?:describe|only|step))?\s*\(/,
];

const IGNORED_LINE_PATTERNS = [
  /^\+\s*$/,
  /^\+\s*#/,
  /^\+\s*\/\//,
  /^\+\s*\/\*/,
  /^\+\s*\*/,
  /^\+\s*<!--/,
  /^\+\s*(?:from\s+[\w.]+\s+)?import\s+/,
  /^\+\s*export\s+\{[^}]*\}\s*(?:from\s+[^;]+)?;?/,
  /^\+\s*(?:const|let|var)?\s*[\w\s{},:*]+\s*=\s*require\(/,
  /^\+\s*(?:export\s+)?(?:type|interface)\s+\w+/,
];

function runGit(root, args) {
  return spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function splitNull(out) {
  if (!out) return [];
  return out
    .split('\0')
    .map((s) => s.replace(/\\/g, '/').trim())
    .filter(Boolean);
}

function resolveBaseRef(root, explicitBase) {
  if (explicitBase) return explicitBase;
  const head = runGit(root, ['rev-parse', '--verify', 'HEAD']);
  if (head.status !== 0) return EMPTY_TREE_SHA;
  for (const branch of ['origin/main', 'main', 'origin/master', 'master']) {
    const mb = runGit(root, ['merge-base', 'HEAD', branch]);
    if (mb.status === 0 && mb.stdout && mb.stdout.trim()) {
      return mb.stdout.trim();
    }
  }
  return 'HEAD';
}

function resolveGitContext(root, options = {}) {
  const top = runGit(root, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) {
    return {
      isGit: false,
      baseRef: null,
      tracked: new Set(),
      untracked: new Set(),
      ignored: new Set(),
      staged: new Set(),
      changedSinceBase: new Set(),
    };
  }

  const baseRef = resolveBaseRef(root, options.baseRef);
  const tracked = new Set(splitNull(runGit(root, ['ls-files', '-z']).stdout));
  const untracked = new Set(
    splitNull(runGit(root, ['ls-files', '-z', '--others', '--exclude-standard']).stdout),
  );
  const ignored = new Set(
    splitNull(runGit(root, ['ls-files', '-z', '--others', '-i', '--exclude-standard']).stdout),
  );
  const staged = new Set(
    splitNull(
      runGit(root, [
        'diff',
        '--cached',
        '--name-only',
        '--diff-filter=ACMR',
        '--no-renames',
        '-z',
        '--relative',
      ]).stdout,
    ),
  );
  const diffBase = new Set(
    splitNull(
      runGit(root, [
        'diff',
        '--name-only',
        '--diff-filter=ACMR',
        '--no-renames',
        '-z',
        '--relative',
        baseRef,
      ]).stdout,
    ),
  );
  const changedSinceBase = new Set([...staged, ...diffBase, ...untracked]);

  return { isGit: true, baseRef, tracked, untracked, ignored, staged, changedSinceBase };
}

function getFileDiffAgainstBase(root, gitCtx, relPath, rawText, stagedOnly = false) {
  if (!gitCtx || !gitCtx.isGit) return '';
  if (!stagedOnly && gitCtx.untracked.has(relPath) && !gitCtx.tracked.has(relPath)) {
    return String(rawText || '')
      .split(/\r\n|\n|\r/)
      .map((line) => `+${line}`)
      .join('\n');
  }
  const args = stagedOnly
    ? ['diff', '--cached', '--no-renames', '-U0', gitCtx.baseRef, '--', relPath]
    : ['diff', '--no-renames', '-U0', gitCtx.baseRef, '--', relPath];
  const res = runGit(root, args);
  return res.status === 0 ? res.stdout || '' : '';
}

function analyzeDiffLogic(diffText, threshold = 10) {
  const addedConstructs = [];
  let netCodeLines = 0;
  let inBlockComment = false;
  let blockDelimiter = '';

  for (const rawLine of String(diffText || '').split(/\r\n|\n|\r/)) {
    if (rawLine.startsWith('+++') || rawLine.startsWith('---') || rawLine.startsWith('@@')) {
      continue;
    }
    if (!rawLine.startsWith('+')) continue;
    const content = rawLine.slice(1).trim();

    if (inBlockComment) {
      if (content.includes(blockDelimiter)) inBlockComment = false;
      continue;
    }
    if (content.includes('/*') && !content.includes('*/')) {
      inBlockComment = true;
      blockDelimiter = '*/';
      continue;
    }

    for (const pattern of NEW_CONSTRUCT_PATTERNS) {
      const m = rawLine.match(pattern);
      if (m) addedConstructs.push(m[1] || 'block');
    }
    if (!IGNORED_LINE_PATTERNS.some((p) => p.test(rawLine))) {
      netCodeLines += 1;
    }
  }

  const reasons = [];
  if (addedConstructs.length > 0) {
    reasons.push(`thêm hàm/class/test mới (${addedConstructs.slice(0, 4).join(', ')})`);
  }
  if (netCodeLines > threshold) {
    reasons.push(`thêm ${netCodeLines} dòng code thực chất (> ${threshold})`);
  }
  return {
    addsLogic: reasons.length > 0,
    netCodeLines,
    addedConstructs,
    reason: reasons.join('; '),
  };
}

module.exports = {
  EMPTY_TREE_SHA,
  resolveGitContext,
  getFileDiffAgainstBase,
  analyzeDiffLogic,
};

