# Plan 17 — Tracking & Analytics Review (Mixpanel)

> **Status:** Phase 1–4 IMPLEMENTED (2026-11-05) tại Hub; Phase 5 IMPLEMENTED (chờ MCP EU, Jira comment)
> **Owner:** QA
> **Phase files:** [plan-17-tracking-analytics/](plan-17-tracking-analytics/)

## Mục tiêu

Đưa năng lực review tracking vào workspace để AI và QA có thể:

1. Review tracking req: event nào nên bắn, thiết kế nào làm report khó hoặc sai.
2. Chạy flow thật (flow đã build) hoặc đọc REQ/Figma (flow chưa build) để suy ra event cần có.
3. Xác định report khai thác được (Funnel, Retention, Flows, Breakdown…) và phần còn thiếu.
4. Biến yêu cầu tracking thành AC/TC/script Playwright có traceability như các REQ khác.

## Quy tắc chọn nguồn (đã chốt với user 2026-11-05)

- Flow đã build → chạy flow thật, bắt network và Live Events. Không dùng Figma.
- Mới có REQ → dựng flow từ Figma hoặc mô tả trong REQ.

## Phases

| Phase | Nội dung | Trạng thái | File |
|---|---|---|---|
| 1 | Skill `qa-tracking-analytics` + checklist `TR-xx` + report catalog + template báo cáo; trỏ từ README và copilot-instructions | ✅ Done | [phase-1-skill.md](plan-17-tracking-analytics/phase-1-skill.md) |
| 2 | Helper Playwright bắt và decode event Mixpanel (`mixpanel-capture.ts`) + unit test | ✅ Done | [phase-2-playwright-capture-helper.md](plan-17-tracking-analytics/phase-2-playwright-capture-helper.md) |
| 3 | Template tracking plan, mục Tracking trong REQ/TC template, capability `tracking` trong `tools/qa` | ✅ Done | [phase-3-templates-and-traceability.md](plan-17-tracking-analytics/phase-3-templates-and-traceability.md) |
| 4 | Pilot trên flow thật: JS-8939 filter tỉnh thành, vieclam24h.vn QC (thay cho REQ-001 vì app mẫu không chạy) | ✅ Done (Desktop guest; MCP EU chưa nối) | [phase-4-pilot-js-8939.md](plan-17-tracking-analytics/phase-4-pilot-js-8939.md) |
| 5 | Rollout sang `D:/_SV_Automation` (qua `_Automation-Project`): skill, helper JS `core/deep-testing`, REQ-013 + spec JS-8939 | ✅ Done (MCP EU, Jira comment còn chờ user) | [phase-5-satellite-rollout.md](plan-17-tracking-analytics/phase-5-satellite-rollout.md) |

## Việc ngoài Plan 17 phát hiện khi audit (có từ trước)

- `npm run qa:check` báo `chua-phan-loai` cho `.claude/` (worktrees, log của Claude Code) chưa có trong
  `sync-manifest.json`. Các exit gate "qa:check pass" ở Phase 1–3 nghĩa là **không thêm finding mới**.
- `npm test` (`node --test tools/`) lỗi trên Node 22.3 vì truyền thư mục; unit test được chạy bằng danh
  sách file `*.test.js` (281/281 pass).

## Phụ thuộc

- Phase 3 dùng helper của Phase 2 làm "helper bắt buộc" cho capability `tracking`.
- Phase 4 cần Phase 2 (và nên có Phase 3) cùng quyền truy cập môi trường test.

## Ranh giới Hub ↔ Project

- `.agents/skills/qa-tracking-analytics`, `templates/`, `tools/qa`: `ship`.
- `playwright/tests/support/mixpanel-capture.ts`: `seed` (theo `playwright/tests/support`).
- REQ/TC/spec của pilot: `own`.
- Project vệ tinh (ví dụ SV_Automation, JavaScript) không có `playwright/tests/support`; `tools/qa` đã nhận
  helper từ `deep-testing/mixpanel-capture`, bản JS nằm ở `_Automation-Project/core/deep-testing/mixpanel-capture.js` (Phase 5).
