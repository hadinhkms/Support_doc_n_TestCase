# Phase 2 — Playwright Mixpanel Capture Helper

> **Status:** IMPLEMENTED 2026-11-05 — self-test với endpoint giả; chưa chạy trên app thật (Phase 4)
> **Depends on:** Phase 1
> **Parent:** [Plan 17](../17_TRACKING_ANALYTICS_SKILL_PLAN.md)

## Mục tiêu

Một helper dùng chung để spec verify event Mixpanel qua network, thay vì mỗi spec tự viết.

## Đã làm

| Task | Kết quả |
|---|---|
| Helper | `playwright/tests/support/mixpanel-capture.ts` (seed, role `module`, < 190 dòng): `startMixpanelCapture`, `decodeMixpanelBody`, `expectMixpanelEvent` (`properties`, `where`, `count`, `timeoutMs`, `settleMs`), `expectNoMixpanelEvent` |
| Proxy host | Option `hosts` hoặc env `MIXPANEL_API_HOST` (tuỳ chọn, khai trong `playwright/.env.example`) |
| Self-test | `playwright/deep-engine-tests/mixpanel-capture.spec.ts` (HM-16, 6 test), chạy bằng `npm run test:deep-engine` |
| Tài liệu | `references/flow-capture-guide.md` và SKILL Step 6 trỏ tới helper thật |

## Hành vi đã kiểm chứng (HM-16)

| Test | Kiểm gì |
|---|---|
| TC-17-P2-01 | Decode form base64 (có/không encode `+`), `data=` JSON, JSON object/batch, input rác → `[]` |
| TC-17-P2-02 | Tách `/track` và `/engage`; assert property subset + asymmetric matcher; sai property → fail |
| TC-17-P2-03 | `count: 1` bắt được event bắn 2 lần |
| TC-17-P2-04 | Khớp host proxy, bỏ qua host không phải Mixpanel |
| TC-17-P2-05 | Thiếu event → lỗi liệt kê event đã bắt; `expectNoMixpanelEvent` bắt event cấm |
| TC-17-P2-06 | Đọc được payload `sendBeacon` (Chromium); `stop()` gỡ listener |

Ổn định: 18/18 pass với `--repeat-each=3`. Self-test chặn mọi request ra ngoài (route giả hoặc
abort), không gửi gì tới Mixpanel thật.

## Hạn chế còn lại

- `sendBeacon` mới kiểm trên Chromium; Firefox/WebKit chưa kiểm.
- Event server-side không đi qua browser: vẫn phải dùng `Get-Live-Events` của Mixpanel MCP.
- Mobile native không áp dụng.
