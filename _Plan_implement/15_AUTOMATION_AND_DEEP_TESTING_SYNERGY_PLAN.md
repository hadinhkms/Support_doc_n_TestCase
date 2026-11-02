# Plan 15 (v1.0): Automation Script & Deep Testing Synergy Enhancement

> **Cấp độ:** L3 · **Trạng thái:** DONE · **Ngày cập nhật:** 2026-10-31
> **Tài liệu Phase chi tiết:**
> - [Phase 1: Metadata & Parser Sync](plan-15-deep-automation-synergy/PHASE_1_METADATA_AND_PARSER_SYNC.md)
> - [Phase 2: Capability ↔ Guard Verification Engine](plan-15-deep-automation-synergy/PHASE_2_CAPABILITY_GUARD_VERIFICATION.md)
> - [Phase 3: CLI Deep Coverage Flags & Config Gate](plan-15-deep-automation-synergy/PHASE_3_CLI_DEEP_COVERAGE_AND_CONFIG_GATE.md)
> - [Phase 4: API Deep Guards Infrastructure (`api-guards.ts`)](plan-15-deep-automation-synergy/PHASE_4_API_DEEP_GUARDS_INFRASTRUCTURE.md)
> - [Phase 5: Unit Tests, Code Limits & Full Gate Verification](plan-15-deep-automation-synergy/PHASE_5_UNIT_TESTS_AND_FULL_GATE_VERIFICATION.md)

---

## A. Đặc Tả Nghiệp Vụ (Business Specification)

### A1. Mục tiêu & Bài toán (Goal & Problem Statement)
- **REQ-15-00**: Khép kín 5 khoảng trống giữa quy chuẩn kiểm thử chuyên sâu ([`.github/copilot-instructions.md`](../.github/copilot-instructions.md), [`qa-api-testing`](../.agents/skills/qa-api-testing/SKILL.md)) và bộ công cụ kiểm chứng tự động ([`tools/qa`](../tools/qa/index.js)).
- Giải quyết triệt để 5 lỗ hổng:
  1. **Lệch chuẩn Metadata Parser:** `loadRequirements` trong `tools/qa/lib/sources.js` chưa nhận diện `Page exposure: Customer | Admin` và `XSS applicability: Exempt`.
  2. **Kiểm chứng Capabilities chưa đầy đủ:** `gaps()` trong `tools/qa/lib/commands.js` mới chỉ kiểm tra `idempotency`, bỏ sót `persistence`, `resilience`, `concurrency`, `boundary`, `ui-geometry`, `a11y`, `responsive`, `xss`, `api-security`, `api-contract`.
  3. **Thiếu cờ CLI & Gate cho Deep Coverage:** Chưa có cờ CLI `--deep-coverage` / `--no-deep-coverage` trong `tools/qa/index.js` và `qa.config.json` chưa bật `checkDeepCoverage: true`.
  4. **Thiếu hạ tầng Guard cho Deep API Testing:** Chưa có `playwright/tests/support/api-guards.ts` để kiểm chứng BOLA/IDOR, Mass Assignment, Schema Contract và API Idempotency.
  5. **Đảm bảo kỷ luật Rule 15 (Code Size Budget < 80% vùng vàng):** Không phình thêm dòng vào `deep-guards.ts` (241/250 dòng), tách module độc lập dưới ngưỡng vàng.

### A2. Phạm vi theo từng Phase (Phase Breakdown)
| Phase | File kế hoạch | Nội dung trọng tâm | File tác động chính |
|---|---|---|---|
| **Phase 1** | [PHASE_1_METADATA_AND_PARSER_SYNC.md](plan-15-deep-automation-synergy/PHASE_1_METADATA_AND_PARSER_SYNC.md) | Đồng bộ parser `Page exposure` (4 mức), `XSS applicability` (`Exempt` / `Not applicable`) và đăng ký import `support/api-guards` | `tools/qa/lib/sources.js` |
| **Phase 2** | [PHASE_2_CAPABILITY_GUARD_VERIFICATION.md](plan-15-deep-automation-synergy/PHASE_2_CAPABILITY_GUARD_VERIFICATION.md) | Khép kín đối chiếu 100% `Capabilities` trong TC với `assertionProfile.matchers` trong Spec và đồng bộ `STATIC_RULE_MAPPING` | `tools/qa/lib/commands.js`, `tools/qa/lib/learner.js` |
| **Phase 3** | [PHASE_3_CLI_DEEP_COVERAGE_AND_CONFIG_GATE.md](plan-15-deep-automation-synergy/PHASE_3_CLI_DEEP_COVERAGE_AND_CONFIG_GATE.md) | Bổ sung cờ `--deep-coverage` / `--no-deep-coverage` vào CLI và kích hoạt `"checkDeepCoverage": true` trong `qa.config.json` | `tools/qa/index.js`, `qa.config.json` |
| **Phase 4** | [PHASE_4_API_DEEP_GUARDS_INFRASTRUCTURE.md](plan-15-deep-automation-synergy/PHASE_4_API_DEEP_GUARDS_INFRASTRUCTURE.md) | Tạo mới `playwright/tests/support/api-guards.ts` (< 160 dòng) nối liền `qa-api-testing` với `tools/qa` | `playwright/tests/support/api-guards.ts` |
| **Phase 5** | [PHASE_5_UNIT_TESTS_AND_FULL_GATE_VERIFICATION.md](plan-15-deep-automation-synergy/PHASE_5_UNIT_TESTS_AND_FULL_GATE_VERIFICATION.md) | Viết unit test bao phủ toàn bộ tính năng mới và chạy Gate nghiệm thu (`npm test`, `npm run verify`, `npm run qa:check`) | `tools/qa/lib/sources.test.js`, `tools/qa/lib/commands.test.js`, `tools/qa/index.test.js` |

---

## B. Tiêu Chí Nghiệm Thu Tổng (Exit Gate)
- [x] Tất cả 5 Phase đạt trạng thái `DONE`.
- [x] `npm test` ở thư mục gốc pass 100%.
- [x] `npm run verify` trong `playwright/` pass 100% (typecheck + lint + limits + `--list`).
- [x] `npm run qa:check` ở thư mục gốc đạt Exit Code `0` với `"checkDeepCoverage": true`.
