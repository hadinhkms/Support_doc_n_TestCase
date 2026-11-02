# Evidence Contract — phụ lục PLAN-16

> Trạng thái: DRAFT · Version đề xuất: 1 · Ngày: 2026-11-02
> Phase sở hữu: 0 khóa contract, 1 triển khai, mọi phase tiêu thụ.
> Bổ sung rule hiện hành; không thay thế Master receipt hoặc chữ ký.

## 1. Nguyên tắc
- Không có bằng chứng phù hợp → NOT VERIFIED, không suy ra PASS.
- Bằng chứng gắn đúng ứng dụng, QA suite, test, attempt, environment và thời điểm.
- Assertion fail là kết quả test; Confirmed Bug cần vượt cổng reproduce riêng.
- Lưu fail attempt ngay khi xảy ra, trước retry/reset/cleanup.
- Manifest là dữ liệu; không thực thi command tùy ý đọc từ manifest.

## 2. Nội dung manifest bắt buộc
| Nhóm | Trường đề xuất | Điều kiện |
|---|---|---|
| Identity | schemaVersion, runId, issueId, REQ/AC/TC, testId, project | Không collision giữa test và worker |
| Attempt | retryIndex, repeatIndex, workerIndex, shard, attemptId | Giữ riêng từng attempt |
| Source | QA full SHA, app build/full SHA, source hash, contract hash | App từ xa không biết SHA: khai build ID và giới hạn |
| Worktree | dirty flag, diff digest, untracked input digests | SHA đơn lẻ không mô tả dirty state |
| Environment | OS, browser/runtime versions, config hash, locale/TZ/viewport | Không lưu toàn bộ environment variables |
| Execution | argv, cwd, start/end UTC, timezone offset, exitCode | Command đã redact, giữ thứ tự arguments |
| Metrics | passed/failed/skipped/interrupted/flaky, duration, matched count | Empty selection không được PASS |
| State | synthetic seed/version, role/tenant aliases, preconditions | Không ghi credential/session thật |
| Observable | expected source, actual, assertion locator/source anchor | HTTP success không chứng minh persistence |
| Correlation | request/job/event IDs và timeline | Redact hoặc alias nếu chứa định danh nhạy cảm |
| Artifacts | path/URI, SHA256, bytes, MIME, sensitivity, expiresAt | Link phải truy xuất được theo access policy |
| Cleanup | outcome, affected IDs aliases, errors, quarantine expiry | Cleanup fail độc lập test outcome |
| Collection | capture errors, redaction status, missing artifacts | Không nuốt lỗi collector |
| Review | scope, reviewer receipt reference | Tự khai actor không có giá trị chữ ký |

## 3. Evidence theo loại bug
| Loại | Bộ bằng chứng tối thiểu |
|---|---|
| UI/visual | Screenshot gốc + bản khoanh đỏ + locator/geometry + trace nếu có |
| Functional UI | Step timeline, expected/actual, DOM observable và persisted outcome |
| API | Method/URL/payload đã redact, status/headers/body, correlation + state check |
| Authorization | Hai principal/tenant aliases, denied response + no mutation/no leak |
| Race/idempotency | Trigger barrier, concurrent attempts, order/timestamps và final aggregate |
| Async | Enqueue/consume/retry timeline, IDs, deadline, DLQ và final state |
| Performance | Workload/config/data hashes, raw samples, percentiles và environment |
| Accessibility | Rule ID, affected element/state, keyboard steps; manual device/reader details |
| Collector failure | Lỗi capture/write/upload, original test error và partial manifest |

Ảnh khoanh đỏ phục vụ đọc; giữ ảnh gốc, không sửa source evidence.
Nếu target đã biến mất hoặc page crash: lưu capture failure và trace/log sẵn có.
Không tạo ảnh giả hoặc khoanh một vùng không còn phản ánh lỗi.
Video tùy rủi ro; không chụp mọi negative test khi log/state đủ chứng minh.

## 4. Privacy và retention
- Redact trước khi persist/upload; bảo vệ Authorization, Cookie, password, OTP, token.
- Cần canary tests cho query/body/console/DOM và nested payloads.
- Trace/HAR/ảnh/video có thể chứa dữ liệu dù JSON đã sạch; phải có policy riêng.
- Artifact không sanitize được: dùng synthetic capture hoặc giữ kho hạn chế, từ chối share/export.
- Không commit trace, storageState, HAR nhạy cảm, signed URL hay credential.
- Không ghi raw secrets trong command hoặc process arguments của repro recipe.
- Retention/access/quota do owner khóa ở Phase 0; không mặc định retention CI là đủ.
- Escalation bug kéo dài cần gia hạn artifact hợp lệ trước hết hạn; không copy vào Git.
- Giữ manifest/tombstone khi xóa theo policy để biết artifact đã hết hạn, không link giả.

## 5. Tính toàn vẹn và CI
- Hash bytes thực tế; file thay đổi sau hash phải invalidate.
- Relative paths nằm trong run root; chặn traversal, symlink escape và unsafe archive extraction.
- Upload trên failure/cancel khi runner còn khả năng; bị kill cứng phải nhận diện missing upload.
- Không dùng một tên artifact cho nhiều worker; index liên kết report/test attempt.
- Receipt Master pin runner/policy/contract/source; không viết một checker cạnh tranh.
- JUnit test_id phải map nguồn tracked thật; phân biệt assertion failure với runner crash.
- Test report HTML/blob không tự thay thế receipt CI được tin cậy.
- Chữ ký độc lập đến từ trust store ngoài PR; checksum chỉ chứng minh integrity.
- Local dirty runs dùng điều tra; không đổi nhãn thành trusted gate evidence.
- Download drill trên runner/checkout mới: artifact tồn tại, hash đúng và đọc được.

## 6. Failure matrix bắt buộc
| Probe | Expected |
|---|---|
| Disk full / permission denied | Collection error, giữ original failure, không full-evidence PASS |
| Upload timeout / canceled job | Partial bundle, upload state rõ, không link success giả |
| Duplicate worker names | Run/attempt namespace ngăn overwrite |
| Manifest đổi revision/hash | Validator reject evidence stale/tampered |
| Secret trong trace/screenshot | Export bị chặn hoặc artifact theo restricted policy |
| Teardown ném lỗi | Cả lỗi test gốc và cleanup được giữ |
| Missing JUnit / zero tests / critical skipped | Không đạt nghiệm thu |
| Expired artifact / broken URI | Hiển thị unavailable, không claim review tái hiện được |
| Malicious path/command | Validator từ chối; không đọc ngoài run root/không exec |

## 7. Evidence Block khi bàn giao
1. Exact command và cwd (đã redact).
2. Exit code thực tế.
3. Counts, duration và phạm vi test; nêu skipped/not run.
4. Trích log trọng yếu, đường dẫn full log và SHA256.
5. QA/app revision, working-tree identity, contract hash và link receipt.
Ghi riêng kết quả test, trạng thái issue và trạng thái gate.
Không có runtime test thì ghi NOT RUN; không điền số PASS giả.

