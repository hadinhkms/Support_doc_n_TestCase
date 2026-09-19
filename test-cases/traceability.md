# Traceability Matrix (toàn dự án)

Bảng tổng hợp `REQ -> AC -> TC -> AUTO`. Mỗi file test case có ma trận riêng của feature đó;
bảng này tồn tại để trả lời được các câu hỏi **liên feature**:

- AC nào chưa có test case nào?
- TC nào ở mức P0/P1 mà vẫn chưa automation?
- Requirement nào đang `Draft` nhưng đã có script trỏ vào?

Cập nhật bảng này trong cùng PR với thay đổi test case hoặc script (xem checklist ở
`.github/pull_request_template.md`).

## Tổng quan requirement

| REQ | Tên | Status | Version | Risk | Test cases | Automated | Owner |
|---|---|---|---|---|---:|---:|---|
| REQ-001 | Sign in with email and password | Ready for Test | 1.0 | High | 13 | 9 | Auth squad |

## Độ phủ theo acceptance criterion

| REQ | AC | Mô tả ngắn | Test cases | Automated | Trạng thái phủ |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | Đăng nhập thành công | TC-001, TC-013 | TC-001, TC-013 | Đủ |
| REQ-001 | AC-002 | Thông báo lỗi chung | TC-002, TC-003, TC-012 | TC-002, TC-003 | Đủ |
| REQ-001 | AC-003 | Validation email ở client | TC-004 | TC-004 | Đủ |
| REQ-001 | AC-004 | Session qua reload / hết hạn 24h | TC-005, TC-010 | TC-005 | **Thiếu** - TC-010 chỉ thủ công |
| REQ-001 | AC-005 | Chặn truy cập khi chưa đăng nhập | TC-006 | TC-006 | Đủ |
| REQ-001 | AC-006 | Accessibility | TC-007, TC-008, TC-011 | TC-007, TC-008 | Đủ (phần thủ công là cố ý) |
| REQ-001 | AC-007 | Khoá sau 5 lần sai | TC-009 | - | **Thiếu** - không automation, chỉ test tay |

## Nợ automation (P0/P1 chưa có script)

| TC | REQ/AC | Priority | Lý do chưa có | Hướng xử lý | Owner | Hạn |
|---|---|---|---|---|---|---|
| TC-009 | REQ-001 / AC-007 | P1 | Không khả thi (Stability 1, Feasibility 2) | Giữ thủ công + monitoring production | QA | - |

## AC không có test case nào

Hiện không có. Khi phát hiện, thêm dòng vào đây **trước** khi đóng requirement.

## Script không trace được về AC

Hiện không có. Mọi test title đều mở đầu bằng `TC-xxx`; ESLint chặn trường hợp thiếu
(`playwright/eslint.config.mjs`, rule `no-restricted-syntax`).

## Cách kiểm tra nhanh

Bảng phía trên là bản tóm tắt cho người đọc. **Nguồn sự thật là tool**, vì bảng
viết tay sẽ cũ đi mà không ai biết:

```powershell
npm run qa:coverage    # đối chiếu với bảng ở trên, lệch nghĩa là bảng đã cũ
npm run qa:gaps        # AC chưa phủ, TC khai Yes mà không có script
npm run qa:drift       # script trỏ tới REQ/AC không còn tồn tại
```

CI chạy `npm run qa:check` ở job `traceability` và fail nếu có finding từ mức
`major`. Nghĩa là bảng này không thể nói dối quá một PR.
