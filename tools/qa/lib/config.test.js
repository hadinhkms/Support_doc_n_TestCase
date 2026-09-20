'use strict';
/**
 * Unit test cho qa.config.json.
 *
 * Giá trị của file cấu hình này nằm ở chỗ nó KHÔNG im lặng: gõ nhầm một khoá mà
 * tool vẫn chạy bằng giá trị mặc định là kiểu hỏng tệ nhất, vì báo cáo vẫn ra và
 * không ai biết nó đang soi nhầm thư mục.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig, CONFIG_FILE, DEFAULTS } = require('./config');

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-config-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const withRepo = (files, fn) => {
  const root = makeRepo(files);
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/** Viết thẳng chuỗi thô để test được cả JSON hỏng lẫn BOM. */
const withConfig = (raw, fn) => withRepo({ [CONFIG_FILE]: raw }, fn);

// Repo chưa có file config phải chạy y như trước khi tính năng này tồn tại.
// Nếu case này đỏ thì mọi repo đang dùng tool bỗng phải thêm file mới.
test('không có qa.config.json -> trả về mặc định, source = null', () => {
  withRepo({}, (root) => {
    const c = loadConfig(root);
    assert.equal(c.projectDir, DEFAULTS.projectDir);
    assert.equal(c.project, DEFAULTS.project);
    assert.deepEqual(c.ignoreSpecs, []);
    assert.equal(c.source, null, 'source = null là dấu hiệu "đang chạy bằng mặc định"');
  });
});

test('có file hợp lệ -> giá trị được ghi đè và source chỉ đúng tên file', () => {
  withConfig('{ "projectDir": ".", "project": "Desktop Chrome" }', (root) => {
    const c = loadConfig(root);
    assert.equal(c.projectDir, '.');
    assert.equal(c.project, 'Desktop Chrome');
    assert.deepEqual(c.ignoreSpecs, [], 'khoá không khai vẫn phải lấy mặc định');
    assert.equal(c.source, CONFIG_FILE);
  });
});

// Đây là lý do tồn tại của cả module: một khoá gõ nhầm phải làm tool DỪNG,
// không được âm thầm bỏ qua rồi chạy bằng mặc định.
test('khoá lạ -> ném lỗi và nêu tên khoá sai lẫn danh sách khoá hợp lệ', () => {
  withConfig('{ "projectDirs": "playwright" }', (root) => {
    assert.throws(() => loadConfig(root), (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('projectDirs'), 'phải nói rõ khoá nào sai');
      assert.ok(err.message.includes('projectDir'), 'và gợi ý khoá đúng');
      return true;
    });
  });
});

test('giá trị không phải chuỗi -> ném lỗi (số/boolean/null đều không nhận)', () => {
  for (const bad of ['123', 'true', 'null', '["playwright"]', '{}']) {
    withConfig(`{ "projectDir": ${bad} }`, (root) => {
      assert.throws(() => loadConfig(root), /phải là chuỗi không rỗng/, `giá trị ${bad} phải bị từ chối`);
    });
  }
});

// Chuỗi toàn khoảng trắng nguy hiểm hơn chuỗi rỗng vì nhìn bằng mắt thấy có giá trị.
test('chuỗi rỗng hoặc toàn khoảng trắng -> ném lỗi', () => {
  withConfig('{ "project": "" }', (root) => {
    assert.throws(() => loadConfig(root), /phải là chuỗi không rỗng/);
  });
  withConfig('{ "project": "   " }', (root) => {
    assert.throws(() => loadConfig(root), /phải là chuỗi không rỗng/);
  });
});

test('giá trị chuỗi được cắt khoảng trắng thừa', () => {
  withConfig('{ "project": "  chromium  " }', (root) => {
    assert.equal(loadConfig(root).project, 'chromium');
  });
});

test('ignoreSpecs phải là MẢNG, một chuỗi đơn lẻ bị từ chối', () => {
  withConfig('{ "ignoreSpecs": "tests/e2e" }', (root) => {
    assert.throws(() => loadConfig(root), /"ignoreSpecs" phải là mảng chuỗi không rỗng/);
  });
});

// Một phần tử rỗng trong ignoreSpecs sẽ khớp với MỌI đường dẫn, tức là tắt gate
// toàn bộ trong im lặng. Phải chặn ngay lúc đọc config.
test('ignoreSpecs chứa phần tử rỗng / không phải chuỗi -> ném lỗi', () => {
  for (const bad of ['[""]', '["  "]', '["tests", 3]', '["tests", null]']) {
    withConfig(`{ "ignoreSpecs": ${bad} }`, (root) => {
      assert.throws(() => loadConfig(root), /"ignoreSpecs" phải là mảng chuỗi không rỗng/, `${bad} phải bị từ chối`);
    });
  }
});

test('ignoreSpecs hợp lệ được chuẩn hoá về dấu / và bỏ tiền tố ./', () => {
  withConfig('{ "ignoreSpecs": ["tests\\\\e2e", "./tests/legacy", "  tests/cu  "] }', (root) => {
    const c = loadConfig(root);
    // So khớp tiền tố trong sources.js luôn dùng dấu /, nên repo Windows viết dấu
    // \\ vẫn phải khớp — nếu không, ignoreSpecs im lặng không có tác dụng gì.
    assert.deepEqual(c.ignoreSpecs, ['tests/e2e', 'tests/legacy', 'tests/cu']);
  });
});

test('mảng rỗng là hợp lệ: khai tường minh "không bỏ qua gì cả"', () => {
  withConfig('{ "ignoreSpecs": [] }', (root) => {
    assert.deepEqual(loadConfig(root).ignoreSpecs, []);
  });
});

// Chỗ duy nhất để ghi chú trong JSON là một khoá giả, vì JSON không có comment.
// Nếu quy ước này mất thì mọi file config có ghi chú sẽ làm tool dừng.
test('khoá bắt đầu bằng $ hoặc _ được coi là ghi chú, không phải khoá lạ', () => {
  withConfig(
    '{ "$schema": "https://x/y.json", "_note": "vì sao để .", "_todo": ["a"], "projectDir": "." }',
    (root) => {
      const c = loadConfig(root);
      assert.equal(c.projectDir, '.');
      assert.equal(c.$schema, undefined, 'ghi chú không được rò vào object cấu hình');
      assert.equal(c._note, undefined);
    },
  );
});

// Editor trên Windows rất hay lưu kèm BOM. Không tha BOM thì JSON.parse ném lỗi
// "Unexpected token" khó hiểu và người dùng không biết file mình sai ở đâu.
test('BOM UTF-8 ở đầu file được tha thứ', () => {
  withConfig('﻿{ "project": "Desktop Chrome" }', (root) => {
    assert.equal(loadConfig(root).project, 'Desktop Chrome');
  });
});

test('JSON hỏng -> ném lỗi có nêu tên file để biết mở file nào', () => {
  withConfig('{ "project": "chromium", }', (root) => {
    assert.throws(() => loadConfig(root), (err) => {
      assert.ok(err.message.includes(CONFIG_FILE));
      assert.ok(err.message.includes('không phải JSON hợp lệ'));
      return true;
    });
  });
});

test('JSON hợp lệ nhưng không phải object (mảng / null / chuỗi) -> ném lỗi', () => {
  for (const raw of ['[]', 'null', '"playwright"', '42']) {
    withConfig(raw, (root) => {
      assert.throws(() => loadConfig(root), /phải là một object JSON/, `${raw} phải bị từ chối`);
    });
  }
});

test('checkBoundaryRules: mặc định true, ghi đè boolean hợp lệ, từ chối non-boolean', () => {
  withRepo({}, (root) => {
    assert.equal(loadConfig(root).checkBoundaryRules, true);
  });
  withConfig('{ "checkBoundaryRules": false }', (root) => {
    assert.equal(loadConfig(root).checkBoundaryRules, false);
  });
  withConfig('{ "checkBoundaryRules": "true" }', (root) => {
    assert.throws(() => loadConfig(root), /phải là boolean/);
  });
});

