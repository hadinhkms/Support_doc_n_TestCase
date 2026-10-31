# PHASE 3: CLI DEEP COVERAGE FLAGS & CONFIG GATE (`tools/qa/index.js` & `qa.config.json`)

> **Thuộc:** [Plan 15](../15_AUTOMATION_AND_DEEP_TESTING_SYNERGY_PLAN.md)
> **Trạng thái:** DONE
> **Phụ thuộc:** Phase 2
> **File mục tiêu:** `tools/qa/index.js`, `qa.config.json`, `tools/qa/README.md`

---

## 1. Mục tiêu
Cho phép điều khiển chế độ kiểm tra độ phủ chiều sâu (`checkDeepCoverage`) trực tiếp từ CLI (tương tự `--boundary-rules` / `--no-boundary-rules`) và kích hoạt cổng bảo vệ này trong `qa.config.json` của workspace.

## 2. Các hạng mục thay đổi chi tiết

### 2.1. Bổ sung cờ CLI trong `tools/qa/index.js`
- Trong `parseArgs(argv)`:
  - Khởi tạo `flags.checkDeepCoverage = null`.
  - Hỗ trợ `--deep-coverage` (`flags.checkDeepCoverage = true`) và `--no-deep-coverage` (`flags.checkDeepCoverage = false`).
- Trong `validateCommandFlags(command, flags, positional)`:
  - Chặn sử dụng `--deep-coverage` / `--no-deep-coverage` với lệnh `learn` (giống `--boundary-rules`).
- Trong `main`:
  - Gộp `checkDeepCoverage: flags.checkDeepCoverage !== null ? flags.checkDeepCoverage : cfg.checkDeepCoverage` vào `options` truyền xuống `commands`.

### 2.2. Kích hoạt trong `qa.config.json`
- Bật `"checkDeepCoverage": true` trong `qa.config.json` của workspace để lệnh `npm run qa:check` chặn ở mức `MAJOR` nếu có vi phạm kiểm thử chuyên sâu.
- Giữ nguyên `DEFAULTS.checkDeepCoverage = false` trong `tools/qa/lib/config.js` để đảm bảo tương thích ngược 100% cho các unit test dùng thư mục tạm không khai `qa.config.json`.

### 2.3. Cập nhật tài liệu `tools/qa/README.md`
- Ghi chú cờ `--deep-coverage` / `--no-deep-coverage` và khóa `checkDeepCoverage` trong `qa.config.json`.

## 3. Tiêu chí hoàn thành (Definition of Done)
- [x] `node tools/qa gaps --deep-coverage` nâng các finding deep coverage lên `major`.
- [x] `node tools/qa gaps --no-deep-coverage` hạ các finding deep coverage về `minor` kể cả khi `qa.config.json` bật `true`.
- [x] `npm run qa:check` chạy trên workspace hiện tại đạt Exit Code `0`.
