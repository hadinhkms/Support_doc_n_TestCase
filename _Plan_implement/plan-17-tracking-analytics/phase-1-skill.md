# Phase 1 — Skill qa-tracking-analytics

> **Status:** IMPLEMENTED 2026-11-05
> **Parent:** [Plan 17](../17_TRACKING_ANALYTICS_SKILL_PLAN.md)

## Đã làm

- `.agents/skills/qa-tracking-analytics/SKILL.md`: workflow Step 0–6 (chọn nguồn, nạp ngữ cảnh,
  bắt behavior, đánh giá, suy ra report, báo cáo, chuyển thành test) và quy tắc an toàn.
- `references/event-design-checklist.md`: checklist `TR-01`..`TR-72` theo 8 nhóm.
- `references/report-catalog.md`: loại report ↔ điều kiện dữ liệu ↔ lỗi tracking làm hỏng.
- `references/flow-capture-guide.md`: bắt request Mixpanel bằng browser tích hợp và Playwright.
- `templates/tracking-review-report.md`: mẫu báo cáo.
- README (bảng skill) và `.github/copilot-instructions.md` (mục "Review tracking và analytics").

## Exit gate

- `npm run qa:limits -- --strict` pass; `npm run qa:check` không thêm finding mới (còn `.claude` có từ trước); unit test `tools/` pass.
- Skill được trỏ từ copilot-instructions để agent tìm thấy.

## Chưa kiểm chứng

- ~~Chưa chạy skill trên flow thật~~ → đã chạy ở Phase 4 (JS-8939); checklist bổ sung `TR-24/25/36/37`.
