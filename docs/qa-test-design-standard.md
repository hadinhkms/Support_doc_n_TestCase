# QA Test Design Standard

## 1. Mục tiêu

Đảm bảo mỗi requirement có thể truy nguyên, kiểm thử được và được đánh giá đủ các trạng thái chính, lỗi, biên, quyền, dữ liệu và khả năng hồi quy.

## 2. Khi nhận requirement

Ghi lại các mục sau trước khi viết test:

- Mục tiêu nghiệp vụ và phạm vi.
- Actor, quyền và điều kiện tiên quyết.
- Luồng chính và các luồng thay thế.
- Business rules, validation, giới hạn và dependency.
- Dữ liệu đầu vào, trạng thái dữ liệu trước/sau.
- Non-functional expectations: performance, accessibility, security, compatibility.
- Acceptance criteria có thể quan sát và đo được.
- Các câu hỏi, giả định, rủi ro và điểm chưa đủ thông tin.

Requirement không được xem là Ready for Test nếu thiếu kết quả mong đợi, dữ liệu cần thiết hoặc tiêu chí chấp nhận.

## 3. Kỹ thuật thiết kế test bắt buộc cân nhắc

- Equivalence partitioning: lớp hợp lệ, không hợp lệ và chưa xác định.
- Boundary value analysis: min, min-1, min+1, max-1, max, max+1.
- Decision table: kết hợp điều kiện và kết quả.
- State transition: trạng thái, sự kiện, chuyển tiếp hợp lệ và không hợp lệ.
- Pairwise: giảm tổ hợp khi có nhiều biến độc lập.
- Error guessing: timeout, refresh, double click, back/forward, duplicate request, stale data.
- Risk-based testing: ưu tiên xác suất x tác động.

## 4. Bộ bao phủ tối thiểu

Mỗi feature cần xem xét:

- Happy path.
- Required/optional/empty input.
- Invalid format, type, length, character set.
- Boundary và boundary-adjacent values.
- Duplicate, idempotency và retry.
- Cancel, back, refresh, timeout và network failure.
- Authentication, authorization và data isolation.
- Concurrency hoặc stale state nếu có.
- Accessibility keyboard/focus/label nếu là UI.
- Responsive/browser compatibility nếu có cam kết.
- Regression của luồng liên quan.

## 5. Quy tắc test case

Mỗi test case phải có một mục tiêu kiểm chứng rõ ràng, dữ liệu độc lập, expected result quan sát được và liên kết tới ít nhất một acceptance criterion. Không gộp nhiều mục tiêu không liên quan vào một case.

Priority:

- P0: chặn sử dụng, mất dữ liệu, lỗi bảo mật hoặc luồng doanh thu cốt lõi.
- P1: chức năng chính, lỗi ảnh hưởng nhóm người dùng lớn.
- P2: luồng phụ, validation hoặc UX quan trọng.
- P3: thẩm mỹ, edge case có tác động thấp.

Test level: API/service trước UI khi cùng một business rule có thể kiểm chứng ở API. UI chỉ giữ smoke, critical journey và hành vi giao diện.
