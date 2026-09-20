#!/usr/bin/env node
'use strict';
/**
 * Kiểm tra sync-manifest.json có còn khớp với thực tế repo không.
 *
 *   node tools/boundary            in phân loại + vấn đề
 *   node tools/boundary --strict   exit 1 khi có vấn đề (dùng cho CI)
 *   node tools/boundary --json
 *
 * Bắt 5 loại sai:
 *   1. Path khai trong manifest nhưng không tồn tại  -> manifest đã cũ
 *   2. Path nằm ở hơn một nhóm                       -> mâu thuẫn
 *   3. Path `own` nằm trong path `ship`              -> sẽ bị ghi đè khi sync
 *   4. Thư mục/file chưa được phân loại              -> ai đó thêm mà quên khai
 *   5. Nhóm `own` lệch với FORBIDDEN của Hub         -> hai bên nói khác nhau
 *
 * Zero dependency, giống tools/qa.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
// Tên file manifest để riêng: mọi hàm nhận `root` nên không được chốt cứng đường dẫn
// tuyệt đối, nếu không tool chỉ chạy đúng cho repo chứa chính nó.
const MANIFEST_FILE = 'sync-manifest.json';
const manifestPathOf = (root) => path.join(root, MANIFEST_FILE);
const CATEGORIES = ['ship', 'seed', 'own'];

/** Thư mục/file không thuộc phạm vi phân loại. */
const IGNORED = new Set([
  'node_modules', '.git', 'playwright-report', 'test-results', '.auth',
  'sync-manifest.json', 'package.json', 'package-lock.json', '.env',
  '.ai', 'ai', 'scratch', 'tmp',
]);

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s) => c('31', s);
const yellow = (s) => c('33', s);
const green = (s) => c('32', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

function norm(p) {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** a có nằm trong b không (b là thư mục cha). */
function isUnder(a, b) {
  return a === b || a.startsWith(b + '/');
}

function loadManifest(root = ROOT) {
  const manifest = manifestPathOf(root);
  if (!fs.existsSync(manifest)) {
    return { error: `Không thấy ${path.relative(root, manifest)}` };
  }
  try {
    return { manifest: JSON.parse(fs.readFileSync(manifest, 'utf8').replace(/^﻿/, '')) };
  } catch (err) {
    return { error: `${MANIFEST_FILE} không phải JSON hợp lệ: ${err.message}` };
  }
}

/**
 * Liệt kê các mục cần phân loại. Tự động đi sâu vào thư mục nào có path được khai
 * bên trong nó, thay vì hard-code danh sách thư mục bị chia đôi.
 */
function inventory(declaredPaths, root = ROOT) {
  const out = [];
  const hasDeclaredInside = (rel) => declaredPaths.some((d) => d !== rel && isUnder(d, rel));
  const walk = (rel) => {
    const abs = rel ? path.join(root, rel) : root;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory() && hasDeclaredInside(child)) walk(child);
      else out.push(child);
    }
  };
  walk('');
  return out;
}

function analyse(manifest, root = ROOT) {
  const problems = [];
  const declared = new Map(); // path -> [categories]

  for (const cat of CATEGORIES) {
    for (const item of manifest[cat] || []) {
      const p = norm(item.path);
      if (!declared.has(p)) declared.set(p, []);
      declared.get(p).push(cat);
      if (!fs.existsSync(path.join(root, p))) {
        problems.push({
          kind: 'path-khong-ton-tai',
          severity: 'major',
          where: p,
          message: `Manifest khai "${p}" ở nhóm ${cat} nhưng path không tồn tại.`,
        });
      }
    }
  }

  for (const [p, cats] of declared) {
    if (cats.length > 1) {
      problems.push({
        kind: 'path-o-nhieu-nhom',
        severity: 'blocker',
        where: p,
        message: `"${p}" được khai ở cả ${cats.join(' và ')}. Phải chọn đúng một nhóm.`,
      });
    }
  }

  const shipPaths = (manifest.ship || []).map((i) => norm(i.path));
  for (const item of manifest.own || []) {
    const p = norm(item.path);
    const parent = shipPaths.find((s) => p !== s && isUnder(p, s));
    if (parent) {
      problems.push({
        kind: 'own-nam-trong-ship',
        severity: 'blocker',
        where: p,
        message: `"${p}" là business nhưng nằm trong "${parent}" (nhóm ship) -> sẽ bị ghi đè khi sync.`,
      });
    }
  }

  // Lớp 4 chỉ liệt kê tới mức thư mục đã khai, không đi sâu vào trong. Nên một thư
  // mục BUSINESS nằm lọt giữa vùng bị ghi đè sẽ vô hình: không ai báo, exit 0.
  // Quét riêng đúng những tên mà Hub cấm sync, ở mọi độ sâu bên trong ship/seed.
  const BUSINESS_DIR_NAMES = new Set(['requirements', 'test-cases', 'data', 'tests', 'pages']);
  const syncedRoots = [...(manifest.ship || []), ...(manifest.seed || [])].map((i) => norm(i.path));
  const ownPaths = (manifest.own || []).map((i) => norm(i.path));
  // Khai `own` là khai có chủ ý cho cả cây bên dưới. So khớp ĐÚNG BẰNG sẽ báo động giả
  // với mọi thư mục con, buộc người dùng khai thừa từng cái mới dập được.
  const isDeclaredOwn = (p) => ownPaths.some((o) => isUnder(p, o));
  const seenBusiness = new Set();
  const MAX_DEPTH = 8;
  const scanForBusiness = (rel, depth = 0) => {
    const abs = path.join(root, rel);
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    if (depth >= MAX_DEPTH) {
      // Cắt im lặng cũng là một chế độ fail-open. Nói ra chỗ đã ngừng.
      problems.push({
        kind: 'quet-business-bi-cat-do-qua-sau',
        severity: 'minor',
        where: rel,
        message: `Ngừng quét ở độ sâu ${MAX_DEPTH}; thư mục business sâu hơn sẽ không được kiểm.`,
      });
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED.has(entry.name)) continue;
      const child = norm(`${rel}/${entry.name}`);
      if (isDeclaredOwn(child)) continue; // đã khai own -> cả cây bên dưới là có chủ ý
      if (BUSINESS_DIR_NAMES.has(entry.name) && !seenBusiness.has(child)) {
        seenBusiness.add(child);
        problems.push({
          kind: 'business-nam-trong-vung-sync',
          severity: 'blocker',
          where: child,
          message:
            `"${child}" mang tên thư mục business (${entry.name}) nhưng nằm trong vùng được ` +
            'sync -> Hub sẽ ghi đè lên nó.',
        });
      }
      scanForBusiness(child, depth + 1);
    }
  };
  // Đặt tên `syncedRoot`: dùng lại `root` ở đây sẽ che mất tham số `root` của hàm,
  // và mọi path bên trong vòng lặp sẽ tính từ nhầm gốc.
  for (const syncedRoot of syncedRoots) {
    const abs = path.join(root, syncedRoot);
    // `.` (gốc repo) khai là ship thì norm() phải cho ra chuỗi rỗng, nếu không mọi
    // `where` sinh ra sẽ mang tiền tố "./" và không khớp được với mục own nào.
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      scanForBusiness(syncedRoot === '.' ? '' : syncedRoot);
    }
  }

  const classified = (p) => {
    for (const d of declared.keys()) if (isUnder(p, d)) return true;
    return false;
  };
  const unclassified = inventory([...declared.keys()], root).filter((p) => !classified(p));
  for (const p of unclassified) {
    problems.push({
      kind: 'chua-phan-loai',
      severity: 'major',
      where: p,
      message: `"${p}" chưa được phân loại vào ship/seed/own trong sync-manifest.json.`,
    });
  }

  return { problems, declared };
}

/**
 * Đối chiếu nhóm `own` với FORBIDDEN_SYNC_MODULES của Hub, nếu tìm thấy Hub.
 * Hằng số này từng nằm trong sync-satellites.js, sau được tách sang lib/sync-manifest.js.
 * Dò cả hai nơi: chỉ tìm đúng một file rồi bỏ cuộc sẽ khiến lớp kiểm tra này im lặng
 * không chạy, đúng lúc nó cần báo động nhất.
 */
function crossCheckHub(manifest, root = ROOT) {
  const candidates = process.env.HUB_SYNC_SCRIPT
    ? [process.env.HUB_SYNC_SCRIPT]
    : [
        path.resolve(root, '..', '_Automation-Project', 'scripts', 'lib', 'sync-manifest.js'),
        path.resolve(root, '..', '_Automation-Project', 'scripts', 'sync-satellites.js'),
      ];

  let hubScript = null;
  let m = null;
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const found = fs
      .readFileSync(file, 'utf8')
      .match(/const\s+FORBIDDEN_SYNC_MODULES\s*=\s*\[([^\]]*)\]/);
    if (found) {
      hubScript = file;
      m = found;
      break;
    }
  }
  if (!m) return null;
  // Đọc cả nháy đơn lẫn nháy kép: một lần Prettier đổi singleQuote ở Hub không được
  // phép làm CI của mọi satellite đỏ cùng lúc vì hiểu nhầm là Hub chưa cấm gì.
  const forbidden = new Set(
    (m[1].match(/['"`]([^'"`]+)['"`]/g) || []).map((x) => x.slice(1, -1)),
  );

  // Chỉ đối chiếu những mục có khai `hubModule`. Suy ra từ đường dẫn sẽ sai:
  // `playwright/tests/pages` có segment đầu là `playwright`, nhưng thứ Hub cấm là `pages`.
  const mapped = (manifest.own || []).filter((i) => i.hubModule);
  // 0 mục được đối chiếu KHÔNG phải là "đối chiếu đạt". Một vòng lặp không chạy lần nào
  // mà in ra OK là đúng loại lỗi im lặng nguy hiểm nhất.
  if (mapped.length === 0) {
    return { hubScript, forbidden: [...forbidden], mapped: [], missing: [], notCompared: true };
  }
  const missing = mapped.filter((i) => !forbidden.has(i.hubModule)).map((i) => i.hubModule);
  return {
    hubScript,
    forbidden: [...forbidden],
    mapped: mapped.map((i) => `${norm(i.path)} -> ${i.hubModule}`),
    missing,
  };
}

const KNOWN_FLAGS = new Set(['--json', '--strict']);

function main() {
  const args = process.argv.slice(2);
  // Cờ gõ sai mà bị nuốt im lặng nghĩa là gate tắt vĩnh viễn: `--stict` sẽ luôn exit 0.
  const unknown = args.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a));
  if (unknown.length > 0) {
    console.error(red(`Cờ không hợp lệ: ${unknown.join(', ')}. Chỉ nhận: --json, --strict`));
    process.exitCode = 2;
    return;
  }
  const asJson = args.includes('--json');
  const strict = args.includes('--strict');

  const { manifest, error } = loadManifest();
  if (error) {
    console.error(red(error));
    process.exitCode = 2;
    return;
  }

  const { problems, declared } = analyse(manifest);
  const hub = crossCheckHub(manifest);
  if (hub && hub.missing.length > 0) {
    problems.push({
      kind: 'lech-voi-forbidden-cua-hub',
      severity: 'blocker',
      where: hub.hubScript,
      message: `Nhóm own có ${hub.missing.join(', ')} nhưng FORBIDDEN_SYNC_MODULES của Hub chưa có -> Hub có thể ghi đè business.`,
    });
  }
  if (hub && hub.notCompared) {
    problems.push({
      kind: 'khong-doi-chieu-duoc-hub',
      severity: 'major',
      where: hub.hubScript,
      message: '0 mục có hubModule để đối chiếu với Hub. sync-manifest.json cần khai hubModule cho các mục own.',
    });
  }

  if (asJson) {
    console.log(JSON.stringify({ problems, hub, counts: countByCategory(manifest) }, null, 2));
  } else {
    printHuman(manifest, problems, hub);
  }

  const hasBlocking = problems.some((p) => p.severity === 'blocker' || p.severity === 'major');
  if (strict && hasBlocking) process.exitCode = 1;
}

function countByCategory(manifest) {
  return CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: (manifest[cat] || []).length }), {});
}

function printHuman(manifest, problems, hub) {
  const counts = countByCategory(manifest);
  console.log(
    bold(`\nRanh giới Hub <-> Project  ·  ship ${counts.ship} · seed ${counts.seed} · own ${counts.own}\n`),
  );
  for (const cat of CATEGORIES) {
    const label = { ship: 'SHIP (Hub ghi đè)', seed: 'SEED (chỉ copy khi thiếu)', own: 'OWN (business, Hub không đụng)' }[cat];
    console.log(bold(label));
    for (const item of manifest[cat] || []) {
      console.log(`  ${norm(item.path).padEnd(38)} ${dim(item.reason || '')}`);
    }
    console.log('');
  }

  if (hub) {
    if (hub.notCompared) {
      console.log(yellow('CẢNH BÁO') + ' Đối chiếu Hub: 0 mục có hubModule, không đối chiếu được gì.');
    } else {
      const ok = hub.missing.length === 0;
      console.log(
        `${ok ? green('OK') : red('LỆCH')} Đối chiếu Hub: FORBIDDEN_SYNC_MODULES = [${hub.forbidden.join(', ')}]`,
      );
    }
  } else {
    console.log(dim('(Không tìm thấy Hub để đối chiếu — đặt HUB_SYNC_SCRIPT nếu cần)'));
  }
  console.log('');

  if (problems.length === 0) {
    console.log(green('OK') + ' Manifest khớp với thực tế repo.\n');
    return;
  }
  console.log(bold(`${problems.length} vấn đề\n`));
  const rank = { blocker: 3, major: 2, minor: 1 };
  for (const p of [...problems].sort((a, b) => rank[b.severity] - rank[a.severity])) {
    const tag =
      p.severity === 'blocker' ? red('BLOCKER') :
      p.severity === 'major' ? yellow('MAJOR  ') :
      dim('MINOR  ');
    console.log(`${tag} ${bold(p.kind)}`);
    console.log(`        ${p.message}`);
    console.log(`        ${dim(p.where)}\n`);
  }
}

// Chỉ chạy khi gọi trực tiếp. Không có guard này thì mọi `require('tools/boundary')`
// đều in cả báo cáo ra stdout và set exit code — nên `summary` từng phải tự đoán lại
// trạng thái ranh giới thay vì gọi `analyse()` thật.
if (require.main === module) main();

module.exports = {
  analyse,
  loadManifest,
  crossCheckHub,
  countByCategory,
  MANIFEST_FILE,
  CATEGORIES,
};
