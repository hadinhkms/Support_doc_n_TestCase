# Tracking Plan: REQ-XXX <Tên feature>

> Lưu tại `test-cases/REQ-XXX-<slug>.tracking-plan.md`. Không thêm mục `## Traceability` vào file
> này; TC tracking nằm trong `test-cases/REQ-XXX-<slug>.md` như mọi TC khác.

- **Requirement**: `requirements/REQ-XXX-<slug>.md`
- **Analytics tool**: Mixpanel — project `<tên project>` (prod) / `<tên project>` (staging)
- **Owner**: <PO / analyst>
- **Version**: 1.0
- **Status**: Draft | Reviewed | Implemented | Verified

Review bằng skill `qa-tracking-analytics` (checklist `TR-xx`) trước khi dev implement.

## 1. Câu hỏi report cần trả lời

| # | Câu hỏi business | Loại report | Event / property dùng |
|---|---|---|---|
| R-01 | <Conversion Sign in theo method?> | Funnel + Breakdown | `Sign In Viewed` → `Sign In Completed` theo `method` |

Event không phục vụ câu hỏi nào ở đây là ứng viên bỏ đi.

## 2. Quy ước

- Tên event: `Object Action`, Title Case, động từ quá khứ (`Order Placed`). Không chứa giá trị động.
- Tên property: `snake_case`, cùng tên ở mọi event.
- Thời điểm: event "thành công" bắn **sau** khi server xác nhận, không bắn lúc click.

## 3. Event

| Event | Trigger (khi nào bắn) | Nguồn | Bước flow | Property bắt buộc | Property tuỳ chọn | Số lần / flow | Report |
|---|---|---|---|---|---|---|---|
| `Sign In Viewed` | Trang Sign in render xong | Client | 1 | `source` | — | 1 | R-01 |
| `Sign In Completed` | API login trả 200 | Client | 2 | `method` | — | 1 | R-01 |
| `Sign In Failed` | API login trả lỗi | Client | 2 | `reason` | — | 1 mỗi lần lỗi | R-02 |

## 4. Property

| Property | Kiểu | Giá trị cho phép / định dạng | Ví dụ | Dùng ở event |
|---|---|---|---|---|
| `method` | string (enum) | `password`, `google`, `apple` (chữ thường) | `password` | `Sign In Completed` |
| `reason` | string (enum) | `wrong_password`, `locked`, `network` | `locked` | `Sign In Failed` |

Không đưa PII (email, số điện thoại, tên, địa chỉ) vào property.

## 5. Identity

| Thời điểm | Gọi | Ghi chú |
|---|---|---|
| Đăng nhập thành công | `identify(<user_id ổn định>)` | Không dùng email làm ID |
| Đăng ký thành công | `identify(<user_id>)` | Nối lịch sử ẩn danh trước đó |
| Đăng xuất | `reset()` | Tránh gộp người dùng trên máy dùng chung |

## 6. Super property và user profile

| Tên | Loại | Giá trị | Đặt khi |
|---|---|---|---|
| `platform` | Super property | `web`, `ios`, `android` | Khởi tạo SDK |
| `app_version` | Super property | semver | Khởi tạo SDK |
| `plan` | User profile (`people.set`) | `free`, `pro` | Sau login / khi đổi plan |

## 7. Môi trường và kiểm chứng

- Staging gửi vào project staging (hoặc gắn `env`), không lẫn vào production.
- Môi trường test nên tắt gửi theo lô (`batch_requests: false`).
- Mỗi event bắt buộc có TC `Type: Tracking`, `Capabilities: tracking`, verify bằng
  `expectMixpanelEvent` / `expectNoMixpanelEvent` (`playwright/tests/support/mixpanel-capture.ts`).
- Event server-side: verify bằng Live Events trên Mixpanel.

## 8. Open questions

- [ ] Q-001: <ví dụ "bắn `Sign In Completed` khi nào nếu cần xác thực 2 bước?"> - Owner: <...>

## Change log

| Version | Date | Change | Event bị ảnh hưởng | Report bị ảnh hưởng |
|---|---|---|---|---|
| 1.0 | <YYYY-MM-DD> | Bản đầu tiên | - | - |

Đổi tên hoặc bỏ event đã chạy production phải ghi ở đây và cập nhật Lexicon (merge/hide),
nếu không report lịch sử sẽ đứt.
