'use strict';
/**
 * Bốn phép join trên dữ liệu đã chuẩn hoá:
 *   coverage - bức tranh tổng
 *   gaps     - NÊN THÊM script nào
 *   impact   - requirement đổi thì PHẢI SỬA script nào
 *   drift    - traceability đã mục ở đâu
 */

const { loadRequirements, loadTestCases, loadAutomatedTests } = require('./sources');

/** Đường dẫn hiển thị của một test, đã được sources.js tính sẵn từ gốc repo. */
function specPath(options, t) {
  return `${t.path || t.file}:${t.line}`;
}

function collect(root, options) {
  const requirements = loadRequirements(root);
  const testCases = loadTestCases(root);
  const automated = loadAutomatedTests(root, options);
  return { requirements, testCases, automated };
}

/** Sinh danh sách case tối thiểu mà một dòng rule đòi hỏi (EP + BVA). */
function expectedCasesFromRule(rule) {
  const wanted = [];
  if (rule.valid && rule.valid !== '-') wanted.push(`${rule.field}: lớp hợp lệ`);
  if (rule.invalid && rule.invalid !== '-') wanted.push(`${rule.field}: lớp không hợp lệ`);
  if (rule.boundary && rule.boundary !== '-') wanted.push(`${rule.field}: giá trị biên (${rule.boundary})`);
  return wanted;
}

function coverage(root, options) {
  const { requirements, testCases, automated } = collect(root, options);
  const byAc = new Map();
  for (const link of testCases.links) {
    const key = `${link.reqId}/${link.acId}`;
    if (!byAc.has(key)) byAc.set(key, []);
    byAc.get(key).push(link);
  }
  const automatedTcIds = new Set(automated.tests.map((t) => t.tcId).filter(Boolean));

  const rows = [];
  for (const req of requirements) {
    if (!req.id) continue;
    for (const ac of req.acs) {
      const links = byAc.get(`${req.id}/${ac.id}`) || [];
      const tcs = links.map((l) => l.tcId);
      const done = tcs.filter((tc) => automatedTcIds.has(tc));
      rows.push({
        reqId: req.id,
        status: req.status,
        acId: ac.id,
        acTitle: ac.title,
        testCases: tcs,
        automated: done,
        manualOnly: links.filter((l) => l.automation === 'No').map((l) => l.tcId),
        candidates: links.filter((l) => l.automation === 'Candidate').map((l) => l.tcId),
      });
    }
  }
  return {
    requirements: requirements.filter((r) => r.id).length,
    acceptanceCriteria: rows.length,
    testCases: testCases.links.length,
    automatedTests: automated.tests.length,
    playwrightError: automated.error,
    rows,
  };
}

function gaps(root, options) {
  const { requirements, testCases, automated } = collect(root, options);
  const automatedTcIds = new Set(automated.tests.map((t) => t.tcId).filter(Boolean));
  const linksByAc = new Map();
  const linksByTc = new Map();
  for (const link of testCases.links) {
    const k = `${link.reqId}/${link.acId}`;
    if (!linksByAc.has(k)) linksByAc.set(k, []);
    linksByAc.get(k).push(link);
    linksByTc.set(link.tcId, link);
  }

  const findings = [];

  for (const req of requirements) {
    if (!req.id) {
      findings.push({
        severity: 'blocker',
        kind: 'requirement-khong-co-front-matter',
        where: req.file,
        message: 'Requirement thiếu front-matter (id/status/...). Tool không đọc được.',
        action: 'Thêm front-matter theo templates/requirement-template.md',
      });
      continue;
    }

    for (const ac of req.acs) {
      const links = linksByAc.get(`${req.id}/${ac.id}`) || [];
      if (links.length === 0) {
        findings.push({
          severity: 'blocker',
          kind: 'ac-khong-co-test-case',
          where: `${req.file}:${ac.line}`,
          message: `${req.id}/${ac.id} "${ac.title}" chưa có test case nào.`,
          action: `Thêm TC vào ${req.testCaseFile || 'test-cases/'} rồi cân nhắc automation.`,
        });
        continue;
      }
      const hasAutomated = links.some((l) => automatedTcIds.has(l.tcId));
      const allManual = links.every((l) => l.automation === 'No');
      if (!hasAutomated && !allManual) {
        findings.push({
          severity: 'major',
          kind: 'ac-chua-co-script',
          where: `${req.file}:${ac.line}`,
          message: `${req.id}/${ac.id} có test case (${links.map((l) => l.tcId).join(', ')}) nhưng chưa test nào được automation.`,
          action: 'Viết script cho TC có điểm cao nhất trong automation plan.',
        });
      }
    }

    // Bảng rule/validation: đối chiếu theo cột `Test cases` (dữ liệu), không đoán
    // theo từ khoá trong title - title tiếng Việt vs tên field tiếng Anh sẽ luôn lệch.
    const knownTcIds = new Set(testCases.links.map((l) => l.tcId));
    for (const rule of req.rules) {
      if (/^<.*>$/.test(rule.field) || !rule.field) continue;
      if (rule.testCases.length === 0) {
        findings.push({
          severity: 'major',
          kind: 'rule-chua-map-toi-test-case',
          where: req.file,
          message: `Dòng rule "${rule.field}" của ${req.id} để trống cột Test cases.`,
          action: `Cần tối thiểu: ${expectedCasesFromRule(rule).join('; ')}`,
        });
        continue;
      }
      const unknown = rule.testCases.filter((tc) => !knownTcIds.has(tc));
      if (unknown.length > 0) {
        findings.push({
          severity: 'blocker',
          kind: 'rule-tro-toi-tc-khong-ton-tai',
          where: req.file,
          message: `Dòng rule "${rule.field}" trỏ tới ${unknown.join(', ')} nhưng TC đó không có trong test-cases/.`,
          action: 'Sửa mã TC hoặc bổ sung test case.',
        });
      }
    }
  }

  // TC khai Yes nhưng không tìm thấy script -> traceability nói dối.
  for (const link of testCases.links) {
    if (link.automation === 'Yes' && !automatedTcIds.has(link.tcId)) {
      findings.push({
        severity: 'blocker',
        kind: 'khai-automation-nhung-khong-co-script',
        where: link.file,
        message: `${link.tcId} khai Automation=Yes nhưng không có test nào mang mã đó.`,
        action: `Viết script, hoặc sửa cột Automation về Candidate/No kèm lý do.`,
      });
    }
    if (link.automation === 'No' && !testCases.noAutomationReasons.has(link.tcId)) {
      findings.push({
        severity: 'major',
        kind: 'khong-automation-nhung-khong-co-ly-do',
        where: link.file,
        message: `${link.tcId} là Automation=No nhưng không có dòng lý do ở mục "Case không automation".`,
        action: 'Ghi lý do và cách bù đắp, nếu không sẽ thành nợ ẩn.',
      });
    }
    if (link.automation === 'Candidate' && /^P[01]$/.test(link.priority)) {
      findings.push({
        severity: 'major',
        kind: 'p0-p1-con-dang-candidate',
        where: link.file,
        message: `${link.tcId} là ${link.priority} nhưng vẫn ở trạng thái Candidate.`,
        action: 'P0/P1 nên được automation, hoặc hạ priority kèm giải thích.',
      });
    }
  }

  if (automated.error) {
    findings.push({
      severity: 'blocker',
      kind: 'khong-doc-duoc-playwright',
      where: (options && options.projectDir) || 'playwright',
      message: automated.error,
      action: `Chạy npm install trong ${(options && options.projectDir) || 'playwright'} rồi thử lại.`,
    });
  }
  return findings;
}

function impact(root, reqId, options) {
  const { requirements, testCases, automated } = collect(root, options);
  const req = requirements.find((r) => r.id === reqId);
  if (!req) return { error: `Không tìm thấy ${reqId} trong requirements/` };

  const testsByTc = new Map();
  for (const t of automated.tests) if (t.tcId) {
    if (!testsByTc.has(t.tcId)) testsByTc.set(t.tcId, []);
    testsByTc.get(t.tcId).push(t);
  }

  const acs = req.acs.map((ac) => {
    const links = testCases.links.filter((l) => l.reqId === reqId && l.acId === ac.id);
    return {
      acId: ac.id,
      title: ac.title,
      testCases: links.map((l) => ({
        tcId: l.tcId,
        automation: l.automation,
        priority: l.priority,
        specs: (testsByTc.get(l.tcId) || []).map((t) => specPath(options, t)),
      })),
    };
  });

  const files = new Set();
  for (const ac of acs) for (const tc of ac.testCases) for (const s of tc.specs) files.add(s);

  return {
    requirement: { id: req.id, title: req.title, status: req.status, version: req.version, file: req.file },
    acs,
    filesToReview: [req.file, req.testCaseFile, ...files].filter(Boolean),
  };
}

function drift(root, options) {
  const { requirements, testCases, automated } = collect(root, options);
  const knownReq = new Set(requirements.map((r) => r.id).filter(Boolean));
  const knownAc = new Set();
  for (const r of requirements) for (const ac of r.acs) knownAc.add(`${r.id}/${ac.id}`);
  const knownTc = new Set(testCases.links.map((l) => l.tcId));
  const findings = [];

  for (const t of automated.tests) {
    // File *.setup.ts là hạ tầng đăng nhập/seed, không phải test case -> không đòi mã TC.
    if (/\.setup\.[jt]s$/.test(t.file)) continue;
    if (!t.tcId) {
      findings.push({
        severity: 'major',
        kind: 'test-khong-co-ma-tc',
        where: specPath(options, t),
        message: `Test "${t.title}" không mở đầu bằng TC-xxx, không trace được.`,
      });
      continue;
    }
    if (!t.reqId) {
      findings.push({
        severity: 'major',
        kind: 'test-thieu-tag-req',
        where: specPath(options, t),
        message: `${t.tcId} thiếu tag @REQ-xxx ở describe.`,
      });
    } else if (!knownReq.has(t.reqId)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-tro-toi-req-khong-ton-tai',
        where: specPath(options, t),
        message: `${t.tcId} gắn tag ${t.reqId} nhưng requirement đó không tồn tại.`,
      });
    }
    if (t.acId && t.reqId && !knownAc.has(`${t.reqId}/${t.acId}`)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-tro-toi-ac-khong-ton-tai',
        where: specPath(options, t),
        message: `${t.tcId} trỏ tới ${t.reqId}/${t.acId} nhưng AC đó không còn trong requirement.`,
      });
    }
    if (!knownTc.has(t.tcId)) {
      findings.push({
        severity: 'major',
        kind: 'script-khong-co-trong-test-case',
        where: specPath(options, t),
        message: `${t.tcId} có script nhưng không có trong bảng traceability của test-cases/.`,
      });
    }
  }

  for (const req of requirements) {
    if (!req.id) continue;
    const hasTests = automated.tests.some((t) => t.reqId === req.id);
    if (hasTests && /^draft$/i.test(req.status)) {
      findings.push({
        severity: 'major',
        kind: 'requirement-draft-nhung-da-co-script',
        where: req.file,
        message: `${req.id} đang Draft nhưng đã có script trỏ vào. Script có thể đang test hành vi chưa chốt.`,
      });
    }
    if (req.testCaseFile) {
      const abs = require('node:path').join(root, req.testCaseFile);
      if (!require('node:fs').existsSync(abs)) {
        findings.push({
          severity: 'blocker',
          kind: 'test-case-file-khong-ton-tai',
          where: req.file,
          message: `${req.id} trỏ tới ${req.testCaseFile} nhưng file không tồn tại.`,
        });
      }
    }
  }
  return findings;
}

module.exports = { coverage, gaps, impact, drift };
