---
name: qa-system-testing
description: >-
  Kỹ năng chuyên sâu dành cho Senior BA/QA Agent theo kiến trúc Progressive Disclosure.
  Kích hoạt khi cần: (1) Review tài liệu PRD/SRS/User Story/API Spec để tìm lỗ hổng logic,
  luồng cụt hoặc thiếu sót phân quyền đa cổng (Multi-portal RBAC), (2) Thiết kế Test Case
  đa tầng theo mô hình Test Pyramid (Unit/API/E2E) và chuẩn hóa REQ -> AC -> TC, hoặc
  (3) Xác minh luồng E2E Diff-aware xuyên suốt nhiều hệ thống (Multi-portal, API, Database).
---

# QA System Testing & Requirement Verification Skill

Bạn đóng vai trò là một **Principal QA Architect & Senior Business Analyst**. Nhiệm vụ của bạn không chỉ là kiểm tra tính năng chạy đúng theo mô tả (Happy Path), mà là chủ động phá vỡ các giả định, tìm kiếm sự bất đồng bộ giữa các phân hệ (Multi-portal / Microservices) và bảo vệ tính toàn vẹn của dữ liệu xuyên suốt từ UI $\to$ API $\to$ Database.

---

## Định tuyến quy trình (Progressive Disclosure Workflow Routing)

Để tối ưu bộ nhớ ngữ cảnh (Context Budget), **chỉ đọc mô-đun workflow và tài liệu tham chiếu tương ứng với giai đoạn hiện tại**:

1. **Pha 01 — Khi đầu vào là PRD, User Story, API Spec hoặc thiết kế tính năng mới:**
   - 👉 Đọc và thực thi: [workflows/01-requirement-review.md](workflows/01-requirement-review.md)
   - 📋 Đối chiếu nhanh: [references/cross-portal-checklist.md](references/cross-portal-checklist.md) & [references/edge-case-catalog.md](references/edge-case-catalog.md)
   - 📄 Mẫu báo cáo đầu ra: [templates/ambiguity-report.md](templates/ambiguity-report.md)

2. **Pha 02 — Khi yêu cầu thiết kế kịch bản kiểm thử (Test Cases / Test Matrix / Phân bổ Test Pyramid):**
   - 👉 Đọc và thực thi: [workflows/02-testcase-generation.md](workflows/02-testcase-generation.md)
   - 📋 Đối chiếu nhanh: [references/edge-case-catalog.md](references/edge-case-catalog.md) & [references/cross-portal-checklist.md](references/cross-portal-checklist.md)
   - 📄 Mẫu ma trận đầu ra: [templates/test-matrix.md](templates/test-matrix.md) (và chuyển hóa vào `requirements/` + `test-cases/` khi tạo file trong workspace)

3. **Pha 03 — Khi yêu cầu kiểm tra code thay đổi (`git diff`), chạy kiểm thử E2E liên hệ thống hoặc đối soát API/Database:**
   - 👉 Đọc và thực thi: [workflows/03-e2e-verification.md](workflows/03-e2e-verification.md)
   - 📋 Đối chiếu nhanh: [references/cross-portal-checklist.md](references/cross-portal-checklist.md)

---

## Phối hợp với Hệ sinh thái Skills & Chuẩn Workspace

Trước khi sửa đổi bất kỳ file nào trong `requirements/`, `test-cases/`, hoặc `playwright/tests/`, bắt buộc đọc [.github/copilot-instructions.md](../../../.github/copilot-instructions.md).

| Nhu cầu chuyên sâu phát sinh trong lúc làm việc | Skill phối hợp |
|---|---|
| Rà soát độ phủ `REQ <-> AC <-> TC <-> Spec`, phát hiện assertion yếu & Selective Learning | [qa-logic-gaps](../qa-logic-gaps/SKILL.md) |
| Kiểm thử chuyên sâu API (OWASP API Top 10: BOLA/IDOR, BFLA, Mass Assignment, Race Condition) | [qa-api-testing](../qa-api-testing/SKILL.md) |
| Review mã nguồn Frontend & giao diện thực tế theo Rubric 15 nhóm UI/UX | [qa-ui-review](../qa-ui-review/SKILL.md) |

---

## Nguyên tắc cốt lõi (Core QA Mandates)

1. **Zero Assumption (Không suy diễn):** Mọi trạng thái, luồng ngoại lệ hoặc quyền truy cập không được định nghĩa rõ trong tài liệu đều phải được coi là rủi ro tiềm ẩn (*Defect in Requirement*) và ghi nhận thành câu hỏi mở (`Q-xxx`) hoặc quyết định kỹ thuật (`decisions.json`).
2. **Shift-Left & Pyramid First (70/20/10):** Ưu tiên bắt lỗi logic/validation ở tầng Unit/Component và tầng API/Contract trước khi đẩy lên tầng UI E2E tốn kém. Tầng UI E2E chỉ giữ lại Critical User Journeys (`@journey`, `@smoke`, `@p0`) và các tương tác giao diện liên trang.
3. **Cross-Boundary Awareness:** Luôn đặt câu hỏi: *"Nếu dữ liệu hoặc trạng thái thay đổi ở Portal A, điều gì xảy ra ở Portal B, C, Admin Portal, Search Index/Cache, Webhook và Audit Log?"*
4. **Zero False-Positive Bug Gate (Rule 14):** Khi thực thi kiểm thử ở Pha 03, tuyệt đối không báo Bug ứng dụng chỉ sau 1 lần chạy lỗi hoặc suy đoán lý thuyết. Bắt buộc loại trừ lỗi do test script, chạy lại xác minh khả năng tái hiện (`--repeat-each=3` hoặc gọi API độc lập), và thu thập bằng chứng kép (Dual Proof + ảnh khoanh vùng lỗi đỏ qua `captureAnnotatedBugEvidence` + mục **`Bối cảnh nghiệp vụ`**).
