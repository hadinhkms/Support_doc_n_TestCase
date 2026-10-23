# PHASE 2: MINING, GATEKEEPER VÀ STORAGE AN TOÀN

> Thuộc [Plan 13 v1.2](../13_SELF_EVOLVING_QA_SKILL_AND_SELECTIVE_LEARNING_PLAN.md); phụ thuộc [Phase 1](PHASE_1_SKILL_KNOWLEDGE_BASE.md).
> File mới: tools/qa/lib/learner.js và learner.test.js.

## 1. API contract

| API | Trách nhiệm |
|---|---|
| parseCatalogMarkdown(text, type) | Parse/validate catalog chung, lỗi có entry/file |
| loadCatalog(root, options) | Shared + project -> effective view/stats/snapshotHash |
| collectDiff(root, options) | Git argv array shell false, diff + scope metadata |
| extractSignalsFromDiff(diff, options) | Hunk-aware, file/line/old-new context, layout config |
| extractSignalsFromDecisions(root) | Schema thực tế, chỉ confirmed option hợp lệ |
| evaluateGatekeeper(signals, catalog) | proposed/needsReview/rejected + gate reasons, không ghi |
| applyReviewedCandidates(root, review, options) | Review validation, stale/lock/cap/dedup, atomic project JSON |
| learn(root, options) | Scan/apply, report chung cho mọi renderer |

Thay appendCandidateToCatalog v1.1 bằng batch apply, không append Markdown ship. Không có API mặc định ghi khi thiếu dryRun.

## 2. Git scope và lỗi

Mặc định diff HEAD với working tree: staged + unstaged, không untracked hoặc các commit trước HEAD. Report nêu scope và số untracked phù hợp bị bỏ qua. Since REF so cây REF với working tree: gồm committed sau REF + staged + unstaged. Hai cú pháp CLI --since=REF và --since REF.

Resolve ref bằng git rev-parse --verify --end-of-options REF^{commit}; diff SHA đã resolve, đặt -- trước pathspec; không đưa raw ref vào shell. Tắt external diff/textconv/color, unified=8, no-renames. Dùng path inventory NUL-delimited rồi diff từng file để xử lý space/Unicode/tab/newline; rename thể hiện delete/add, dedup nội dung. Binary/deleted-only báo skipped reason.

Repo chưa có HEAD: mặc định dùng empty tree tạo bằng Git core. Ref chỉ định không tồn tại là lỗi. Git thiếu/not-repo/timeout/buffer limit => lỗi exit 2, không nuốt thành report rỗng. Timeout 15 giây/subprocess; tổng diff <= 8 MiB, <= 1.000 signals; vượt limit báo lỗi, không truncate rồi apply.

Lấy requirementsDir/testCasesDir/projectDir từ config, hỗ trợ spec .spec.ts/.spec.js trong projectDir; áp dụng ignoreSpecs. Không hardcode chỉ playwright/tests. Bỏ generated traceability và toàn bộ <testCasesDir>/_learning khỏi mining để tránh feedback loop. Validate real path symlink/junction không thoát repo; skipped/filter count hiện trong report.

## 3. Signal có evidence

REQ/TC: nhận heading ##..######, dấu phân cách -, :, – hoặc — và bảng trong Rules and validation. Gộp context hunk/precondition/action/expected, không bắt chữ min ở mọi dòng. Chỉ heading hoặc thiếu expected => needsReview.

Spec: so old/new nhận assertion/await/isolation change; assertion mới trong file mới không mặc định là false-positive fix. Thiếu context/helper không đọc được => needsReview; không chạy spec để mining.

Decisions: root object có decisions array, BOM được hỗ trợ. File absent là nguồn absent; JSON/schema hỏng là error. Chỉ status confirmed, answer object, answer.optionId không rỗng và tồn tại trong options. Evidence title + option label + answer.note, không stringify thành [object Object]. Pending có note placeholder không sinh candidate; confirmed sai schema báo lỗi. Severity blocking/urgent chỉ metadata, không tự pass Impact.

Verify trực tiếp do reviewer đưa vào artifact kèm file/line/test-run evidence và hash, qua cùng gates; engine không tự đọc chat.

## 4. Dedupe và report

Fingerprint SHA-256 từ source kind + evidence redacted/chuẩn hóa + nội dung nghiệp vụ chuẩn hóa, không chứa line number/timestamp. candidateId từ fingerprint; project ID cấp khi ghi. sourceHash riêng để phát hiện nguồn đổi. Exact fingerprint giữ identity; so nội dung chuẩn hóa để gộp cùng bài học đến từ nhiều source kind, giữ tối đa 5 provenance.

So processed/entries, shared/project catalog, các candidate trước cùng batch. Lexical Jaccard >= 0.65 gắn possible-duplicate, không chứng minh semantic duplicate. Static mapping version hóa ít nhất assertion-thieu-await/spec-thieu-assertion/spec-chi-assert-url, test đối chiếu finding kind thực tế. Partial rule coverage giữ semantic remainder cho review, không loại toàn bộ PA-01.

Report schemaVersion 1.0.0: mode, scope, snapshotHash, sourceHash, catalogStats {shared, project, effective}, proposed, needsReview, rejected, applied, skipped, errors. Sort source/file/line/fingerprint, reason code ổn định. Mỗi gate status pass/fail/unknown + reason; reviewer mới xác nhận đủ bốn pass. Proposed không tính applied. Snapshot hash bao shared catalog bytes + project knowledge canonical state + schema/policy version; sourceHash bao diff/decisions/evidence của scope đã export.

## 5. Batch apply transaction

1. Validate review/schema/path own. Approved/rejected phải có review metadata; pending bỏ qua, báo skipped.
2. Lock exclusive wx; pid/time, không tự phá theo tuổi. Nếu lock tồn tại exit 2; recovery thủ công sau xác nhận writer đã dừng.
3. Reload catalog/knowledge, đối chiếu snapshot và sourceHash bằng rescan scope artifact; verify evidence hash cho nguồn trực tiếp. Không xác minh được => error. Nếu tất cả fingerprints đã processed cùng resolution/content, replay no-op exit 0; nội dung sửa sau apply => conflict. Lưu resolution content hash trong processed để kiểm tra replay.
4. Validate toàn batch trước ghi: cap/ID/schema/dedup/length/redaction. Partial stale hoặc cap overflow abort cả batch exit 2, không partial write. Duplicate với entry đã có chỉ gộp provenance khi review nêu rõ resolution merged.
5. Cấp ID đơn điệu; serialize một JSON. Temp sibling exclusive -> flush/close -> atomic rename. Rename lỗi (kể cả Windows file mở) giữ original, không unlink original để ép ghi. Dọn temp/lock trong finally; crash trước rename giữ cũ, sau rename giữ mới; lock sót xử lý theo README.
6. Dry-run cùng validation nhưng không tạo folder/lock/temp; chỉ preview, không hứa lần apply sau vẫn cùng snapshot.

Không undo bằng xóa knowledge. Undo qua review commit hoặc retire có tombstone. Không tự merge/graduate để né cap.

## 6. Test matrix bắt buộc

Node test/assert, fixture repo tạm, cleanup; mỗi nhóm có expected cụ thể, có thể nhiều subtest.

| ID | Fixture / expected |
|---|---|
| L01 | BOM/CRLF/fence, đúng field/enums; malformed/duplicate ID/cap lỗi |
| L02 | Overlay absent rỗng; JSON/read error không fallback |
| L03 | Heading/table/context biến thể; generated/_learning không mining |
| L04 | Noise comment/format/config/happy path bị lọc; heading/keyword đơn lẻ needsReview |
| L05 | Assertion fix old/new; assertion mới không tự approved |
| L06 | Confirmed/pending/placeholder/wrong option/BOM/malformed decisions |
| L07 | Exact/lexical/multilingual unknown; shared/project/batch dedup; static partial |
| L08 | Batch ID không trùng; ID retired không tái sử dụng |
| L09 | Cap 24+1 pass, 25+1 fail, 24+2 abort; field/provenance limits |
| L10 | Preview/dry-run repo hash không đổi, không tạo file/folder/lock |
| L11 | Apply đúng; replay byte-identical; sửa source/review/catalog stale/conflict |
| L12 | Lock contention, permission/rename failure, cleanup/crash recovery giữ JSON hợp lệ |
| L13 | Git thật staged/unstaged/committed/untracked/empty HEAD; bad ref/not-repo/timeout/limit |
| L14 | Path space/Unicode/rename/binary/custom layout/ignore; junction escape chặn |
| L15 | Secret/PII/instruction không xuất raw/không thực thi/không bypass review |
| L16 | Apply không đổi ship; thay ship giả lập vẫn giữ/load project knowledge |

Dùng injected subprocess/fs adapter cho lỗi khó tái hiện, nhưng đường chính có Git/FS integration thật. Không chỉ mock toàn bộ implementation hoặc kiểm tra truthy. npm test phải chạy các nhóm này cùng test cũ.
