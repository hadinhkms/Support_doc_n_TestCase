# Phase 3 — Templates và Traceability cho Tracking

> **Status:** IMPLEMENTED 2026-11-05 — unit test xanh; chưa áp dụng cho REQ thật (Phase 4)
> **Depends on:** Phase 2 (helper bắt buộc cho capability `tracking`)
> **Parent:** [Plan 17](../17_TRACKING_ANALYTICS_SKILL_PLAN.md)

## Mục tiêu

Yêu cầu tracking được viết, review và test theo cùng chuẩn REQ → AC → TC → script.

## Đã làm

| Task | Kết quả |
|---|---|
| Tracking plan template | `templates/tracking-plan-template.md`: câu hỏi report, quy ước, bảng event, property, identity, super property/profile, môi trường, open questions, change log |
| Vị trí file | `test-cases/REQ-xxx-<slug>.tracking-plan.md`, cạnh `.automation-plan.md`. **Không** đặt trong `requirements/`: `loadRequirements` coi mọi `.md` ở đó là REQ và báo blocker `requirement-khong-co-front-matter` |
| REQ template | Thêm dòng `Tracking` trong `## Coverage notes` và mục `## Tracking` (link plan + mẫu AC event) |
| TC template | Thêm `Type: Tracking`, tag `@tracking`, capability `tracking` |
| `tools/qa` | `sources.js`: tin helper `expectMixpanelEvent`/`expectNoMixpanelEvent` chỉ khi import từ `support/mixpanel-capture` (hoặc qua fixtures). `commands.js`: rule `tracking` → finding `missing-tracking-guard`. `learner.js`: thêm vào `STATIC_RULE_MAPPING` (`coverage: partial`) |
| Unit test | `sources.test.js` TC-17-P3-01 (nhận diện import, alias, thiếu `await`, từ chối module lạ); `commands.test.js` TC-15-03 mở rộng lên 12 capability; `learner.test.js` cập nhật danh sách finding hợp lệ |
| Tài liệu | `copilot-instructions.md` bước 4, SKILL Step 6 |

## Vì sao `coverage: partial`

Gọi `expectMixpanelEvent` chỉ chứng minh spec có kiểm event, không chứng minh kiểm đúng event
và property theo tracking plan. Phần đối chiếu nội dung vẫn là review bằng skill.

## Exit gate

- `node --test` toàn bộ `tools/` pass.
- `npm run qa:check` không phát sinh finding mới trên repo hiện tại.
- `npm run verify` trong `playwright/` pass.
