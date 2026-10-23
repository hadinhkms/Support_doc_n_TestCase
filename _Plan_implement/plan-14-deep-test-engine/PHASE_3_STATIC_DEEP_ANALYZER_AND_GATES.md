# PHASE 3: STATIC DEEP-QUALITY ANALYZER & GATE RULES

> **Thuộc:** [Plan 14](../14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md)  
> **Phiên bản:** 1.1 — 2026-10-23  
> **Phụ thuộc:** Phase 0; có thể triển khai độc lập Phase 1–2 sau khi chốt contract.  
> **File mục tiêu:** tools/qa/lib/sources.js, commands.js và tests; tools/qa/index.js, index.test.js, README.md.

## 1. Phạm vi và tên chuẩn

Static chỉ đo chỉ dấu capability, không suy ra runtime PASS từ tag/số assertion. Tên chuẩn: public-page-thieu-security-test, ui-req-thieu-layout-check, negative-tc-assertion-yeu; JSON deepMetrics. Bỏ cam kết deepTestingScore/deepCoverage/deepTestingMetrics/req-thieu-ui-check của 1.0 vì chưa có công thức điểm chất lượng hợp lệ.

## 2. Metadata và parser

### 2.1. Requirement/TC

- Parse Page exposure: public|customer|admin|internal, thiếu giữ unknown/null; không đoán từ URL.
- Parse UI coverage và XSS applicability: required|not-applicable|unknown. Related pages/modules chỉ gợi ý review, bảng rules không chứng minh có sink XSS.
- Coverage notes dùng bảng Capability | Applicability | Reason | Owner | Evidence; capability xss hoặc layout. Miễn trừ cần not-applicable + reason + owner + evidence, đúng capability; ghi chú chung không tắt rule khác. Metadata thiếu/sai sinh deep-metadata-chua-ro minor khi bật deep coverage.
- Parse Type/Tags và Capabilities: xss, layout, negative-side-effect theo TC; spec XSS có @xss cùng @security. Join bằng REQ/AC/TC, không đếm test requirement khác.
- Automation chỉ tính TC có spec không @wip/skip, đúng liên kết và có assertion nhận diện được. Manual/planned/exempt tách riêng. Cookie/auth @security không thay xss; exemption không tính là test chạy.

### 2.2. Assertion helper

- Nhận diện qua import từ support/ui-checks hoặc deep-guards, kể cả alias. Không cộng hàm local/comment/string trùng tên hay object bất kỳ có assertClean.
- Helper có assertion thật được cộng assertionCount/profile mixed; mixed không chứng minh outcome nghiệp vụ. Không biến auto runtimeTrap thành business assertion cho mọi test.
- assertClean đồng bộ; helper async cần kiểm tra await/return/await Promise.all. Không thêm tên helper tùy tiện vào ASYNC_MATCHERS vốn xử lý cú pháp matcher expect.
- Callback không phân tích chắc chắn giữ unknown + reason, không coi assertion mạnh hay PASS.

## 3. Rules và CLI

| Finding | Severity | Điều kiện khi bật deep coverage |
|---|---|---|
| public-page-thieu-security-test | minor, DH-05 partial | Public/customer + XSS required, thiếu TC/spec xss hợp lệ và không có exemption hợp lệ. Auth/cookie tag không xóa finding. |
| ui-req-thieu-layout-check | minor | UI required, thiếu TC/spec layout có helper UI nhận diện được và không có exemption hợp lệ. @a11y đơn thuần chưa chứng minh geometry. |
| negative-tc-assertion-yeu | minor, PA-04 partial | TC Negative/Error thiếu chỉ dấu absence-of-side-effect đúng TC hoặc zero-mutation helper; không dùng số expect <=1 kết luận nghiệp vụ sai. |
| deep-metadata-chua-ro | minor | Metadata applicability hoặc exemption chưa đủ. |

Assertion side-effect tương đương viết trực tiếp được hỗ trợ khi parser nhận diện chắc chắn. Unknown phải kèm file:line/reason và yêu cầu semantic review; tag không tự tắt rule.

CLI dự kiến phải triển khai:

- --deep-coverage cho gaps/summary, truyền options.checkDeepCoverage bật cả ba chiều; mặc định off giữ tương thích. Bỏ options.checkUiCoverage riêng không có CLI.
- --fail-on=minor|major|blocker cho gaps/drift. Từ chối giá trị sai, tổ hợp với --strict và command không hỗ trợ. --strict cũ vẫn tương đương major.
- G4 chạy gaps --deep-coverage --fail-on=minor và drift --fail-on=minor bên cạnh qa:check cũ. Một minor phải exit 1. Không đổi chính sách mặc định project.
- Các flag này là phần cần code, chưa phải khả năng hiện có.

## 4. JSON deepMetrics

Giữ field JSON cũ; thêm deepMetrics schemaVersion:1. securityTests/uiUxTests/journeyTests đếm test logic theo file+REQ+TC+title, không nhân browser. uiHelperCalls/deepGuardCalls là số test có gọi helper; tách excludedWip/excludedSkipped/unclassifiedTests.

capabilities.xss|layout|negativeSideEffect gồm applicable, automated, manual, planned, exempt, unknown. Đơn vị xss/layout là requirement, negativeSideEffect là TC Negative/Error. Denominator=0 trả tỷ lệ null + not-applicable; unknown không thành covered. Các nhóm manual/planned/automated có thể giao nhau khi requirement có nhiều TC: ghi rõ nhóm độc lập, không cộng thành tổng. Chỉ số static không khẳng định runtime PASS.

## 5. Ma trận tests

| ID | Kịch bản | Expected |
|---|---|---|
| DT-01 | Helper đúng nguồn/alias, chỉ helper | Đếm assertion; không báo thiếu assertion/URL-only |
| DT-02 | Quên await; return; await Promise.all | Chỉ thiếu chờ bị major; assertClean sync không bị nhầm |
| DT-03 | Cookie/auth @security; XSS required | Vẫn finding; @xss WIP/skip/khác REQ không xóa finding |
| DT-04 | Metadata thiếu/sai, exemption layout | Unknown được báo; không miễn trừ chéo xss |
| DT-05 | Một assertion negative mạnh; nhiều assert UI yếu | Không dùng số expect làm oracle; unknown có reason |
| DT-06 | Helper local/comment/string/object assertClean khác | Không cộng assertion helper |
| DT-07 | Multi-browser/WIP/manual/0 applicable | Không đếm nhân; JSON cũ nguyên; denominator=0 trả null |
| DT-08 | Deep coverage/fail-on CLI | Default tương thích; 1 minor exit 1; sai flag/value/command bị từ chối |
| DT-09 | Custom qa.config.json | Join đúng paths; harness không thành business coverage |
| DT-10 | Gate boundary/drift/gaps | Finding làm exit nonzero đúng threshold, không chỉ kiểm console |

## 6. Nghiệm thu

Unit/CLI tests cũ+mới PASS; README flags, JSON fixture/schema và templates metadata đồng bộ. Ghi baseline khi bật deep coverage. Không xóa finding bằng exemption chung/tag trang trí hoặc thay expected chưa được owner xác nhận.
