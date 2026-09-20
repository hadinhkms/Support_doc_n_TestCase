#!/usr/bin/env node
'use strict';
/**
 * QA traceability analyzer.
 *
 *   node tools/qa coverage              bức tranh tổng REQ -> AC -> TC -> script
 *   node tools/qa gaps                  nên THÊM script nào
 *   node tools/qa impact REQ-001        requirement đổi thì phải SỬA file nào
 *   node tools/qa drift                 traceability mục ở đâu
 *
 * Cờ dùng chung:
 *   --json           in JSON thay vì bảng (cho CI hoặc agent đọc)
 *   --strict         exit 1 khi có finding từ mức major trở lên
 *   --project=X      project Playwright dùng để liệt kê test
 *   --project-dir=X  thư mục chứa playwright.config (`.` = gốc repo)
 *
 * Hai cờ cuối mặc định lấy từ qa.config.json ở gốc repo, xem lib/config.js.
 * Không dùng dependency ngoài để chạy được ở cả repo JavaScript lẫn TypeScript.
 */

const path = require('node:path');
const { coverage, gaps, impact, drift, matrix } = require('./lib/commands');
const { loadConfig } = require('./lib/config');

const ROOT = path.resolve(__dirname, '..', '..');
const SEVERITY_RANK = { blocker: 3, major: 2, minor: 1 };
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

function parseArgs(argv) {
  // project/projectDir để null: chưa có cờ thì nhường cho qa.config.json.
  const flags = { json: false, strict: false, project: null, projectDir: null, checkBoundaryRules: null };
  const positional = [];
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--no-boundary-rules') flags.checkBoundaryRules = false;
    else if (arg === '--boundary-rules') flags.checkBoundaryRules = true;
    else if (arg.startsWith('--project-dir=')) flags.projectDir = arg.slice('--project-dir='.length);
    else if (arg.startsWith('--project=')) flags.project = arg.slice('--project='.length);
    else if (arg.startsWith('--')) throw new Error(`Cờ không hợp lệ: ${arg}`);
    else positional.push(arg);
  }
  return { flags, positional };
}

function severityLabel(s) {
  if (s === 'blocker') return red('BLOCKER');
  if (s === 'major') return yellow('MAJOR  ');
  return dim('MINOR  ');
}

function printFindings(title, findings) {
  if (findings.length === 0) {
    console.log(`${green('OK')} ${title}: không phát hiện vấn đề.`);
    return;
  }
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0),
  );
  console.log(bold(`\n${title} — ${findings.length} phát hiện\n`));
  for (const f of sorted) {
    console.log(`${severityLabel(f.severity)} ${bold(f.kind)}`);
    console.log(`         ${f.message}`);
    console.log(`         ${dim(f.where)}`);
    if (f.action) console.log(`         ${dim('-> ' + f.action)}`);
    console.log('');
  }
  const counts = sorted.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {});
  console.log(
    dim(
      `Tổng: ${counts.blocker || 0} blocker, ${counts.major || 0} major, ${counts.minor || 0} minor`,
    ),
  );
}

function runCoverage(options, flags) {
  const result = coverage(ROOT, options);
  if (flags.json) return console.log(JSON.stringify(result, null, 2));

  if (result.playwrightError) console.log(yellow(`! ${result.playwrightError}\n`));
  // Đọc được 0 spec là chế độ hỏng trông giống hệt chế độ sạch -> phải hét lên.
  if (result.emptySpecs) console.log(red(`!! ${result.emptyMessage}\n`));
  // Không bao giờ giấu số test bị khoanh vùng: một gate im lặng bỏ qua là gate nói dối.
  if (result.ignoredSpecs > 0) {
    console.log(
      yellow(
        `! Đã bỏ qua ${result.ignoredSpecs} test theo ignoreSpecs: ${result.ignorePrefixes.join(', ')}\n`,
      ),
    );
  }
  console.log(
    bold(
      `\n${result.requirements} requirement · ${result.acceptanceCriteria} AC · ` +
        `${result.testCases} test case · ${result.automatedTests} test đã automation\n`,
    ),
  );
  const width = Math.max(10, ...result.rows.map((r) => r.acTitle.length > 42 ? 42 : r.acTitle.length));
  console.log(dim(`${'REQ/AC'.padEnd(18)}${'Mô tả'.padEnd(width + 2)}Test case -> đã automation`));
  console.log(dim('-'.repeat(18 + width + 30)));
  for (const row of result.rows) {
    const key = `${row.reqId}/${row.acId}`;
    const desc = row.acTitle.length > 42 ? row.acTitle.slice(0, 39) + '...' : row.acTitle;
    const tcs = row.testCases.length ? row.testCases.join(',') : '-';
    const auto = row.automated.length ? green(row.automated.join(',')) : red('chưa có');
    const extra = [];
    if (row.manualOnly.length) extra.push(dim(`thủ công: ${row.manualOnly.join(',')}`));
    if (row.candidates.length) extra.push(dim(`candidate: ${row.candidates.join(',')}`));
    console.log(`${key.padEnd(18)}${desc.padEnd(width + 2)}${tcs} -> ${auto} ${extra.join(' ')}`);
  }
  console.log('');
}

function runImpact(reqId, options, flags) {
  if (!reqId) {
    console.error('Thiếu mã requirement. Ví dụ: node tools/qa impact REQ-001');
    process.exitCode = 2;
    return;
  }
  const result = impact(ROOT, reqId, options);
  if (result.error) {
    console.error(red(result.error));
    process.exitCode = 2;
    return;
  }
  if (flags.json) return console.log(JSON.stringify(result, null, 2));

  const r = result.requirement;
  console.log(bold(`\n${r.id} — ${r.title}`));
  console.log(dim(`status: ${r.status} · version: ${r.version} · ${r.file}\n`));
  console.log(bold('Nếu requirement này đổi, rà lại:\n'));
  for (const ac of result.acs) {
    console.log(`  ${bold(ac.acId)} ${ac.title}`);
    if (ac.testCases.length === 0) console.log(`    ${red('chưa có test case nào')}`);
    for (const tc of ac.testCases) {
      const tag = tc.automation === 'Yes' ? green(tc.automation) : yellow(tc.automation || '?');
      console.log(`    ${tc.tcId} [${tc.priority}] ${tag}`);
      for (const s of tc.specs) console.log(`      ${dim(s)}`);
      if (tc.automation === 'Yes' && tc.specs.length === 0) {
        console.log(`      ${red('khai Yes nhưng không tìm thấy script')}`);
      }
    }
    console.log('');
  }
  console.log(bold('File cần mở:'));
  const uniqueFiles = [...new Set(result.filesToReview.map((f) => f.split(':')[0]))];
  for (const f of uniqueFiles) console.log(`  ${f}`);
  console.log('');
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(red(err.message));
    process.exitCode = 2;
    return;
  }
  const { flags, positional } = parsed;
  const command = positional[0] || 'coverage';

  let config;
  try {
    config = loadConfig(ROOT);
  } catch (err) {
    console.error(red(err.message));
    process.exitCode = 2;
    return;
  }
  const options = {
    project: flags.project || config.project,
    projectDir: flags.projectDir || config.projectDir,
    ignoreSpecs: config.ignoreSpecs || [],
    requirementsDir: config.requirementsDir,
    testCasesDir: config.testCasesDir,
    checkBoundaryRules: flags.checkBoundaryRules !== null ? flags.checkBoundaryRules : config.checkBoundaryRules,
  };
  if (options.ignoreSpecs.length > 0 && !flags.json) {
    console.log(dim(`(ignoreSpecs đang bật: ${options.ignoreSpecs.join(', ')})`));
  }

  let findings = null;
  switch (command) {
    case 'coverage':
      runCoverage(options, flags);
      break;
    case 'gaps':
      findings = gaps(ROOT, options);
      if (flags.json) console.log(JSON.stringify(findings, null, 2));
      else printFindings('Gaps — nên thêm script nào', findings);
      break;
    case 'drift':
      findings = drift(ROOT, options);
      if (flags.json) console.log(JSON.stringify(findings, null, 2));
      else printFindings('Drift — traceability mục ở đâu', findings);
      break;
    case 'impact':
      runImpact(positional[1], options, flags);
      break;
    case 'matrix': {
      const res = matrix(ROOT, options);
      if (flags.json) console.log(JSON.stringify(res, null, 2));
      else {
        console.log(bold(`\n✅ Đã tự động cập nhật ma trận truy vết (${res.rowsCount} dòng):`));
        console.log(`   -> ${res.file}\n`);
      }
      break;
    }
    default:
      console.error(`Lệnh không hợp lệ: ${command}`);
      console.error('Dùng: coverage | gaps | impact <REQ-xxx> | drift | matrix');
      process.exitCode = 2;
      return;
  }

  if (flags.strict && findings) {
    const blocking = findings.filter((f) => (SEVERITY_RANK[f.severity] || 0) >= SEVERITY_RANK.major);
    if (blocking.length > 0) process.exitCode = 1;
  }
}

main();
