# ADR-16: Evidence, Trust & Runner Architecture

> **Trạng thái:** ACCEPTED · **Ngày:** 2026-11-02  
> **Người đề xuất:** Tech Lead & Senior QA Architect · **Phạm vi:** Phase 0 (Task T0.4 & AC-16-P0-3)  
> **Tham chiếu:** `_Plan_implement/plan-16-testing-professionalization/evidence-contract.md`

---

## 1. Bối Cảnh (Context)

Hệ thống kiểm thử hiện tại đã có bộ bẫy lỗi runtime (`runtime-trap.ts`), chụp ảnh hành trình (`evidence.ts`) và các bộ guards chuyên sâu. Tuy nhiên:
1. Thiếu một hợp đồng dữ liệu chuẩn hóa (Evidence Manifest Contract) để kết nối giữa kết quả test và báo cáo bug.
2. Dễ xảy ra tranh chấp ghi đè tệp bằng chứng giữa các worker chạy song song (`fullyParallel`).
3. Chưa có cơ chế ngăn chặn rò rỉ credential và path traversal trong artifact metadata.
4. Cần phân định tuyệt đối giữa mã hash kiểm tra toàn vẹn file và chữ ký xác thực quyền hạn (Approval).

---

## 2. Quyết Định Kiến Trúc (Decisions)

### ADR-16-01: Evidence Manifest Schema & Lifecycle
- **Schema 5 nhóm bắt buộc**:
  - `Identity`: `schemaVersion`, `runId`, `issueId`, `testId`, `project`.
  - `Attempt`: `attemptId`, `workerIndex`, `shardIndex`, `retryIndex`.
  - `Source & Worktree`: `qaRevision` (full SHA), `appBuild`, `isDirty`, `diffDigest`.
  - `Execution & Env`: `argv`, `cwd`, `startedAt`, `finishedAt`, `exitCode`, `browserInfo`.
  - `Artifacts & Observables`: danh sách URI, SHA256, MIME, kích thước, expected/actual state.
- **Bảo mật & Path Traversal**: Mọi đường dẫn artifact tương đối bắt buộc nằm trong `runRoot`. Validator từ chối các ký tự `..` hoặc ký tự thoát khỏi sandbox.
- **Sanitization**: Tự động che giấu Bearer tokens, Cookie, Authorization headers, mật khẩu trước khi ghi manifest.
- **Retention & Tombstone**: Khi artifact bị xóa theo chính sách TTL, manifest giữ bản ghi `Tombstone` với trạng thái `EXPIRED_UNAVAILABLE`, cấm link giả mạo.

### ADR-16-02: Trust Model & Attestation
- **Toàn vẹn (Integrity) $\neq$ Thẩm quyền (Authority)**:
  - Checksum SHA-256 chỉ chứng minh artifact không bị sửa đổi.
  - Phê duyệt Gate (Gate Closure) bắt buộc phải có chữ ký tách biệt từ Master Authority hoặc Reviewer độc lập.
- **Dirty State Isolation**: Kết quả chạy trên working tree có thay đổi chưa commit (`isDirty: true`) chỉ được gắn nhãn `INVESTIGATION_ONLY`, không được dùng làm bằng chứng vượt gate release.

### ADR-16-03: Multi-Runner Isolation & Receipts
- **Không gian tên theo Worker (Namespace Isolation)**: Mọi artifact được định tuyến vào thư mục `artifacts/<runId>/<shardIndex>_<workerIndex>/` để chống xung đột file.
- **Empty Selection Gate**: Khi bộ lọc test không khớp kịch bản nào (`matchedCount === 0`), runner trả về trạng thái `INVALID_EMPTY_RUN`, không được tính là `PASS`.
- **Hỗ trợ Runner kép**: Cung cấp cấu trúc receipt tương thích cả Playwright runner và Node core test runner.

### ADR-16-04: Phân Loại Lỗi & Cổng Xác Minh Bug (Rule 14)
- Khi phát hiện sai khác, hệ thống phân loại thành 4 nhóm độc lập:
  1. `TEST_DEFECT`: Lỗi selector, thiếu await, sai assertion.
  2. `ENVIRONMENT_ISSUE`: Mạng chập chờn, rớt dịch vụ, cấu hình sai.
  3. `SPEC_GAP`: Chưa có tài liệu nghiệp vụ chuẩn để đối chiếu.
  4. `CONFIRMED_BUG`: Lỗi nghiệp vụ thực sự sau khi vượt qua quy trình 3 bước xác minh khả năng tái hiện.

---

## 3. Hệ Quả & Rủi Ro (Consequences & Risks)

- **Ưu điểm**: Đảm bảo 100% bằng chứng kiểm thử có thể kiểm toán ngược (auditability), ngăn ngừa báo cáo bug ảo.
- **Chi phí**: Tăng thêm một lượng nhỏ I/O khi tính toán SHA256 cho artifact; được khắc phục bằng cách chỉ băm các artifact quan trọng trên failure hoặc milestone.

