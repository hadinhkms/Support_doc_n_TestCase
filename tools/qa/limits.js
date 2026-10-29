#!/usr/bin/env node
'use strict';
/**
 * Cổng kiểm tra giới hạn kích thước code automation trước khi commit.
 *
 *   node tools/qa/limits                  quét toàn bộ thư mục automation (<projectDir>)
 *   node tools/qa/limits --strict         exit 1 khi có finding từ mức major trở lên
 *   node tools/qa/limits --changed        chỉ kiểm tra file đã sửa / thêm mới so với nhánh gốc
 *   node tools/qa/limits --staged         chỉ kiểm tra file đang staged
 *   node tools/qa/limits --json           xuất JSON sạch cho CI / AI Agent đọc
 *   node tools/qa/limits --project-dir=X  ghi đè thư mục Playwright
 *   node tools/qa/limits --base=REF       ghi đè mốc Git base cho kiểm tra vùng vàng 80%
 */

const path = require('node:path');
const { checkCodeLimits } = require('./lib/code-limits');

const ROOT = path.resolve(__dirname, '..', '..');
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

const SEVERITY_RANK = { blocker: 3, major: 2, minor: 1 };

function parseLimitsArgs(argv) {
  const flags = {
    json: false,
    strict: false,
    changedOnly: false,
    stagedOnly: false,
    projectDir: null,
    baseRef: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--changed' || arg === '--changed-only') flags.changedOnly = true;
    else if (arg === '--staged') flags.stagedOnly = true;
    else if (arg.startsWith('--project-dir=')) flags.projectDir = arg.slice('--project-dir='.length).trim();
    else if (arg === '--project-dir' && argv[i + 1]) {
      flags.projectDir = argv[i + 1].trim();
      i += 1;
    } else if (arg.startsWith('--base=')) flags.baseRef = arg.slice('--base='.length).trim();
    else if (arg === '--base' && argv[i + 1]) {
      flags.baseRef = argv[i + 1].trim();
      i += 1;
    } else {
      throw new Error(`Cờ không hợp lệ cho qa:limits: ${arg}`);
    }
  }
  if (flags.changedOnly && flags.stagedOnly) {
    throw new Error('Chỉ được chọn một trong hai cờ: --changed hoặc --staged.');
  }
  return flags;
}

function renderHuman(result) {
  console.log(
    bold(
      `QA Code Limits — quét ${result.scannedCount} file trong "${result.scanRoot}"` +
        (result.exemptedCount > 0 ? ` (${result.exemptedCount} file được miễn trừ)` : ''),
    ),
  );
  if (result.ignoredSpecsCount > 0) {
    console.log(
      yellow(
        `  Lưu ý: ${result.ignoredSpecsCount} file bỏ qua theo ignoreSpecs (${result.ignoredSpecPrefixes.join(', ')})`,
      ),
    );
  }

  if (result.findings.length === 0) {
    console.log(green('  ✓ Tất cả file automation đều nằm trong ngưỡng an toàn (< 80% vùng vàng & trần cứng).'));
    return;
  }

  for (const f of result.findings) {
    const badge =
      f.severity === 'blocker'
        ? red('[BLOCKER]')
        : f.severity === 'major'
          ? red('[MAJOR]')
          : yellow('[MINOR]');
    console.log(`  ${badge} ${bold(f.kind)} — ${f.where}`);
    console.log(`    ${f.message}`);
    if (f.action) console.log(`    ${dim(`-> ${f.action}`)}`);
  }
}

function runCli(argv = process.argv.slice(2), root = ROOT) {
  let flags;
  try {
    flags = parseLimitsArgs(argv);
  } catch (err) {
    if (argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify({ error: err.message })}\n`);
    } else {
      console.error(red(`Lỗi tham số: ${err.message}`));
    }
    return 2;
  }

  let result;
  try {
    result = checkCodeLimits(root, flags);
  } catch (err) {
    if (flags.json) {
      process.stdout.write(`${JSON.stringify({ error: err.message })}\n`);
    } else {
      console.error(red(`Lỗi cấu hình: ${err.message}`));
    }
    return 2;
  }

  const blockingCount = result.findings.filter((f) => (SEVERITY_RANK[f.severity] || 0) >= 2).length;
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ ...result, blockingCount }, null, 2)}\n`);
  } else {
    renderHuman(result);
  }

  if (flags.strict && blockingCount > 0) return 1;
  return 0;
}

if (require.main === module) {
  process.exit(runCli());
}

module.exports = { parseLimitsArgs, runCli };

