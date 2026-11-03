# Reproduction Protocol — phụ lục PLAN-16

> Trạng thái: VERIFIED · Phase sở hữu: 2 · Ngày: 2026-11-03
> Nguồn quy tắc: .github/copilot-instructions.md mục 14; Master Acceptance Gates.
> Phụ lục đã được QC/UAT review và phù hợp với zero false-positive / dual-proof gate trong workspace.

## 1. Phân loại trước khi kết luận
| Trạng thái | Nghĩa |
|---|---|
| Observation | Đã thấy hành vi bất thường, chưa đủ điều kiện kết luận |
| TEST_DEFECT | Locator/assertion/setup/cleanup/await hoặc test oracle sai đã xác minh |
| ENVIRONMENT_ISSUE | Lỗi cấu hình/dịch vụ/token/resource có bằng chứng |
| SPEC_GAP | Chưa có expected có thẩm quyền |
| INTERMITTENT_OBSERVATION | Lỗi ngắt quãng đã lưu, chưa dựng trigger lặp ổn định |
| Confirmed Bug | Đạt rule 14: loại nhiễu, reproduce nhất quán, dual proof |
| FIX_IMPLEMENTED_UNVERIFIED | Đã có bản sửa, chưa đủ verify/independent review |
| VERIFIED_FIXED | Before/after và regression đạt trong phạm vi ghi rõ; closure theo gate |
Không đổi issue status thành test PASS; case FAIL chỉ khi đạt rule hiện hành.
Lỗi assertion chưa xác minh ghi runtime failure + classification pending.
Không xóa observation nghiêm trọng chỉ vì rerun pass.

## 2. Recipe tái hiện tối thiểu
- Bối cảnh nghiệp vụ và tác động, REQ/BR/AC/TC hoặc SPEC_GAP.
- App build và QA revision; dirty diff/config hashes nếu có.
- Runtime/browser/OS/version; viewport/locale/TZ khi liên quan.
- Vai trò và tenant aliases; cách tạo synthetic account có quyền tương đương.
- Dataset seed/schema/version; cách dựng prerequisite qua API/fixture.
- Exact command/cwd hoặc minimal curl, cấu hình qua tên biến env.
- Trình tự steps, payload, expected theo nguồn và actual observable.
- Reset trước mỗi attempt; teardown idempotent sau capture.
- Repro attempts n/N, signature, request/event IDs, artifact manifest.
- Mọi dependency ngoại vi, mock/fault trigger và giới hạn mô phỏng.
- Người tiếp quản có thể chạy mà không dùng máy/phiên browser của tác giả.

## 3. Quy trình điều tra
1. Giữ evidence lần phát hiện trước khi thay đổi state.
2. Kiểm selector, await, hydration, test data collision, env/token và expected.
3. Chạy control khỏe; control lỗi thì điều tra fixture/environment, không quy app.
4. Reset state sạch, chạy đúng scenario ba lần độc lập theo rule 14.
5. Ghi từng attempt, không chỉ ảnh lần fail hay summary lần cuối.
6. Đối chiếu signature/nguyên nhân và downstream state, không chỉ cùng dòng timeout.
7. Nếu nhất quán: dual proof gồm runtime evidence + source anchor khi đọc được code.
8. Không có source: minimal STR/curl; không gán root cause đã xác nhận từ suy đoán.
9. Người khác tái dựng từ recipe và rerun; lưu receipt riêng cùng revision.

Lệnh Playwright --repeat-each=3 cần project/grep/spec chính xác, không rơi vào zero tests.
Repeated tests vẫn phải seed/reset riêng; không dùng cùng state biến đổi cả ba lần.
Sự cố môi trường retry tối đa 3 lần theo Master, sau đó BLOCKED có log.
Ba rerun phục vụ xác minh, không phải bằng chứng lỗi ngắt quãng không tồn tại.

## 4. Race condition và lỗi ngắt quãng
- Giữ lần fail đầu cùng timestamp, tải, ordering, dữ liệu và attempt ratio.
- Dựng barrier tại điểm tranh chấp quan sát được; Promise.all đơn lẻ không bảo đảm overlap.
- Ghi release order, số in-flight, server correlation và trạng thái cuối.
- Dùng delay/fault injection ở boundary xác định khi môi trường cho phép.
- Reproduce bằng fault injection ghi rõ điều kiện nhân tạo; không suy tần suất production.
- Không tăng timeout/retry hoặc bỏ assertion để khiến probe xanh.
- Chưa có trigger nhất quán giữ INTERMITTENT_OBSERVATION, owner và kế hoạch điều tra.
- Severity theo tác động quan sát; chưa Confirmed Bug không có nghĩa rủi ro thấp.

## 5. Không đánh mất hiện trường
- Capture failure trước finally/afterEach xóa data; evidence có giới hạn thời gian.
- Teardown vẫn chạy; không bỏ cleanup vô hạn để giữ hiện trường.
- Nếu cần giữ tài nguyên: synthetic quarantine có owner/TTL và quyền truy cập rõ.
- Cleanup fail có issue riêng/metadata, không che failure ban đầu.
- Snapshot/DB dump chỉ khi đã được duyệt, không kéo dữ liệu thật vào artifact.
- Redaction không được thay mất giá trị cần reproduce: giữ seed hoặc alias mapping an toàn.
- Không nhúng storageState/token hết hạn vào gói rồi coi đó là recipe lâu dài.

## 6. Xác minh bản sửa
| Bước | Bằng chứng |
|---|---|
| Before | Revision trước sửa, test fail đúng observable và log/hash |
| After | Revision sau sửa, cùng expected + data/profile, pass |
| Negative control | Input sai/rejected mutation không tạo side effect |
| Collision | Concurrent/repeated action không nhân đôi/ghi đè trái contract |
| Boundary | Biên schema/field/state có liên quan vẫn đúng |
| Regression | Luồng lân cận được chọn theo impact, browser/role phù hợp |
| Independent rerun | Reviewer receipt riêng trên cùng revision/contract |

Nếu không thể chạy before: NOT_FEASIBLE, lý do, evidence lịch sử và giới hạn kết luận.
Không đổi expected để match bản sửa; contract đổi phải qua PDR.
Test mới cần chứng minh bắt được lỗi trước sửa khi khả thi.
Không tuyên bố hết bug toàn hệ thống từ một scenario xanh.
Gate closure theo Master signatures, clean SHA và trusted receipts; không tự đóng phase.

## 7. Mẫu bug report
- ID / trạng thái / severity / owner.
- Bối cảnh nghiệp vụ.
- Nguồn expected và traceability.
- Build/môi trường/role/dataset aliases.
- Preconditions + reset.
- Steps hoặc exact command.
- Expected / actual + persisted side effects.
- Attempts n/N và bảng signature.
- Evidence index: ảnh gốc, ảnh khoanh đỏ, trace/log, network/state.
- Root cause: confirmed source anchor hoặc hypothesis được gắn nhãn.
- Repro recipe và người kiểm chứng độc lập.
- Before/after/regression receipts.
- Giới hạn còn mở, retention expiry và hành động tiếp theo.

## 8. Acceptance drill
- Healthy control, deterministic app defect, test defect và env failure được phân loại đúng.
- Race probe có trigger được lặp lại, không lấy flake ngẫu nhiên làm Confirmed Bug.
- Người mới clone/download rồi dựng dữ liệu và reproduce được cùng signature.
- Replay không dùng secrets cũ, không ghi đè môi trường ngoài scope.
- Artifact missing/stale/tampered bị từ chối; partial capture không báo full verification.

