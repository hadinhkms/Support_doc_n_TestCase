#!/usr/bin/env node
'use strict';

/**
 * PR impact selection: danh sách file đổi (stdin, mỗi dòng 1 path) -> regex grep `@REQ-xxx\b|...`
 * cho các REQ bị ảnh hưởng, để gate PR chạy thêm test của chúng bên cạnh `@smoke|@p0`.
 *
 * Ánh xạ:
 *   requirements/REQ-xxx-*.md, test-cases/REQ-xxx-*.md   -> REQ-xxx
 *   playwright/tests/** /*.spec.ts                         -> tag @REQ-xxx trong file
 *   module .ts khác trong playwright/tests                 -> tag của mọi spec import nó, kể cả
 *                                                            gián tiếp (fixture -> page -> spec)
 * Không suy được REQ nào -> in chuỗi rỗng; workflow giữ nguyên `@smoke|@p0`.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TESTS_DIR = 'playwright/tests';
const REQ_FILE = /^(?:requirements|test-cases)\/(REQ-\d{3})[-.]/;
const SPEC_FILE = /\.spec\.ts$/;
const TS_FILE = /\.ts$/;
const REQ_TAG = /@(REQ-\d{3})\b/g;

const posix = (p) => p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
const stripTs = (p) => p.replace(/\.ts$/, '');

function tagsIn(text) {
  return [...String(text || '').matchAll(REQ_TAG)].map((m) => m[1]);
}

/** Module (đường dẫn từ gốc repo, bỏ `.ts`) mà `file` import/re-export theo đường dẫn tương đối. */
function importTargets(file, text) {
  const pattern = /(?:from|import)\s+['"](\.{1,2}\/[^'"]+)['"]/g;
  return [...String(text || '').matchAll(pattern)].map(([, spec]) =>
    stripTs(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))),
  );
}

/** Spec dùng `moduleFile` trực tiếp hoặc gián tiếp: đi ngược đồ thị import trên playwright/tests. */
function specsReaching(moduleFile, io) {
  const importers = new Map();
  for (const file of io.listFiles().map(posix)) {
    for (const target of importTargets(file, io.readFile(file))) {
      if (!importers.has(target)) importers.set(target, []);
      importers.get(target).push(file);
    }
  }
  const seen = new Set();
  const specs = new Set();
  const queue = [stripTs(moduleFile)];
  while (queue.length) {
    for (const importer of importers.get(queue.shift()) || []) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      if (SPEC_FILE.test(importer)) specs.add(importer);
      queue.push(stripTs(importer));
    }
  }
  return [...specs];
}

/**
 * @param {string[]} changedFiles đường dẫn tính từ gốc repo
 * @param {{ readFile(p: string): string | null, listFiles(): string[] }} io listFiles: mọi .ts trong playwright/tests
 */
function impactedReqs(changedFiles, io) {
  const reqs = new Set();
  for (const file of changedFiles.map(posix).filter(Boolean)) {
    const reqFile = REQ_FILE.exec(file);
    if (reqFile) {
      reqs.add(reqFile[1]);
    } else if (file.startsWith(`${TESTS_DIR}/`) && SPEC_FILE.test(file)) {
      tagsIn(io.readFile(file)).forEach((r) => reqs.add(r));
    } else if (file.startsWith(`${TESTS_DIR}/`) && TS_FILE.test(file)) {
      for (const spec of specsReaching(file, io)) tagsIn(io.readFile(spec)).forEach((r) => reqs.add(r));
    }
  }
  return [...reqs].sort();
}

function grepFragment(reqs) {
  return reqs.map((r) => `@${r}\\b`).join('|');
}

function repoIo(root = REPO_ROOT) {
  const listFiles = (dir = TESTS_DIR) =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return listFiles(rel);
      return TS_FILE.test(entry.name) ? [rel] : [];
    });
  return {
    readFile: (p) => (fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), 'utf8') : null),
    listFiles: () => listFiles(),
  };
}

if (require.main === module) {
  const input = fs.readFileSync(0, 'utf8').split(/\r?\n/);
  process.stdout.write(grepFragment(impactedReqs(input, repoIo())));
}

module.exports = { impactedReqs, grepFragment, importTargets, repoIo };
