# Mẫu Ma Trận Kịch Bản Kiểm Thử Phân Tầng (System Test Matrix & Workspace Traceability)

Sử dụng mẫu này trong **Workflow 02 (`02-testcase-generation.md`)** để:
1. Trình bày **Ma trận phân bổ Test Pyramid (Unit / API / E2E)** trực quan trên khung chat.
2. Chuyển hóa mượt mà sang file chuẩn `test-cases/REQ-xxx-<slug>.md` mà không làm gãy trình phân tích tự động `node tools/qa` (`coverage`, `gaps`, `drift`, `matrix`).

---

## Phần A: Mẫu Ma Trận Phân Tầng Trên Khung Chat (System Test Matrix)

Khi người dùng yêu cầu thiết kế hoặc review danh sách kịch bản kiểm thử trên khung chat, xuất bảng tổng hợp theo cấu trúc sau:

```markdown
### Tỷ trọng Phân bổ Test Pyramid
- **Unit / Component (~70%):** <Số lượng> kịch bản (Logic tính toán, helper, format, state reducer)
- **API / Integration (~20%):** <Số lượng> kịch bản (Contract, RBAC/BOLA, BVA payload, Concurrency `Promise.all`, Read-After-Write)
- **UI / E2E & Cross-Portal (~10%):** <Số lượng> kịch bản (Critical Journey `@journey`, Multi-portal sync, UI Geometry/A11y/Responsive, DOM Idempotency)

### Bảng Ma Trận Kịch Bản Kiểm Thử (System Test Matrix)

| ID | AC Liên kết | Phân hệ / Portal | Tên kịch bản (Title) | Điều kiện tiên quyết (Pre-condition) | Các bước thực hiện / Payload | Kết quả mong đợi (UI / API / DB) | Tầng Pyramid (Unit/API/E2E) | Capabilities & Tags | Độ ưu tiên |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-001** | `AC-001` | Portal A $\to$ Portal B | <Mô tả luồng chính xuyên cổng> | <Tài khoản & dữ liệu seed> | 1. Tạo ở Portal A<br>2. Duyệt ở Portal B<br>3. Kiểm tra ở Portal A | - **UI:** Hiển thị trạng thái `Approved`<br>- **API:** `GET` trả về `200`<br>- **DB:** `status = 'APPROVED'`, có `audit_logs` | `E2E` | `@smoke @p0 @journey` (`persistence`, `ui-geometry`) | `P0` |
| **TC-002** | `AC-002` | API Gateway | Chặn truy cập chéo tổ chức (BOLA/IDOR) | Token của Công ty A, ID bản ghi của Công ty B | `PATCH /api/v1/items/:idB` | - **API:** Trả về `403`/`404`<br>- **DB:** Bản ghi của Công ty B không đổi (`Read-After-Reject`) | `API` | `@api @p0 @security` | `P0` |
| **TC-003** | `AC-003` | Portal A | Chặn gửi trùng khi nhấn đúp nút Submit | Đang ở form tạo mới | Nhấn đúp liên tiếp vào nút `Submit` | - **Network:** Chỉ bắn đúng 1 request `POST`<br>- **DB:** Không sinh bản ghi trùng | `E2E` | `@p1` (`idempotency`) | `P1` |
```

---

## Phần B: Quy Tắc Ánh Xạ Sang File Chuẩn `test-cases/REQ-xxx-<slug>.md`

Khi lưu kịch bản vào thư mục `test-cases/` của repository, **bắt buộc** giữ nguyên cấu trúc bảng `## Traceability` 6 cột và định dạng `### TC-xxx:` để `npm run qa:check` và `npm run qa:matrix` hoạt động chính xác:

1. **Bảng `## Traceability` (Giữ nguyên 6 cột chuẩn của `tools/qa`):**
   ```markdown
   ## Traceability

   | Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
   |---|---|---|---|---|---|
   | REQ-XXX | AC-001 | TC-001 | Yes | `playwright/tests/<domain>/<feature>.spec.ts` | P0 |
   | REQ-XXX | AC-002 | TC-002 | Yes | `playwright/tests/<domain>/<feature>.api.spec.ts` | P0 |
   | REQ-XXX | AC-003 | TC-003 | No | - | P2 |
   ```
   *(Lưu ý: Các case thuộc tầng **Unit** hoặc kiểm thử thủ công không chạy bằng Playwright thì đặt `Automation: No` và khai báo lý do trong bảng `## Case không automation` ở cuối file).*

2. **Chi tiết từng Test Case (`### TC-xxx:`):**
   Ghi rõ **Portal** và **Tầng Pyramid** ngay trong dòng metadata hoặc bảng Step, đồng thời khai báo `- **Capabilities**: ...` khi dùng các hàm kiểm chứng sâu:
   ```markdown
   ### TC-001: <Mục tiêu kiểm thử>

   - Type: Functional | Validation | Boundary | Security | Accessibility | UI/UX | Regression
   - Priority: P0 | P1 | P2 | P3
   - Technique: <EP / BVA / Decision table / State transition / Error guessing>
   - Test level & Portal: <E2E | API | Unit> — <Portal A / Portal B / Admin>
   - Automation: Yes | Candidate | No
   - Tags: `@smoke @p0 @journey`
   - **Capabilities**: persistence, ui-geometry, a11y, responsive

   | Step | Action | Expected result |
   |---|---|---|
   | 1 | <Hành động cụ thể trên UI hoặc API payload> | <Kết quả quan sát được ở UI + API Status + Trạng thái DB> |
   ```
