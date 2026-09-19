# Automation Plan: REQ-XXX <Tên feature>

## Candidate selection

Chấm 1-5 theo `docs/automation-strategy.md`. `Maintenance` chấm ngược: 5 = rẻ bảo trì, 1 = đắt.
Ngưỡng đề xuất automation: tổng từ 17/25, hoặc là P0/P1 critical path.

| Test case | Frequency | Risk | Stability | Feasibility | Maintenance | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| TC-001 | 5 | 5 | 4 | 5 | 4 | 23 | Automate |

## Script contract

- Spec file: `playwright/tests/<domain>/<feature>.spec.ts`
- Test title: `<TC-ID> - <short title>`
- Setup: <fixture/API/seed>
- Steps: <numbered user-observable actions>
- Assertions: <main result + side effects>
- Cleanup: <...>
- Evidence on failure: trace, screenshot, video

## Rủi ro của bản thân bộ automation

- Điểm hỏng tập trung (setup/fixture dùng chung) nếu fail thì kéo theo bao nhiêu test?
- Giả định nào về locator/test id chưa được dev xác nhận?
- Test nào có thể đỏ vì lý do không phải hồi quy chức năng (vd quét a11y khi design đổi màu)?

## Automation readiness checklist

- [ ] Stable locator available (`data-testid` or accessible role/name).
- [ ] Test data can be seeded and cleaned up.
- [ ] No real secret/OTP/payment dependency.
- [ ] Expected result is deterministic.
- [ ] Test is independent and rerunnable.
- [ ] Requirement and test case IDs are included in title/tag.
- [ ] Đã cập nhật `test-cases/traceability.md`.
