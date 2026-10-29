# Workflow 02: Thiết kế Test Case & Phân bổ Test Pyramid

## Mục tiêu
Chuyển hóa Requirement thành bộ kịch bản kiểm thử tối ưu độ phủ (Coverage) trên toàn hệ thống nhưng tối thiểu hóa chi phí thực thi và bảo trì bằng cách phân bổ đúng tầng **Test Pyramid (70/20/10)** và tuân thủ 100% chuẩn truy vết `REQ -> AC -> TC -> Spec` của workspace.

---

## Quy trình Thiết kế 4 Bước

### Bước 1: Áp dụng Kỹ thuật Thiết kế Kiểm thử Chuyên sâu
Đọc đối chiếu [../references/edge-case-catalog.md](../references/edge-case-catalog.md) và `docs/qa-test-design-standard.md` (hoặc `D:/_QA_Test_Automation/docs/qa-test-design-standard.md`):
1. **Equivalence Partitioning (EP) & Boundary Value Analysis (BVA):**
   - Textbox chữ: rỗng, chỉ khoảng trắng (`"   "`), khoảng trắng đầu/cuối, `min - 1`, `min`, `max`, `max + 1`, `UNICODE_OVERFLOW_PAYLOADS`.
   - Textbox số/tiền tệ: chữ (`abc`), ký tự đặc biệt (`!@#`), dán chuỗi hỗn hợp (`12abc34`), số `0`, số âm, số thập phân, `min - 1`, `min`, `max`, `max + 1`.
2. **Decision Table & Cross-Portal Matrix:**
   - Tổ hợp các điều kiện nghiệp vụ (`Role` $\times$ `Entity State` $\times$ `Portal`).
3. **State Transition Testing:**
   - Bao phủ cả luồng chuyển trạng thái hợp lệ (*Valid transitions*) và cố tình gọi API/UI chuyển trạng thái sai thứ tự (*Invalid/Forced transitions*).
4. **Race Condition, Concurrency & Idempotency:**
   - Nhấn đúp nút Submit (`idempotency`), mở 2 tab cùng thao tác (`concurrency`), hoặc 2 Actor trên 2 Portal cùng duyệt/cùng hủy một bản ghi tại cùng thời điểm.
5. **Security, Resilience & UI/UX Geometry:**
   - Xét đủ 5 chiều kiểm thử chuyên sâu của workspace: `persistence`, `boundary`, `idempotency`, `ui-geometry`/`a11y`/`responsive`, và `xss` (bao gồm cả Stored XSS xuyên Portal).

---

### Bước 2: Phân tầng theo Mô hình Test Pyramid (Quy tắc 70 / 20 / 10)
Không đẩy mọi kịch bản lên tầng UI E2E. Phân loại rõ từng kịch bản vào 3 tầng:

| Tầng kiểm thử | Tỷ trọng mục tiêu | Phạm vi kiểm chứng tối ưu | Cách ánh xạ trong Workspace |
|---|---|---|---|
| **1. Unit / Component Level** | ~70% | Logic tính toán thuần túy (thuế, chiết khấu, làm tròn), hàm парse/format ngày giờ, regex helper, state reducer cô lập. | Ghi nhận đề xuất Unit Test cho Dev hoặc kiểm thử hàm ở `tools/` (`node --test`). Trong `test-cases/REQ-xxx.md`, nếu không chạy bằng Playwright E2E thì đánh dấu `Automation: No` kèm lý do *"Đã phủ ở tầng Unit/API"* trong bảng `## Case không automation`. |
| **2. API / Integration Level (Trọng tâm QA Automation)** | ~20% | HTTP Status (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`), JSON Schema, BOLA/IDOR, BFLA, Mass Assignment, BVA payload, Race Condition (`Promise.all`), Read-After-Write & Read-After-Reject. | Gắn tag `@api` (`@p0`..`@p2`, `@security`), tự động hóa siêu nhanh bằng Playwright `APIRequestContext` / `ApiClient` (xem skill [qa-api-testing](../../qa-api-testing/SKILL.md)). |
| **3. UI / E2E & Cross-Portal Level** | ~10% | Critical User Journeys (`@journey`, `@smoke`, `@p0`), luồng đi xuyên nhiều Portal (Portal A tạo $\to$ Portal B duyệt $\to$ Portal A thấy kết quả), kiểm tra hình học UI (`ui-geometry`, `responsive`, `a11y`), chống double-click trên DOM (`idempotency`) và bảo toàn form khi lỗi mạng (`resilience`). | Gắn `- **Capabilities**: ...` tương ứng (`ui-geometry`, `a11y`, `responsive`, `idempotency`, `persistence`, `boundary`, `xss`) và viết Playwright UI spec sử dụng `ui-checks.ts` & `deep-guards.ts`. |

---

### Bước 3: Chấm điểm Ưu tiên Automation (Candidate Selection)
Với các kịch bản ở tầng API và UI/E2E, áp dụng tiêu chí 5 chiều trong `docs/automation-strategy.md` (hoặc `D:/_QA_Test_Automation/docs/automation-strategy.md`) (`Frequency`, `Risk`, `Stability`, `Feasibility`, `Maintenance` chấm 1–5; tổng $\ge 17/25$ hoặc thuộc `P0`/`P1` Critical Path $\to$ `Automation: Yes`).

---

### Bước 4: Xuất Kết Quả (Định dạng Kép: Test Matrix & File Chuẩn Workspace)

1. **Khi người dùng yêu cầu xem nhanh Ma trận Phân tích / Phân tầng trên khung chat:**
   - Sử dụng bảng **System Test Matrix** tại [../templates/test-matrix.md](../templates/test-matrix.md) (có đầy đủ cột `Phân hệ / Portal`, `Tầng Pyramid (Unit/API/E2E)`, `Capabilities`).
2. **Khi lưu thành file chính thức trong `requirements/` và `test-cases/`:**
   - Tuân thủ nghiêm ngặt cấu trúc của `templates/requirement-template.md` và `templates/test-case-template.md` (xem hướng dẫn chi tiết trong [../templates/test-matrix.md](../templates/test-matrix.md)).
   - Chạy `npm run qa:matrix` và `npm run qa:check` để đảm bảo không phát sinh lỗi `ac-khong-co-test-case` hay `rule-chua-map-toi-test-case`.
