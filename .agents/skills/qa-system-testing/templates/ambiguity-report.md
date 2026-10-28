# Mẫu Báo Cáo Rà Soát Requirement & Phát Hiện Điểm Mâu Thuẫn (Ambiguity & Mismatch Report)

Sử dụng mẫu này làm đầu ra chuẩn cho **Workflow 01 (`01-requirement-review.md`)** khi phân tích PRD, User Story, thiết kế Figma hoặc API Spec.

---

```markdown
# Báo Cáo Rà Soát Requirement & Kiến Trúc Kiểm Thử — <Tên Tính Năng / REQ-xxx>

- **Nguồn tài liệu đối chiếu:** <PRD / User Story / Figma / API Spec / Mã nguồn>
- **Các Portal / Actor tham gia:** <VD: Seeker Portal, Employer Portal, Admin Portal, Background Worker>
- **Đánh giá mức độ sẵn sàng (Readiness Status):** 🔴 Chưa thể Dev/Test (Có Blocker) | 🟡 Cần làm rõ thêm (Có Open Questions) | 🟢 Sẵn sàng (Ready for Test Design)

---

## 1. 🚨 Critical Blockers (Lỗi logic/phân quyền nghiêm trọng cần chốt ngay)

| Mã | Phân loại | Vị trí / Luồng liên quan | Mô tả lỗ hổng hoặc mâu thuẫn | Rủi ro nếu giữ nguyên | Đề xuất hướng xử lý chuẩn |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | RBAC / Tenant Isolation (`CP-05`) | <Portal / API> | <Mô tả chi tiết điểm mâu thuẫn hoặc lỗ hổng> | <Lộ dữ liệu chéo công ty / Sai lệch tiền tệ / Treo trạng thái> | <Giải pháp kỹ thuật/nghiệp vụ đề xuất> |
| **BLK-02** | State Machine / Dead-end | <Trạng thái A -> B> | ... | ... | ... |

---

## 2. ⚠️ Edge Cases & Câu Hỏi Làm Rõ (`Open Questions` cho PO / BA / Dev)

> *Nguyên tắc Zero Assumption: Không tự ý suy diễn hành vi khi tài liệu bỏ trống. Các câu hỏi dưới đây cần được xác nhận để đưa vào `requirements/REQ-xxx.md` hoặc `decisions.json`.*

| Mã câu hỏi | Khía cạnh (Heuristic) | Tình huống biên / Ngoại lệ chưa được định nghĩa | Đề xuất mặc định (Default Proposal) | Người cần chốt |
| :--- | :--- | :--- | :--- | :--- |
| **Q-001** | Async / Webhook (`CP-09`) | Khi cổng thứ 3 timeout hoặc bắn callback trùng 2 lần liên tiếp thì hệ thống xử lý thế nào? | Sử dụng `Idempotency-Key` theo `transaction_id`, giữ trạng thái `Pending` và tự động đối soát sau 5 phút. | PO / Tech Lead |
| **Q-002** | Cross-Portal Sync (`CP-02`) | Khi Admin khóa bản ghi ở Portal Admin trong lúc User đang mở màn hình thanh toán/ứng tuyển ở Portal User thì chuyện gì xảy ra? | Chặn ở bước Submit cuối cùng với mã `409 Conflict` và hiển thị thông báo rõ ràng, không trừ tiền/lượt. | PO |

---

## 3. 🔄 Phạm Vi Ảnh Hưởng Liên Hệ Thống (Cross-System & Multi-Portal Impact)

| Thành phần / Phân hệ | Loại tác động (Trực tiếp / Ngầm) | Chi tiết điểm cần kiểm tra hồi quy (Regression Check) |
| :--- | :--- | :--- |
| **Portal A (VD: User Portal)** | Trực tiếp | Form nhập liệu, trạng thái hiển thị, bộ lọc tìm kiếm. |
| **Portal B (VD: Partner/Employer)** | Ngầm | Trang danh sách quản lý, bộ đếm thống kê (Counters), chức năng Export CSV/Excel. |
| **Portal C (VD: Admin Backoffice)** | Ngầm | Luồng duyệt/từ chối, bảng `audit_logs`, cấu hình quyền. |
| **API / Database / Cache / Queue** | Ngầm | Schema migration, Redis cache invalidation, Elasticsearch indexing, Webhook retry. |

---

## 4. 📐 Khuyến Nghị Metadata Chuẩn Cho Workspace (`requirements/REQ-xxx-*.md`)

- **Risk:** `High` | `Medium` | `Low`
- **Page exposure:** `Public` | `Customer` | `Authenticated` | `Admin`
- **UI coverage:** `Required` | `Exempt` *(kèm lý do nếu Exempt)*
- **XSS applicability:** `Applicable` | `Exempt` *(cảnh báo Stored XSS liên Portal nếu có)*
- **Capabilities trọng tâm cần gắn ở bước thiết kế Test Case:** `persistence`, `boundary`, `idempotency`, `ui-geometry`, `a11y`, `responsive`, `xss`
```
