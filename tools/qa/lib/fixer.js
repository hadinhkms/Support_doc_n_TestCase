'use strict';
/**
 * tools/qa/lib/fixer.js
 *
 * Tự động sửa chữa và đồng bộ chuỗi truy vết (Traceability Auto-Reconciler):
 *   1. Chuẩn hoá tiền tố đường dẫn spec trong test-cases/*.md (bổ sung playwright/ nếu file tồn tại).
 *   2. Tự động đăng ký test case mới phát hiện từ automation spec vào bảng Traceability.
 *   3. Đồng bộ lại ma trận tổng test-cases/traceability.md.
 *
 * Zero-dependency, hỗ trợ --dry-run và đảm bảo tính chất idempotent.
 */

const fs = require('node:fs');
const path = require('node:path');
const { collect, matrix } = require('./commands');

function fixTraceability(root, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const testCasesDir = options.testCasesDir || 'test-cases';
  const projectDir = options.projectDir || 'playwright';
  const targetReq = options.reqId ? options.reqId.toUpperCase() : null;

  const tcDirAbs = path.join(root, testCasesDir);
  if (!fs.existsSync(tcDirAbs)) {
    return { ok: false, error: `Thư mục ${testCasesDir} không tồn tại`, fixedCount: 0, changes: [] };
  }

  const changes = [];
  const modifiedFiles = new Map(); // absPath -> newContent

  // 1. Quét và chuẩn hoá đường dẫn spec trong test-cases/*.md
  const tcFiles = fs
    .readdirSync(tcDirAbs)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md' && f.toLowerCase() !== 'traceability.md');

  for (const file of tcFiles) {
    if (targetReq && !file.toUpperCase().startsWith(targetReq)) continue;

    const absPath = path.join(tcDirAbs, file);
    const rel = path.relative(root, absPath).replace(/\\/g, '/');
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split(/\r?\n/);
    let changed = false;

    const newLines = lines.map((line, idx) => {
      // Nhận diện dòng bảng: | REQ | AC | TC | Status | Spec | Priority |
      if (!line.trim().startsWith('|')) return line;
      const parts = line.split('|');
      if (parts.length < 7) return line;

      const specCell = parts[5].trim();
      const cleanSpec = specCell.replace(/`/g, '').trim();

      // Nếu đường dẫn bắt đầu bằng tests/ mà file nằm ở playwright/tests/
      if (cleanSpec.startsWith('tests/')) {
        const candidateAbs = path.join(root, projectDir, cleanSpec);
        if (fs.existsSync(candidateAbs)) {
          const normalized = `${projectDir}/${cleanSpec}`;
          parts[5] = ` \`${normalized}\` `;
          const newLine = parts.join('|');
          changes.push({
            file: rel,
            line: idx + 1,
            kind: 'chuan-hoa-duong-dan-spec',
            from: specCell,
            to: `\`${normalized}\``,
          });
          changed = true;
          return newLine;
        }
      }
      return line;
    });

    if (changed) {
      modifiedFiles.set(absPath, newLines.join('\n'));
    }
  }

  // 2. Tự động đăng ký test case chưa được khai báo nhưng có trong automation script
  const collected = collect(root, options);
  const knownTcKeys = new Set(collected.testCases.links.map((l) => `${l.reqId}/${l.tcId}`));

  for (const t of collected.realTests) {
    if (!t.reqId || !t.tcId || !t.acId) continue;
    if (targetReq && t.reqId.toUpperCase() !== targetReq) continue;

    const key = `${t.reqId}/${t.tcId}`;
    if (!knownTcKeys.has(key)) {
      // Tìm file test-case tương ứng với REQ
      const matchingFile = tcFiles.find((f) => f.toUpperCase().startsWith(t.reqId.toUpperCase()));
      if (matchingFile) {
        const absPath = path.join(tcDirAbs, matchingFile);
        const rel = path.relative(root, absPath).replace(/\\/g, '/');
        const currentText = modifiedFiles.has(absPath)
          ? modifiedFiles.get(absPath)
          : fs.readFileSync(absPath, 'utf8');

        const lines = currentText.split(/\r?\n/);
        let inTraceability = false;
        let lastRowIdx = -1;

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          if (/^##\s+Traceability/i.test(l)) {
            inTraceability = true;
            continue;
          }
          if (inTraceability) {
            if (/^##\s+/.test(l)) {
              inTraceability = false;
              break;
            }
            if (l.startsWith('|')) {
              lastRowIdx = i;
            }
          }
        }

        if (lastRowIdx !== -1) {
          const newRow = `| ${t.reqId} | ${t.acId} | ${t.tcId} | Candidate | \`${t.path}\` | P2 |`;
          lines.splice(lastRowIdx + 1, 0, newRow);
          modifiedFiles.set(absPath, lines.join('\n'));
          knownTcKeys.add(key);
          changes.push({
            file: rel,
            line: lastRowIdx + 2,
            kind: 'them-test-case-chua-khai-bao',
            tcId: t.tcId,
            acId: t.acId,
            spec: t.path,
          });
        }
      }
    }
  }

  // 3. Ghi đĩa nếu không phải dryRun
  if (!dryRun && modifiedFiles.size > 0) {
    for (const [absPath, content] of modifiedFiles.entries()) {
      fs.writeFileSync(absPath, content, 'utf8');
    }
    // Tự động sinh lại ma trận tổng
    try {
      matrix(root, options);
    } catch {
      // Bỏ qua nếu sinh ma trận gặp lỗi phụ
    }
  }

  return {
    ok: true,
    dryRun,
    fixedCount: changes.length,
    modifiedFilesCount: modifiedFiles.size,
    changes,
  };
}

module.exports = { fixTraceability };
