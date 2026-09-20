#!/usr/bin/env node
'use strict';

/**
 * tools/scaffold/index.js
 *
 * Tự động sinh đồng bộ chuỗi truy vết:
 *   Requirement -> Test Case -> Playwright Spec
 * Hoặc suy luận ngược (Reverse Scaffold) từ file spec có sẵn.
 *
 * Zero-dependency: chỉ dùng Node core fs, path.
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

let loadConfig;
try {
  loadConfig = require('../qa/lib/config').loadConfig;
} catch {
  loadConfig = () => ({
    requirementsDir: 'requirements',
    testCasesDir: 'test-cases',
    projectDir: 'playwright',
  });
}

function slugify(text) {
  return String(text || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'feature';
}

function parseArgs(argv) {
  const flags = {
    req: null,
    slug: null,
    title: null,
    acs: 2,
    domain: null,
    infer: null,
    force: false,
    json: false,
    wizard: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') flags.force = true;
    else if (arg === '--json') flags.json = true;
    else if (arg.startsWith('--req=')) flags.req = arg.slice(6);
    else if (arg === '--req' && argv[i + 1]) flags.req = argv[++i];
    else if (arg.startsWith('--slug=')) flags.slug = arg.slice(7);
    else if (arg === '--slug' && argv[i + 1]) flags.slug = argv[++i];
    else if (arg.startsWith('--title=')) flags.title = arg.slice(8);
    else if (arg === '--title' && argv[i + 1]) flags.title = argv[++i];
    else if (arg.startsWith('--acs=')) flags.acs = parseInt(arg.slice(6), 10);
    else if (arg === '--acs' && argv[i + 1]) flags.acs = parseInt(argv[++i], 10);
    else if (arg.startsWith('--domain=')) flags.domain = arg.slice(9);
    else if (arg === '--domain' && argv[i + 1]) flags.domain = argv[++i];
    else if (arg === '--infer=' || arg.startsWith('--infer=')) flags.infer = arg.slice(8);
    else if (arg === '--infer' && argv[i + 1]) flags.infer = argv[++i];
    else if (arg === '--wizard' || arg === '-w') flags.wizard = true;
    else {
      throw new Error(`Tùy chọn không hợp lệ: "${arg}". Chạy không cờ để xem hướng dẫn.`);
    }
  }
  return flags;
}

function suggestNextReqId(reqDir) {
  if (!fs.existsSync(reqDir)) return 'REQ-001';
  const files = fs.readdirSync(reqDir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');
  const ids = [];
  for (const file of files) {
    const fullPath = path.join(reqDir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const m = content.match(/^id:\s*REQ-(\d+)/im);
      if (m) {
        ids.push(parseInt(m[1], 10));
      }
    } catch {
      // ignore read error
    }
  }
  if (ids.length === 0) return 'REQ-001';
  const max = Math.max(...ids);
  return `REQ-${String(max + 1).padStart(3, '0')}`;
}

function listExistingDomains(projectDir) {
  const testsDir = path.join(projectDir, 'tests');
  if (!fs.existsSync(testsDir)) return ['auth'];
  const reserved = new Set(['support', 'fixtures', 'api', 'pages', 'data']);
  try {
    const entries = fs.readdirSync(testsDir, { withFileTypes: true });
    const domains = entries
      .filter((e) => e.isDirectory() && !reserved.has(e.name))
      .map((e) => e.name);
    return domains.length > 0 ? domains : ['auth'];
  } catch {
    return ['auth'];
  }
}

async function runWizard({ root, config, input = process.stdin, output = process.stdout, promptFn = null }) {
  let rl = null;
  let ask = promptFn;
  if (!ask) {
    rl = readline.createInterface({ input, output });
    ask = (q) => new Promise((resolve) => rl.question(q, resolve));
  }

  try {
    const reqDir = path.resolve(root, config.requirementsDir || 'requirements');
    const projectDir = path.resolve(root, config.projectDir || 'playwright');
    const suggestedReq = suggestNextReqId(reqDir);
    const existingDomains = listExistingDomains(projectDir);

    output.write('\n🧙 === BỘ TỰ ĐỘNG KHỞI TẠO TRUY VẾT QA (SCAFFOLD WIZARD) ===\n\n');

    // 1. Mã Requirement
    const ansReq = (await ask(`1. Mã Requirement [Mặc định: ${suggestedReq}]: `)).trim();
    const reqId = ansReq || suggestedReq;

    // 2. Tiêu đề
    let title = '';
    while (!title) {
      title = (await ask('2. Tiêu đề tính năng (Ví dụ: "Quên mật khẩu"): ')).trim();
      if (!title) output.write('   ⚠️ Tiêu đề không được để trống!\n');
    }

    // 3. Slug
    const defaultSlug = slugify(title);
    const ansSlug = (await ask(`3. Slug định danh [Mặc định: ${defaultSlug}]: `)).trim();
    const slug = ansSlug || defaultSlug;

    // 4. Domain
    output.write('4. Chọn Domain kiểm thử:\n');
    existingDomains.forEach((dom, idx) => {
      output.write(`   [${idx + 1}] ${dom}\n`);
    });
    output.write(`   [${existingDomains.length + 1}] Nhập domain mới...\n`);
    const ansDomainChoice = (await ask(`   Chọn (1-${existingDomains.length + 1}) [Mặc định: 1]: `)).trim();
    let domain = existingDomains[0] || 'auth';
    const choiceNum = parseInt(ansDomainChoice, 10);
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= existingDomains.length) {
      domain = existingDomains[choiceNum - 1];
    } else if (choiceNum === existingDomains.length + 1) {
      const customDom = (await ask('   Nhập tên domain mới: ')).trim();
      if (customDom) domain = slugify(customDom);
    }

    // 5. Số AC
    const ansAcs = (await ask('5. Số lượng Acceptance Criteria (AC) [Mặc định: 2]: ')).trim();
    const acCount = parseInt(ansAcs, 10) || 2;

    // 6. Preview & Confirm
    output.write('\n📋 Xem trước các file sẽ được sinh:\n');
    output.write(`   + ${config.requirementsDir || 'requirements'}/${reqId}-${slug}.md\n`);
    output.write(`   + ${config.testCasesDir || 'test-cases'}/${reqId}-${slug}.md\n`);
    output.write(`   + ${config.projectDir || 'playwright'}/tests/${domain}/${slug}.spec.ts\n\n`);

    const confirm = (await ask('👉 Bạn có muốn tạo các file này? (Y/n): ')).trim().toLowerCase();
    if (confirm !== '' && confirm !== 'y' && confirm !== 'yes') {
      output.write('\n❌ Đã hủy thao tác scaffold.\n\n');
      if (rl) rl.close();
      return null;
    }

    if (rl) rl.close();

    const res = generateScaffold({
      root,
      reqId,
      slug,
      title,
      acCount,
      domain,
      force: false,
    });

    output.write(`\n✅ Đã khởi tạo thành công bộ truy vết cho ${reqId}:\n`);
    res.created.forEach((f) => output.write(`   + ${f}\n`));
    output.write('\n💡 Lưu ý: File spec được sinh với test.fixme và tag @wip, test case ở trạng thái Candidate (P2).\n');
    output.write('   qa:gaps/drift có thể báo "minor" (bình thường đối với file nháp vừa sinh).\n\n');

    return res;
  } catch (err) {
    if (rl) rl.close();
    throw err;
  }
}

function findDuplicateReqId(reqDir, reqId, ignoreFilePath = null) {
  if (!fs.existsSync(reqDir)) return null;
  const files = fs.readdirSync(reqDir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');
  const normalizedIgnore = ignoreFilePath ? path.resolve(ignoreFilePath) : null;

  for (const file of files) {
    const fullPath = path.resolve(reqDir, file);
    if (normalizedIgnore && fullPath === normalizedIgnore) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^id:\s*([A-Za-z0-9_-]+)/m);
      if (match && match[1].trim().toUpperCase() === reqId.toUpperCase()) {
        return path.relative(path.resolve(reqDir, '..'), fullPath).replace(/\\/g, '/');
      }
    } catch {
      // Bỏ qua lỗi đọc file đơn lẻ
    }
  }
  return null;
}

function generateRequirementContent({ reqId, title, slug, acCount, isInferred = false, acList = null }) {
  const acBlocks = [];
  const ruleRows = [];
  const evidenceRows = [];

  const items = acList || Array.from({ length: acCount }, (_, i) => ({
    acId: `AC-${String(i + 1).padStart(3, '0')}`,
    num: i + 1,
  }));

  items.forEach((item, idx) => {
    const acId = item.acId;
    const num = item.num || (idx + 1);
    const tcNum = String(num).padStart(3, '0');

    if (isInferred) {
      acBlocks.push(
        `### ${acId}: Tiêu chí chấp nhận ${num} của ${title}\n\n` +
        `**Given** tiền điều kiện hệ thống ban đầu (suy luận từ spec)\n` +
        `**When** người dùng thực hiện thao tác kiểm thử\n` +
        `**Then** hệ thống xử lý chính xác và trả về kết quả mong đợi\n`
      );
      evidenceRows.push(`| Tiêu chí ${acId} của ${title} | Suy luận từ automation spec | Low | Needs confirmation |`);
    } else {
      acBlocks.push(
        `### ${acId}: Tiêu chí chấp nhận ${num} của ${title}\n\n` +
        `**Given** tiền điều kiện hệ thống ban đầu\n` +
        `**When** người dùng thực hiện thao tác kiểm thử\n` +
        `**Then** hệ thống xử lý chính xác và trả về kết quả mong đợi\n`
      );
    }
    ruleRows.push(`| Rule ${num} | Giá trị hợp lệ | Giá trị không hợp lệ | Biên | Xử lý đúng | TC-${tcNum} |`);
  });

  const sourceDesc = isInferred ? 'Inferred from automation' : 'Product requirement';
  const defaultEvidence = `| Quy tắc chính của ${title} | Tài liệu phân tích nghiệp vụ | High | Confirmed |`;

  return `---
id: ${reqId}
title: ${title}
status: Draft
version: 1.0
risk: Medium
owner: QA Team
slug: ${slug}
test_cases: test-cases/${reqId}-${slug}.md
---

# ${reqId}: ${title}

- Status: Draft
- Owner: QA Team
- Version: 1.0
- Risk: Medium
- Related pages/modules: \`/${slug}\`
- Source: ${sourceDesc}

## Business goal

Mô tả mục tiêu nghiệp vụ của tính năng ${title}.

## Acceptance criteria

${acBlocks.join('\n')}
## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
${ruleRows.join('\n')}

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
${isInferred ? evidenceRows.join('\n') : defaultEvidence}

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | ${new Date().toISOString().slice(0, 10)} | Khởi tạo tài liệu từ scaffold | - | - |
`;
}

function generateTestCaseContent({ reqId, title, slug, acCount, specRelPath, links = null }) {
  const traceRows = [];
  const tcBlocks = [];

  if (links && links.length > 0) {
    links.forEach((link) => {
      traceRows.push(`| ${reqId} | ${link.acId} | ${link.tcId} | Candidate | \`${specRelPath}\` | P2 |`);
      tcBlocks.push(
        `### ${link.tcId}: Kiểm thử ${link.acId} cho ${title}\n\n` +
        `- Type: Functional | Priority: P2 | Technique: Equivalence Partitioning\n` +
        `- Automation: Candidate | Tags: \`@wip @p2\`\n` +
        `- Preconditions: Môi trường sẵn sàng\n\n` +
        `| Step | Action | Expected result |\n` +
        `|---|---|---|\n` +
        `| 1 | Truy cập màn hình tính năng | Trang hiển thị đầy đủ |\n` +
        `| 2 | Thực hiện thao tác: ${link.title || 'kiểm thử'} | Phản hồi đúng theo ${link.acId} |\n`
      );
    });
  } else {
    for (let i = 1; i <= acCount; i++) {
      const acNum = String(i).padStart(3, '0');
      const tcNum = String(i).padStart(3, '0');
      traceRows.push(`| ${reqId} | AC-${acNum} | TC-${tcNum} | Candidate | \`${specRelPath}\` | P2 |`);

      tcBlocks.push(
        `### TC-${tcNum}: Kiểm thử AC-${acNum} cho ${title}\n\n` +
        `- Type: Functional | Priority: P2 | Technique: Equivalence Partitioning\n` +
        `- Automation: Candidate | Tags: \`@wip @p2\`\n` +
        `- Preconditions: Môi trường sẵn sàng\n\n` +
        `| Step | Action | Expected result |\n` +
        `|---|---|---|\n` +
        `| 1 | Truy cập màn hình tính năng | Trang hiển thị đầy đủ |\n` +
        `| 2 | Thực hiện thao tác kiểm thử | Phản hồi đúng theo AC-${acNum} |\n`
      );
    }
  }

  return `# Test Cases: ${reqId} ${title}

Requirement: \`requirements/${reqId}-${slug}.md\` (v1.0)

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
${traceRows.join('\n')}

> Lưu ý: Cập nhật Priority thật (P0/P1) và chuyển Automation thành Yes khi hoàn thiện test.

## Case không automation

| Test case | Lý do | Cách bù đắp |
|---|---|---|

## Test cases

${tcBlocks.join('\n')}
`;
}

function generateSpecContent({ reqId, title, slug, acCount, specDomain }) {
  const tests = [];
  const fixtureImport = '../fixtures/test-fixtures';
  const cleanSlug = slug || slugify(title);

  for (let i = 1; i <= acCount; i++) {
    const acNum = String(i).padStart(3, '0');
    const tcNum = String(i).padStart(3, '0');
    tests.push(
      `  test.fixme(\n` +
      `    'TC-${tcNum} - AC-${acNum} verify ${slugify(title)} scenario ${i}',\n` +
      `    { tag: ['@wip', '@p2'] },\n` +
      `    async ({ page }) => {\n` +
      `      await test.step('Bước 1: Điều hướng tới trang', async () => {\n` +
      `        // await page.goto('/...');\n` +
      `        expect(page).toBeDefined();\n` +
      `      });\n\n` +
      `      await test.step('Bước 2: Kiểm tra kết quả mong đợi', async () => {\n` +
      `        expect(false, 'TODO: viết assertion cho AC-${acNum}').toBe(true);\n` +
      `      });\n` +
      `    },\n` +
      `  );`
    );
  }

  return `import { test, expect } from '${fixtureImport}';

/**
 * ${reqId} - ${title}
 * Requirement : requirements/${reqId}-${cleanSlug}.md
 */
test.describe('${reqId} - ${title}', { tag: '@${reqId}' }, () => {
${tests.join('\n\n')}
});
`;
}

function generateScaffold({ root, reqId, slug, title, acCount, domain, force, inputPathsToCheck = [] }) {
  if (!reqId || !/^REQ-\d{3}$/.test(reqId)) {
    throw new Error(`Mã requirement không hợp lệ: "${reqId}" (yêu cầu dạng REQ-001)`);
  }
  const cleanTitle = title || `Feature ${reqId}`;
  const cleanSlug = slug || slugify(cleanTitle);
  const cleanDomain = domain || cleanSlug.split('-')[0] || 'general';
  const cleanAcs = Math.max(1, parseInt(acCount, 10) || 1);

  const config = loadConfig(root);
  const reqDir = path.resolve(root, config.requirementsDir);
  const tcDir = path.resolve(root, config.testCasesDir);
  const projectDir = path.resolve(root, config.projectDir);

  const reqFile = path.resolve(reqDir, `${reqId}-${cleanSlug}.md`);
  const tcFile = path.resolve(tcDir, `${reqId}-${cleanSlug}.md`);
  const specRel = path.posix.join('tests', cleanDomain, `${cleanSlug}.spec.ts`);
  const specFile = path.resolve(projectDir, specRel);

  const targets = [reqFile, tcFile, specFile];

  // Invariant 1: Targets must not collide with each other
  const uniqueTargets = new Set(targets);
  if (uniqueTargets.size !== targets.length) {
    throw new Error('Đường dẫn ghi bị trùng lặp giữa các file đích.');
  }

  // Invariant 2: Targets must not overwrite any input path
  for (const inputPath of inputPathsToCheck) {
    const absInput = path.resolve(inputPath);
    if (targets.includes(absInput)) {
      throw new Error(`Đường dẫn ghi trùng với đường dẫn nguồn đầu vào: "${absInput}"`);
    }
  }

  // Invariant 3: No duplicate requirement ID in existing requirements
  const existingReq = findDuplicateReqId(reqDir, reqId, reqFile);
  if (existingReq) {
    throw new Error(`Mã requirement "${reqId}" đã tồn tại trong "${existingReq}". Mỗi requirement phải có mã duy nhất.`);
  }

  if (!force) {
    const existing = targets.filter((f) => fs.existsSync(f));
    if (existing.length > 0) {
      throw new Error(
        `File đã tồn tại (dùng --force để ghi đè):\n  ${existing.map((f) => path.relative(root, f)).join('\n  ')}`
      );
    }
  }

  fs.mkdirSync(path.dirname(reqFile), { recursive: true });
  fs.mkdirSync(path.dirname(tcFile), { recursive: true });
  fs.mkdirSync(path.dirname(specFile), { recursive: true });

  const reqContent = generateRequirementContent({ reqId, title: cleanTitle, slug: cleanSlug, acCount: cleanAcs });
  const tcContent = generateTestCaseContent({
    reqId,
    title: cleanTitle,
    slug: cleanSlug,
    acCount: cleanAcs,
    specRelPath: path.relative(root, specFile).replace(/\\/g, '/'),
  });
  const specContent = generateSpecContent({
    reqId,
    title: cleanTitle,
    slug: cleanSlug,
    acCount: cleanAcs,
    specDomain: cleanDomain,
  });

  fs.writeFileSync(reqFile, reqContent, 'utf8');
  fs.writeFileSync(tcFile, tcContent, 'utf8');
  fs.writeFileSync(specFile, specContent, 'utf8');

  return {
    ok: true,
    created: [
      path.relative(root, reqFile).replace(/\\/g, '/'),
      path.relative(root, tcFile).replace(/\\/g, '/'),
      path.relative(root, specFile).replace(/\\/g, '/'),
    ],
  };
}

function inferFromSpec({ root, specFile, force }) {
  const absSpec = path.isAbsolute(specFile) ? path.resolve(specFile) : path.resolve(root, specFile);
  if (!fs.existsSync(absSpec)) {
    throw new Error(`Không tìm thấy file spec: "${specFile}"`);
  }
  const content = fs.readFileSync(absSpec, 'utf8');
  const tagMatch = content.match(/tag:\s*['"]?@(REQ-\d{3})['"]?/i);
  const reqId = tagMatch ? tagMatch[1].toUpperCase() : 'REQ-999';

  const titleMatch = content.match(/test\.describe\(\s*['"]([^'"]+)['"]/);
  const describeTitle = titleMatch ? titleMatch[1].replace(/^REQ-\d{3}\s*[-–:]\s*/i, '').trim() : 'Inferred Feature';

  const baseName = path.basename(specFile).replace(/\.spec\.[jt]sx?$/, '');
  const slug = slugify(baseName);

  // Parse genuine TC - AC pairings preserving order and jump numbers
  const tcMatches = [...content.matchAll(/test(?:\.(?:skip|fixme))?\(\s*['"]\s*(TC-\d{3})\s*[-–:]\s*(AC-\d{3})\s*(?:[-–:]\s*)?([^'"]*)['"]/g)];
  if (tcMatches.length === 0) {
    throw new Error(`Không tìm thấy cặp (TC-xxx - AC-xxx) nào trong spec "${specFile}". Không thể suy luận traceability.`);
  }

  const links = tcMatches.map((m) => ({
    tcId: m[1].toUpperCase(),
    acId: m[2].toUpperCase(),
    title: m[3].trim(),
  }));

  const uniqueAcIds = [...new Set(links.map((l) => l.acId))].sort();

  const config = loadConfig(root);
  const reqDir = path.resolve(root, config.requirementsDir);
  const tcDir = path.resolve(root, config.testCasesDir);

  const reqFile = path.resolve(reqDir, `${reqId}-${slug}.md`);
  const tcFile = path.resolve(tcDir, `${reqId}-${slug}.md`);

  // Invariant: Do not overwrite source spec
  if (reqFile === absSpec || tcFile === absSpec) {
    throw new Error(`Đích ghi trùng đường dẫn đọc: "${absSpec}"`);
  }

  // Guard against duplicate REQ id
  const existingReq = findDuplicateReqId(reqDir, reqId, reqFile);
  if (existingReq) {
    throw new Error(`Mã requirement "${reqId}" đã tồn tại trong "${existingReq}". Mỗi requirement phải có mã duy nhất.`);
  }

  if (!force && (fs.existsSync(reqFile) || fs.existsSync(tcFile))) {
    const existing = [reqFile, tcFile].filter((f) => fs.existsSync(f));
    throw new Error(
      `File nháp đã tồn tại cho ${reqId} (dùng --force để ghi đè):\n  ${existing.map((f) => path.relative(root, f)).join('\n  ')}`
    );
  }

  fs.mkdirSync(path.dirname(reqFile), { recursive: true });
  fs.mkdirSync(path.dirname(tcFile), { recursive: true });

  const specRelPath = path.relative(root, absSpec).replace(/\\/g, '/');

  const reqContent = generateRequirementContent({
    reqId,
    title: describeTitle,
    slug,
    acCount: uniqueAcIds.length,
    isInferred: true,
    acList: uniqueAcIds.map((acId, idx) => ({ acId, num: idx + 1 })),
  });

  const tcContent = generateTestCaseContent({
    reqId,
    title: describeTitle,
    slug,
    acCount: uniqueAcIds.length,
    specRelPath,
    links,
  });

  fs.writeFileSync(reqFile, reqContent, 'utf8');
  fs.writeFileSync(tcFile, tcContent, 'utf8');

  return {
    ok: true,
    inferredFrom: specFile,
    created: [
      path.relative(root, reqFile).replace(/\\/g, '/'),
      path.relative(root, tcFile).replace(/\\/g, '/'),
    ],
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, '..', '..');
  const config = loadConfig(root);

  try {
    if (flags.wizard || (!flags.req && !flags.infer && process.stdin.isTTY)) {
      await runWizard({ root, config });
      return;
    }

    if (flags.infer) {
      const res = inferFromSpec({ root, specFile: flags.infer, force: flags.force });
      if (flags.json) console.log(JSON.stringify(res, null, 2));
      else {
        console.log(`\n✅ Đã bóc tách ngược từ spec "${flags.infer}":`);
        res.created.forEach((f) => console.log(`   + ${f}`));
        console.log('\n💡 Lưu ý: File sinh ra là nháp suy luận (Candidate, Low confidence).');
        console.log('   qa:gaps/drift có thể hiển thị các thông tin liên quan.');
        console.log('   Các bước tiếp theo:');
        console.log('   1. Rà soát lại Acceptance criteria và Evidence trong requirement.');
        console.log('   2. Kiểm tra lại độ ưu tiên Priority và chuyển Automation sang Yes trong test-cases.');
        console.log('   3. Chạy npm run qa:check để kiểm chứng.\n');
      }
      return;
    }

    if (!flags.req) {
      console.log('Cách dùng:');
      console.log('  node tools/scaffold --wizard                                        (Giao diện hỏi đáp tương tác)');
      console.log('  node tools/scaffold --req REQ-002 --title "Đăng ký tài khoản" --acs 3');
      console.log('  node tools/scaffold --infer playwright/tests/auth/login.spec.ts');
      console.log('');
      console.log('Tùy chọn:');
      console.log('  --wizard, -w      Chạy chế độ Wizard hỏi đáp từng bước');
      console.log('  --req=REQ-xxx     Mã requirement (bắt buộc)');
      console.log('  --title="..."     Tên tính năng');
      console.log('  --slug=...        Slug đường dẫn (mặc định suy từ title)');
      console.log('  --acs=N           Số lượng Acceptance Criteria (mặc định: 2)');
      console.log('  --domain=...      Tên thư mục con trong playwright/tests/ (mặc định: theo slug)');
      console.log('  --infer=spec_path Bóc tách ngược từ test script có sẵn');
      console.log('  --force           Ghi đè nếu file đã tồn tại');
      console.log('  --json            In kết quả JSON');
      process.exitCode = 1;
      return;
    }

    const res = generateScaffold({
      root,
      reqId: flags.req,
      slug: flags.slug,
      title: flags.title,
      acCount: flags.acs,
      domain: flags.domain,
      force: flags.force,
    });

    if (flags.json) console.log(JSON.stringify(res, null, 2));
    else {
      console.log(`\n✅ Đã khởi tạo thành công bộ truy vết cho ${flags.req}:`);
      res.created.forEach((f) => console.log(`   + ${f}`));
      console.log('\n💡 Lưu ý: File spec được sinh với test.fixme và tag @wip, test case ở trạng thái Candidate (P2).');
      console.log('   qa:gaps/drift có thể báo "minor" (bình thường đối với file nháp vừa sinh).');
      console.log('   Các bước tiếp theo:');
      console.log('   1. Hoàn thiện nội dung nghiệp vụ trong file requirement.');
      console.log('   2. Viết logic kiểm thử thật trong spec, bỏ test.fixme và tag @wip.');
      console.log('   3. Cập nhật Priority và chuyển Automation sang Yes trong test-cases, rồi chạy npm run qa:check.\n');
    }
  } catch (err) {
    console.error(`\n❌ Lỗi: ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ Lỗi: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  slugify,
  parseArgs,
  findDuplicateReqId,
  suggestNextReqId,
  listExistingDomains,
  runWizard,
  generateScaffold,
  inferFromSpec,
  generateRequirementContent,
  generateTestCaseContent,
  generateSpecContent,
};
