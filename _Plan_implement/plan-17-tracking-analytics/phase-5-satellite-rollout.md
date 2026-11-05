# Phase 5 — Rollout sang project vệ tinh (SV_Automation)

> **Status:** IMPLEMENTED 2026-11-05 (chưa commit ở cả 3 repo) — còn 2 việc cần user: nối Mixpanel MCP vùng EU, comment Jira
> **Depends on:** Phase 1–4
> **Parent:** [Plan 17](../17_TRACKING_ANALYTICS_SKILL_PLAN.md)

## Luồng đồng bộ thực tế (phát hiện khi làm)

```
D:/_QA_Test_Automation (.agents/skills)  --qaUpstreamSync-->  D:/_Automation-Project (Hub framework: core, dashboard, skills, AGENTS.md)
                                                                   --update:framework / sync-satellites-->  D:/_SV_Automation
```

- `core/`, `AGENTS.md`, `.agents/skills` của SV do `_Automation-Project` sở hữu: sửa thẳng ở SV sẽ bị ghi đè.
- `tools/qa` của SV giống `_Automation-Project`, **không** tự đồng bộ từ Hub QA; capability `tracking` (Phase 3)
  chưa có trong `tools/qa` của SV (không gây lỗi, chỉ chưa có guard).
- `_Automation-Project` (nhánh `main`) đang có thay đổi chưa commit ở 5 skill khác, nên **không chạy script sync**;
  chỉ thêm file mới và chép đúng các file đó sang SV (lần `update:framework` sau sẽ không tạo khác biệt).

## Đã làm

| Repo | Thay đổi | Sở hữu |
|---|---|---|
| `_Automation-Project` | `.agents/skills/qa-tracking-analytics/` (chép từ Hub QA) | ship |
| `_Automation-Project` | `core/deep-testing/mixpanel-capture.js` (130 dòng, bản JS cùng API) + `mixpanel-capture.test.js` (node:test, 3 test) + export trong `index.js` | ship |
| `_Automation-Project` | `AGENTS.md` mục 3A: thêm dòng skill | ship |
| `_SV_Automation` | Bản sao y hệt 4 mục trên (`diff` = 0 với Hub framework) | ship |
| `_SV_Automation` | `requirements/REQ-013-tracking-tim-kiem-theo-tinh-thanh.md` (AC-071..073, 5 open questions) | own |
| `_SV_Automation` | `test-cases/REQ-013-…md` (TC-172..174) + 4 dòng trong `test-cases/traceability.md` | own |
| `_SV_Automation` | `pages/desktop/search/ProvinceFilterVersionHelper.js` (picker 2 phiên bản tỉnh/thành) | own |
| `_SV_Automation` | `data/js8939TrackingData.json` + `tests/e2e/desktop/tracking-tim-kiem-tinh-thanh-js-8939.spec.js` | own |
| `_QA_Test_Automation` | SKILL Step 6 nêu helper JS cho project vệ tinh | ship |

Spec chỉ assert hành vi đã chốt (không chọn tỉnh → null; Hà Nội cũ → `1/"1.0"`; Toàn quốc mới → `34/"2.0"`,
bắn đúng 1 lần). Hành vi reload còn Open question nên không assert.

## Kết quả kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| Unit test helper JS (Hub framework và SV) | 3/3 pass |
| Spec JS-8939 trên QC, Desktop Regression | 3/3 pass |
| `--repeat-each=3` (2 lượt) | 17/18 pass; 1 lần fail `browser.newContext: Target page, context or browser has been closed` trước khi test chạy (hạ tầng), lượt 2 9/9 |
| `npm run check:framework` (SV, Hub framework) | pass |
| `node tools/qa gaps --req=REQ-013`, `coverage --req=REQ-013` | không gap; 3 AC → 3 TC → 3 test automation |

## Phát hiện phụ

- `JobSearchPage.locTheoTinhThanhInput` tìm **textbox** "Lọc theo tỉnh thành", nhưng QC hiện là **button**.
  Helper mới dùng locator riêng. Các spec cũ dùng `filterByCity` (ví dụ `job_search_by_cities-bdd.spec.js`)
  có thể đang hỏng: chưa chạy kiểm.
- `tools/qa matrix` ghi đè `test-cases/traceability.md` theo format Hub, khác bảng viết tay của SV: đã hoàn lại,
  thêm dòng thủ công.

## Còn lại (cần user)

- Nối Mixpanel MCP vùng EU (`mcp-eu.mixpanel.com`) để đối chiếu Live Events / Lexicon / project nhận event.
- Comment kết quả lên Jira JS-8939: chỉ làm khi user đồng ý nội dung.
- Commit 3 repo (SV đang ở nhánh `feature/req-007-009-012-chop-jobnearme-zalo-otp`; `_Automation-Project` ở `main`).

## Exit gate

- [x] Agent trong SV_Automation tìm thấy skill (qua `AGENTS.md`).
- [x] Spec JS-8939 pass ổn định trên QC, `check:framework` pass.
- [ ] Đối chiếu `Get-Live-Events`: chờ MCP vùng EU.
