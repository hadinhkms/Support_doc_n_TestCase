# PHASE 5: REFERENCE SUITE DOGFOODING (`REQ-001`) & FULL GATE VERIFICATION

> **Thuộc:** [Plan 14 — Deep Logic, Runtime Bug-Trap & UI/UX Geometry Engine](../14_DEEP_LOGIC_AND_UI_UX_BUG_HUNTING_FRAMEWORK_PLAN.md)  
> **Phiên bản:** 1.1 — 2026-10-23  
> **Phụ thuộc:** Phase 0–4
> **File mục tiêu:**
> - `[MODIFY]` [`requirements/REQ-001-sign-in.md`](../../requirements/REQ-001-sign-in.md)
> - `[MODIFY]` [`test-cases/REQ-001-sign-in.md`](../../test-cases/REQ-001-sign-in.md) & [`test-cases/REQ-001-sign-in.automation-plan.md`](../../test-cases/REQ-001-sign-in.automation-plan.md)
> - `[MODIFY]` [`playwright/tests/data/users.ts`](../../playwright/tests/data/users.ts) & [`playwright/tests/pages/login.page.ts`](../../playwright/tests/pages/login.page.ts)
> - `[MODIFY]` [`playwright/tests/auth/login.spec.ts`](../../playwright/tests/auth/login.spec.ts)
> - `[MODIFY]` [`playwright/tests/a11y/login.a11y.spec.ts`](../../playwright/tests/a11y/login.a11y.spec.ts)
> - `[AUTO-GENERATED]` [`test-cases/traceability.md`](../../test-cases/traceability.md)

---

## 1. Mục Tiêu: Biến `REQ-001` Thành "Gold Standard" Của Deep Testing

Mọi nâng cấp ở Phase 1–4 phải được **kiểm chứng thực chiến (Dogfooding)** ngay trên bộ mẫu chuẩn `REQ-001` của dự án để:
1. Xử lý triệt để **2 cảnh báo `rule-thieu-boundary-test`** đang tồn đọng khi chạy `npm run qa:gaps`.
2. Lập inventory finding có file:line, expected xác nhận và TC/spec xử lý; không ghi LG-01..LG-09 đã đóng khi chưa có báo cáo nguồn/bằng chứng từng finding.
3. Đạt 0 blocker/major/minor bằng CLI fail-on=minor Phase 3; tách G5a helper proof và G5b application proof.

---

## 2. Chi Tiết Thay Đổi Trên Bộ Tài Liệu & Code Của `REQ-001`

### 2.1. Tại [`requirements/REQ-001-sign-in.md`](../../requirements/REQ-001-sign-in.md)
1. Bổ sung `- Page exposure: public` vào mục `Actors and preconditions`.
2. Cập nhật bảng `Rules and validation` để phủ đủ cả lớp hợp lệ (EP) và giá trị biên (BVA):
   - `Email`: gán `TC-004, TC-014, TC-016`
   - `Password`: gán `TC-012, TC-015, TC-016`
   - `Failed attempts`: gán `TC-002, TC-009` (tách lớp thử sai < 5 lần và biên khoá ở lần 5, 6 $\rightarrow$ xoá cảnh báo `rule-thieu-boundary-test` số 1).
   - `Session idle`: gán `TC-005, TC-010` (tách lớp đang hoạt động < 24h và biên hết hạn 24h, 24h+1m $\rightarrow$ xoá cảnh báo `rule-thieu-boundary-test` số 2).
   - `Submit action`: gán `TC-001, TC-017` (chống bấm đúp `DH-01`).
3. Bổ sung mục `- UI/UX & Layout:` vào `Non-functional expectations` và thêm `Q-005` (quy tắc `trim()` khoảng trắng đầu/cuối cho Email) vào `Open questions`.

### 2.2. Tại [`test-cases/REQ-001-sign-in.md`](../../test-cases/REQ-001-sign-in.md)
Chuẩn hoá và mở rộng danh sách Test Case từ `TC-001` $\to$ `TC-020`:
- **TC-001 (@smoke @p0 @journey)**: Auto fixture runtimeTrap kiểm tra teardown, checkpoint thủ công tùy chọn.
- **`TC-002` & `TC-003` (`@p1 @security`)**: Bổ sung kiểm tra không sinh session cookie (`PA-04`) và giữ nguyên giá trị `emailInput` sau khi báo lỗi (`DH-06` qua `expectInputsPreserved`).
- **`TC-004` (`@p2`)**: Dùng `expectZeroNetworkMutations` chứng minh `0` request `POST /api/auth/login` bắn lên server khi sai định dạng email (`PA-04`).
- **`TC-012`, `TC-014`, `TC-015` (`@p2`)**: Chuyển từ `Candidate` sang `Automation: Yes`, kiểm thử biên độ dài Email (`254`, `255`) và Password (`7`, `8`, `64`, `65`) bằng `expectMaxLengthEnforced` và validation locator.
- **`TC-016` (`@p2` — Mới)**: Kiểm thử chuỗi toàn khoảng trắng (`"     "`) bị chặn ở client với `expectZeroNetworkMutations` (`DH-03`).
- **`TC-017` (`@p1` — Mới)**: Kiểm thử chống bấm đúp liên tiếp vào nút `Sign in` bằng `expectDoubleSubmitProtection` (`DH-01`).
- **`TC-018` (`@p1 @security @xss` — Mới)**: Kiểm thử chống Reflected XSS trên trang `/login` bằng `expectXssPayloadNeutralized` (`DH-05`).
- **`TC-019` (`@ui @a11y @p2` — Mới)**: Kiểm thử hình học DOM khi nhập chuỗi biên `254` ký tự và khi hiện lỗi validation bằng `expectContainedWithin`, `expectPairwiseNoOverlap`, `expectNoTextClipping`, `expectNotOccluded`.
- **`TC-020` (`@ui @a11y @p2` — Mới)**: Kiểm thử Responsive Desktop (`1280x720`) & Mobile (`375x667`), chống tràn ngang, chống ảnh vỡ và kích thước vùng chạm bằng `expectCleanUiState` & `expectMinTapTargetSize`.

### 2.3. Tại [`playwright/tests/auth/login.spec.ts`](../../playwright/tests/auth/login.spec.ts) và [`playwright/tests/a11y/login.a11y.spec.ts`](../../playwright/tests/a11y/login.a11y.spec.ts)
- Cài đặt đầy đủ các test `TC-001` $\to$ `TC-006`, `TC-012` $\to$ `TC-018` trong `login.spec.ts`.
- Cài đặt đầy đủ các test `TC-007`, `TC-008`, `TC-019`, `TC-020` trong `login.a11y.spec.ts`.

---

## 3. Quy Trình Chạy Kiểm Chứng Cuối Cùng (Verification Runbook)

Sau khi hoàn tất code ở Phase 1–5, chạy lần lượt chuỗi lệnh sau và ghi nhận bằng chứng:

```powershell
# 1. Chạy toàn bộ Unit Test của tools/ (qa, boundary, decisions, scaffold, learner)
npm test

# 2. Kiểm định TypeScript + ESLint + Danh sách test Playwright
cd playwright
npm run verify
cd ..

# 3. Sinh lại Ma trận Truy vết tự động
npm run qa:matrix

# 4. Chạy Gate tổng hợp (boundary + drift + gaps)
npm run qa:check

# 5. Kiểm tra chỉ số sức khỏe Deep Testing trên JSON API cho Dashboard
npm run qa:summary -- --json

# 6. Kiểm tra trạng thái Selective Learning
node tools/qa learn --json
```

### Kỳ vọng kết quả đầu ra (Exit Criteria)
- `npm test`: **100% PASS** (`0 fail`).
- npm run verify: typecheck/lint/list PASS. 17 test logic là dự kiến 1.0; xác nhận theo inventory cuối, tách số browser/harness. --list không phải runtime proof.
- `npm run qa:check`:
  - `Boundary`: **PASS** (0 unclassified, 0 ship violation).
  - `Drift`: **PASS** (0 vấn đề).
  - `Gaps`: **0 blocker, 0 major, 0 minor** (sạch tuyệt đối).


## 4. Ràng buộc nghiệp vụ

- Trước khi sửa requirements/test-cases/spec, đọc .github/copilot-instructions.md, chạy npm run qa:impact -- REQ-001 và npm run qa:gaps; lần cập nhật 1.1 chỉ thay plan.
- Không chỉ thêm TC-002/TC-005 vào bảng để hết minor. TC phải kiểm tra biên với dữ liệu/timestamp và expected. Khoá lần 5 hay 6 phải theo AC-007 được owner xác nhận, không tự đổi thành khoá lần 5.
- Session đúng 24h và 24h+1m cần xác nhận vì REQ nói sau/quá 24h. Cần backend clock/seed contract; chỉnh clock page chưa chứng minh expiry server.
- Whitespace theo từng field; không tự trim password hoặc kết luận password toàn khoảng trắng sai nếu rule chưa chốt. Q-005 và Open questions phải xử lý trước khi expected thành gate.
- TC-017 cần AC/rule chống trùng được xác nhận. TC-018 cần sink, input/query và expected escaping/CSP; chưa biết sink thì pending, không ghi neutralization PASS.
- TC-012/014/015 chỉ chuyển Yes khi spec triển khai đúng requirement; runtime status ghi riêng. Mỗi test có priority/REQ/AC/TC, setup/cleanup và dữ liệu độc lập browser/worker/shard.

## 5. Runbook bổ sung

Lệnh mới dưới đây chỉ chạy sau implementation Phase 3/5. Runbook §3 chỉ kiểm tra static nền.

### 5.1. G4: chặn cả minor

Chạy ở root sau qa:matrix/qa:check:

~~~powershell
node tools/qa gaps --deep-coverage --fail-on=minor
node tools/qa drift --fail-on=minor
node tools/qa summary --deep-coverage --json
~~~

Lưu exit code/finding counts/JSON theo Phase 3. --strict cũ chỉ chặn major, không chứng minh zero minor. Boundary strict có trong qa:check.

### 5.2. G5a: helper runtime độc lập app

Triển khai harness/config/script theo Phase 0; cập nhật manifest ownership trước khi tạo file. Trong playwright:

~~~powershell
npm run test:deep-engine -- --shard=1/2
npm run test:deep-engine -- --shard=2/2
~~~

Mỗi lệnh chạy chromium/firefox/webkit, retries=0. Chạy lại cả hai với dữ liệu mới. HM-01..HM-08 map cặp sạch/cài bug. Suite exit 0 vì bắt đúng lỗi dự kiến, không dùng skip/test.fail/catch mọi lỗi. Verify bao gồm harness/config mới.

### 5.3. G5b: REQ-001 trên ứng dụng thật

Preflight: BASE_URL, credential qua requireEnv, seed/cleanup, tài khoản riêng cho lockout, clock/test API expiry, sink XSS và business contracts xác nhận. Thiếu app thì G5b BLOCKED với owner/dependency/resume condition; G1–G5a xanh chưa thành application PASS.

Khi preflight đủ, chạy trong playwright:

~~~powershell
npm run test:regression
npx playwright test --project=firefox --project=webkit --grep @REQ-001 --grep-invert @wip
~~~

Lưu executed/skipped/failed, browser, report/trace và business outcome. TC-009/010 cần backend capability tương ứng; TC/manual hoặc --list chưa chứng minh runtime. Kiểm tra PR chỉ chọn smoke/P0 và loại WIP; deep P1/P2 phải có lượt regression/nightly thật.

## 6. Hồ sơ nghiệm thu

Tạo evidence/verification.md theo Phase 0; từng G0/G1/G2/G3/G4/G5a/G5b/G6 có PASS/FAIL/BLOCKED/PENDING, người chạy/reviewer, command/revision/artifacts/lý do. Chỉ gọi Gold Standard khi G5b có bằng chứng; trước đó ghi implemented/unverified theo thực tế.

G6 learn read-only, không tự apply knowledge. Nếu nguồn đã commit phải chỉ rõ --since; giữ quyền duyệt/apply theo Plan 13. Không có candidate không đồng nghĩa lỗi learner; learner chạy được không chứng minh helper bắt bug.
