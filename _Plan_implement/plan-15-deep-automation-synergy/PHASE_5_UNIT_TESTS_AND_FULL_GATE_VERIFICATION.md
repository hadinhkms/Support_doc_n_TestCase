# PHASE 5: UNIT TESTS, CODE LIMITS & FULL GATE VERIFICATION

> **Thuộc:** [Plan 15](../15_AUTOMATION_AND_DEEP_TESTING_SYNERGY_PLAN.md)
> **Trạng thái:** DONE
> **Phụ thuộc:** Phase 1, Phase 2, Phase 3, Phase 4
> **File mục tiêu:** `tools/qa/lib/sources.test.js`, `tools/qa/lib/commands.test.js`, `tools/qa/index.test.js`

---

## 1. Mục tiêu
Kiểm chứng toàn diện bằng unit test và cổng CI cho mọi thay đổi từ Phase 1 đến Phase 4, đảm bảo không có hồi quy (regression) và không vi phạm giới hạn dòng code (Rule 15).

## 2. Ma trận Unit Test bổ sung

| Mã Test | File Test | Kịch bản kiểm chứng | Kết quả mong đợi |
|---|---|---|---|
| `TC-15-01` | `tools/qa/lib/sources.test.js` | Parse `Page exposure: Customer | Admin` và `XSS applicability: Exempt (reason: ...)` | Nhận diện đúng `Customer`, `Admin` và `{ status: 'Exempt', reason: '...' }` |
| `TC-15-02` | `tools/qa/lib/sources.test.js` | `extractVerifiedHelperImports` với `support/api-guards` (`expectApiSchemaContract`, `expectBolaForbidden`, `expectMassAssignmentIgnored`, `expectIdempotentApiMutation`) | Map đúng canonical helper và bắt `missingAwaits` nếu thiếu `await` |
| `TC-15-03` | `tools/qa/lib/commands.test.js` | `gaps()` phát hiện thiếu guard cho từng capability: `persistence`, `resilience`, `concurrency`, `boundary`, `ui-geometry`, `a11y`, `responsive`, `xss`, `api-security`, `api-contract` | Phát sinh đúng mã finding `missing-*-guard` và đổi severity theo `checkDeepCoverage` |
| `TC-15-04` | `tools/qa/lib/commands.test.js` | `gaps()` không báo lỗi khi spec đã gọi đúng helper tương ứng với capability đã khai báo | Danh sách finding `missing-*-guard` rỗng (`0` false-positive) |
| `TC-15-05` | `tools/qa/index.test.js` | Cờ CLI `--deep-coverage` và `--no-deep-coverage` trên `gaps` và từ chối khi gọi cùng `learn` | Hoạt động đúng như thiết kế, exit code chuẩn |

## 3. Cổng kiểm chứng bắt buộc (Verification Commands)
1. Chạy toàn bộ unit test của `tools/`:
   ```bash
   npm test
   ```
2. Chạy cổng kiểm chứng Playwright (`typecheck` + `lint` + `limits` + `--list`):
   ```bash
   cd playwright && npm run verify
   ```
3. Chạy cổng kiểm chứng tổng ở thư mục gốc (`boundary` + `drift` + `gaps` + `limits`):
   ```bash
   npm run qa:check
   ```

## 4. Tiêu chí hoàn thành (Definition of Done)
- [x] 100% unit test trong `npm test` PASS.
- [x] `cd playwright && npm run verify` PASS.
- [x] `npm run qa:check` PASS (0 blocker, 0 major).
- [x] Cập nhật trạng thái tất cả các file Phase 1..5 và Master Plan 15 sang `DONE`.
