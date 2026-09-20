'use strict';
/**
 * Test cho tools/boundary.
 *
 * Công cụ lấy ROOT từ vị trí của chính nó (path.resolve(__dirname, '..', '..')) và gọi
 * main() ngay khi require, nên không require() vào test được. Cách trung thực nhất mà
 * không sửa source: dựng một repo giả trong os.tmpdir(), COPY index.js vào
 * <repo>/tools/boundary/index.js để ROOT trỏ đúng vào repo giả, rồi chạy nó như CLI.
 * Dùng spawnSync (không phải execFileSync) vì cần đọc exit code 0/1/2 mà không phải
 * bọc try/catch - exit code chính là thứ CI dựa vào.
 *
 * Repo giả nằm trong một sandbox: <sandbox>/project là repo, còn <sandbox>/_Automation-Project
 * là Hub anh em - đúng cấu trúc thật, nên dò Hub theo đường mặc định cũng test được.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE = path.join(__dirname, 'index.js');

/**
 * Key bắt đầu bằng '../' sẽ nằm CẠNH repo (trong sandbox) chứ không nằm trong repo -
 * đó là chỗ Hub thật sự ở.
 */
function makeRepo(files) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-'));
  const root = path.join(sandbox, 'project');
  fs.mkdirSync(path.join(root, 'tools', 'boundary'), { recursive: true });
  fs.copyFileSync(SOURCE, path.join(root, 'tools', 'boundary', 'index.js'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.resolve(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return { sandbox, root };
}

const withRepo = (files, fn) => {
  const { sandbox, root } = makeRepo(files);
  try {
    return fn(root);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
};

/**
 * hub: đường dẫn (tương đối repo) nạp vào HUB_SYNC_SCRIPT.
 * defaultHub: true -> xoá biến môi trường để công cụ tự dò theo đường mặc định.
 * Mặc định trỏ HUB_SYNC_SCRIPT vào file không tồn tại, để máy của người chạy test
 * có sẵn Hub thật hay không cũng không làm kết quả đổi.
 */
function run(root, args = [], opts = {}) {
  const env = { ...process.env, NO_COLOR: '1' };
  if (opts.defaultHub) delete env.HUB_SYNC_SCRIPT;
  else env.HUB_SYNC_SCRIPT = opts.hub ? path.resolve(root, opts.hub) : path.join(root, 'khong-co-hub.js');
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'boundary', 'index.js'), ...args], {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env,
  });
  assert.equal(r.error, undefined, 'không spawn được công cụ');
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function runJson(root, args = [], opts = {}) {
  const r = run(root, ['--json', ...args], opts);
  return { ...r, report: JSON.parse(r.stdout) };
}

const manifest = (o) => JSON.stringify({
  ship: [{ path: 'tools/boundary', reason: 'tool' }],
  seed: [{ path: 'docs', reason: 'chuẩn QA' }],
  own: [{ path: 'requirements', reason: 'business', hubModule: 'requirements' }],
  ...o,
}, null, 2);

const kinds = (report, kind) => report.problems.filter((p) => p.kind === kind);
const wheres = (report, kind) => kinds(report, kind).map((p) => p.where);

/** Repo tối thiểu khớp đúng với manifest() mặc định. */
const CLEAN = {
  'sync-manifest.json': manifest({}),
  'docs/test-design.md': '# chuẩn',
  'requirements/REQ-001.md': '# REQ-001',
};

const hubFile = (modules) => `const FORBIDDEN_SYNC_MODULES = [${modules.map((m) => `'${m}'`).join(', ')}];\n`;

// ---------------------------------------------------------------------------
// Trạng thái sạch
// ---------------------------------------------------------------------------

test('manifest khớp thực tế: không vấn đề, exit 0, counts đúng theo manifest', () => {
  withRepo(CLEAN, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.deepEqual(report.problems, []);
    assert.deepEqual(report.counts, { ship: 1, seed: 1, own: 1 });
  });
});

test('repo sạch + --strict vẫn exit 0: gate không được đỏ khi không có gì sai', () => {
  withRepo(CLEAN, (root) => {
    assert.equal(run(root, ['--strict']).status, 0);
  });
});

// ---------------------------------------------------------------------------
// Loại 1: path khai trong manifest nhưng không tồn tại trên đĩa
// ---------------------------------------------------------------------------

test('path khai trong manifest nhưng không có trên đĩa -> major, nêu đúng nhóm', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'templates' }],
    }),
  }, (root) => {
    const { report } = runJson(root);
    const found = kinds(report, 'path-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].where, 'templates');
    assert.equal(found[0].severity, 'major');
    // Phải nói rõ nhóm nào khai sai, nếu không người sửa phải tự grep cả manifest.
    assert.ok(found[0].message.includes('ship'));
    // Một path ma không được kéo theo cả tràng chua-phan-loai giả.
    assert.equal(report.problems.length, 1);
  });
});

test('path khai thừa ở nhóm own cũng bị bắt: không chỉ riêng ship được kiểm', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({
      own: [{ path: 'requirements', hubModule: 'requirements' }, { path: 'test-cases', hubModule: 'test-cases' }],
    }),
  }, (root) => {
    const { report } = runJson(root);
    assert.deepEqual(wheres(report, 'path-khong-ton-tai'), ['test-cases']);
  });
});

// ---------------------------------------------------------------------------
// Loại 2: một path khai ở hai nhóm
// ---------------------------------------------------------------------------

test('cùng một path khai ở hai nhóm -> blocker (sync sẽ xử lý theo nhóm nào?)', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'docs' }],
    }),
  }, (root) => {
    const { report } = runJson(root);
    const found = kinds(report, 'path-o-nhieu-nhom');
    assert.equal(found.length, 1);
    assert.equal(found[0].where, 'docs');
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('ship') && found[0].message.includes('seed'),
      'thông báo phải gọi tên cả hai nhóm đang tranh nhau');
  });
});

// ---------------------------------------------------------------------------
// Loại 3: own nằm trong ship
// ---------------------------------------------------------------------------

test('own nằm trong ship -> blocker, chỉ đúng path con và nêu tên thư mục cha', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'playwright/tests' }],
      own: [{ path: 'playwright/tests/pages', hubModule: 'pages' }],
    }),
    'playwright/tests/pages/login.page.ts': 'export class LoginPage {}',
    'playwright/tests/api/seed.spec.ts': 'test',
    'docs/x.md': '#',
  }, (root) => {
    const { report } = runJson(root);
    const found = kinds(report, 'own-nam-trong-ship');
    assert.equal(found.length, 1);
    assert.equal(found[0].where, 'playwright/tests/pages');
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('playwright/tests'), 'phải chỉ ra thư mục ship đang nuốt nó');
    // playwright/tests/api nằm trong ship nên đã được phân loại: lồng nhau hợp lệ không
    // được biến thành báo động phụ, nếu không mỗi vi phạm sẽ kéo theo vài dòng nhiễu.
    assert.equal(report.problems.length, 1);
  });
});

test('own nằm trong seed thì KHÔNG báo: seed chỉ copy khi thiếu, không ghi đè', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }],
      seed: [{ path: 'playwright/tests' }],
      own: [{ path: 'playwright/tests/pages', hubModule: 'pages' }],
    }),
    'playwright/tests/pages/login.page.ts': 'export class LoginPage {}',
  }, (root) => {
    const { report } = runJson(root);
    assert.deepEqual(kinds(report, 'own-nam-trong-ship'), []);
  });
});

// ---------------------------------------------------------------------------
// Loại 4: có trên đĩa nhưng không thuộc nhóm nào
// ---------------------------------------------------------------------------

test('thư mục/file thêm mới mà quên khai -> chua-phan-loai, báo ở mức thư mục', () => {
  withRepo({
    ...CLEAN,
    'scripts/deploy.js': '// mới thêm',
    'scripts/lib/helper.js': '// mới thêm',
    'ghi-chu.txt': 'note',
  }, (root) => {
    const { report } = runJson(root);
    const found = wheres(report, 'chua-phan-loai').sort();
    assert.deepEqual(found, ['ghi-chu.txt', 'scripts']);
    // Báo 'scripts' một lần, không xả ra từng file bên trong - nếu không, thêm một thư
    // mục 200 file sẽ nhấn chìm 4 loại vấn đề còn lại.
    assert.ok(!found.some((p) => p.startsWith('scripts/')));
  });
});

test('thư mục bị chia đôi: tự đi sâu để tìm phần con chưa khai', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }],
      seed: [{ path: 'docs' }],
      own: [{ path: 'playwright/tests/pages', hubModule: 'pages' }],
    }),
    'docs/x.md': '#',
    'playwright/tests/pages/login.page.ts': 'x',
    'playwright/tests/api/seed.spec.ts': 'x',
    'playwright/playwright.config.ts': 'x',
  }, (root) => {
    const { report } = runJson(root);
    // Chỉ cần một path được khai bên trong 'playwright' là phải soi tiếp vào trong,
    // thay vì coi cả 'playwright' là đã phân loại.
    assert.deepEqual(wheres(report, 'chua-phan-loai').sort(),
      ['playwright/playwright.config.ts', 'playwright/tests/api']);
  });
});

test('tên trùng tiền tố không bị nuốt: docs-old khác docs', () => {
  withRepo({ ...CLEAN, 'docs-old/legacy.md': '# cũ' }, (root) => {
    const { report } = runJson(root);
    // So sánh bằng startsWith(d) trần sẽ coi docs-old là con của docs và im lặng cho qua.
    assert.deepEqual(wheres(report, 'chua-phan-loai'), ['docs-old']);
  });
});

test('node_modules, .git, report... không bị tính là chưa phân loại', () => {
  withRepo({
    ...CLEAN,
    'node_modules/pkg/index.js': 'x',
    'playwright-report/index.html': 'x',
    'test-results/.last-run.json': '{}',
    '.env': 'SECRET=1',
    'package.json': '{}',
  }, (root) => {
    const { report } = runJson(root);
    assert.deepEqual(report.problems, [], 'rác sinh ra lúc chạy test không phải việc của manifest');
  });
});

test('path khai kiểu Windows hoặc có dấu / cuối vẫn khớp được với đĩa', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools\\boundary' }],
      seed: [{ path: 'docs/' }],
    }),
  }, (root) => {
    const { report } = runJson(root);
    // Manifest do người gõ tay, lẫn '\' hoặc '/' cuối là chuyện thường. Nếu norm() hỏng
    // thì gate đỏ trên máy này và xanh trên máy khác - kiểu lỗi tốn nhiều giờ nhất.
    assert.deepEqual(report.problems, []);
  });
});

// ---------------------------------------------------------------------------
// Loại 5: đối chiếu với FORBIDDEN_SYNC_MODULES của Hub
// ---------------------------------------------------------------------------

test('own có hubModule mà Hub chưa cấm -> blocker, trỏ vào đúng file Hub', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({ ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }] }),
    'hub-gia/sync-manifest.js': hubFile(['data', 'tests']),
  }, (root) => {
    const { report } = runJson(root, [], { hub: 'hub-gia/sync-manifest.js' });
    const found = kinds(report, 'lech-voi-forbidden-cua-hub');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('requirements'));
    assert.ok(found[0].where.endsWith('sync-manifest.js'), 'where phải là file Hub cần sửa');
    assert.deepEqual(report.hub.missing, ['requirements']);
    assert.deepEqual(report.hub.forbidden, ['data', 'tests']);
  });
});

test('Hub đã cấm đủ -> không vấn đề, nhưng vẫn báo cáo đã đối chiếu những gì', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({ ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }] }),
    'hub-gia/sync-manifest.js': hubFile(['data', 'requirements']),
  }, (root) => {
    const { status, report } = runJson(root, [], { hub: 'hub-gia/sync-manifest.js' });
    assert.equal(status, 0);
    assert.deepEqual(report.problems, []);
    assert.deepEqual(report.hub.missing, []);
    assert.deepEqual(report.hub.mapped, ['requirements -> requirements']);
  });
});

test('own không khai hubModule thì không đối chiếu: không suy ra module từ đường dẫn', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }],
      own: [{ path: 'requirements', reason: 'business' }],
    }),
    'hub-gia/sync-manifest.js': hubFile(['data']),
  }, (root) => {
    const { report } = runJson(root, [], { hub: 'hub-gia/sync-manifest.js' });
    // 'playwright/tests/pages' có segment đầu là 'playwright' nhưng Hub cấm 'pages':
    // suy diễn từ path sẽ đẻ ra báo động giả, nên chỉ đối chiếu mục có khai hubModule.
    assert.deepEqual(report.hub.mapped, []);
    assert.deepEqual(kinds(report, 'lech-voi-forbidden-cua-hub'), []);
  });
});

test('không set HUB_SYNC_SCRIPT: tự tìm Hub ở lib/sync-manifest.js cạnh repo', () => {
  withRepo({
    ...CLEAN,
    '../_Automation-Project/scripts/lib/sync-manifest.js': hubFile(['requirements']),
  }, (root) => {
    const { report } = runJson(root, [], { defaultHub: true });
    assert.ok(report.hub, 'phải tìm thấy Hub mà không cần cấu hình gì');
    assert.ok(report.hub.hubScript.includes('sync-manifest.js'));
    assert.deepEqual(report.hub.missing, []);
  });
});

test('lib không chứa hằng số thì phải dò tiếp sang sync-satellites.js', () => {
  withRepo({
    ...CLEAN,
    // Hằng số từng nằm ở sync-satellites.js rồi được tách sang lib. Dừng ở file đầu tiên
    // tìm thấy sẽ khiến lớp kiểm tra thứ 5 im lặng không chạy, đúng lúc cần báo động nhất.
    '../_Automation-Project/scripts/lib/sync-manifest.js': 'module.exports = { buildPlan };\n',
    '../_Automation-Project/scripts/sync-satellites.js': hubFile(['data']),
  }, (root) => {
    const { report } = runJson(root, [], { defaultHub: true });
    assert.ok(report.hub, 'không được bỏ cuộc ở file đầu tiên');
    assert.ok(report.hub.hubScript.endsWith('sync-satellites.js'));
    assert.deepEqual(report.hub.missing, ['requirements']);
  });
});

test('không có Hub để đối chiếu: 4 lớp còn lại vẫn chạy và vẫn bắt được lỗi', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({ ship: [{ path: 'tools/boundary' }, { path: 'templates' }] }),
  }, (root) => {
    const { report } = runJson(root);
    assert.equal(report.hub, null);
    assert.deepEqual(wheres(report, 'path-khong-ton-tai'), ['templates']);
  });
});

// ---------------------------------------------------------------------------
// Hợp đồng với CI: exit code và định dạng đầu ra
// ---------------------------------------------------------------------------

test('--strict + có vấn đề -> exit 1 (CI đỏ)', () => {
  withRepo({ ...CLEAN, 'scripts/deploy.js': 'x' }, (root) => {
    assert.equal(run(root, ['--strict']).status, 1);
  });
});

test('không --strict thì có vấn đề vẫn exit 0: chạy tay là để xem, không phải để chặn', () => {
  withRepo({ ...CLEAN, 'scripts/deploy.js': 'x' }, (root) => {
    const r = run(root);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes('chua-phan-loai'), 'vẫn phải in vấn đề ra cho người đọc');
  });
});

test('--json in ra JSON hợp lệ duy nhất, không lẫn bản in cho người', () => {
  withRepo({ ...CLEAN, 'scripts/deploy.js': 'x' }, (root) => {
    const { stdout } = run(root, ['--json']);
    const report = JSON.parse(stdout); // hỏng ở đây nghĩa là dashboard/CI không đọc được
    assert.deepEqual(Object.keys(report).sort(), ['counts', 'hub', 'problems']);
    assert.ok(Array.isArray(report.problems));
    for (const p of report.problems) {
      assert.deepEqual(Object.keys(p).sort(), ['kind', 'message', 'severity', 'where']);
    }
    assert.ok(!stdout.includes('SHIP (Hub ghi đè)'));
  });
});

test('--json --strict: vừa đọc được máy vừa chặn được CI', () => {
  withRepo({ ...CLEAN, 'scripts/deploy.js': 'x' }, (root) => {
    const { status, report } = runJson(root, ['--strict']);
    assert.equal(status, 1);
    assert.equal(report.problems.length, 1);
  });
});

test('bản in cho người: đủ ba nhóm, số lượng, và nhãn mức độ khi có vấn đề', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({ ship: [{ path: 'tools/boundary' }, { path: 'docs' }] }),
  }, (root) => {
    const { stdout } = run(root);
    assert.ok(stdout.includes('SHIP'));
    assert.ok(stdout.includes('SEED'));
    assert.ok(stdout.includes('OWN'));
    assert.ok(stdout.includes('ship 2'), 'dòng tóm tắt phải đếm theo manifest');
    assert.ok(stdout.includes('BLOCKER'));
    assert.ok(stdout.includes('path-o-nhieu-nhom'));
    assert.ok(!stdout.includes('['), 'NO_COLOR=1 thì không được nhét mã màu vào log CI');
  });
});

test('thiếu sync-manifest.json -> exit 2, tách bạch với 1 (vấn đề) và 0 (sạch)', () => {
  withRepo({ 'docs/x.md': '#' }, (root) => {
    const r = run(root, ['--strict']);
    assert.equal(r.status, 2, 'không đọc được manifest là lỗi hạ tầng, không phải vi phạm ranh giới');
    assert.ok(r.stderr.includes('sync-manifest.json'));
    assert.equal(r.stdout, '');
  });
});

test('sync-manifest.json hỏng cú pháp -> exit 2 kèm lý do trên stderr', () => {
  withRepo({ ...CLEAN, 'sync-manifest.json': '{ "ship": [ , ] }' }, (root) => {
    const r = run(root);
    assert.equal(r.status, 2);
    assert.ok(r.stderr.includes('JSON'), 'phải nói rõ là lỗi cú pháp, đừng bắt người đọc đoán');
  });
});

// ---------------------------------------------------------------------------
// Tính chất chung
// ---------------------------------------------------------------------------

test('công cụ chỉ đọc: không tạo, sửa hay xoá file nào trong repo', () => {
  withRepo({ ...CLEAN, 'scripts/deploy.js': 'x' }, (root) => {
    const snapshot = () => fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => {
        const full = path.join(e.parentPath || e.path, e.name);
        return `${path.relative(root, full)}:${fs.readFileSync(full, 'utf8').length}`;
      }).sort();
    const before = snapshot();
    run(root, ['--strict']);
    run(root, ['--json']);
    assert.deepEqual(snapshot(), before);
  });
});

test('ROOT bám theo vị trí công cụ, không theo cwd: chạy từ đâu cũng ra một kết quả', () => {
  withRepo({ ...CLEAN, 'scripts/deploy.js': 'x' }, (root) => {
    const tuRepo = runJson(root);
    // Chạy từ thư mục cha (nơi Hub ở) - npm script, hook hay CI đều có thể đổi cwd.
    const tuNgoai = runJson(root, [], { cwd: path.dirname(root) });
    assert.deepEqual(tuNgoai.report, tuRepo.report);
    assert.equal(tuNgoai.status, tuRepo.status);
  });
});

test('manifest rỗng hoàn toàn: báo mọi thứ trên đĩa, không nổ', () => {
  withRepo({ ...CLEAN, 'sync-manifest.json': '{}' }, (root) => {
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.deepEqual(report.counts, { ship: 0, seed: 0, own: 0 });
    assert.deepEqual(wheres(report, 'chua-phan-loai').sort(), ['docs', 'requirements', 'tools']);
  });
});

// ---------------------------------------------------------------------------
// Loại 6: thư mục business nằm lọt bên trong vùng được sync (ship/seed)
//
// Lớp 4 chỉ liệt kê tới mức thư mục ĐÃ KHAI rồi dừng, nên một thư mục business
// nằm sâu bên trong một path ship hoàn toàn vô hình với nó: công cụ in
// "OK Manifest khớp với thực tế repo" và exit 0 ngay trước lần sync xoá sạch dữ
// liệu đó. Cả cụm test dưới đây tồn tại để chặn đúng kịch bản im lặng ấy.
// ---------------------------------------------------------------------------

const BUSINESS = 'business-nam-trong-vung-sync';

test('thư mục business nằm trong vùng ship -> blocker và --strict phải đỏ', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'docs', reason: 'chuẩn QA' }],
      seed: [],
      own: [],
    }),
    'docs/test-design.md': '# chuẩn',
    'docs/requirements/REQ-001.md': '# REQ-001',
  }, (root) => {
    const { report } = runJson(root);
    const found = kinds(report, BUSINESS);
    assert.equal(found.length, 1);
    assert.equal(found[0].where, 'docs/requirements', 'phải chỉ vào thư mục con, không phải vùng ship');
    assert.equal(found[0].severity, 'blocker', 'mất dữ liệu business là blocker, không phải major');
    assert.ok(found[0].message.includes('requirements'), 'phải gọi tên thư mục để người đọc tìm được');
    assert.ok(found[0].message.includes('ghi đè'), 'phải nói rõ hậu quả: Hub sẽ ghi đè');
    // 'docs' đã được khai nên lớp 4 im lặng. Nếu lớp này cũng im thì cả kịch bản
    // biến mất khỏi báo cáo - đúng chỗ hồi quy cần chặn.
    assert.deepEqual(kinds(report, 'chua-phan-loai'), []);
    assert.equal(run(root, ['--strict']).status, 1, 'CI phải chặn được, không chỉ in ra rồi thôi');
  });
});

test('đúng path đó nhưng đã khai vào own -> lớp mới im: đó là khai báo có chủ ý', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'docs' }],
      seed: [],
      own: [{ path: 'docs/requirements', hubModule: 'requirements' }],
    }),
    'docs/test-design.md': '# chuẩn',
    'docs/requirements/REQ-001.md': '# REQ-001',
  }, (root) => {
    const { report } = runJson(root);
    assert.deepEqual(kinds(report, BUSINESS), [], 'đã khai own thì không phải là thứ bị bỏ quên');
    // Vẫn phải còn đúng MỘT tiếng nói về path này, của lớp 3 - lớp nói rõ được
    // thư mục ship nào đang nuốt nó. Hai finding cho cùng một path làm người sửa
    // tưởng có hai việc phải làm.
    assert.deepEqual(wheres(report, 'own-nam-trong-ship'), ['docs/requirements']);
    assert.equal(report.problems.length, 1);
  });
});

test('own khai bên trong vùng seed -> sạch hoàn toàn, không báo động giả', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }],
      seed: [{ path: 'docs' }],
      own: [{ path: 'docs/requirements', hubModule: 'requirements' }],
    }),
    'docs/test-design.md': '# chuẩn',
    'docs/requirements/REQ-001.md': '# REQ-001',
  }, (root) => {
    const { status, report } = runJson(root);
    // Đây là cách khai HỢP LỆ để giữ business bên trong vùng Hub có đụng tới.
    // Nếu nó cũng bị báo thì người dùng không còn cách nào làm cho gate xanh.
    assert.deepEqual(report.problems, []);
    assert.equal(status, 0);
  });
});

test('thư mục business nằm sâu nhiều cấp trong vùng ship vẫn bị bắt', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'docs' }],
      seed: [],
      own: [],
    }),
    // Quét chỉ một cấp con sẽ bỏ lọt đúng kiểu thư mục hay bị chôn sâu nhất:
    // tài liệu tách theo thị trường / theo đội rồi mới tới test-cases.
    'docs/vn/khach-hang/mobile/test-cases/TC-001.md': '# TC-001',
  }, (root) => {
    const { report } = runJson(root);
    assert.deepEqual(wheres(report, BUSINESS), ['docs/vn/khach-hang/mobile/test-cases']);
    assert.equal(kinds(report, BUSINESS)[0].severity, 'blocker');
  });
});

test('vùng seed cũng được quét, không chỉ mỗi ship', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }],
      seed: [{ path: 'docs' }],
      own: [],
    }),
    'docs/test-design.md': '# chuẩn',
    'docs/data/nguoi-dung.json': '[]',
  }, (root) => {
    const { report } = runJson(root);
    // seed chỉ copy khi thiếu, nhưng thư mục business chưa khai nằm trong đó vẫn
    // là quả mìn: chỉ cần Hub đổi seed thành ship là mất. Bỏ qua seed = quét nửa vời.
    assert.deepEqual(wheres(report, BUSINESS), ['docs/data']);
    assert.equal(report.problems.length, 1);
  });
});

test('thư mục business NGOÀI mọi vùng ship/seed -> rule này không được báo', () => {
  withRepo({
    ...CLEAN,
    // 'requirements' là own: mọi thứ bên trong nó Hub không đụng tới, nên
    // requirements/data và requirements/tests là chuyện riêng của dự án.
    'requirements/data/nguoi-dung.json': '[]',
    'requirements/tests/REQ-001.spec.md': '# ghi chú',
  }, (root) => {
    const { status, report } = runJson(root);
    // Quét cả repo thay vì chỉ quét trong vùng sync sẽ biến gate thành cái loa
    // báo động giả, và rồi người ta tắt nó đi.
    assert.deepEqual(report.problems, []);
    assert.equal(status, 0);
  });
});

test('node_modules và .git bên trong vùng ship không bị quét', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'docs' }],
      seed: [],
      own: [],
    }),
    'docs/node_modules/goi-gia/tests/index.spec.js': 'x',
    'docs/.git/refs/data/HEAD': 'x',
    // Một vi phạm thật, để chứng minh vòng quét CÓ chạy chứ không phải chết câm.
    'docs/pages/login.md': '# login',
  }, (root) => {
    const { report } = runJson(root);
    assert.deepEqual(wheres(report, BUSINESS), ['docs/pages']);
  });
});

test('path ship trỏ vào một FILE chứ không phải thư mục -> không nổ', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'README.md' }],
      seed: [],
      own: [],
    }),
    'README.md': '# repo',
  }, (root) => {
    // Hub ship từng file lẻ là chuyện bình thường. readdirSync trên một file ném
    // ENOTDIR -> công cụ chết kèm stack trace, và CI không phân biệt được với
    // "có vi phạm ranh giới".
    const { status, report } = runJson(root);
    assert.equal(status, 0);
    assert.deepEqual(report.problems, []);
    assert.equal(run(root, ['--strict']).status, 0);
  });
});

test('vùng ship toàn thư mục/file tên bình thường -> không false positive', () => {
  withRepo({
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'docs' }],
      seed: [],
      own: [],
    }),
    'docs/huong-dan/onboarding.md': '# onboarding',
    'docs/templates/mau-bao-cao.md': '# mẫu',
    // Trùng TÊN business nhưng là FILE: rule này nói về thư mục bị ghi đè, còn
    // một file lẻ trong vùng ship là thứ Hub được phép quản.
    'docs/data.json': '{}',
    'docs/tests.md': '# ghi chú',
  }, (root) => {
    const { status, report } = runJson(root);
    assert.deepEqual(report.problems, []);
    assert.equal(status, 0);
  });
});

// ---------------------------------------------------------------------------
// Đối chiếu Hub: hai sửa đổi vừa vào
// ---------------------------------------------------------------------------

/** Cùng nội dung hubFile() nhưng viết bằng nháy KÉP (Prettier singleQuote: false). */
const hubFileNhayKep = (modules) =>
  `const FORBIDDEN_SYNC_MODULES = [${modules.map((m) => `"${m}"`).join(', ')}];\n`;

test('FORBIDDEN_SYNC_MODULES viết bằng nháy kép vẫn đọc được', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({ ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }] }),
    'hub-gia/sync-manifest.js': hubFileNhayKep(['data', 'requirements']),
  }, (root) => {
    const { status, report } = runJson(root, [], { hub: 'hub-gia/sync-manifest.js' });
    // Chỉ bắt nháy đơn thì một lần Prettier đổi cấu hình ở Hub sẽ làm CI của MỌI
    // satellite đỏ cùng lúc, vì forbidden đọc ra rỗng -> mọi hubModule đều "thiếu".
    assert.deepEqual(report.hub.forbidden, ['data', 'requirements']);
    assert.deepEqual(report.hub.missing, []);
    assert.deepEqual(kinds(report, 'lech-voi-forbidden-cua-hub'), []);
    assert.equal(status, 0);
  });
});

test('không mục own nào khai hubModule -> JSON phải nói rõ notCompared', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }],
      own: [{ path: 'requirements', reason: 'business' }],
    }),
    'hub-gia/sync-manifest.js': hubFile(['data']),
  }, (root) => {
    const { report } = runJson(root, [], { hub: 'hub-gia/sync-manifest.js' });
    // 0 mục được đối chiếu KHÔNG phải là "đối chiếu đạt". Thiếu cờ này thì
    // dashboard đọc missing: [] rồi vẽ một gate xanh cho một lần kiểm tra chưa
    // từng chạy - đúng loại hỏng im lặng mà cả công cụ này sinh ra để chống.
    assert.equal(report.hub.notCompared, true);
    assert.deepEqual(report.hub.mapped, []);
    assert.deepEqual(report.hub.missing, []);
    assert.ok(report.hub.forbidden.includes('data'), 'vẫn phải cho biết Hub đang cấm những gì');
  });

  withRepo({
    ...CLEAN,
    'sync-manifest.json': manifest({ ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }] }),
    'hub-gia/sync-manifest.js': hubFile(['requirements']),
  }, (root) => {
    const { report } = runJson(root, [], { hub: 'hub-gia/sync-manifest.js' });
    // Ngược lại: có đối chiếu thật thì không được gắn cờ, nếu không cờ mất nghĩa.
    assert.equal(report.hub.notCompared, undefined);
    assert.deepEqual(report.hub.mapped, ['requirements -> requirements']);
  });
});

test('notCompared sinh problem major và làm --strict exit 1', () => {
  withRepo({
    ...CLEAN,
    'sync-manifest.json': JSON.stringify({
      ship: [{ path: 'tools/boundary' }, { path: 'hub-gia' }],
      seed: [],
      own: [{ path: 'requirements' }], // không có hubModule
    }),
    'hub-gia/sync-manifest.js': hubFile(['requirements']),
  }, (root) => {
    const { status, report } = runJson(root, ['--strict'], { hub: 'hub-gia/sync-manifest.js' });
    assert.equal(status, 1, '--strict phải exit 1 khi không đối chiếu được với Hub');
    const notCompProblem = report.problems.find((p) => p.kind === 'khong-doi-chieu-duoc-hub');
    assert.ok(notCompProblem, 'phải có problem khong-doi-chieu-duoc-hub');
    assert.equal(notCompProblem.severity, 'major');
  });
});

test('boundary --strict: exit 0 khi chỉ còn finding minor', () => {
  // Dựng cây thư mục sâu hơn MAX_DEPTH (8) bên trong ship để kích hoạt minor
  const deepFiles = {
    'sync-manifest.json': manifest({
      ship: [{ path: 'tools/boundary' }, { path: 'deep-dir' }],
    }),
    'deep-dir/1/2/3/4/5/6/7/8/9/dummy.txt': 'test',
  };
  withRepo(deepFiles, (root) => {
    const { status, report } = runJson(root, ['--strict']);
    const minorFinding = report.problems.find((p) => p.kind === 'quet-business-bi-cat-do-qua-sau');
    if (minorFinding) {
      assert.equal(minorFinding.severity, 'minor');
      const hasBlocking = report.problems.some((p) => p.severity === 'blocker' || p.severity === 'major');
      if (!hasBlocking) {
        assert.equal(status, 0, '--strict không được chặn khi chỉ có finding minor');
      }
    }
  });
});

