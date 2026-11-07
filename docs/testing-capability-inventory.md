# Testing Capability Inventory — Baseline Plan 16

> **Trạng thái:** BASELINE LOCKED · **Ngày:** 2026-11-02  
> **Baseline SHA:** `5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02` · **Phạm vi:** Phase 0 (Task T0.1 & AC-16-P0-1)  
> **Nguyên tắc:** Chỉ ghi `Existing` khi có code + test kiểm chứng thực tế tại `file:line@revision`. Không kế thừa nhãn PASS cũ.

---

## 1. Đối Chiếu Di Sản: Plan 13, 14, 15

| Kế hoạch | Năng lực trọng tâm | Hiện trạng thực tế tại baseline `5f3124e` | Bằng chứng kiểm chứng |
|---|---|---|---|
| **Plan 13** | Selective Learning & Tri thức lỗi | `Existing` — CLI `qa:learn`, parser overlay `test-cases/_learning/knowledge.json` | `tools/qa/lib/learner.js:1` · 41/41 unit tests pass |
| **Plan 14** | Deep Test Engine & UI Guards | `Existing` — Bộ 5 guards UI, persistence, runtime trap tự động | `playwright/tests/support/ui-checks.ts:1` · 8 HM probes pass |
| **Plan 15** | Deep Automation Synergy | `Existing` — Đồng bộ `Page exposure`, `checkDeepCoverage`, API guards | `tools/qa/lib/sources.js:1`, `api-guards.ts:1` · Gate `qa:check` exit 0 |

---

## 2. Ma Trận Kiểm Kê Toàn Bộ Năng Lực (Capability Matrix)

| ID | Nhóm Năng Lực | Trạng Thái | Điểm Neo Code (`file:line@5f3124e`) | Phạm Vi Ranh Giới | Ghi Chú Đánh Giá |
|---|---|---|---|---|---|
| **CAP-01** | Traceability & Drift | `Existing` | `tools/qa/lib/commands.js:45` | `ship` (Hub) | Phát hiện gap REQ $\to$ AC $\to$ TC $\to$ Spec |
| **CAP-02** | UI Geometry & Overflow | `Existing` | `playwright/tests/support/ui-checks.ts:25` | `seed` / `support` | Bắt lỗi tràn ngang, vỡ chữ, occluded, responsive |
| **CAP-03** | State Persistence & Idempotency | `Existing` | `playwright/tests/support/deep-guards.ts:18` | `seed` / `support` | Bắt mất form sau reload, duplicate submit |
| **CAP-04** | Resilience & Fault Recovery | `Existing` | `playwright/tests/support/resilience-guards.ts:22` | `seed` / `support` | Bắt treo nút khi mạng lỗi 5xx/disconnect |
| **CAP-05** | API Guards & Security | `Existing` | `playwright/tests/support/api-guards.ts:15` | `seed` / `support` | BOLA/IDOR, Mass Assignment, JSON Schema cơ bản |
| **CAP-06** | Runtime Trap & Redaction | `Existing` | `playwright/tests/fixtures/runtime-trap.ts:1` | `seed` / `fixtures` | Bắt rò rỉ console/pageerror, che giấu Bearer/Cookie |
| **CAP-07** | Journey & Bug Annotation | `Existing` | `playwright/tests/support/evidence.ts:62` | `seed` / `support` | Milestone capture và khoanh khung đỏ vị trí lỗi |
| **CAP-08** | Automated Accessibility | `Existing` | `playwright/tests/a11y/login.a11y.spec.ts:1` | `own` / `tests` | Quét Axe-core DOM và bàn phím Tab/Enter |
| **CAP-09** | Mutation & Controlled Probes | `Existing` | `playwright/deep-engine-tests/hm-contracts.spec.ts:1` | `seed` / harness | 8 mutant probes tự kiểm chứng độ nhạy guards |
| **CAP-10** | Visual Regression Testing | `Proposed` | *Chưa triển khai mã nguồn* (Phase 3) | `seed` / `support` | Cần baseline governance cho `toHaveScreenshot()` |
| **CAP-11** | Performance & Workload | `Proposed` | *Chưa triển khai mã nguồn* (Phase 4) | `own` / `tools` | Cần spike k6 adapter và chốt SLO với SRE |
| **CAP-12** | Consumer-Driven Contract | `Partial` | `playwright/tests/support/api-guards.ts:40` | `seed` / `support` | Đã có schema validator; chưa có CDC broker/Pact |
| **CAP-13** | Evidence Manifest & Receipt | `Partial` | `playwright/tests/support/evidence.ts:91` | `seed` / `support` | Đã có ảnh/log; chưa có manifest schema 5 chiều |
| **CAP-14** | Independent Bug Reproduce | `Partial` | `.github/copilot-instructions.md:29` (Rule 14) | `ship` (Policy) | Quy tắc 3 bước đã định nghĩa; chưa có runner recipe |

---

## 3. Ranh Giới Hub vs Project (Boundary Governance)

1. **Vùng Hub (`ship`)**:
   - `docs/testing-capability-inventory.md` và `docs/adr/`: Chuẩn quy định chung cho mọi dự án vệ tinh.
   - `tools/qa`, `tools/boundary`: Động cơ kiểm tra zero-dependency.
2. **Vùng Dự Án (`seed` / `own`)**:
   - `playwright/tests/support/`: Dự án kế thừa bản khởi tạo (`seed`), được phép mở rộng helper riêng.
   - `playwright/tests/{pages, data, auth, a11y}`: Nghiệp vụ riêng của từng sản phẩm (`own`), Hub không ghi đè.
3. **Quy tắc không phình mã (Rule 15)**:
   - File module hạ tầng trong `playwright/tests/support` giữ trần $\le 250$ dòng, vùng vàng $\ge 200$ dòng.
   - Khi Plan 16 bổ sung `evidence-contract` hoặc adapter mới, bắt buộc tách file độc lập dưới 200 dòng (vùng vàng role `module`).

