# Phase 2 — Expand Login Risk Coverage

> **Status:** PARTIAL — TC-014 automated; TC-009, TC-010, TC-012, TC-020 blocked (see below)
> **Depends on:** Phases 0 and 1
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Automate confirmed high-risk login cases without shared-account lockouts, hidden state,
or timing-dependent expectations.

## Candidate coverage

- Lockout attempt boundary and unlock/reset behavior (current TC-009).
- Confirmed email/password length and required-field boundaries (TC-012, TC-014, TC-020; TC-015 retired in Phase 1).
- Session expiry only if the product rule and a deterministic test seam are available.
- Rejected submissions do not establish a session or mutate unrelated account state.

## Tasks

1. Use a dedicated lockout identity or isolated fixture, not the shared setup account.
2. Define an approved reset/seed path and deterministic time control or API seam.
3. Separate specs by validation/security concern when needed; obey the workspace file budget.
4. Make each test independent, rerunnable, safe under parallel workers, and traceable.
5. Run the focused spec in a clean state with `--repeat-each=3`; investigate any
   inconsistent outcome as possible test/environment noise before classifying it.

## Open prerequisites

- Owner-confirmed lockout/reset/expiry semantics from Phase 0.
- Test environment that can safely reset the dedicated account.
- A deterministic mechanism for time-dependent behavior; do not wait 15 minutes in CI.

## Exit gate

- Confirmed cases pass three clean repetitions with identical outcomes.
- No shared account or residual lockout state affects other tests.
- Error and side-effect assertions match the approved requirement.
- Traceability, Playwright verification, strict limits, and root QA checks pass.
- If a prerequisite is unavailable, document the uncovered risk and keep the case manual;
  do not weaken the expected result to force automation.

## Implementation (2026-11-04)

| Case | Outcome | Why |
|---|---|---|
| TC-014 email 254/255 | **Automated** in `playwright/tests/auth/login.validation.spec.ts` | Expected result is in REQ-001 `Rules and validation`. 254 must pass validation, send the POST and get the AC-002 generic error; 255 must show the field error and send nothing. Data from `emailOfLength()` (`tests/data/users.ts`): both lengths are HTML-valid, so only the length rule rejects 255. |
| TC-012 / TC-020 password | Candidate (unchanged) | Automation plan waits for a Password error test id; no locator is guessed. Whitespace-only stays open (Q-008). |
| TC-009 lockout | Manual (unchanged) | Q-003 open; no dedicated lockout account or reset seam. |
| TC-010 session expiry | Manual (unchanged) | Q-005 open; no time control or TTL seam in the test environment. |

### Shared-account risk found and reduced

TC-002 sent a wrong password for `TEST_USER_EMAIL`, the account `auth.setup.ts` signs in with.
Nightly runs TC-002 in 3 projects (chromium, firefox, webkit) with `retries: 2`, so one run
produces 3–9 failed attempts; a push to main adds 1–3 (chromium) and a full local run adds 4
(all 4 projects, no retries). Within one 15-minute window these add up past 5. AC-007 locks an
email on its 6th failure within 15 minutes, so that would lock the setup account and fail every
test. TC-002 now uses `TEST_VIEWER_EMAIL` (already a CI secret and unused by other tests).

**Viewer lockout was deterministic, not residual (corrected after review, 2026-11-04).** TC-021
(Phase 3) also sends one wrong password for the viewer in every project. A clean nightly therefore
made 3 (TC-002) + 3 (TC-021) = 6 failed viewer attempts, enough to lock it per AC-007 and fail a
test while the app is correct; a full local run made 4 + 4 = 8. TC-021 now runs only in the
`chromium` project, giving nightly 3 + 1 = 4, local 4 + 1 = 5, PR/push 1 + 1 = 2. Still open:
retries, or back-to-back runs within 15 minutes, can push the viewer past 5. TC-003, TC-014 and
TC-021's unknown-email requests could trip a per-IP lockout (Q-003). Closing this needs a dedicated
negative-test account with a reset path (tasks 1–2).

### First-run triage note

If TC-014 fails on 255 with "Expected 0 mutation requests", check for `maxlength="254"` on the
Email input first: `fill()` would truncate to a valid 254-char email. That is a spec/implementation
mismatch (REQ-001 expects a field error), not a confirmed bug; raise it as a question per rule 14.

### Uncovered risk (kept manual, not weakened)

- Lockout boundary, unlock time and counter reset (AC-007) — manual each release per TC file.
- Session idle expiry (24h rule) — manual; no AC yet (Q-005).
- Password length/required boundaries — blocked on locator only; expectations are confirmed.

### Verification

| Check | Result |
|---|---|
| `playwright: npm run verify` | Exit 0 — typecheck, lint, limits; TC-014 listed in all 4 projects |
| `npm run qa:matrix` | TC-014 → `login.validation.spec.ts:13` (Automated) |
| `npm run qa:check` | Exit 0 — no findings |
| `--repeat-each=3` on target | **Not run** — no target environment (`playwright/.env` absent, D-05) |

_Review 2026-11-04:_ attempt counts corrected against `.github/workflows/playwright.yml`
(nightly is 3 projects, not 4; `mobile-chrome` runs only locally).

### Exit gate

- [ ] Confirmed cases pass three clean repetitions — not run; needs the target app.
- [ ] No shared account or residual lockout state affects other tests — the setup account no
  longer receives failed attempts, but TC-002 and TC-021 still share the viewer account. Mitigated
  (TC-021 on chromium only); closing it needs a dedicated negative-test account with a reset path.
- [x] Error and side-effect assertions match the approved requirement.
- [x] Traceability, Playwright verification, strict limits, and root QA checks pass.
- [x] Unavailable prerequisites are documented and those cases stay manual/candidate.
