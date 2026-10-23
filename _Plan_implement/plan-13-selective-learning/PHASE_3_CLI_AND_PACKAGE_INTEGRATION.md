# PHASE 3: CLI, RENDERER VÀ INTEGRATION TEST

> Thuộc [Plan 13 v1.2](../13_SELF_EVOLVING_QA_SKILL_AND_SELECTIVE_LEARNING_PLAN.md), phụ thuộc [Phase 2](PHASE_2_MULTI_HOP_LEARNER_ENGINE.md).

## 1. File thay đổi

- tools/qa/index.js: learn route/flags/validation/renderer.
- tools/qa/index.test.js: mới, CLI subprocess/integration tests.
- package.json: script qa:learn = node tools/qa learn.
- tools/qa/README.md: usage/schema/Git scope/ownership/cap/errors/recovery.

Giữ lệnh cũ. Refactor main({root, argv}) để inject root khi test; mặc định giữ path.resolve(__dirname, '..', '..'), không đổi sang cwd. Guard require.main === module, export parse/main cần cho test; import không tự chạy/process.exit.

## 2. CLI contract

```bash
npm run qa:learn
node tools/qa learn --json
node tools/qa learn --since=HEAD~1 --json
node tools/qa learn --since HEAD~1 --output=test-cases/_learning/review.json
node tools/qa learn --apply --review=test-cases/_learning/review.json
node tools/qa learn --apply --review=test-cases/_learning/review.json --json
node tools/qa learn --apply --review=test-cases/_learning/review.json --dry-run --json
```

Mặc định preview read-only. Output export artifact pending là ghi file được yêu cầu tường minh: chỉ dưới <testCasesDir>/_learning, không trùng knowledge/lock, không overwrite file tồn tại. Lỗi exit 2; muốn export mới dùng tên khác để giữ công review cũ.

Apply bắt buộc review; review không apply là lỗi. Apply lấy scope trong artifact, không nhận since/output cùng lúc. Dry-run đứng riêng là preview; dry-run + output là lỗi để không mơ hồ side effect. Project-dir vẫn truyền layout; apply phải khớp layout snapshot. Req/domain/tag/strict/boundary flags chưa hỗ trợ cho learn thì báo lỗi, không ignore âm thầm. JSON dùng được mọi mode. Hỗ trợ --since=REF/--since REF, --review=PATH/--review PATH; giá trị thiếu/rỗng là lỗi.

Một pipeline validate -> scan/apply -> report -> render. Mutation nằm trong learner, không đặt bên trong terminal branch. JSON + apply có cùng side effect. JSON stdout đúng một object success/error, không ANSI/diagnostics/stack trace. Pre-detect json để cả lỗi parse/config cũng xuất JSON; stderr dùng diagnostics nếu cần. Machine consumer gọi node trực tiếp vì npm có thể thêm banner.

Exit **0**: scan/apply/no-op thành công, có rejected/needsReview vẫn 0. Exit **2**: usage/config/source/schema/lock/stale/cap/I/O error. Learn không là quality gate mới; gaps/drift giữ exit 1 khi strict có major.

Terminal hiển thị shared/project/effective stats, scope, untracked skipped, proposed/needsReview/rejected/applied/skipped và reason/source. Không gọi proposed là đã học. Apply thiếu review hợp lệ không tự viết entry mẫu.

## 3. Integration matrix

| ID | Expected |
|---|---|
| C01 | Import không chạy; root injection dùng repo tạm; default root không đổi |
| C02 | Hai cú pháp since; unknown/empty/missing value/tổ hợp sai exit 2 |
| C03 | JSON success/error parse được, không ANSI/banner/stack trace |
| C04 | Terminal/JSON apply cùng knowledge bytes/IDs |
| C05 | Preview/dry-run read-only; output tạo artifact pending, không overwrite |
| C06 | Thiếu review/metadata không ghi; approved ghi entry, pending skipped, rejected ghi processed |
| C07 | Replay no-op; stale/cap/lock/I/O exit 2, không partial write |
| C08 | Regression coverage/gaps/drift/summary/fix và flag cũ không đổi |

Dùng spawnSync(process.execPath, argv) với fixture copy CLI/lib/config/catalog hoặc main root injection; không thêm public test-only root flag. Repo Git tạm đặt local identity, không phụ thuộc global. npm test chạy toàn bộ C01–C08 và test cũ.

## 4. Nghiệm thu

Chỉ chạy lệnh learn trên repo thật sau khi đã implement; không báo lệnh chưa có là PASS. README đúng schema Phase 1/2, layout, replay, limits, manual lock recovery và temp cleanup. Không thêm dependency hoặc sửa script test để bỏ failures.
