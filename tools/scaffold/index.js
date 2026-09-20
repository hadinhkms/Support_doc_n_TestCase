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
    else if (arg.startsWith('--infer=')) flags.infer = arg.slice(8);
    else if (arg === '--infer' && argv[i + 1]) flags.infer = argv[++i];
  }
  return flags;
}

function generateRequirementContent({ reqId, title, slug, acCount }) {
  const acBlocks = [];
  const ruleRows = [];

  for (let i = 1; i <= acCount; i++) {
    const acNum = String(i).padStart(3, '0');
    acBlocks.push(
      `### AC-${acNum}: Tiêu chí chấp nhận ${i} của ${title}\n\n` +
      `**Given** tiền điều kiện hệ thống ban đầu\n` +
      `**When** người dùng thực hiện thao tác kiểm thử\n` +
      `**Then** hệ thống xử lý chính xác và trả về kết quả mong đợi\n`
    );
    const tcNum = String(i).padStart(3, '0');
    ruleRows.push(`| Rule ${i} | Giá trị hợp lệ | Giá trị không hợp lệ | Biên | Xử lý đúng | TC-${tcNum} |`);
  }

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
- Source: Product requirement

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
| Quy tắc chính của ${title} | Tài liệu phân tích nghiệp vụ | High | Confirmed |

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | ${new Date().toISOString().slice(0, 10)} | Khởi tạo tài liệu từ scaffold | - | - |
`;
}

function generateTestCaseContent({ reqId, title, slug, acCount, specRelPath }) {
  const traceRows = [];
  const tcBlocks = [];

  for (let i = 1; i <= acCount; i++) {
    const acNum = String(i).padStart(3, '0');
    const tcNum = String(i).padStart(3, '0');
    const prio = i === 1 ? 'P0' : 'P1';
    traceRows.push(`| ${reqId} | AC-${acNum} | TC-${tcNum} | Yes | \`${specRelPath}\` | ${prio} |`);

    tcBlocks.push(
      `### TC-${tcNum}: Kiểm thử AC-${acNum} cho ${title}\n\n` +
      `- Type: Functional | Priority: ${prio} | Technique: Equivalence Partitioning\n` +
      `- Automation: Yes | Tags: \`@smoke @${prio.toLowerCase()}\`\n` +
      `- Preconditions: Môi trường sẵn sàng\n\n` +
      `| Step | Action | Expected result |\n` +
      `|---|---|---|\n` +
      `| 1 | Truy cập màn hình tính năng | Trang hiển thị đầy đủ |\n` +
      `| 2 | Thực hiện thao tác kiểm thử | Phản hồi đúng theo AC-${acNum} |\n`
    );
  }

  return `# Test Cases: ${reqId} ${title}

Requirement: \`requirements/${reqId}-${slug}.md\` (v1.0)

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
${traceRows.join('\n')}

## Case không automation

| Test case | Lý do | Cách bù đắp |
|---|---|---|

## Test cases

${tcBlocks.join('\n')}
`;
}

function generateSpecContent({ reqId, title, acCount, specDomain }) {
  const tests = [];
  const fixtureImport = '../fixtures/test-fixtures';

  for (let i = 1; i <= acCount; i++) {
    const acNum = String(i).padStart(3, '0');
    const tcNum = String(i).padStart(3, '0');
    const prio = i === 1 ? 'p0' : 'p1';
    tests.push(
      `  test(\n` +
      `    'TC-${tcNum} - AC-${acNum} verify ${slugify(title)} scenario ${i}',\n` +
      `    { tag: ['@${prio}'] },\n` +
      `    async ({ page }) => {\n` +
      `      await test.step('Bước 1: Điều hướng tới trang', async () => {\n` +
      `        // await page.goto('/...');\n` +
      `        expect(page).toBeDefined();\n` +
      `      });\n\n` +
      `      await test.step('Bước 2: Kiểm tra kết quả mong đợi', async () => {\n` +
      `        expect(true, 'khẳng định trạng thái tính năng đúng theo AC-${acNum}').toBe(true);\n` +
      `      });\n` +
      `    },\n` +
      `  );`
    );
  }

  return `import { test, expect } from '${fixtureImport}';

/**
 * ${reqId} - ${title}
 * Requirement : requirements/${reqId}.md
 */
test.describe('${reqId} - ${title}', { tag: '@${reqId}' }, () => {
${tests.join('\n\n')}
});
`;
}

function generateScaffold({ root, reqId, slug, title, acCount, domain, force }) {
  if (!reqId || !/^REQ-\d{3}$/.test(reqId)) {
    throw new Error(`Mã requirement không hợp lệ: "${reqId}" (yêu cầu dạng REQ-001)`);
  }
  const cleanTitle = title || `Feature ${reqId}`;
  const cleanSlug = slug || slugify(cleanTitle);
  const cleanDomain = domain || cleanSlug.split('-')[0] || 'general';
  const cleanAcs = Math.max(1, parseInt(acCount, 10) || 1);

  const reqFile = path.join(root, 'requirements', `${reqId}-${cleanSlug}.md`);
  const tcFile = path.join(root, 'test-cases', `${reqId}-${cleanSlug}.md`);
  const specRel = `tests/${cleanDomain}/${cleanSlug}.spec.ts`;
  const specFile = path.join(root, 'playwright', specRel);

  const filesToCheck = [reqFile, tcFile, specFile];
  if (!force) {
    const existing = filesToCheck.filter((f) => fs.existsSync(f));
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
    specRelPath: specRel,
  });
  const specContent = generateSpecContent({
    reqId,
    title: cleanTitle,
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
  const absSpec = path.isAbsolute(specFile) ? specFile : path.join(root, specFile);
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

  const tcMatches = [...content.matchAll(/test\(\s*['"](TC-\d{3})\s*-\s*(AC-\d{3})\s*([^'"]*)['"]/g)];
  const acCount = Math.max(1, tcMatches.length);

  const reqFile = path.join(root, 'requirements', `${reqId}-${slug}.md`);
  const tcFile = path.join(root, 'test-cases', `${reqId}-${slug}.md`);
  const relSpec = path.relative(path.join(root, 'playwright'), absSpec).replace(/\\/g, '/');

  if (!force && (fs.existsSync(reqFile) || fs.existsSync(tcFile))) {
    throw new Error(`File nháp đã tồn tại cho ${reqId} (dùng --force để ghi đè).`);
  }

  const result = generateScaffold({
    root,
    reqId,
    slug,
    title: describeTitle,
    acCount,
    domain: path.basename(path.dirname(absSpec)),
    force: true,
  });

  return {
    ok: true,
    inferredFrom: specFile,
    created: result.created,
  };
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, '..', '..');

  try {
    if (flags.infer) {
      const res = inferFromSpec({ root, specFile: flags.infer, force: flags.force });
      if (flags.json) console.log(JSON.stringify(res, null, 2));
      else {
        console.log(`\n✅ Đã bóc tách ngược từ spec "${flags.infer}":`);
        res.created.forEach((f) => console.log(`   + ${f}`));
        console.log('');
      }
      return;
    }

    if (!flags.req) {
      console.log('Cách dùng:');
      console.log('  node tools/scaffold --req REQ-002 --title "Đăng ký tài khoản" --acs 3');
      console.log('  node tools/scaffold --infer playwright/tests/auth/login.spec.ts');
      console.log('');
      console.log('Tùy chọn:');
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
      console.log('\n💡 Bạn có thể chạy: npm run qa:coverage để kiểm tra độ phủ.');
      console.log('');
    }
  } catch (err) {
    console.error(`\n❌ Lỗi: ${err.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  slugify,
  generateScaffold,
  inferFromSpec,
  generateRequirementContent,
  generateTestCaseContent,
  generateSpecContent,
};
