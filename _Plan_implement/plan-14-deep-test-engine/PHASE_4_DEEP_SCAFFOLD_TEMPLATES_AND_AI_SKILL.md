# PHASE 4: DEEP SCAFFOLD (`--deep`), TEMPLATES & AI SKILL UPGRADE

> **Thuộc:** [Plan 14 — Deep Logic, Runtime Bug-Trap & UI/UX Geometry Engine](../14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md)  
> **Phiên bản:** 1.1 — 2026-10-23  
> **Phụ thuộc:** Phase 0, Phase 1, Phase 2, Phase 3
> **File mục tiêu:**
> - `[MODIFY]` [`tools/scaffold/index.js`](../../tools/scaffold/index.js) & [`tools/scaffold/index.test.js`](../../tools/scaffold/index.test.js)
> - `[MODIFY]` [`.agents/skills/qa-logic-gaps/SKILL.md`](../../.agents/skills/qa-logic-gaps/SKILL.md)
> - `[MODIFY]` [`docs/qa-test-design-standard.md`](../../docs/qa-test-design-standard.md)

---

## 1. Mục Tiêu: Tự Động Hoá Việc Tạo Bộ Test Chuyên Sâu Ngay Từ Khâu Khởi Tạo

Nếu đã có `ui-checks.ts` (Phase 1) và `deep-guards.ts` (Phase 2) nhưng mỗi lần tạo tính năng mới (`REQ-002`, `REQ-003`...), tester vẫn phải nhớ và import thủ công từng hàm thì hiệu suất áp dụng sẽ thấp.

Phase 4 nâng cấp:
1. **`tools/scaffold` (Chế độ `--deep`)**: Khi chạy `npm run qa:scaffold -- --req REQ-002 --slug checkout --title "Thanh toán" --deep` (hoặc chọn trong `--wizard`), công cụ tự động sinh trọn bộ:
   - Requirement có sẵn cấu hình `Page exposure`, bảng `Rules and validation` (gồm Textbox chữ, Textbox số, Submit action) và mục `UI/UX & Layout`.
   - File `test-cases/REQ-xxx-*.md` có sẵn các Test Case phủ đủ 5 lớp: **Happy Path (`@journey`)**, **Negative & Zero-Mutation (`PA-04`)**, **Boundary BVA (`DH-03`/`DH-04`)**, **Security/Double-Submit (`@security` / `DH-01`)**, và **UI/UX Layout Geometry (`@ui` / `@a11y`)**.
   - File `.spec.ts` import sẵn `expectCleanUiState`, `expectZeroNetworkMutations`, `expectDoubleSubmitProtection`, `captureJourneyStep` để tester chỉ việc điền locator thật vào là chạy săn bug ngay.
2. **Nâng cấp Skill AI [`.agents/skills/qa-logic-gaps/SKILL.md`](../../.agents/skills/qa-logic-gaps/SKILL.md)**:
   - Bổ sung hướng dẫn để AI Agent khi thực hiện **Step 2 (Deep Business & UI/UX Audit)** và **Step 5 (Remediation)** luôn ưu tiên sử dụng các hàm chuẩn hoá trong `deep-guards.ts` và `ui-checks.ts` thay vì viết các câu lệnh assert rời rạc.

---

## 2. Thiết Kế Chi Tiết Trong [`tools/scaffold/index.js`](../../tools/scaffold/index.js)

### 2.1. Bổ sung cờ `--deep` vào `parseArgs()` và `runWizard()`
- Trong `parseArgs(argv)`:
  - Hỗ trợ `--deep` (`flags.deep = true`).
- Trong `runWizard()`:
  - Thêm câu hỏi ngắn: `Bật chế độ Deep Test (tự sinh thêm TC Boundary, Double-Submit, Security & UI/UX Layout)? (Y/n) [Mặc định: Y]:`.

### 2.2. Cấu trúc Spec Sinh Ra Khi Bật `--deep`
Khi `flags.deep === true`, file `playwright/tests/<domain>/<slug>.spec.ts` sinh ra sẽ import sẵn:
```typescript
import { test, expect } from '../fixtures/test-fixtures';
import { captureJourneyStep } from '../support/evidence';
import { expectCleanUiState, expectMaxLengthEnforced } from '../support/ui-checks';
import {
  expectDoubleSubmitProtection,
  expectZeroNetworkMutations,
} from '../support/deep-guards';
```
Và tạo sẵn các block `@wip` có cấu trúc rõ ràng cho:
- TC-001 - AC-001 (@smoke @p0 @journey): Luồng chính, captureJourneyStep và auto runtimeTrap kiểm tra teardown.
- `TC-002 - AC-002` (`@p1`): Luồng Negative + `expectZeroNetworkMutations` / bảo toàn dữ liệu.
- `TC-003 - AC-001` (`@p1`): Chống bấm đúp `expectDoubleSubmitProtection`.
- `TC-004 - AC-002` (`@ui`, `@a11y`, `@p2`): Kiểm tra giao diện Desktop & Mobile bằng `expectCleanUiState(page, ...)`.

---

## 3. Nâng Cấp [`.agents/skills/qa-logic-gaps/SKILL.md`](../../.agents/skills/qa-logic-gaps/SKILL.md) & [`docs/qa-test-design-standard.md`](../../docs/qa-test-design-standard.md)

### 3.1. Bổ sung bảng ánh xạ "Heuristic $\to$ Code Helper" vào `SKILL.md`
Trong mục **Step 2 & Step 3** của `SKILL.md`, bổ sung bảng đối chiếu trực tiếp để mỗi khi AI phát hiện một Logic Gap hoặc UI/UX Gap thì biết ngay phải gọi hàm nào trong code:

| Mã Heuristic / Gap | Chiều kiểm thử | Helper ưu tiên khi phù hợp contract |
|---|---|---|
| `DH-01` | Rapid Double-Submit | `expectDoubleSubmitProtection(page, options)` (`deep-guards.ts`) |
| `DH-03` / `DH-04` | BVA / Maxlength / Numeric | `expectMaxLengthEnforced(input, max)`, `expectNumericInputRejectsText(input)` (`ui-checks.ts`) |
| `DH-05` | Reflected XSS (Public/Customer) | `expectXssPayloadNeutralized(page, action, options)` (`deep-guards.ts`) |
| `DH-06` | Form Input Preservation on Error | `expectInputsPreserved([{ locator, expectedValue }])` (`deep-guards.ts`) |
| `PA-04` | Client Validation Zero-Mutation | `expectZeroNetworkMutations(page, action, options)` (`deep-guards.ts`) |
| `UI-Overlap` | Thông báo lỗi đè lên nút/input | `expectPairwiseNoOverlap([...locators])` (`ui-checks.ts`) |
| `UI-Occlusion` | Nút bấm bị che theo trục Z | `expectNotOccluded(locator)` (`ui-checks.ts`) |
| `UI-Clipping` | Chữ bị cắt mất phần đuôi | `expectNoTextClipping(locator)` (`ui-checks.ts`) |
| `UI-Responsive` | Vỡ khung ngang Desktop/Mobile & Ảnh vỡ | `expectCleanUiState(page, options)` (`ui-checks.ts`) |
| Runtime-Silent | Lỗi JS/Console/5xx | Auto fixture runtimeTrap; checkpoint assertClean tùy chọn |

---

## 4. Tiêu Chuẩn Nghiệm Thu Phase 4

1. Chạy `npm test` xác nhận toàn bộ unit test của `tools/scaffold/index.test.js` (cả chế độ mặc định để giữ nguyên backward-compatibility lẫn chế độ `--deep` mới) đều PASS 100%.
2. Spec sinh ra từ `scaffold --deep` khi chạy qua `tools/qa gaps` không phát sinh bất kỳ lỗi cú pháp hay lỗi thiếu liên kết truy vết nào.


## 5. Ràng buộc scaffold/templates bản 1.1

- Bổ sung templates/requirement-template.md, test-case-template.md, automation-plan-template.md; README scaffold nếu có. Metadata applicability/capability/Coverage notes theo Phase 3.
- Không tự gán public/XSS required hoặc expected nghiệp vụ. Thiếu dữ liệu giữ unknown + Open questions; không sinh rule Textbox số khi không có trường số.
- Các block §2.2 là skeleton; --deep còn cần Boundary và XSS khi applicability xác nhận. Double-submit không thay XSS. Chưa xác nhận giữ @wip, không tính automated coverage.
- Stub phải typecheck/lint/list được, ghi chưa triển khai. Không bỏ @wip với callback rỗng hay matcher mọi URL. Dùng fixture chuẩn và helper options Phase 2.
- Smoke/P0 @wip phải bị loại khỏi PR; kiểm chứng grep workflow, không chỉ chuỗi tag.
- Test scaffold trong workspace tạm/custom qa.config.json và chạy verify thật; gaps --deep-coverage phải báo đúng planned/WIP, không tắt rule để có zero gaps.
- Unit tests mặc định giữ tương thích; thêm test --deep/wizard, unknown/exemption và import paths.
