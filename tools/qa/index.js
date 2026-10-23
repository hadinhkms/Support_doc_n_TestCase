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

const fs = require('node:fs');
const path = require('node:path');
const { coverage, gaps, impact, drift, matrix, summary, SEVERITY_RANK } = require('./lib/commands');
const { fixTraceability } = require('./lib/fixer');
const { loadConfig } = require('./lib/config');
const {
  learn,
  resolveAndValidateReviewOutputPath,
  exportReviewArtifact,
} = require('./lib/learner');

const ROOT = path.resolve(__dirname, '..', '..');
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
function stripAnsi(str) {
  return String(str || '').replace(ANSI_REGEX, '');
}

const VALUE_FLAG_MAP = {
  '--project-dir': 'projectDir',
  '--project': 'project',
  '--domain': 'domain',
  '--req': 'req',
  '--tag': 'tag',
  '--output': 'output',
  '--since': 'since',
  '--review': 'review',
};

function parseArgs(argv) {
  // project/projectDir để null: chưa có cờ thì nhường cho qa.config.json.
  const flags = {
    json: false,
    strict: false,
    project: null,
    projectDir: null,
    checkBoundaryRules: null,
    domain: null,
    req: null,
    tag: null,
    output: null,
    dryRun: false,
    apply: false,
    since: null,
    review: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--strict') {
      flags.strict = true;
    } else if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--apply') {
      flags.apply = true;
    } else if (arg === '--no-boundary-rules') {
      flags.checkBoundaryRules = false;
    } else if (arg === '--boundary-rules') {
      flags.checkBoundaryRules = true;
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const eqIdx = arg.indexOf('=');
      const rawName = arg.slice(0, eqIdx);
      const rawVal = arg.slice(eqIdx + 1);
      const prop = VALUE_FLAG_MAP[rawName];
      if (!prop) {
        throw new Error(`Cờ không hợp lệ: ${arg}`);
      }
      if (!rawVal || !rawVal.trim()) {
        throw new Error(`Cờ ${rawName} thiếu giá trị.`);
      }
      flags[prop] = rawVal.trim();
    } else if (Object.prototype.hasOwnProperty.call(VALUE_FLAG_MAP, arg)) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-') || !next.trim()) {
        throw new Error(`Cờ ${arg} thiếu giá trị.`);
      }
      flags[VALUE_FLAG_MAP[arg]] = next.trim();
      i += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`Cờ không hợp lệ: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function validateCommandFlags(command, flags, positional) {
  if (command === 'learn') {
    if (positional.length > 1) {
      throw new Error(`Tham số không hợp lệ cho lệnh learn: ${positional.slice(1).join(' ')}`);
    }
    if (flags.apply && !flags.review) {
      throw new Error('Cờ --apply bắt buộc đi kèm --review=<path>.');
    }
    if (flags.review && !flags.apply) {
      throw new Error('Cờ --review chỉ được dùng kèm --apply.');
    }
    if (flags.apply && flags.since !== null) {
      throw new Error('Không dùng --since cùng lúc với --apply (apply lấy scope từ review artifact).');
    }
    if (flags.apply && flags.output !== null) {
      throw new Error('Không dùng --output cùng lúc với --apply.');
    }
    if (flags.dryRun && flags.output !== null) {
      throw new Error('Không dùng --dry-run cùng lúc với --output để tránh mơ hồ side effect.');
    }
    if (flags.req !== null) {
      throw new Error('Cờ --req không hỗ trợ cho lệnh learn.');
    }
    if (flags.domain !== null) {
      throw new Error('Cờ --domain không hỗ trợ cho lệnh learn.');
    }
    if (flags.tag !== null) {
      throw new Error('Cờ --tag không hỗ trợ cho lệnh learn.');
    }
    if (flags.strict) {
      throw new Error('Cờ --strict không hỗ trợ cho lệnh learn.');
    }
    if (flags.checkBoundaryRules !== null) {
      throw new Error('Cờ --boundary-rules / --no-boundary-rules không hỗ trợ cho lệnh learn.');
    }
  } else {
    if (flags.apply || flags.since !== null || flags.review !== null) {
      throw new Error('Các cờ --apply, --since, --review chỉ dùng cho lệnh learn.');
    }
  }
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

function emitCliError(message, jsonMode) {
  const cleanMsg = stripAnsi(message).trim();
  if (jsonMode) {
    console.log(JSON.stringify({ ok: false, error: cleanMsg }, null, 2));
    console.error(cleanMsg);
  } else {
    console.error(red(cleanMsg));
  }
  process.exitCode = 2;
  return 2;
}

function formatCandidateReason(item) {
  if (item.reason) return item.reason;
  if (item.gates && typeof item.gates === 'object') {
    const unknowns = Object.entries(item.gates)
      .filter(([, g]) => g && (g.status === 'unknown' || g.status === 'warn'))
      .map(([k, g]) => `${k} [${g.reasonCode || 'unknown'}]: ${g.reason}`);
    if (unknowns.length > 0) return unknowns.join(' | ');
    const passes = Object.entries(item.gates)
      .filter(([, g]) => g && g.status === 'pass')
      .map(([k, g]) => `${k}: ${g.reasonCode || 'pass'}`);
    if (passes.length > 0) return `Đạt 4 cổng (${passes.join(', ')})`;
  }
  return '-';
}

function formatCandidateSource(item) {
  const p = Array.isArray(item.provenance) && item.provenance[0] ? item.provenance[0] : null;
  if (!p) return item.source || '-';
  const loc = p.line ? `${p.file}:${p.line}` : p.file || '-';
  return `${p.source} @ ${loc}`;
}

function renderLearnReport(report) {
  const modeLabels = {
    preview: 'Preview (Read-Only — chưa ghi vào kho tri thức)',
    'preview-dry-run': 'Preview Dry-Run (Read-Only — chưa ghi vào kho tri thức)',
    apply: 'Apply (Cập nhật Project Overlay)',
    'apply-dry-run': 'Apply Dry-Run (Read-Only — không ghi đĩa)',
  };
  const modeLabel = modeLabels[report.mode] || report.mode;
  const stats = report.catalogStats || {
    shared: { DH: 0, PA: 0, total: 0 },
    project: { DH: 0, PA: 0, active: 0, retired: 0, processed: 0 },
    effective: { DH: 0, PA: 0, total: 0, shadowedCount: 0 },
  };
  const scope = report.scope || {};
  const layout = scope.layout || {};

  console.log(bold(`\nQA Selective Learning — ${modeLabel}\n`));
  console.log(
    `  Shared Catalog (ship)  : ${bold(stats.shared.DH)} DH · ${bold(stats.shared.PA)} PA (tổng: ${stats.shared.total})`,
  );
  console.log(
    `  Project Overlay (own)  : ${bold(stats.project.DH)} DH · ${bold(stats.project.PA)} PA ` +
      `(active: ${stats.project.active}, retired: ${stats.project.retired}, processed: ${stats.project.processed})`,
  );
  console.log(
    `  Effective Knowledge    : ${bold(stats.effective.DH)} DH · ${bold(stats.effective.PA)} PA ` +
      `(tổng: ${stats.effective.total}, shadowed: ${stats.effective.shadowedCount || 0})`,
  );
  console.log(
    `  Scope                  : mode=${scope.mode || report.mode} · since=${scope.since || '(working tree)'} · base=${scope.resolvedBaseSha || '-'}`,
  );
  console.log(
    `  Layout                 : req=${layout.requirementsDir || 'requirements'} · tc=${layout.testCasesDir || 'test-cases'} · spec=${layout.projectDir || 'playwright'}`,
  );
  if (Array.isArray(layout.ignoreSpecs) && layout.ignoreSpecs.length > 0) {
    console.log(`  Ignore Specs           : ${layout.ignoreSpecs.join(', ')}`);
  }
  console.log(
    `  Untracked skipped      : ${scope.untrackedSkippedCount || 0}` +
      (Array.isArray(scope.untrackedFiles) && scope.untrackedFiles.length > 0
        ? ` (${scope.untrackedFiles.join(', ')})`
        : ''),
  );

  if (report.replayNoOp) {
    console.log(
      yellow('\n  [REPLAY NO-OP] Toàn bộ candidate trong review artifact đã được xử lý trước đó — không ghi lại kho tri thức.'),
    );
  }

  console.log(
    bold(
      `\n  Tóm tắt: Proposed ${report.proposed.length} · Needs Review ${report.needsReview.length} · ` +
        `Rejected ${report.rejected.length} · Applied ${report.applied.length} · Skipped ${report.skipped.length}\n`,
    ),
  );

  if (report.proposed.length > 0) {
    console.log(bold('  Proposed (Đề xuất chờ duyệt — CHƯA học / CHƯA ghi vào kho tri thức):'));
    for (const item of report.proposed) {
      console.log(`    ${green('[PROPOSED]')} ${bold(item.candidateId)} [${item.type}/${item.category}] ${item.title}`);
      console.log(`      source: ${dim(formatCandidateSource(item))}`);
      console.log(`      reason: ${dim(formatCandidateReason(item))}`);
    }
    console.log('');
  }

  if (report.needsReview.length > 0) {
    console.log(bold('  Needs Review (Cần người/agent kiểm tra bổ sung — CHƯA học / CHƯA ghi vào kho tri thức):'));
    for (const item of report.needsReview) {
      console.log(`    ${yellow('[NEEDS_REVIEW]')} ${bold(item.candidateId)} [${item.type}/${item.category}] ${item.title}`);
      console.log(`      source: ${dim(formatCandidateSource(item))}`);
      console.log(`      reason: ${dim(formatCandidateReason(item))}`);
    }
    console.log('');
  }

  if (report.rejected.length > 0) {
    console.log(bold('  Rejected (Bị từ chối):'));
    for (const item of report.rejected) {
      const tag = item.type || item.targetCatalog || 'rejected';
      console.log(`    ${red('[REJECTED]')} ${bold(item.candidateId)} [${tag}] ${item.title || '-'}`);
      console.log(`      source: ${dim(formatCandidateSource(item))}`);
      console.log(`      reason: ${dim(`[${item.failedGate || 'review'}/${item.reasonCode || 'rejected'}] ${item.reason || '-'}`)}`);
    }
    console.log('');
  }

  if (report.applied.length > 0) {
    const label = report.mode === 'apply-dry-run' ? '[DRY-RUN APPLIED]' : '[APPLIED]';
    console.log(bold('  Applied (Cập nhật vào Project Overlay):'));
    for (const item of report.applied) {
      console.log(`    ${green(label)} ${bold(item.id)} <- ${item.candidateId} [${item.targetCatalog}] ${item.title}`);
      console.log(`      action: ${dim(item.action || 'created')} · reason: ${dim('Đã được reviewer phê duyệt (approved)')}`);
    }
    console.log('');
  }

  if (report.skipped.length > 0) {
    console.log(bold('  Skipped (Đã bỏ qua):'));
    for (const item of report.skipped) {
      const target = item.candidateId || item.decisionId || item.file || '-';
      const src = item.source || item.file || item.reasonCode || 'skip';
      console.log(`    ${dim('[SKIPPED]')} ${bold(target)} (${src}) — reason: ${dim(item.reason || '-')}`);
    }
    console.log('');
  }

  if (report.reviewFile) {
    console.log(green(`  Đã xuất Review Artifact (trạng thái pending) ra: ${report.reviewFile}\n`));
  }
}

function runLearn(rootDir, options, flags) {
  if (flags.output) {
    resolveAndValidateReviewOutputPath(rootDir, flags.output, options);
  }
  const learnOpts = {
    ...options,
    since: flags.since,
    apply: flags.apply,
    review: flags.review,
    dryRun: flags.dryRun,
  };
  const report = learn(rootDir, learnOpts);
  if (flags.output) {
    const exported = exportReviewArtifact(rootDir, flags.output, report, options);
    report.reviewFile = exported.outputPath;
  }
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderLearnReport(report);
  }
  return report;
}

function runCoverage(rootDir, options, flags) {
  const result = coverage(rootDir, options);
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

function runImpact(rootDir, reqId, options, flags) {
  if (!reqId) {
    return emitCliError('Thiếu mã requirement. Ví dụ: node tools/qa impact REQ-001', flags.json);
  }
  const result = impact(rootDir, reqId, options);
  if (result.error) {
    return emitCliError(result.error, flags.json);
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
  return 0;
}

function main(opts = {}) {
  const rootDir = opts.root ? path.resolve(opts.root) : ROOT;
  const argv = Array.isArray(opts.argv) ? opts.argv : process.argv.slice(2);
  const preDetectedJson = argv.some((a) => a === '--json');
  process.exitCode = 0;

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    return emitCliError(err.message, preDetectedJson);
  }
  const { flags, positional } = parsed;
  const command = positional[0] || 'coverage';

  try {
    validateCommandFlags(command, flags, positional);
  } catch (err) {
    return emitCliError(err.message, flags.json);
  }

  let config;
  try {
    config = loadConfig(rootDir);
  } catch (err) {
    return emitCliError(err.message, flags.json);
  }
  const options = {
    project: flags.project || config.project,
    projectDir: flags.projectDir || config.projectDir,
    ignoreSpecs: config.ignoreSpecs || [],
    requirementsDir: config.requirementsDir,
    testCasesDir: config.testCasesDir,
    checkBoundaryRules: flags.checkBoundaryRules !== null ? flags.checkBoundaryRules : config.checkBoundaryRules,
    filterDomain: flags.domain,
    filterReq: flags.req,
    filterTag: flags.tag,
    dryRun: flags.dryRun,
  };
  if (options.ignoreSpecs.length > 0 && !flags.json && command !== 'learn') {
    console.log(dim(`(ignoreSpecs đang bật: ${options.ignoreSpecs.join(', ')})`));
  }
  if ((options.filterDomain || options.filterReq || options.filterTag) && !flags.json && command !== 'learn') {
    const filters = [];
    if (options.filterDomain) filters.push(`domain: ${options.filterDomain}`);
    if (options.filterReq) filters.push(`req: ${options.filterReq}`);
    if (options.filterTag) filters.push(`tag: ${options.filterTag}`);
    console.log(dim(`(Đang lọc theo ${filters.join(', ')})`));
  }

  let findings = null;
  try {
    switch (command) {
      case 'coverage':
        runCoverage(rootDir, options, flags);
        break;
      case 'gaps':
        findings = gaps(rootDir, options);
        if (flags.json) console.log(JSON.stringify(findings, null, 2));
        else printFindings('Gaps — nên thêm script nào', findings);
        break;
      case 'drift':
        findings = drift(rootDir, options);
        if (flags.json) console.log(JSON.stringify(findings, null, 2));
        else printFindings('Drift — traceability mục ở đâu', findings);
        break;
      case 'impact':
        runImpact(rootDir, positional[1], options, flags);
        break;
      case 'matrix': {
        const res = matrix(rootDir, options);
        if (flags.json) console.log(JSON.stringify(res, null, 2));
        else {
          console.log(bold(`\n✅ Đã tự động cập nhật ma trận truy vết (${res.rowsCount} dòng):`));
          console.log(`   -> ${res.file}\n`);
        }
        break;
      }
      case 'summary': {
        const res = summary(rootDir, options);
        if (flags.output) {
          const outPath = path.resolve(rootDir, flags.output);
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, JSON.stringify(res, null, 2), 'utf8');
        }
        if (flags.json) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          const m = res.metrics;
          const h = res.health;
          const b = res.boundary;
          const d = res.decisions;
          const healthColor = h.status === 'HEALTHY' ? green : h.status === 'WARNING' ? yellow : red;

          console.log(bold('\n┌─────────────────────────────────────────────────────────────┐'));
          console.log(bold(`│  ${c('36;1', 'QA TRACEABILITY & HEALTH DASHBOARD SUMMARY')}                │`));
          console.log(bold('├─────────────────────────────────────────────────────────────┤'));
          console.log(`│  Trạng thái hệ thống: ${healthColor(bold(h.status.padEnd(9)))}                           │`);
          console.log(`│  Độ phủ Automation  : ${bold(String(m.coveragePercent + '%').padEnd(7))} (${m.coveredAcCount}/${m.acceptanceCriteria} ACs có script)         │`);
          console.log(`│  Requirements       : ${bold(String(m.requirements).padEnd(4))}  · Test Cases       : ${bold(String(m.testCases).padEnd(5))}     │`);
          console.log(`│  Automated Tests    : ${bold(String(m.automatedTests).padEnd(4))}  · WIP / Stub Tests : ${bold(String(m.wipTests).padEnd(5))}     │`);
          console.log(`│  Vấn đề (Findings)  : ${red(h.blockers)} blocker · ${yellow(h.majors)} major · ${dim(h.minors)} minor    │`);
          console.log(`│  Quyết định chờ duyệt: ${bold(String(d.pending).padEnd(3))} (Chặn: ${d.blocking > 0 ? red(d.blocking) : green(0)})                   │`);
          console.log(`│  Ranh giới Hub-Repo : ${b.status === 'ALIGNED' ? green('ALIGNED') : red('DRIFTED')} (ship ${b.shipCount}, seed ${b.seedCount}, own ${b.ownCount})  │`);
          console.log(bold('└─────────────────────────────────────────────────────────────┘\n'));
          if (flags.output) {
            console.log(dim(`(Đã xuất báo cáo JSON ra: ${flags.output})\n`));
          }
        }
        findings = res.findings;
        break;
      }
      case 'fix': {
        const res = fixTraceability(rootDir, options);
        if (flags.json) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          const prefix = res.dryRun ? '[DRY-RUN] ' : '';
          if (res.fixedCount === 0) {
            console.log(green(`\n${prefix}OK: Toàn bộ bảng traceability đã đồng bộ, không phát hiện lỗi cần sửa.\n`));
          } else {
            console.log(bold(`\n${prefix}🔧 Đã xử lý ${res.fixedCount} vấn đề truy vết (${res.modifiedFilesCount} file):\n`));
            for (const chg of res.changes) {
              if (chg.kind === 'chuan-hoa-duong-dan-spec') {
                console.log(`  - [${chg.file}:${chg.line}] Chuẩn hoá đường dẫn: ${dim(chg.from)} -> ${green(chg.to)}`);
              } else if (chg.kind === 'them-test-case-chua-khai-bao') {
                console.log(`  + [${chg.file}:${chg.line}] Tự động bổ sung test case: ${bold(chg.tcId)} (${chg.acId}) -> ${dim(chg.spec)}`);
              }
            }
            if (res.dryRun) {
              console.log(yellow('\n(Đây là chế độ dry-run: không có file nào trên đĩa bị thay đổi. Bỏ cờ --dry-run để áp dụng).\n'));
            } else {
              console.log(green('\n(Đã cập nhật file và đồng bộ lại test-cases/traceability.md).\n'));
            }
          }
        }
        break;
      }
      case 'learn':
        runLearn(rootDir, options, flags);
        break;
      default:
        return emitCliError(
          `Lệnh không hợp lệ: ${command}\nDùng: coverage | gaps | impact <REQ-xxx> | drift | matrix | summary | fix | learn`,
          flags.json,
        );
    }
  } catch (err) {
    return emitCliError(err.message || String(err), flags.json);
  }

  if (flags.strict && findings) {
    const blocking = findings.filter((f) => (SEVERITY_RANK[f.severity] || 0) >= SEVERITY_RANK.major);
    if (blocking.length > 0) process.exitCode = 1;
  }

  return process.exitCode || 0;
}

if (require.main === module) {
  main();
}

module.exports = {
  ROOT,
  parseArgs,
  validateCommandFlags,
  renderLearnReport,
  main,
};
