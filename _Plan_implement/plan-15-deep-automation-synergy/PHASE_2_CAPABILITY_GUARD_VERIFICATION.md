# PHASE 2: CAPABILITY ↔ GUARD VERIFICATION ENGINE (`tools/qa/lib/commands.js` & `learner.js`)

> **Thuộc:** [Plan 15](../15_AUTOMATION_AND_DEEP_TESTING_SYNERGY_PLAN.md)
> **Trạng thái:** DONE
> **Phụ thuộc:** Phase 1
> **File mục tiêu:** `tools/qa/lib/commands.js`, `tools/qa/lib/learner.js`

---

## 1. Mục tiêu
Đóng lỗ hổng lớn nhất giữa thiết kế Test Case chuyên sâu và viết Script Automation: Khi một Test Case đã khai báo `- **Capabilities**: ...` và đã được gắn `Automation: Yes` (không mang `@wip` hay `test.skip`), `tools/qa gaps` phải đối chiếu xem bên trong thân hàm test của `.spec.ts` đã thực sự gọi helper kiểm chứng tương ứng hay chưa.

## 2. Bảng ánh xạ `CAPABILITY_GUARD_RULES` trong `tools/qa/lib/commands.js`

| Capability trong TC | Điều kiện thoả mãn trên Test (`t`) | Mã Finding khi thiếu | Hành động khuyến nghị (`action`) |
|---|---|---|---|
| `idempotency` | `matchers` chứa `helper:expectIdempotentSubmit` hoặc `helper:expectIdempotentApiMutation` | `missing-idempotency-guard` | Sử dụng `expectIdempotentSubmit` (UI) hoặc `expectIdempotentApiMutation` (API) |
| `persistence` | `matchers` chứa `helper:expectStatePersistence` | `missing-persistence-guard` | Sử dụng `expectStatePersistence` từ `support/deep-guards` để chứng minh trạng thái bền vững sau reload |
| `resilience` | `matchers` chứa `helper:expectNetworkFaultRecovery` | `missing-resilience-guard` | Sử dụng `expectNetworkFaultRecovery` từ `support/deep-guards` để kiểm chứng khôi phục sau lỗi mạng/5xx |
| `concurrency` | `matchers` chứa `helper:expectMultiTabConcurrency` | `missing-concurrency-guard` | Sử dụng `expectMultiTabConcurrency` từ `support/deep-guards` để kiểm chứng chống ghi đè đa tab |
| `boundary` | `matchers` chứa `helper:expectBoundaryRejected` hoặc `helper:expectMaxLengthEnforced` | `missing-boundary-guard` | Sử dụng `expectBoundaryRejected` hoặc `expectMaxLengthEnforced` để kiểm chứng từ chối dữ liệu biên |
| `xss` | `matchers` chứa `helper:expectSafeXssRender` | `missing-xss-guard` | Sử dụng `expectSafeXssRender` từ `support/deep-guards` với `XSS_PAYLOADS` |
| `ui-geometry` | `matchers` chứa ít nhất 1 helper hình học (`expectNoHorizontalScroll`, `expectNoHorizontalOverflow`, `expectNoTextOverflow`, `expectPairwiseNoOverlap`, `expectNoOverlap`, `expectContainedIn`, `expectContainedWithin`, `expectNotOccluded`) | `missing-ui-geometry-guard` | Sử dụng các hàm kiểm tra hình học từ `support/ui-checks` |
| `a11y` | `matchers` chứa `helper:expectInteractiveA11y` hoặc test mang tag `@a11y` | `missing-a11y-guard` | Sử dụng `expectInteractiveA11y` từ `support/ui-checks` hoặc quét `@a11y` (AxeBuilder) |
| `responsive` | `matchers` chứa `helper:expectResponsiveIntegrity` | `missing-responsive-guard` | Sử dụng `expectResponsiveIntegrity` từ `support/ui-checks` qua các mốc viewport |
| `api-security` | `matchers` chứa `helper:expectBolaForbidden` hoặc `helper:expectMassAssignmentIgnored` | `missing-api-security-guard` | Sử dụng `expectBolaForbidden` hoặc `expectMassAssignmentIgnored` từ `support/api-guards` |
| `api-contract` | `matchers` chứa `helper:expectApiSchemaContract` | `missing-api-contract-guard` | Sử dụng `expectApiSchemaContract` từ `support/api-guards` |

## 3. Đồng bộ `STATIC_RULE_MAPPING` trong `tools/qa/lib/learner.js`
- Đăng ký các mã finding `missing-*-guard` mới vào `STATIC_RULE_MAPPING` để hệ thống Selective Learning (`npm run qa:learn`) hiểu các rule tĩnh này và không tạo candidate trùng lặp.

## 4. Tiêu chí hoàn thành (Definition of Done)
- [x] Mọi capability trong bảng trên được kiểm tra tự động trong `gaps()`.
- [x] Mức độ nghiêm trọng tuân theo `deepSeverity` (`minor` khi `checkDeepCoverage = false`, `major` khi `checkDeepCoverage = true`).
- [x] Các spec hiện tại của workspace (`login.spec.ts`, `login.a11y.spec.ts`) và bộ template `tools/scaffold` vượt qua 100% mà không phát sinh cảnh báo giả.
