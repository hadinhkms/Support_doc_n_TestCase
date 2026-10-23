# PHASE 2: RUNTIME BUG-TRAP & DEEP LOGIC / SECURITY HELPERS

> **Thuộc:** [Plan 14](../14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md)  
> **Phiên bản:** 1.1 — 2026-10-23  
> **Phụ thuộc:** Phase 0 và Phase 1  
> **File mục tiêu:** `playwright/tests/support/deep-guards.ts`, `playwright/tests/fixtures/test-fixtures.ts`; harness theo Phase 0.

## 1. Mục tiêu và thay đổi so với bản 1.0

Bẫy pageerror/console.error/5xx và chuẩn hóa kiểm tra request, gửi trùng, XSS, giữ dữ liệu. Bản 1.1 thay các snippet 1.0 bằng hợp đồng dưới đây: loại bỏ click đơn + count<=1, observation chỉ kéo dài bằng action, marker XSS chỉ nằm trong window và listener không dispose. Không triển khai lại các snippet cũ.

## 2. Hợp đồng helper

### 2.1. RuntimeBugTrap

- Thu thập lỗi trên page được fixture quản lý từ trước goto đầu tiên tới teardown. Popup, service worker, APIRequestContext và frame ngoài phạm vi phải ghi rõ; không tuyên bố bao phủ tự động.
- RuntimeTrapOptions khai báo ngoại lệ theo từng test: kind, method/path/status nếu HTTP, message pattern nếu console/pageerror, maxCount và lý do. Không dùng ngoại lệ mọi URL 5xx hay tắt trap để làm xanh suite lỗi dự kiến.
- Lỗi HTTP dự kiến có thể tạo thêm console.error: cấu hình từng channel và kiểm thử tương ứng; cho phép response không tự cho phép mọi console error. Vượt maxCount phải fail.
- Lưu handler có tên để dispose() gỡ đúng listener; dispose idempotent. Normalize/reset lastIndex với regex g/y để tránh match xen kẽ.
- assertClean() đồng bộ, tổng hợp mọi channel; teardown vẫn kiểm tra lỗi phát sinh sau checkpoint thủ công. Diagnostics redacted, bounded; không lưu token/body/query nhạy cảm.

### 2.2. expectZeroNetworkMutations — PA-04

API dự kiến: `expectZeroNetworkMutations(page, action, options)`; options bắt buộc requestMatcher, waitForSettled, observationMs, timeoutMs.

1. Đăng ký listener trước action; matcher chuẩn hóa URL/method, không dùng includes mơ hồ. Đếm method khai báo (mặc định POST/PUT/PATCH/DELETE).
2. Chạy action và waitForSettled() xác nhận trạng thái validation cuối. Giữ listener trong observationMs tính từ mốc đó bằng collector có deadline. Đây là cửa sổ đo vắng mặt hữu hạn, không phải sleep đoán app sẵn sàng.
3. Hết cửa sổ mới assert count=0. Giữ diagnostics request sai phạm kể cả khi action lỗi; action/settled timeout không được chuyển thành PASS.
4. Finally gỡ đúng listener. Request ngoài thời gian/phạm vi chưa được chứng minh; database side effect cần oracle riêng.

HM-02 phải có request debounce sau khi click resolve, request không khớp không bị đếm, cleanup khi action throw.

### 2.3. expectDoubleSubmitProtection — DH-01

API dự kiến: `expectDoubleSubmitProtection(page, options)`; options gồm requestMatcher, firstSubmit, attemptSecondSubmit, waitForSettled, assertBusinessOutcome, observationMs, timeoutMs. Harness có oracle đếm mutation.

1. Gắn listener/route handler riêng; giữ response đầu bằng barrier release chủ động, không dùng delayMs cố định. Chờ request đầu; 0 request là FAIL.
2. Gọi attemptSecondSubmit khi request đầu còn pending. Phải phát kích hoạt thứ hai thực tế; không dùng click tự đợi nút enabled rồi submit sau khi request kết thúc. Với nút disabled, dùng tương tác vật lý tại tọa độ đã xác nhận; không dùng dispatchEvent để giả lập người dùng.
3. Quan sát tới hết observation window; đúng 1 request. Disabled/aria-busy là assertion UI bổ sung, không thay đếm request.
4. Release response, chờ trạng thái cuối và assertBusinessOutcome(). Luồng tạo dữ liệu cần oracle đọc xác nhận đúng 1 mutation; chỉ có request count thì ghi đúng mức bằng chứng đó.
5. Finally release barrier pending, unroute(pattern, ownHandler), gỡ đúng listener. Không gỡ route caller; kiểm thử fallback để không bypass mock/fulfill đã có.

HM-03 có app aria-busy=true nhưng gửi hai request, app gửi 0 request, Enter + click, và route caller vẫn hoạt động sau helper.

### 2.4. expectXssPayloadNeutralized — DH-05

API dự kiến: `expectXssPayloadNeutralized(page, actionWithPayload, options)`; options gồm assertPayloadReachedSink, waitForSettled, observationMs, timeoutMs và payload theo sink.

- Trước action, đăng ký context binding tên duy nhất theo test và init script cho document trong phạm vi hỗ trợ, bao gồm document hiện tại. Payload báo thực thi về collector Node tồn tại xuyên navigation.
- Chờ sink xử lý/render và assertPayloadReachedSink xác nhận payload tới sink. Chỉ fill input hoặc validation chặn chưa đủ chứng minh reflected-XSS; không tới sink phải fail/inconclusive.
- Giữ collector tới hết observation window sau settled. Payload chạy rồi navigation và onerror chạy trễ đều bị phát hiện; không chỉ đọc window ở document cuối.
- PASS chỉ nghĩa là không quan sát thực thi với payload/sink/phạm vi đã kiểm tra. CSP chặn cần báo riêng; muốn chứng minh escaping phải kiểm tra DOM/text tương ứng.
- Context riêng theo test và đóng sau test để cleanup binding/init script. Cross-origin/frame/popup chưa hỗ trợ phải báo rõ.

HM-04 có fixture vulnerable và escaped cùng đường truyền payload; kiểm chứng collector nhận đúng tín hiệu trước khi dùng làm oracle.

### 2.5. expectInputsPreserved — DH-06

Giữ API `expectInputsPreserved([{ locator, expectedValue }])`; dùng await expect(locator).toHaveValue. Caller chờ đúng trạng thái lỗi. Chỉ kiểm tra trường không nhạy cảm, không in expectedValue vào custom message. Password/OTP giữ hay xóa theo requirement xác nhận.

## 3. Fixture lifecycle

- Fixtures có runtimeTrap: RuntimeBugTrap và test option runtimeTrapOptions.
- Auto fixture khởi tạo từ page trước use và trước navigation; page object không được goto trong setup trước khi trap sẵn sàng.
- Sau await use(trap), đợi mốc pending đã đăng ký, assertClean, dispose trong finally trước khi page đóng. Không chờ networkidle vô hạn. Teardown là mốc cuối phạm vi quan sát.
- Nếu test đã fail, giữ lỗi gốc và attach findings redacted; nếu test đang pass và trap bẩn, fail teardown. Không dựa vào expectedStatus để giấu lỗi.
- assertClean() giữa test chỉ là checkpoint tùy chọn; caller không phải tự nhớ gọi để bật trap.

## 4. Nghiệm thu

1. npm run verify trong playwright PASS; API đồng bộ Phase 4/templates.
2. HM-01..HM-04 và HM-08 đủ case sạch/cài bug trong harness, chạy thật theo G5a.
3. Có test ngoại lệ 5xx + console, lỗi cuối test, action throw, cleanup và route collision.
4. Chưa có app thật thì không claim G5b PASS.
