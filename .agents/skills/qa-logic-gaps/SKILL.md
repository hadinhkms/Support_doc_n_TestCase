---
name: qa-logic-gaps
description: >-
  Use this skill when the user asks to check, audit, or find "Logic Gaps", test coverage
  gaps, missing edge cases, weak assertions, or business logic holes across requirements,
  test cases, and Playwright automation specs.
---

# QA Logic Gaps Analysis Skill

This skill provides a systematic two-layer methodology (**Automated Static Analysis** + **Deep Semantic Business Logic Audit**) augmented by a **Selective Learning Knowledge Base** to uncover **Logic Gaps** across `requirements/`, `test-cases/`, and `playwright/tests/`.

For frontend source or rendered UI/UX review, use the sibling
[qa-ui-review skill](../qa-ui-review/SKILL.md). This skill owns coverage and assertion
quality; the sibling owns application UI findings. For mixed requests, connect findings
through REQ/AC/TC, avoid duplicates, and preserve workspace rule 14 for confirmed bugs.

---

## Workflow

### Step 1: Run Automated Static Baseline & Load Effective Knowledge
1. **Run the workspace static & traceability analyzers** before manual reading:
   ```bash
   npm run qa:gaps
   npm run qa:drift
   ```
   *(Optional: filter by requirement or domain using `node tools/qa gaps --req=REQ-001` or `--domain=auth`)*

   Review findings automatically caught by `tools/qa`:
   - **Coverage holes**: `ac-khong-co-test-case`, `ac-chua-co-script`, `ac-chi-co-script-wip`
   - **BVA/EP mapping holes**: `rule-chua-map-toi-test-case`, `rule-thieu-boundary-test`
   - **Script quality holes**: `spec-thieu-assertion` (0 `expect` calls), `assertion-thieu-await` (false-positive async matcher), `test-bi-skip-am-tham`, `spec-chi-assert-url` (navigation-only assertion heuristic)

2. **Read Workspace Rules Before Any Edits**:
   - Always read [.github/copilot-instructions.md](../../../.github/copilot-instructions.md) (referenced by [AGENTS.md](../../../AGENTS.md)) before modifying anything in `requirements/`, `test-cases/`, or `playwright/tests/`.

3. **Load Effective Knowledge Base (Shared `ship` + Project `own` Overlay)**:
   - Read the Selective Learning policy and shared catalogs (relative to this skill directory):
     - [references/SELECTIVE-LEARNING-POLICY.md](references/SELECTIVE-LEARNING-POLICY.md)
     - [references/defect-heuristics-catalog.md](references/defect-heuristics-catalog.md) & [references/bug-hunting-heuristics.md](references/bug-hunting-heuristics.md) (`DH-01`..`DH-06`)
     - [references/playwright-antipatterns-catalog.md](references/playwright-antipatterns-catalog.md) & [references/anti-pattern-catalog.md](references/anti-pattern-catalog.md) (`PA-01`..`PA-04`)
   - Resolve and inspect the project-local overlay from the **repository root** and `qa.config.json` (`<testCasesDir>/_learning/knowledge.json`, defaulting to `test-cases/_learning/knowledge.json` — never resolve `<testCasesDir>` relative to the skill folder), or run `node tools/qa learn --json` to inspect `catalogStats` (`shared`, `project`, `effective`).
   - **Handling Overlay State**:
     - If `<testCasesDir>/_learning/knowledge.json` does not exist yet, treat the project overlay as empty (valid state) and audit using the shared catalogs.
     - If `<testCasesDir>/_learning/knowledge.json` or shared catalogs have corrupted JSON, unsupported `schemaVersion`, or malformed entries, **surface the error immediately** — never silently ignore or overwrite a corrupted knowledge file.
   - **Selective Context Loading & Scope Rules**:
     - Filter and apply entries matching the target domain and `Category` (`State & Concurrency`, `Data & BVA`, `Security & Access`, `Resilience & Recovery` for `DH`; `Superficial Assertion`, `Async & Timing`, `Parallel Isolation`, `Selector Fragility`, `Negative Side Effects` for `PA`).
     - Knowledge entries **augment** the audit as heuristics; they **never override** confirmed project requirements.
     - A new session only loads this knowledge when this skill is invoked. If delegating research/audit tasks to a subagent (only when subagent invocation is appropriate), explicitly instruct the subagent which catalog files and overlay paths to read.

---

### Step 2: Deep Business & Requirement Logic Audit (`requirements/` $\leftrightarrow$ `test-cases/`)
Read the target `requirements/REQ-xxx-*.md` and `test-cases/REQ-xxx-*.md` files, cross-referencing active `DH-xx` / `PDH-xxx` heuristics across the **7 Logic Dimensions**:

1. **Decision Table & Branch Completeness**
   - Are all combinations of business conditions (`if/else`, multi-condition rules) represented in Acceptance Criteria (`AC-xxx`)?
   - Does every positive flow have corresponding negative and alternative flows?

2. **State Transition & Lifecycle Integrity (`State & Concurrency`)**
   - Are invalid state transitions tested? (e.g., submitting an already-submitted form, acting on a locked/deleted/expired entity, using browser Back/Forward after state change or logout, session expiration mid-flow — see `DH-01`, `DH-05`).
   - Are idempotency and concurrency edge cases considered (e.g., double-clicking Submit / `Double-submit protection`, parallel requests at rate-limit/lockout boundaries — see `DH-02`)?

3. **Field Validation — Equivalence Partitioning (EP) & Boundary Value Analysis (BVA) (`Data & BVA`)**
   - **Text Inputs**: Empty string, whitespace-only (`"   "`), leading/trailing whitespace normalization (`DH-03`), `minlength - 1`, `minlength`, `maxlength`, `maxlength + 1` (verify truncation or validation error).
   - **Numeric Inputs**: Alphabetic (`abc`), special chars (`!@#`), mixed paste (`12abc34`), negative numbers, decimals (when integer-only), and boundaries (`min - 1`, `min`, `max`, `max + 1`).

4. **Security, Role & Page Exposure Matrix (`Security & Access`)**
   - **Page Exposure**: If `Page exposure` is `public` or `customer` and user input / query params are rendered back to the UI, verify XSS test coverage (`Type: Security`, tag `@security`). If `admin/internal`, verify the exemption reason is documented in `Coverage notes`.
   - **Access Control & Enumeration**: Unauthenticated access to protected routes, horizontal/vertical privilege escalation, and consistent generic error responses across authentication failure modes to prevent account enumeration (`DH-04`).

5. **Error Handling, Resilience & Recovery (`Resilience & Recovery`)**
   - How does the system behave when the backend returns `4xx` / `5xx`, network times out, or user retries after a failed submission? Is non-sensitive user input preserved on validation error while sensitive fields (passwords/OTP) are cleared (`DH-06`)?

6. **UI/UX Geometry, Responsive & Interactive Accessibility (`ui-geometry`, `a11y`, `responsive`)**
   - Verify Canonical Metadata (`- **Page exposure**: ...`, `- **UI coverage**: ...`, `- **XSS applicability**: ...`), `## Coverage notes`, and `- **Capabilities**: ...` on every Test Case.
   - Horizontal overflow (`expectNoHorizontalScroll`), text truncation (`expectNoTextOverflow`), hit-target occlusion (`expectNotOccluded`), interactive accessible names (`expectInteractiveA11y`), and multi-viewport integrity (`expectResponsiveIntegrity`).

7. **Ambiguities & Contradictions**
   - Identify any contradiction between `Acceptance criteria`, `Rules and validation`, and `Test cases`.
   - **Rule**: Never invent expected business behavior when the requirement is silent. Flag it as an Open Question (`Q-xxx`) or a Decision (`decisions.json`).

---

### Step 3: Semantic Playwright Spec Audit (`test-cases/` $\leftrightarrow$ `playwright/tests/`)
Inspect the corresponding `.spec.ts` files and Page Objects (`playwright/tests/pages/`), cross-referencing active `PA-xx` / `PPA-xxx` antipatterns across the **5 Deep Audit Dimensions** (`persistence`, `boundary`, `idempotency`, `ui-geometry/a11y/responsive`, `xss`):

1. **Weak or Superficial Assertions (`Superficial Assertion` — `PA-01`, `PA-04`)**
   - Flag tests that only assert `toHaveURL(...)` / `toHaveTitle(...)` (`PA-01`) or existence-only matchers (`toBeVisible`, `toBeAttached`, `toBeDefined`, `toBeTruthy`, `not.toBeNull`, `toHaveCount` — `weak-existence-assertion` / `PA-04`) without proving business data or calling verified helpers.

2. **Step & Expectation Mismatch / Missing Negative Side-Effect Checks (`Negative Side Effects` — `PA-04`)**
   - In negative/error or double-submit test cases, verify the spec asserts both the error message **and** the absence of unintended mutations (`expectBoundaryRejected`, `expectIdempotentSubmit`).

3. **Isolation, Async Timing & Selector Resilience (`Async & Timing`, `Parallel Isolation`, `Selector Fragility` — `PA-02`, `PA-03`)**
   - Check for shared mutable test accounts/data across parallel workers (`fullyParallel` — `PA-03`) and ensure every `expect(...)` and verified async helper has `await` (`PA-02`).

#### 3.4. Symptom-to-Helper Mapping (`ui-checks.ts` & `deep-guards.ts`)
| Triệu chứng lỗi (Bug Symptom) | Capability Tag | Helper bắt buộc (`playwright/tests/support/`) |
|---|---|---|
| Tràn khung ngang trên Desktop/Mobile | `ui-geometry` | `expectNoHorizontalScroll(page)` (`ui-checks.ts`) |
| Cắt cụt chữ (`scrollWidth > clientWidth`) không có `title` | `ui-geometry` | `expectNoTextOverflow(rootLocator)` (`ui-checks.ts`) |
| Nút bấm bị sticky header/toast/modal đè tâm điểm | `ui-geometry` | `expectNotOccluded(targetLocator)` (`ui-checks.ts`) |
| Nút/input/link thiếu tên tiếp cận (`accessibleName`) | `a11y` | `expectInteractiveA11y(rootLocator)` (`ui-checks.ts`) |
| Vỡ layout khi đổi qua Desktop / Tablet / Mobile | `responsive` | `expectResponsiveIntegrity(page, { requiredLocators, optionalLocators })` (`ui-checks.ts`) |
| Double-click gửi 2+ request `POST`/`PUT`/`PATCH`/`DELETE` | `idempotency` | `expectIdempotentSubmit(page, submitLocator, urlPattern)` (`deep-guards.ts`) |
| Payload `<script>` / `onerror` thực thi hoặc lọt vào DOM sink | `xss` | `expectSafeXssRender(page, inputAction, { sinkLocator })` (`deep-guards.ts`) |
| Optimistic UI mất dữ liệu sau khi `page.reload()` | `persistence` | `expectStatePersistence(page, assertFn)` (`deep-guards.ts`) |
| Giá trị biên / rỗng / quá dài vẫn bắn request thành công | `boundary` | `expectBoundaryRejected(page, trigger, errorLocator, options)` (`deep-guards.ts`) |

---

### Step 4: Output Structured Logic Gaps Report
Present the findings clearly grouped by severity. Whenever a gap corresponds to a catalog entry, **cite the Knowledge ID (`DH-xx`, `PA-xx`, `PDH-xxx`, `PPA-xxx`) alongside concrete `REQ/AC/TC` or `spec:line` evidence**:

```markdown
## Báo Cáo Rà Soát Logic Gaps — <REQ-xxx / Scope>

### 1. Tóm tắt (Executive Summary)
- **Static / Traceability Findings (`qa:gaps` & `qa:drift`)**: <số lượng>
- **Effective Knowledge Applied**: <Shared DH/PA + Project PDH/PPA>
- **Semantic & Business Logic Gaps**: <Blocker / Major / Minor>

### 2. Chi tiết các Logic Gaps phát hiện

| Mã | Mức độ | Phân loại / Knowledge ID | Bằng chứng (File:Line / REQ/AC/TC) | Mô tả lỗ hổng Logic | Đề xuất khắc phục |
|---|---|---|---|---|---|
| LG-01 | 🔴 BLOCKER | Superficial Assertion (`PA-01`) | `playwright/tests/...:42` (`TC-001` / `AC-001`) | ... | ... |
| LG-02 | 🟡 MAJOR | State & Concurrency (`DH-02` / `PDH-001`) | `requirements/REQ-...:18` (`AC-002`) | ... | ... |
| LG-03 | ⚪ MINOR | UI Edge Case / Doc Ambiguity | `test-cases/REQ-...:55` (`TC-008`) | ... | ... |

### 3. Open Questions / Quyết định cần PO/Owner xác nhận
- `Q-xxx`: <Câu hỏi nghiệp vụ chưa rõ trong Requirement, không tự suy diễn>
```

---

### Step 5: Remediation & Gate Verification (When Asked to Fix)
If the user asks to fix the discovered Logic Gaps:
1. Update `requirements/REQ-xxx-*.md` (add missing ACs, rules, or `Open questions`).
2. Update `test-cases/REQ-xxx-*.md` (add missing `TC-xxx` rows and update the `Traceability` table).
3. Implement or strengthen Playwright tests in `playwright/tests/` (ensure `@REQ-xxx` on `test.describe`, title `TC-xxx - AC-yyy <description>`, and priority tag `@p0`..`@p3`).
4. Validate strictly before finishing:
   - Run `npm run verify` inside `playwright/`
   - Run `npm run qa:matrix` at repository root
   - Run `npm run qa:check` at repository root (must pass with 0 `blocker`/`major` findings)
   - Run `npm test` at repository root

---

### Step 6: Selective Learning After Verification (Học Chọn Lọc Sau Verify)
After verifying bug fixes, strengthening weak assertions, or confirming technical decisions, run the selective learning workflow to evolve project knowledge without polluting the catalog with noise:

1. **Scan Signals & Inspect Scope (Preview Read-Only)**:
   - Run `npm run qa:learn` (or `node tools/qa learn --json`) to scan the working tree and `decisions.json`.
   - If learning from changes that were **already committed**, explicitly pass `--since=<ref>` (e.g., `node tools/qa learn --since=HEAD~1 --json`). Do **not** assume default `qa:learn` scans past commits when the working tree is clean.

2. **Evaluate Candidates Against the 4 Gates**:
   - Inspect `proposed`, `needsReview`, and `rejected` items, checking the old/new diff or confirmed decision (`status === "confirmed"` with valid `answer.optionId`) against `Generality`, `Novelty`, `Impact`, and `Distillability`.
   - For lessons discovered during direct verification (`direct-verify`), attach concrete file/test-run evidence and `sourceHash` in the review artifact — the engine does not automatically read chat transcripts, Jira, or Slack.

3. **Distill Actionable Knowledge (No Hallucinated Expectations)**:
   - Refine `title` ($\le 120$ chars), `category`, `trigger`, `failureMode`, and `actionableCheck` ($\le 500$ chars each), ensuring all PII/secrets/tokens are redacted.
   - **Strict Rule**: Never invent expected business behavior when the requirement is silent. If evidence is incomplete, keep `review.status = "pending"` and raise a specific Open Question (`Q-xxx`) to the user.

4. **Export Review Artifact & Record Review Decisions**:
   - Export the pending review artifact explicitly under `<testCasesDir>/_learning/`:
     ```bash
     node tools/qa learn --since=HEAD~1 --output=test-cases/_learning/review.json
     ```
   - Present the candidate details, scope, and source provenance clearly.
   - Populate `review.status` (`"approved"` or `"rejected"`), `review.by`, `review.at`, and `review.rationale` for reviewed candidates.
   - **Authorization & Apply Discipline**: Only run `--apply` within the scope authorized by the user. If the user has already authorized updating learned knowledge in the current session, proceed without redundantly asking again for each sub-step; if not yet authorized, prepare the review artifact and present it for decision. Never apply candidates whose `review.status` is still `"pending"`.

5. **Dry-Run Preview, Atomic Apply & Staleness Handling**:
   - Optionally run `--dry-run` first:
     ```bash
     node tools/qa learn --apply --review=test-cases/_learning/review.json --dry-run --json
     ```
   - Apply approved lessons to `<testCasesDir>/_learning/knowledge.json`:
     ```bash
     node tools/qa learn --apply --review=test-cases/_learning/review.json
     ```
   - If `--apply` fails with `STALE_SNAPSHOT_HASH` or `STALE_SOURCE_HASH`, re-run the scan and review the updated diff/catalog — **never** manually edit hashes in `review.json` to bypass staleness protection.

6. **Respect Provenance, Deduplication & Ceiling Cap**:
   - Rejecting noise is normal and does **not** require modifying shared catalogs.
   - Each layer is capped at **25 active entries per type (`DH` / `PA`)**. When the cap is reached, never silently delete or merge existing entries to bypass the limit; any retirement or graduation must follow the explicit governance below.

---

## Hub/Project Ownership & Static Guardrail Graduation

1. **Ownership Boundary (`ship` vs `own`)**:
   - `.agents/skills/qa-logic-gaps/references/*` belongs to `ship` (Hub-owned, read-only for `learn`).
   - `<testCasesDir>/_learning/knowledge.json` belongs to `own` (project-specific overlay). `node tools/qa learn --apply` writes exclusively to this project overlay.
   - Promoting a project lesson (`PDH-xxx` / `PPA-xxx`) to the shared Hub catalog requires anonymizing project-specific details and reviewing at the Hub repository — never auto-push or send cross-repo messages. Updating shared catalogs from Hub preserves the project overlay and never reuses retired project IDs.

2. **Static Guardrail Graduation (`STATIC_RULE_MAPPING`)**:
   - When an antipattern or heuristic can be enforced deterministically by `tools/qa`, graduate it into a static rule and record `entryId -> findingKind + coverage` (`full` or `partial`).
   - **Semantic Remainder Rule (`PA-01` $\leftrightarrow$ `spec-chi-assert-url`)**:
     - `spec-chi-assert-url` (`minor`) only detects the syntactic surface where a test has `toHaveURL`/`toHaveTitle` and no other `expect(...)`.
     - `PA-01` carries `coverage: partial` because: (a) a navigation-focused TC may legitimately only assert URL, and (b) adding a trivial `expect(locator).toBeVisible()` silences the static rule without proving business data correctness.
     - Therefore, **never retire `PA-01`** merely because the static rule exists.
   - Retiring or merging any project entry (`status: "retired"`) requires explicit review and a tombstone record in `graduations[]` (`entryId`, `retiredAt`, `retiredBy`, `reason`, `replacement`).
