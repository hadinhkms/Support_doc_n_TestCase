'use strict';
/**
 * Cấu hình layout cho tools/qa.
 *
 * Mỗi repo để Playwright một kiểu: repo này để ở `playwright/` với project tên
 * `chromium`, nhưng repo khác có thể để `playwright.config.js` ngay ở gốc và đặt
 * tên project là `Desktop Chrome`. Hard-code hai giá trị này khiến tool chỉ chạy
 * được ở đúng một repo.
 *
 * Thứ tự ưu tiên: cờ CLI > qa.config.json ở gốc repo > mặc định.
 * Zero dependency, giống phần còn lại của tools/.
 */

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = 'qa.config.json';

/** Mặc định giữ nguyên hành vi cũ để repo chưa có config không bị đổi gì. */
const DEFAULTS = {
  // Thư mục chứa playwright.config.* — `.` nghĩa là gốc repo.
  projectDir: 'playwright',
  // Tên project trong playwright.config dùng để liệt kê test.
  project: 'chromium',
  // Thư mục tài liệu. Repo để requirement ở chỗ khác mà không khai được thì tool
  // chạy một gate RỖNG màu xanh — nguy hiểm hơn hẳn việc báo lỗi.
  requirementsDir: 'requirements',
  testCasesDir: 'test-cases',
  // Tiền tố đường dẫn spec nằm NGOÀI phạm vi gate, tính từ gốc repo.
  // Dùng khi một repo có sẵn spec cũ chưa kịp gắn mã TC: thay vì để gate đỏ
  // vĩnh viễn rồi cả đội quen bỏ qua, khoanh vùng chúng lại một cách có ghi chép.
  // Số test bị bỏ qua LUÔN được in ra, không bao giờ im lặng.
  ignoreSpecs: [],
  // Bật đối chiếu quy tắc phân tích biên (EP + BVA). Mặc định bật theo Plan 10/11.
  checkBoundaryRules: true,
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULTS));
const ARRAY_KEYS = new Set(['ignoreSpecs']);
const BOOLEAN_KEYS = new Set(['checkBoundaryRules']);

/**
 * Đọc qa.config.json nếu có. Ném lỗi khi file sai định dạng hoặc sai khoá —
 * im lặng bỏ qua một khoá gõ nhầm sẽ khiến tool chạy bằng giá trị mặc định
 * mà không ai biết.
 */
function loadConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  // Sao chép mảng: trả thẳng DEFAULTS.ignoreSpecs khiến mọi lần gọi dùng CHUNG một
  // mảng, nên một tiến trình sống lâu (dashboard) lỡ mutate là đầu độc repo khác.
  if (!fs.existsSync(file)) return { ...DEFAULTS, ignoreSpecs: [...DEFAULTS.ignoreSpecs], source: null };

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`${CONFIG_FILE} không phải JSON hợp lệ: ${err.message}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${CONFIG_FILE} phải là một object JSON`);
  }

  const config = { ...DEFAULTS, ignoreSpecs: [...DEFAULTS.ignoreSpecs], source: CONFIG_FILE };
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('$') || key.startsWith('_')) continue; // chỗ để ghi chú
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(
        `${CONFIG_FILE}: khoá không hợp lệ "${key}". Chỉ nhận: ${[...KNOWN_KEYS].join(', ')}`,
      );
    }
    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== 'boolean') {
        throw new Error(`${CONFIG_FILE}: "${key}" phải là boolean (true/false)`);
      }
      config[key] = value;
      continue;
    }
    if (ARRAY_KEYS.has(key)) {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) {
        throw new Error(`${CONFIG_FILE}: "${key}" phải là mảng chuỗi không rỗng`);
      }
      config[key] = value.map((v) => v.trim().replace(/\\/g, '/').replace(/^\.\//, ''));
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${CONFIG_FILE}: "${key}" phải là chuỗi không rỗng`);
    }
    config[key] = value.trim();
  }
  return config;
}

module.exports = { loadConfig, CONFIG_FILE, DEFAULTS };
