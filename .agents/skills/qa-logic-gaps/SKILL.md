---
name: qa-logic-gaps
description: >-
  Use this skill when the user asks to check, audit, or find "Logic Gaps", test coverage
  gaps, missing edge cases, weak assertions, or business logic holes across requirements,
  test cases, and Playwright automation specs.
---

# QA Logic Gaps Analysis Skill

This skill provides a systematic two-layer methodology (Automated Static Analysis + Deep Semantic Business Logic Audit) to uncover **Logic Gaps** across `requirements/`, `test-cases/`, and `playwright/tests/`.

---

## Workflow

### Step 1: Run Automated Static & Traceability Baseline
Before performing manual reading, run the workspace analyzer to capture structural and syntactic gaps:

```bash
npm run qa:gaps
npm run qa:drift
```

*(Optional: filter by requirement or domain using `node tools/qa gaps --req=REQ-001` or `--domain=auth`)*

Review findings automatically caught by `tools/qa`:
- **Coverage holes**: `ac-khong-co-test-case`, `ac-chua-co-script`, `ac-chi-co-script-wip`
- **BVA/EP mapping holes**: `rule-chua-map-toi-test-case`, `rule-thieu-boundary-test`
- **Script quality holes**: `spec-thieu-assertion` (0 `expect` calls), `assertion-thieu-await` (false-positive async matcher), `test-bi-skip-am-tham`

---

### Step 2: Deep Business & Requirement Logic Audit (`requirements/` $\leftrightarrow$ `test-cases/`)
Read the target `requirements/REQ-xxx-*.md` and `test-cases/REQ-xxx-*.md` files and evaluate the following **7 Logic Dimensions**:

1. **Decision Table & Branch Completeness**
   - Are all combinations of business conditions (`if/else`, multi-condition rules) represented in Acceptance Criteria (`AC-xxx`)?
   - Does every positive flow have corresponding negative and alternative flows?

2. **State Transition & Lifecycle Integrity**
   - Are invalid state transitions tested? (e.g., submitting an already-submitted form, acting on a locked/deleted/expired entity, using browser Back/Forward after state change or logout, session expiration mid-flow).
   - Are idempotency and concurrency edge cases considered (e.g., double-clicking Submit / `Double-submit protection`)?

3. **Field Validation — Equivalence Partitioning (EP) & Boundary Value Analysis (BVA)**
   - **Text Inputs**: Empty string, whitespace-only (`"   "`), `minlength - 1`, `minlength`, `maxlength`, `maxlength + 1` (verify truncation or validation error).
   - **Numeric Inputs**: Alphabetic (`abc`), special chars (`!@#`), mixed paste (`12abc34`), negative numbers, decimals (when integer-only), and boundaries (`min - 1`, `min`, `max`, `max + 1`).

4. **Security, Role & Page Exposure Matrix**
   - **Page Exposure**: If `Page exposure` is `public` or `customer` and user input / query params are rendered back to the UI, verify XSS test coverage (`Type: Security`, tag `@security`). If `admin/internal`, verify the exemption reason is documented in `Coverage notes`.
   - **Access Control**: Unauthenticated access to protected routes, horizontal privilege escalation (User A accessing User B's resource), and vertical privilege escalation (standard user accessing Admin URL/API).

5. **Error Handling, Resilience & Recovery**
   - How does the system behave when the backend returns `4xx` / `5xx`, network times out, or user retries after a failed submission? Is user input preserved on validation error instead of being wiped?

6. **UI/UX & Layout Edge Cases**
   - Element overlap when validation error messages appear (`assertNoOverlap`).
   - Horizontal overflow on Desktop and Mobile viewports (`assertNoHorizontalOverflow`).
   - Text/container overflow when rendering `max` boundary strings (`assertNoTextOverflow`).

7. **Ambiguities & Contradictions**
   - Identify any contradiction between `Acceptance criteria`, `Rules and validation`, and `Test cases`.
   - **Rule**: Never invent expected business behavior when the requirement is silent. Flag it as an Open Question (`Q-xxx`) or a Decision (`decisions.json`).

---

### Step 3: Semantic Playwright Spec Audit (`test-cases/` $\leftrightarrow$ `playwright/tests/`)
Inspect the corresponding `.spec.ts` files and Page Objects (`playwright/tests/pages/`) to catch **False Positives** that static tools miss:

1. **Weak or Superficial Assertions**
   - Does the test pass `qa:gaps` because it has `expect(page).toHaveURL(...)`, while failing to assert the **actual business side-effect** (e.g., data saved/rendered accurately, specific error message bound to the specific field, session state cleared)?
   - Are assertions overly broad (e.g., `toBeVisible()` on a generic container instead of verifying exact role/state/message)?

2. **Step & Expectation Mismatch (Semantic Drift)**
   - Compare the steps and `Expected` column in `test-cases/REQ-xxx-*.md` against the actual Playwright actions and assertions. Flag any TC where the spec skips steps or asserts a partial outcome.

3. **Isolation & Determinism (`fullyParallel` Safety)**
   - Check for shared mutable test data between tests, missing cleanup, or tests that rely on execution order.
   - Verify no `waitForTimeout` or fragile layout-coupled CSS selectors are used.

---

### Step 4: Output Structured Logic Gaps Report
Present the findings clearly grouped by severity:

```markdown
## Báo Cáo Rà Soát Logic Gaps — <REQ-xxx / Scope>

### 1. Tóm tắt (Executive Summary)
- **Static / Traceability Findings (`qa:gaps` & `qa:drift`)**: <số lượng>
- **Semantic & Business Logic Gaps**: <Blocker / Major / Minor>

### 2. Chi tiết các Logic Gaps phát hiện

| Mã | Mức độ | Phân loại | Vị trí (File:Line / REQ/AC/TC) | Mô tả lỗ hổng Logic | Đề xuất khắc phục |
|---|---|---|---|---|---|
| LG-01 | 🔴 BLOCKER | False-Positive / Missing Core Flow | `...` | ... | ... |
| LG-02 | 🟡 MAJOR | Missing BVA / Weak Assertion / State Gap | `...` | ... | ... |
| LG-03 | ⚪ MINOR | UI Edge Case / Doc Ambiguity | `...` | ... | ... |

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
