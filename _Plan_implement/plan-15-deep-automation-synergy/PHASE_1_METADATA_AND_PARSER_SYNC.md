# PHASE 1: METADATA & PARSER SYNC (`tools/qa/lib/sources.js`)

> **Thuộc:** [Plan 15](../15_AUTOMATION_AND_DEEP_TESTING_SYNERGY_PLAN.md)
> **Trạng thái:** DONE
> **File mục tiêu:** `tools/qa/lib/sources.js`

---

## 1. Mục tiêu
Đồng bộ bộ phân tích cú pháp Markdown và Spec trong `tools/qa/lib/sources.js` để khớp 100% với quy chuẩn trong `.github/copilot-instructions.md` và `tools/scaffold/template.js`, đồng thời mở rộng nhận diện các hàm helper kiểm thử API chuyên sâu.

## 2. Các hạng mục thay đổi chi tiết

### 2.1. Đồng bộ `Page exposure` (4 mức chuẩn)
- **Hiện tại:** Chỉ khớp `/^\s*-\s*\*\*Page exposure\*\*\s*:\s*(Public|Authenticated)\b/i`.
- **Nâng cấp:** Hỗ trợ đủ `Public | Customer | Authenticated | Admin` (không phân biệt hoa thường, chuẩn hoá về dạng PascalCase: `'Public'`, `'Customer'`, `'Authenticated'`, `'Admin'`).

### 2.2. Đồng bộ `XSS applicability` (`Applicable | Exempt | Not applicable`)
- **Hiện tại:** Chỉ khớp `(Applicable|Not applicable)`.
- **Nâng cấp:** Hỗ trợ `(Applicable|Exempt|Not applicable)` kèm `(reason: ...)`.
  - Khi ghi `Exempt` hoặc `Not applicable`, giữ đúng thông tin miễn trừ (`status: 'Exempt'` hoặc `'Not applicable'`, `reason: ...`) để không bị rơi về `null`.

### 2.3. Mở rộng `VERIFIED_GUARD_HELPERS` và `extractVerifiedHelperImports`
- Thêm 4 hàm API Deep Guard chuẩn vào `VERIFIED_GUARD_HELPERS`:
  - `expectApiSchemaContract`
  - `expectBolaForbidden`
  - `expectMassAssignmentIgnored`
  - `expectIdempotentApiMutation`
- Cập nhật regex module path trong `extractVerifiedHelperImports`:
  - Chấp nhận import từ `support/api-guards` (bên cạnh `support/deep-guards`, `support/resilience-guards`).

## 3. Tiêu chí hoàn thành (Definition of Done)
- [x] `loadRequirements` đọc đúng `Page exposure: Customer`, `Page exposure: Admin`, và `XSS applicability: Exempt (reason: ...)`.
- [x] `extractVerifiedHelperImports` nhận diện đúng các hàm import từ `../support/api-guards` (kể cả alias `as` và CommonJS `require`).
- [x] Không làm hỏng bất kỳ unit test hiện có nào trong `tools/qa/lib/sources.test.js`.
