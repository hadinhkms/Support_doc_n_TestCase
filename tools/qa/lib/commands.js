'use strict';
/**
 * Bốn phép join trên dữ liệu đã chuẩn hoá:
 *   coverage - bức tranh tổng
 *   gaps     - NÊN THÊM script nào
 *   impact   - requirement đổi thì PHẢI SỬA script nào
 *   drift    - traceability đã mục ở đâu
 *   matrix   - tự động sinh bảng ma trận truy vết
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadRequirements, loadTestCases, loadAutomatedTests } = require('./sources');

/**
 * Thang mức độ nghiêm trọng, khai MỘT lần cho cả bộ công cụ. Trước đây index.js giữ
 * một bản sao riêng, nên thêm một mức mới ở đây mà quên sửa bên kia sẽ khiến `--strict`
 * âm thầm xếp hạng khác với báo cáo in ra.
 */
const SEVERITY_RANK = { blocker: 3, major: 2, minor: 1 };

/** Đường dẫn hiển thị của một test, đã được sources.js tính sẵn từ gốc repo. */
function specPath(options, t) {
  return `${t.path || t.file}:${t.line}`;
}

/**
 * Chế độ hỏng nguy hiểm nhất: đọc được 0 spec thì MỌI kiểm tra đều xanh vì không có
 * gì để đối chiếu — trông y hệt một repo sạch. Chỉ im lặng khi repo thật sự chưa có
 * test case nào (đang dựng dở), còn đã khai test case mà không thấy spec là báo động.
 */
function emptySpecFinding(testCases, automated, options) {
  if (!automated.emptyResult || automated.error) return null;
  if (testCases.links.length === 0) return null;
  return {
    severity: 'blocker',
    kind: 'doc-duoc-0-spec',
    where: (options && options.projectDir) || 'playwright',
    message: automated.emptyMessage,
    action: 'Sửa projectDir/project trong qa.config.json, hoặc chạy --project-dir=<đường dẫn>.',
  };
}

/**
 * `loadAutomated` là khe cắm cho test: mặc định chạy `playwright --list` thật, nhưng
 * unit test truyền vào một hàm trả dữ liệu dựng sẵn để kiểm được phần join mà không
 * cần cài browser hay dựng app. Code chạy thật không bao giờ truyền tham số này.
 */
function collect(root, options) {
  const loadAutomated = (options && options.loadAutomated) || loadAutomatedTests;
  let requirements = loadRequirements(root, options);
  let testCases = loadTestCases(root, options);
  const automated = loadAutomated(root, options);
  // MỘT định nghĩa "test thật" cho cả bốn lệnh. Trước đây mỗi lệnh tự lọc một kiểu
  // nên coverage, gaps và impact bất đồng ý về việc file setup có phải test không.
  let realTests = (automated.tests || []).filter((t) => !t.isSetup);

  if (options && (options.filterReq || options.filterDomain || options.filterTag)) {
    if (options.filterReq) {
      const targetReq = options.filterReq.toUpperCase();
      requirements = requirements.filter((r) => r.id && r.id.toUpperCase() === targetReq);
      testCases = {
        ...testCases,
        links: testCases.links.filter((l) => l.reqId && l.reqId.toUpperCase() === targetReq),
      };
      realTests = realTests.filter((t) => {
        return (t.tags && t.tags.includes(`@${targetReq}`)) || (t.reqId && t.reqId.toUpperCase() === targetReq);
      });
    }
    if (options.filterDomain) {
      const dom = options.filterDomain.toLowerCase();
      realTests = realTests.filter((t) => {
        const p = (t.path || t.file || '').toLowerCase();
        return p.includes(`/${dom}/`) || p.startsWith(`${dom}/`);
      });
      const activeTcIds = new Set(realTests.map((t) => t.tcId).filter(Boolean));
      testCases = {
        ...testCases,
        links: testCases.links.filter((l) => {
          const sp = (l.spec || '').toLowerCase();
          return sp.includes(`/${dom}/`) || sp.startsWith(`${dom}/`) || activeTcIds.has(l.tcId);
        }),
      };
      const activeReqIds = new Set(testCases.links.map((l) => l.reqId).filter(Boolean));
      if (activeReqIds.size > 0) {
        requirements = requirements.filter((r) => activeReqIds.has(r.id));
      }
    }
    if (options.filterTag) {
      const rawTag = options.filterTag;
      const tag = rawTag.startsWith('@') ? rawTag : `@${rawTag}`;
      realTests = realTests.filter((t) => t.tags && t.tags.includes(tag));
      const activeTcIds = new Set(realTests.map((t) => t.tcId).filter(Boolean));
      testCases = {
        ...testCases,
        links: testCases.links.filter((l) => activeTcIds.has(l.tcId)),
      };
      const activeReqIds = new Set(testCases.links.map((l) => l.reqId).filter(Boolean));
      if (activeReqIds.size > 0) {
        requirements = requirements.filter((r) => activeReqIds.has(r.id));
      }
    }
  }

  return { requirements, testCases, automated, realTests };
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
  const { requirements, testCases, automated, realTests } = collect(root, options);
  const byAc = new Map();
  for (const link of testCases.links) {
    const key = `${link.reqId}/${link.acId}`;
    if (!byAc.has(key)) byAc.set(key, []);
    byAc.get(key).push(link);
  }
  const automatedTcIds = new Set(realTests.map((t) => t.tcId).filter(Boolean));
  const wipTcIds = new Set(
    realTests.filter((t) => t.tags && t.tags.includes('@wip')).map((t) => t.tcId).filter(Boolean)
  );

  const rows = [];
  for (const req of requirements) {
    if (!req.id) continue;
    for (const ac of req.acs) {
      const links = byAc.get(`${req.id}/${ac.id}`) || [];
      const tcs = links.map((l) => l.tcId);
      const done = tcs.filter((tc) => automatedTcIds.has(tc) && !wipTcIds.has(tc));
      const wipDone = tcs.filter((tc) => automatedTcIds.has(tc) && wipTcIds.has(tc));
      rows.push({
        reqId: req.id,
        status: req.status,
        acId: ac.id,
        acTitle: ac.title,
        testCases: tcs,
        automated: done,
        wip: wipDone,
        manualOnly: links.filter((l) => l.automation === 'No').map((l) => l.tcId),
        candidates: links.filter((l) => l.automation === 'Candidate').map((l) => l.tcId),
      });
    }
  }
  return {
    requirements: requirements.filter((r) => r.id).length,
    acceptanceCriteria: rows.length,
    testCases: testCases.links.length,
    automatedTests: realTests.length,
    playwrightError: automated.error,
    emptySpecs: Boolean(automated.emptyResult),
    emptyMessage: automated.emptyMessage || null,
    ignoredSpecs: automated.ignoredCount || 0,
    ignorePrefixes: automated.ignorePrefixes || [],
    rows,
  };
}

function gaps(root, options) {
  const { requirements, testCases, automated, realTests } = collect(root, options);
  const automatedTcIds = new Set(realTests.map((t) => t.tcId).filter(Boolean));
  const wipTcIds = new Set(
    realTests.filter((t) => t.tags && t.tags.includes('@wip')).map((t) => t.tcId).filter(Boolean)
  );

  const linksByAc = new Map();
  const linksByTc = new Map();
  for (const link of testCases.links) {
    const k = `${link.reqId}/${link.acId}`;
    if (!linksByAc.has(k)) linksByAc.set(k, []);
    linksByAc.get(k).push(link);
    linksByTc.set(link.tcId, link);
  }

  const findings = [];

  // Không đọc được requirement nào = gate rỗng: mọi rule dưới đây đều không chạy
  // và kết quả là "xanh tuyệt đối" ở một repo mà tool không hề đọc được gì.
  if (requirements.length === 0) {
    findings.push({
      severity: 'blocker',
      kind: 'khong-doc-duoc-requirement',
      where: `${(options && options.requirementsDir) || 'requirements'}/`,
      message:
        'Không đọc được requirement nào. Thư mục requirements/ không tồn tại, rỗng, hoặc ' +
        'tài liệu để ở chỗ khác. Mọi kiểm tra bên dưới sẽ xanh giả vì không có gì để đối chiếu.',
      action: 'Tạo requirements/REQ-xxx-<slug>.md theo templates/requirement-template.md.',
    });
  }

  // F-03: Kiểm tra trùng mã REQ giữa các file trong requirements/
  const reqsById = new Map();
  for (const r of requirements) {
    if (!r.id) continue;
    if (!reqsById.has(r.id)) reqsById.set(r.id, []);
    reqsById.get(r.id).push(r);
  }
  for (const [id, reqList] of reqsById.entries()) {
    if (reqList.length > 1) {
      findings.push({
        severity: 'blocker',
        kind: 'ma-req-trung',
        where: reqList.map((r) => r.file).join(', '),
        message: `Mã requirement "${id}" bị trùng lặp ở ${reqList.length} file: ${reqList.map((r) => r.file).join(', ')}.`,
        action: 'Đổi mã REQ để mỗi requirement có định danh duy nhất, tránh thổi phồng độ phủ.',
      });
    }
  }

  // F-03: Kiểm tra trùng mã TC trong bảng Traceability
  const linksByTcId = new Map();
  for (const link of testCases.links) {
    if (!link.tcId) continue;
    if (!linksByTcId.has(link.tcId)) linksByTcId.set(link.tcId, []);
    linksByTcId.get(link.tcId).push(link);
  }
  for (const [tcId, occList] of linksByTcId.entries()) {
    if (occList.length > 1) {
      findings.push({
        severity: 'major',
        kind: 'ma-tc-trung',
        where: occList.map((l) => `${l.file} (${l.reqId}/${l.acId})`).join(', '),
        message: `Mã test case "${tcId}" xuất hiện ${occList.length} lần trong bảng traceability.`,
        action: 'Đổi mã TC để mỗi test case có định danh duy nhất (không được tái sử dụng mã TC).',
      });
    }
  }

  // Dòng traceability bị loại vì mã REQ sai quy ước.
  for (const nm of testCases.nearMisses || []) {
    findings.push({
      severity: 'major',
      kind: 'dong-traceability-bi-bo-qua',
      where: nm.file,
      message: `Dòng "${nm.raw}" có mã REQ sai quy ước nên bị bỏ qua hoàn toàn.`,
      action: 'Sửa về dạng REQ-001, nếu không TC ở dòng đó vô hình với mọi rule.',
    });
  }

  // Giá trị cột Automation không nhận ra -> mọi rule so sánh với nó đều fail-open.
  for (const link of testCases.links) {
    if (link.automation === null) {
      findings.push({
        severity: 'major',
        kind: 'gia-tri-automation-khong-hop-le',
        where: link.file,
        message: `${link.tcId} có cột Automation = "${link.automationRaw}", không hiểu được.`,
        action: 'Dùng Yes / No / Candidate. Giá trị lạ làm mọi rule về automation im lặng.',
      });
    }
  }

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

    // F-03: Kiểm tra trùng mã AC trong cùng một requirement
    const acCounts = new Map();
    for (const ac of req.acs) {
      if (!ac.id) continue;
      acCounts.set(ac.id, (acCounts.get(ac.id) || 0) + 1);
    }
    for (const [acId, count] of acCounts.entries()) {
      if (count > 1) {
        findings.push({
          severity: 'major',
          kind: 'ma-ac-trung',
          where: req.file,
          message: `Mã tiêu chí "${acId}" xuất hiện ${count} lần trong ${req.id}.`,
          action: 'Đổi mã AC để mỗi tiêu chí chấp nhận có định danh duy nhất trong requirement.',
        });
      }
    }

    // Mã gần giống mà sai quy ước phải được BÁO. Im lặng bỏ qua nghĩa là một AC
    // biến mất khỏi mọi báo cáo trong khi coverage vẫn in con số cũ.
    for (const nm of req.nearMisses || []) {
      findings.push({
        severity: 'major',
        kind: 'dinh-danh-sai-quy-uoc',
        where: `${req.file}:${nm.line}`,
        message: `"${nm.raw}" trông giống mã định danh nhưng sai quy ước (đúng: AC-001, TC-001).`,
        action: 'Sửa về đúng 3 chữ số, nếu không mục này vô hình với mọi báo cáo.',
      });
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
      } else if (hasAutomated) {
        // F-08/F-09: Kiểm tra nếu toàn bộ script của AC đều là stub @wip
        const autoLinks = links.filter((l) => automatedTcIds.has(l.tcId));
        const allWip = autoLinks.length > 0 && autoLinks.every((l) => wipTcIds.has(l.tcId));
        if (allWip) {
          findings.push({
            severity: 'minor',
            kind: 'ac-chi-co-script-wip',
            where: `${req.file}:${ac.line}`,
            message: `${req.id}/${ac.id} có test case (${autoLinks.map((l) => l.tcId).join(', ')}) nhưng toàn bộ script đều mang tag @wip/stub (chưa hoàn thiện).`,
            action: 'Hoàn thiện script và gỡ tag @wip để được tính vào độ phủ chính thức.',
          });
        }
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

      // F-05: Kiểm tra phân tích biên (BVA + EP) trên cả cột Boundary và Invalid
      if (options && options.checkBoundaryRules && rule.testCases.length === 1) {
        const hasMultiBoundary = rule.boundary && rule.boundary !== '-' && rule.boundary.includes(',');
        const hasMultiInvalid = rule.invalid && rule.invalid !== '-' && rule.invalid.includes(',');
        if (hasMultiBoundary || hasMultiInvalid) {
          const reason = hasMultiBoundary
            ? `nhiều giá trị biên (${rule.boundary})`
            : `nhiều giá trị không hợp lệ (${rule.invalid})`;
          findings.push({
            severity: 'minor',
            kind: 'rule-thieu-boundary-test',
            where: req.file,
            message: `Dòng rule "${rule.field}" có ${reason} nhưng chỉ gán 1 test case (${rule.testCases[0]}).`,
            action: `Khuyến nghị tách thêm test case độc lập (BVA/EP). Cần tối thiểu: ${expectedCasesFromRule(rule).join('; ')}`,
          });
        }
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

    // Phase 6: Đối chiếu cột Spec với filesystem / automated specs
    if (link.spec && link.spec !== '-') {
      const cand1 = path.resolve(root, link.spec);
      const cand2 = path.resolve(root, (options && options.projectDir) || 'playwright', link.spec);
      const existsOnDisk = fs.existsSync(cand1) || fs.existsSync(cand2);
      const existsInAutomated = Boolean(
        automated.tests &&
        automated.tests.some((t) => {
          const f = (t.path || t.file || '').replace(/\\/g, '/');
          const s = link.spec.replace(/\\/g, '/');
          return f === s || f.endsWith('/' + s) || s.endsWith('/' + f);
        })
      );
      if (!existsOnDisk && !existsInAutomated) {
        findings.push({
          severity: 'major',
          kind: 'spec-khong-ton-tai',
          where: link.file,
          message: `${link.tcId} khai spec "${link.spec}" nhưng file không tồn tại trên filesystem.`,
          action: 'Kiểm tra lại đường dẫn spec trong bảng Traceability.',
        });
      }
    }
  }

  // Kiểm tra chất lượng assertion và trạng thái skip của test script thật
  for (const t of realTests) {
    if (t.assertionCount === 0) {
      findings.push({
        severity: 'major',
        kind: 'spec-thieu-assertion',
        where: specPath(options, t),
        message: `${t.tcId || t.title} không chứa bất kỳ lệnh assert/expect nào (assertionCount = 0).`,
        action: 'Bổ sung assertion expect(...) để kiểm chứng kết quả mong đợi, tránh test rỗng.',
      });
    }
    if (t.isSkipped && !t.tags.includes('@wip')) {
      findings.push({
        severity: 'major',
        kind: 'test-bi-skip-am-tham',
        where: specPath(options, t),
        message: `${t.tcId || t.title} đang bị test.skip hoặc test.fixme mà không gắn tag @wip để cách ly.`,
        action: 'Gắn tag @wip hoặc phục hồi lại test nếu đã sẵn sàng.',
      });
    }
    if (t.missingAwaits && t.missingAwaits.length > 0) {
      for (const ma of t.missingAwaits) {
        findings.push({
          severity: 'major',
          kind: 'assertion-thieu-await',
          where: `${t.path || t.file}:${ma.line}`,
          message: `${t.tcId || t.title} gọi matcher bất đồng bộ của Playwright mà thiếu "await": "${ma.text}". Test có nguy cơ pass giả hoặc flaky.`,
          action: 'Thêm await trước expect(...).',
        });
      }
    }
  }

  const empty = emptySpecFinding(testCases, automated, options);
  if (empty) findings.push(empty);

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
  const { requirements, testCases, realTests } = collect(root, options);
  const automated = { tests: realTests };
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
  for (const ac of acs) {
    for (const tc of ac.testCases) {
      for (const s of tc.specs) {
        files.add(s);
      }
    }
  }

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
    // File setup là hạ tầng đăng nhập/seed, không phải test case -> không đòi mã TC.
    if (t.isSetup) continue;
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
    const reqTests = automated.tests.filter((t) => t.reqId === req.id && !t.isSetup);
    const hasTests = reqTests.length > 0;
    if (hasTests && /^draft/i.test(req.status)) {
      // F-08: Nếu mọi script đều mang @wip thì hạ mức xuống minor (scaffold draft)
      const allWip = reqTests.every((t) => t.tags && t.tags.includes('@wip'));
      if (allWip) {
        findings.push({
          severity: 'minor',
          kind: 'requirement-moi-scaffold-chua-hoan-thien',
          where: req.file,
          message: `${req.id} đang Draft và mọi script trỏ vào đều là @wip/stub vừa scaffold.`,
          action: 'Hoàn thiện requirement và triển khai test script thật trước khi chuyển status.',
        });
      } else {
        findings.push({
          severity: 'major',
          kind: 'requirement-draft-nhung-da-co-script',
          where: req.file,
          message: `${req.id} đang Draft nhưng đã có script trỏ vào. Script có thể đang test hành vi chưa chốt.`,
          action: 'Chuyển status sang Review/Approved hoặc đánh dấu script là @wip.',
        });
      }
    }
    if (req.testCaseFile) {
      const abs = path.join(root, req.testCaseFile);
      if (!fs.existsSync(abs)) {
        findings.push({
          severity: 'blocker',
          kind: 'test-case-file-khong-ton-tai',
          where: req.file,
          message: `${req.id} trỏ tới ${req.testCaseFile} nhưng file không tồn tại.`,
        });
      }
    }
  }

  // Chiều ngược: dòng traceability trỏ tới REQ/AC đã bị xoá.
  for (const link of testCases.links) {
    if (link.reqId && !knownReq.has(link.reqId)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-case-tro-toi-req-khong-ton-tai',
        where: link.file,
        message: `${link.tcId} trỏ tới ${link.reqId} nhưng requirement đó không tồn tại.`,
        action: 'Sửa mã REQ trong bảng Traceability, hoặc xoá dòng đã chết.',
      });
    } else if (link.acId && !knownAc.has(`${link.reqId}/${link.acId}`)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-case-tro-toi-ac-khong-ton-tai',
        where: link.file,
        message: `${link.tcId} trỏ tới ${link.reqId}/${link.acId} nhưng AC đó không còn.`,
        action: 'AC có thể đã bị xoá hoặc đổi số. Rà lại bảng Traceability.',
      });
    }
  }

  const emptyDrift = emptySpecFinding(testCases, automated, options);
  if (emptyDrift) findings.push(emptyDrift);
  if (automated.error) {
    findings.push({
      severity: 'blocker',
      kind: 'khong-doc-duoc-playwright',
      where: (options && options.projectDir) || 'playwright',
      message: automated.error,
      action: 'Không đọc được spec thì drift không kết luận được gì.',
    });
  }
  return findings;
}

/**
 * Tự động tạo ma trận truy vết Markdown từ dữ liệu sống của repo.
 * Chống xung đột Git: file traceability.md là artifact sinh tự động, không sửa tay.
 * F-07: Loại bỏ timestamp để đảm bảo 100% tất định (Deterministic output).
 */
function matrix(root, options) {
  const { testCases, realTests } = collect(root, options);
  const automatedTcIds = new Set(realTests.map((t) => t.tcId).filter(Boolean));
  const specsByTc = new Map();
  for (const t of realTests) {
    if (t.tcId) {
      if (!specsByTc.has(t.tcId)) specsByTc.set(t.tcId, []);
      specsByTc.get(t.tcId).push(specPath(options, t));
    }
  }

  const lines = [
    '# Ma Trận Truy Vết Kiểm Thử (Traceability Matrix)',
    '',
    '<!-- AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. -->',
    '<!-- Sinh tự động bằng lệnh: npm run qa:matrix -->',
    '',
    'Bảng tổng hợp sống đối chiếu giữa Requirement, Acceptance Criteria, Test Case và Playwright script.',
    '',
    '| Requirement | Acceptance criterion | Test case | Trạng thái Automation | Spec file | Priority |',
    '|---|---|---|---|---|---|',
  ];

  let rowsCount = 0;
  for (const link of testCases.links) {
    const isAuto = automatedTcIds.has(link.tcId);
    let statusText = link.automation || 'No';
    if (link.automation === null) {
      statusText = '(KHÔNG ĐỌC ĐƯỢC)';
    } else if (link.automation === 'Yes') {
      statusText = isAuto ? 'Yes (Automated)' : 'Yes (Thiếu script)';
    }

    const specs = specsByTc.get(link.tcId) || [];
    let specCol = '-';
    if (specs.length > 0) {
      specCol = specs.map((s) => `\`${s}\``).join('<br>');
    } else if (link.spec) {
      // Chuẩn hoá đường dẫn cột Spec về dạng tương đối từ gốc repo
      let normalizedSpec = link.spec;
      if (normalizedSpec.startsWith('tests/')) {
        normalizedSpec = `${(options && options.projectDir) || 'playwright'}/${normalizedSpec}`;
      }
      specCol = `\`${normalizedSpec}\``;
    }

    lines.push(
      `| ${link.reqId} | ${link.acId} | ${link.tcId} | ${statusText} | ${specCol} | ${link.priority || '-'} |`
    );
    rowsCount++;
  }

  lines.push('');
  const outPath = path.join(root, (options && options.testCasesDir) || 'test-cases', 'traceability.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  return {
    ok: true,
    file: path.relative(root, outPath).replace(/\\/g, '/'),
    rowsCount,
  };
}

function summary(root, options) {
  const cov = coverage(root, options);
  const gapsList = gaps(root, options);
  const driftList = drift(root, options);

  const allFindings = [...gapsList, ...driftList];
  const blockerCount = allFindings.filter((f) => f.severity === 'blocker').length;
  const majorCount = allFindings.filter((f) => f.severity === 'major').length;
  const minorCount = allFindings.filter((f) => f.severity === 'minor').length;

  let decisionsTotal = 0;
  let decisionsPending = 0;
  let decisionsBlocking = 0;
  const decisionsPath = path.join(root, 'decisions.json');
  if (fs.existsSync(decisionsPath)) {
    try {
      const dData = JSON.parse(fs.readFileSync(decisionsPath, 'utf8').replace(/^﻿/, ''));
      if (dData && Array.isArray(dData.decisions)) {
        decisionsTotal = dData.decisions.length;
        const pendingList = dData.decisions.filter((d) => !d.answer || !d.answer.optionId);
        decisionsPending = pendingList.length;
        decisionsBlocking = pendingList.filter((d) => d.severity === 'blocking').length;
      }
    } catch {
      // Bỏ qua lỗi parse decisions
    }
  }

  // Gọi ĐÚNG hàm mà `node tools/boundary` dùng. Trước đây khối này chỉ ĐẾM số mục
  // ship/seed/own rồi mặc định 'ALIGNED' mà không hề chạy kiểm tra nào — nên
  // `boundary --strict` báo BLOCKER và exit 1 trong khi dashboard vẫn in ALIGNED.
  // Một đèn xanh tính ra mà không chạy kiểm tra là chế độ hỏng tệ nhất ở repo này.
  let boundaryStatus = 'ALIGNED';
  let boundaryProblems = [];
  let shipCount = 0;
  let seedCount = 0;
  let ownCount = 0;
  const { loadManifest, analyse, countByCategory } = require('../../boundary');
  const loaded = loadManifest(root);
  if (loaded.error) {
    // Thiếu file và file hỏng là hai chuyện khác nhau: đừng gộp thành một trạng thái.
    boundaryStatus = fs.existsSync(path.join(root, 'sync-manifest.json')) ? 'DRIFTED' : 'MISSING';
  } else {
    const counts = countByCategory(loaded.manifest);
    shipCount = counts.ship;
    seedCount = counts.seed;
    ownCount = counts.own;
    boundaryProblems = analyse(loaded.manifest, root).problems;
    const blocking = boundaryProblems.filter(
      (p) => (SEVERITY_RANK[p.severity] || 0) >= SEVERITY_RANK.major,
    );
    if (blocking.length > 0) boundaryStatus = 'DRIFTED';
  }

  const acsCovered = cov.rows.filter((r) => r.automated && r.automated.length > 0).length;
  const coveragePercent =
    cov.acceptanceCriteria === 0 ? 0 : Number(((acsCovered / cov.acceptanceCriteria) * 100).toFixed(1));

  const wipTestsCount = cov.rows.reduce((sum, r) => sum + (r.wip ? r.wip.length : 0), 0);
  const candidateCount = cov.rows.reduce((sum, r) => sum + (r.candidates ? r.candidates.length : 0), 0);

  let systemHealth = 'HEALTHY';
  if (blockerCount > 0 || boundaryStatus === 'MISSING' || boundaryStatus === 'DRIFTED') {
    systemHealth = 'CRITICAL';
  } else if (majorCount > 0 || decisionsBlocking > 0) {
    systemHealth = 'WARNING';
  }

  return {
    schemaVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    systemHealth,
    metrics: {
      requirements: cov.requirements,
      acceptanceCriteria: cov.acceptanceCriteria,
      coveredAcCount: acsCovered,
      coveragePercent,
      testCases: cov.testCases,
      automatedTests: cov.automatedTests,
      wipTests: wipTestsCount,
      candidateTests: candidateCount,
    },
    health: {
      status: systemHealth,
      blockers: blockerCount,
      majors: majorCount,
      minors: minorCount,
      totalFindings: allFindings.length,
    },
    boundary: {
      status: boundaryStatus,
      shipCount,
      seedCount,
      ownCount,
      // Trả luôn danh sách vấn đề: một trạng thái DRIFTED không kèm lý do thì người
      // đọc dashboard vẫn phải mở terminal chạy lại `node tools/boundary`.
      problems: boundaryProblems,
    },
    decisions: {
      total: decisionsTotal,
      pending: decisionsPending,
      blocking: decisionsBlocking,
    },
    findings: allFindings,
  };
}

module.exports = { collect, coverage, gaps, impact, drift, matrix, summary, SEVERITY_RANK };
