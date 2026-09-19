## Thay đổi gì

<!-- Một đoạn ngắn. Nếu là test mới, nêu REQ/AC được phủ thêm. -->

## Traceability

| Requirement | AC | Test case | Spec |
|---|---|---|---|
| REQ-XXX | AC-001 | TC-001 | `playwright/tests/<domain>/<feature>.spec.ts` |

## Checklist

- [ ] `npm run verify` pass (typecheck + lint + list) trong thư mục `playwright/`.
- [ ] Test title bắt đầu bằng mã `TC-xxx`.
- [ ] Đã gắn tag priority (`@p0`..`@p3`) và loại (`@smoke`/`@security`/`@a11y`) nếu phù hợp.
- [ ] Locator theo `docs/selector-convention.md`, không có CSS phụ thuộc layout.
- [ ] Không có `waitForTimeout`, không có test phụ thuộc thứ tự chạy.
- [ ] Dữ liệu được seed và cleanup theo `docs/test-data-management.md`.
- [ ] Không có credential thật trong diff (`.env` không được commit).
- [ ] `npm run qa:check` pass ở thư mục gốc (drift + gaps).
- [ ] Đã chạy `npm run qa:impact -- REQ-xxx` nếu sửa requirement, và xử lý hết file nó liệt kê.
- [ ] Đã cập nhật `test-cases/traceability.md`.
- [ ] Test đã chạy hai lần liên tiếp để kiểm tra rerun/cleanup.

## Case không automation

<!-- Case nào đã cân nhắc nhưng quyết định không automation, và lý do theo docs/automation-strategy.md. -->
