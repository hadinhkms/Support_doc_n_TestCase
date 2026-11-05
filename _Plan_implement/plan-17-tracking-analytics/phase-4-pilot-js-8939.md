# Phase 4 — Pilot trên flow thật (JS-8939, vieclam24h.vn QC)

> **Status:** IMPLEMENTED 2026-11-05 — Desktop guest trên QC; Mixpanel MCP chưa dùng được (vùng EU)
> **Depends on:** Phase 2, Phase 3
> **Parent:** [Plan 17](../17_TRACKING_ANALYTICS_SKILL_PLAN.md)

## Đổi phạm vi so với kế hoạch

Kế hoạch ban đầu pilot trên REQ-001 Sign in. REQ-001 chỉ là app mẫu (không chạy, không có Mixpanel), nên
user chọn: dùng repo `D:/_SV_Automation`, requirement Jira **JS-8939** (tracking filter tỉnh thành), môi trường **QC**.

## Kiểm tra điều kiện

| Điều kiện | Kết quả |
|---|---|
| Môi trường | QC `https://seeker.vl24hv2.qc.sieuviet-team.com`, lấy từ `D:/_SV_Automation/core/config/dashboardConfig.json` |
| Tài khoản | Không cần: flow tìm việc chạy được khi chưa đăng nhập |
| Mixpanel MCP | Project `vieclam24h.vn-*` ở vùng EU; MCP nối `mcp.mixpanel.com` (US) nên bị từ chối. Cần `mcp-eu.mixpanel.com` |
| Helper Phase 2 | Bắt được `api-eu.mixpanel.com/track` dạng form `data=`, 0 request không decode được |

## Đã làm

1. Chạy 4 kịch bản Desktop bằng spec pilot tạm (scratchpad, không commit) dùng `startMixpanelCapture` /
   `expectMixpanelEvent`: không chọn tỉnh; Toàn quốc mới → F5; Hà Nội cũ; Toàn quốc mới → Áp dụng → Tìm kiếm → F5.
2. Đối chiếu với report verify chức năng sẵn có của SV_Automation: kết quả khớp.
3. Review thiết kế theo checklist `TR-xx` và đánh giá report khai thác được:
   [evidence/pilot-JS-8939.md](evidence/pilot-JS-8939.md).
4. Cập nhật skill từ bài học pilot: checklist thêm `TR-24`, `TR-25`, `TR-36`, `TR-37`; flow-capture guide
   thêm mục "Bài học từ pilot JS-8939".

## Kết quả chính

- 4 rủi ro thiết kế (3 Major, 1 Minor), 3 đề xuất, 5 open questions cho PO/dev/data.
- Report: 1 làm được, 3 một phần, 1 chưa làm được, 1 chưa kiểm chứng.

## Không làm (cần user đồng ý)

- Chưa thêm spec tracking chính thức vào `D:/_SV_Automation` (repo dự án khác, có convention JS/POM riêng).
- Chưa comment lên Jira JS-8939.

## Exit gate

- [x] Báo cáo có bảng flow ↔ event, findings có bằng chứng, report khai thác được, open questions.
- [x] Helper chạy được trên app thật (EU endpoint, form base64).
- [ ] Đối chiếu Mixpanel project: chờ kết nối MCP vùng EU → chuyển sang [Phase 5](phase-5-satellite-rollout.md).
- [ ] Spec tracking chính thức: chờ user quyết định → chuyển sang [Phase 5](phase-5-satellite-rollout.md).
