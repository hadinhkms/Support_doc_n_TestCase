# Test Cases

Mỗi feature có một file theo `templates/test-case-template.md`. Test case phải trace được về requirement và acceptance criterion. Khi trạng thái requirement thay đổi, rà lại các case bị ảnh hưởng và đánh dấu regression cần chạy lại.

Mỗi feature có thể kèm một automation plan riêng (`<feature>.automation-plan.md`) chấm điểm case theo `docs/automation-strategy.md` và ghi rõ case nào không automation kèm lý do.

`traceability.md` là ma trận tổng toàn dự án, trả lời các câu hỏi liên feature: AC nào chưa có test case, TC P0/P1 nào chưa automation. Cập nhật trong cùng PR với thay đổi test case hoặc script.

Ví dụ mẫu đầy đủ: `REQ-001-sign-in.md` và `REQ-001-sign-in.automation-plan.md`.
