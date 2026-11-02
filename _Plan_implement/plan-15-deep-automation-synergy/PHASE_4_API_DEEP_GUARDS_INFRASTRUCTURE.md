# PHASE 4: API DEEP GUARDS INFRASTRUCTURE (`playwright/tests/support/api-guards.ts`)

> **Thuộc:** [Plan 15](../15_AUTOMATION_AND_DEEP_TESTING_SYNERGY_PLAN.md)
> **Trạng thái:** DONE
> **Phụ thuộc:** Phase 1, Phase 2
> **File mục tiêu:** `playwright/tests/support/api-guards.ts`, `.agents/skills/qa-api-testing/SKILL.md`

---

## 1. Mục tiêu
Xây dựng bộ hàm kiểm chứng chuyên sâu cho tầng API (`APIRequestContext` / `APIResponse`) để hiện thực hóa các kỹ thuật trong skill `qa-api-testing` (Schema Contract, BOLA/IDOR, Mass Assignment, API Idempotency) mà vẫn tuân thủ nghiêm ngặt **Rule 15** (file `module` trong `tests/support/` phải **< 190 dòng**, dưới vùng vàng 200/250 dòng).

## 2. Thiết kế `playwright/tests/support/api-guards.ts`

### 2.1. `expectApiSchemaContract(response, contract)`
- Kiểm chứng HTTP status code (`expectedStatus`, mặc định `200`).
- Kiểm chứng `content-type` chứa `application/json`.
- Kiểm chứng sự tồn tại và kiểu dữ liệu của `requiredFields` (`Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>`).
- Kiểm chứng danh sách `forbiddenFields` (ví dụ `['password', 'passwordHash', 'salt', 'secret']`) **không được phép xuất hiện** trong JSON response (chống Excessive Data Exposure — OWASP API3).

### 2.2. `expectBolaForbidden(response, options?)`
- Kiểm chứng response trả về một trong các mã chặn hợp lệ (`allowedStatuses`, mặc định `[401, 403, 404]`).
- Kiểm chứng response body **không chứa** các giá trị định danh hoặc dữ liệu nhạy cảm của nạn nhân (`leakedValues?: string[]`).

### 2.3. `expectMassAssignmentIgnored(response, verifyStateFn, options?)`
- Kiểm chứng khi gửi kèm các trường đặc quyền (`role: 'admin'`, `isAdmin: true`, `balance: 999999`), server hoặc trả về `400/422` từ chối, hoặc nếu trả về `2xx` thì kết quả `verifyStateFn()` xác nhận các trường đặc quyền không bị ghi đè.

### 2.4. `expectIdempotentApiMutation(sendMutationFn, options?)`
- Thực thi đồng thời `concurrency` lần (mặc định `3`) hàm `sendMutationFn()` qua `Promise.all`.
- Kiểm chứng số lượng response tạo mới/thay đổi thành công (`200`/`201`) không vượt quá `maxSuccessCount` (mặc định `1`), và không phát sinh lỗi `5xx` (`status >= 500`).

## 3. Cập nhật liên kết trong `.agents/skills/qa-api-testing/SKILL.md`
- Bổ sung hướng dẫn sử dụng 4 hàm từ `playwright/tests/support/api-guards.ts` và các capability `api-security`, `api-contract`, `idempotency` để người dùng và AI Agent áp dụng thống nhất.

## 4. Tiêu chí hoàn thành (Definition of Done)
- [x] `playwright/tests/support/api-guards.ts` có số dòng **< 160 dòng** (kiểm chứng bằng `npm run qa:limits -- --strict`).
- [x] `npm run verify` trong `playwright/` đạt Exit Code `0` (TypeScript typecheck + ESLint).
