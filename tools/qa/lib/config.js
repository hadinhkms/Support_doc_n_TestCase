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
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULTS));

/**
 * Đọc qa.config.json nếu có. Ném lỗi khi file sai định dạng hoặc sai khoá —
 * im lặng bỏ qua một khoá gõ nhầm sẽ khiến tool chạy bằng giá trị mặc định
 * mà không ai biết.
 */
function loadConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) return { ...DEFAULTS, source: null };

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`${CONFIG_FILE} không phải JSON hợp lệ: ${err.message}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${CONFIG_FILE} phải là một object JSON`);
  }

  const config = { ...DEFAULTS, source: CONFIG_FILE };
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('$') || key.startsWith('_')) continue; // chỗ để ghi chú
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(
        `${CONFIG_FILE}: khoá không hợp lệ "${key}". Chỉ nhận: ${[...KNOWN_KEYS].join(', ')}`,
      );
    }
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${CONFIG_FILE}: "${key}" phải là chuỗi không rỗng`);
    }
    config[key] = value.trim();
  }
  return config;
}

module.exports = { loadConfig, CONFIG_FILE, DEFAULTS };
