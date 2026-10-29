'use strict';
/**
 * Đánh giá toàn diện giới hạn kích thước code automation trước khi commit:
 * trần số dòng theo role, vùng vàng 80% khi thêm logic, dòng quá dài, mật độ dòng & file nháp.
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const {
  loadQualityPolicy,
  loadSizeExemptions,
  checkFileExemption,
  determineAutomationRole,
  isJunkAutomationPath,
  splitGuidanceForRole,
} = require('./code-limits-policy');
const {
  resolveGitContext,
  getFileDiffAgainstBase,
  analyzeDiffLogic,
} = require('./code-limits-git');
const {
  splitPhysicalLines,
  measureContent,
  collectAutomationFiles,
} = require('./code-limits-scan');

function evaluateSingleFile(root, relPath, policy, exemptions, todayIso, gitCtx, options) {
  const findings = [];
  if (isJunkAutomationPath(relPath)) {
    findings.push({
      severity: 'blocker',
      kind: 'file-rac-khong-duoc-commit',
      where: relPath,
      message: `File nháp/probe "${relPath}" khớp mẫu cấm commit (*.ai-test.*, *.scratch.*, _scratch/).`,
      action: 'Xoá file nháp, đưa vào _scratch/ (gitignored) hoặc đổi sang tên spec chuẩn nếu là test chính thức.',
    });
    return { report: null, exempted: false, findings };
  }

  const rawBuffer = fs.readFileSync(path.join(root, relPath));
  const metrics = measureContent(rawBuffer);
  const role = determineAutomationRole(relPath);
  const limit = policy.limits[role] || policy.limits.module || 250;
  const warningAt = Math.floor(limit * 0.8);
  const exemptReason = checkFileExemption(relPath, rawBuffer, metrics.lineCount, exemptions, todayIso);

  const report = {
    path: relPath,
    role,
    lines: metrics.lineCount,
    limit,
    warningAt,
    longestLine: metrics.longestLine,
    avgLineLength: Number(metrics.avgLineLength.toFixed(1)),
    exempted: Boolean(exemptReason),
  };
  if (exemptReason) return { report, exempted: true, findings };

  if (metrics.lineCount > limit) {
    findings.push({
      severity: 'blocker',
      kind: 'vuot-tran-so-dong',
      where: relPath,
      message: `${relPath} có ${metrics.lineCount} dòng, vượt trần cứng ${limit} dòng của role "${role}".`,
      action: splitGuidanceForRole(role, relPath),
    });
  } else if (metrics.lineCount >= warningAt) {
    const hasInjected =
      options.diffByFile && Object.prototype.hasOwnProperty.call(options.diffByFile, relPath);
    const isTouched =
      hasInjected ||
      (options.stagedOnly ? gitCtx.staged.has(relPath) : gitCtx.changedSinceBase.has(relPath));
    const diffText = hasInjected
      ? options.diffByFile[relPath]
      : isTouched
        ? getFileDiffAgainstBase(root, gitCtx, relPath, metrics.text, Boolean(options.stagedOnly))
        : '';
    const diffAnalysis = isTouched ? analyzeDiffLogic(diffText) : { addsLogic: false, reason: '' };

    if (diffAnalysis.addsLogic) {
      findings.push({
        severity: 'major',
        kind: 'vuot-vung-vang-80-them-logic',
        where: relPath,
        message: `${relPath} ở vùng vàng >= 80% (${metrics.lineCount}/${limit} dòng, mốc vàng ${warningAt}) và thêm logic mới (${diffAnalysis.reason}) — pre-commit sẽ chặn SPLIT REQUIRED.`,
        action: splitGuidanceForRole(role, relPath),
      });
    } else {
      findings.push({
        severity: 'minor',
        kind: 'cham-vung-vang-80',
        where: relPath,
        message: `${relPath} đang ở vùng vàng >= 80% (${metrics.lineCount}/${limit} dòng, mốc vàng ${warningAt} của role "${role}").`,
        action: 'Nếu thêm hàm/test mới (> 10 dòng code), bắt buộc tách file trước để không bị chặn lúc commit.',
      });
    }
  }

  if (metrics.longestLine > policy.maxLineLength) {
    findings.push({
      severity: 'blocker',
      kind: 'dong-qua-dai',
      where: relPath,
      message: `${relPath} có dòng dài ${metrics.longestLine} ký tự (trần ${policy.maxLineLength}).`,
      action: 'Ngắt dòng hoặc dùng "x".repeat(n) / tách dữ liệu mẫu sang file riêng thay vì chuỗi literal dài.',
    });
  }
  if (metrics.lineCount >= 50 && metrics.avgLineLength > policy.maxAvgLineLength) {
    findings.push({
      severity: 'blocker',
      kind: 'mat-do-dong-qua-day',
      where: relPath,
      message: `${relPath} có độ dài dòng trung bình ${metrics.avgLineLength.toFixed(1)} ký tự (trần ${policy.maxAvgLineLength} cho file >= 50 dòng).`,
      action: 'Không nén nhiều lệnh lên 1 dòng dài để lách trần số dòng; format chuẩn và tách file.',
    });
  }
  if (metrics.byteLength > policy.maxFileBytes) {
    findings.push({
      severity: 'blocker',
      kind: 'file-qua-nang',
      where: relPath,
      message: `${relPath} nặng ${metrics.byteLength} bytes (trần ${policy.maxFileBytes} bytes).`,
      action: 'Tách payload/fixture lớn sang file dữ liệu riêng và phân rã code thành module nhỏ.',
    });
  }

  return { report, exempted: false, findings };
}

function checkCodeLimits(root, options = {}) {
  const cfg = loadConfig(root);
  const projectDir = options.projectDir || cfg.projectDir;
  const policy = loadQualityPolicy(root);
  const exemptions = loadSizeExemptions(root);
  const todayIso = options.todayIso || new Date().toISOString().slice(0, 10);
  const gitCtx = options.gitContext || resolveGitContext(root, { baseRef: options.baseRef });

  const { files: discovered, skippedByIgnoreSpecs, scanRoot } = collectAutomationFiles(
    root,
    projectDir,
    policy,
    cfg.ignoreSpecs || [],
    gitCtx,
  );

  const targetFiles = discovered.filter((relPath) => {
    if (options.stagedOnly) return gitCtx.staged.has(relPath);
    if (options.changedOnly) return gitCtx.changedSinceBase.has(relPath);
    return true;
  });

  const findings = [];
  const fileReports = [];
  let exemptedCount = 0;

  for (const relPath of targetFiles) {
    const res = evaluateSingleFile(root, relPath, policy, exemptions, todayIso, gitCtx, options);
    if (res.report) fileReports.push(res.report);
    if (res.exempted) exemptedCount += 1;
    findings.push(...res.findings);
  }

  return {
    scanRoot,
    scannedCount: targetFiles.length,
    exemptedCount,
    ignoredSpecsCount: skippedByIgnoreSpecs.length,
    ignoredSpecPrefixes: cfg.ignoreSpecs || [],
    files: fileReports,
    findings,
  };
}

module.exports = {
  splitPhysicalLines,
  measureContent,
  checkCodeLimits,
};
