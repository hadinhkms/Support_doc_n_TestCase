---
name: qa-ui-review
description: >-
  Review frontend UI source and rendered behavior for layout, responsive, mobile,
  accessibility, interaction, and async-state defects. Use for UI/UX code audits
  or visual reviews of an application under test. For requirement-to-test coverage
  and Playwright assertion quality, use qa-logic-gaps instead.
---

# UI/UX Frontend Review

> **Live Source + Built-in Fallback:** Nếu trên máy tồn tại `D:/_QA_Test_Automation/.agents/skills/qa-ui-review/`, ưu tiên đọc `SKILL.md` và `references/ui-review-rubric.md` trực tiếp từ `D:/_QA_Test_Automation/.agents/skills/qa-ui-review/` để lấy bản mới nhất; nếu không có trên máy, sử dụng ngay bản tích hợp sẵn tại thư mục hiện tại.

Review the application UI with evidence proportional to the conclusion. This QA
workspace may contain only tests and Page Objects: identify the actual application
source and running URL before treating test code as frontend implementation.

## Review mode and context budget

Default to **Quick** for ordinary reviews. Use **Full** for an explicit comprehensive
audit, release/sign-off request, or a change whose shared dependencies affect many
pages. State the selected mode and reason; neither mode changes the confirmed-bug gate.

| Mode | Scope and rubric | Output |
| --- | --- | --- |
| Quick | Requested change, relevant callers/styles/primitives, and affected flows; select relevant rubric sections. | Compact scope, new/changed/reopened findings, unresolved IDs, and validation gaps. |
| Full | All requested pages/flows and applicable rubric sections; broader supported browser/viewport/state coverage. | Full scoped scorecard and findings, with explicit unverified conditions. |

### Quick workflow

1. Identify a trustworthy comparison base in the **application source repository**:
   user-specified ref, previous review revision, or PR base. Inspect working-tree and
   untracked changes as well. Do not assume this QA repository's diff is the app diff.
   Without a base, review the requested component/flow as a bounded first review and
   state that limitation; do not silently compare against an arbitrary branch.
2. Identify existing relevant Playwright checks and run the narrow applicable set
   first when the environment is available. Read a compact result summary; inspect
   detailed logs/traces only for failures or uncertainties. Missing runtime access
   remains Not verified. Green checks do not replace review of affected UI behavior.
3. Read changed code and enough dependency context to explain its behavior. Load only
   relevant rubric sections (A layout/content, B mobile/input, C state/interaction,
   D overlays/stability/motion/themes). Do not dump the entire repository, test output,
   DOM, or all screenshots into context. Expand to callers, global CSS, or other sections
   when the evidence requires it; do not impose a file/token cap that hides a defect.
4. Inspect representative changed states and failure evidence. Use region screenshots
   when local detail suffices and whole-page images for layout/overlay context. Avoid
   loading near-identical frames into AI context. Preserve original logs/screenshots
   and required journey milestones/annotated bug evidence; do not disable their capture
   to save context. Passing geometry checks still leave visual judgment and interaction
   gaps to inspect where applicable.
5. Group duplicate symptoms only when they share a demonstrated cause; retain affected
   pages, states, and evidence links. Report concise fixes instead of full rewritten
   components. Keep prior unresolved findings visible by ID; do not repeat their full
   text unless evidence, severity, or status changed.

Expand Quick when a finding implicates shared layout/theme/primitives or critical
flows; explain the expanded scope. Use Full when that impact is broad or cannot be
bounded. Full also uses selective reads and concise evidence, without skipping applicable
checks to save quota. Never claim quota savings as a percentage without measurement.

### Review checkpoints

If an ongoing review needs a saved checkpoint, use the owning project's existing review
location; in this workspace use `_Plan_implement/ui-reviews/<scope>.md`. Do not create
empty baseline files. Record application revision **and dirty-worktree identity**, QA
spec/helper revision, scope/dependencies, environment/build/browser/viewports/data,
commands and evidence paths, finding IDs/status, and unverified conditions. Keep secrets
and raw sensitive payloads out of the checkpoint. A checkpoint is an audit record, not
an approval or test result cache.

Reuse previous analysis only after checking source/dependency and environment changes.
Changes to shared CSS/tokens, primitives, requirements, test helpers, browser/config,
data, or app build invalidate the affected conclusions. Recheck affected findings;
unaffected findings may be referenced as historical evidence, never relabeled as current
Pass without current checks. If identity or dependencies are unknown, widen inspection
and retain Not verified. Checkpoints never replace mandatory reruns or final gates.

## Scope and sources

- Read [AGENTS.md](../../../AGENTS.md) and `.github/copilot-instructions.md` (or fallback to `D:/_QA_Test_Automation/.github/copilot-instructions.md` when invoked from another project) first. They are
  the authority for test authoring, traceability, and confirmed-bug evidence.
- Establish the requested pages/components, available source, running environment,
  supported browsers/devices, design references, and whether changes are requested.
  Continue with available evidence; list missing inputs and the limits they impose.
- Inspect relevant call sites, shared primitives, global CSS, theme/design tokens,
  and framework versions before judging a local class or event handler. Account for
  styles and behavior inherited from component libraries.
- Review web and React Native using platform-appropriate behavior. Do not apply DOM,
  Tailwind, CSS viewport units, or Safari rules directly to native controls.
- Read relevant sections of [the 15-point rubric](references/ui-review-rubric.md) in
  Quick, and all applicable sections in Full. Distinguish checks outside the selected
  review scope from N/A checks and from in-scope checks left Not verified.

## Evidence and classification

Keep **classification**, **severity**, and **confidence** separate:

| Classification | Required basis |
| --- | --- |
| Static risk (`UI-RISK-xx`) | Concrete source path/line and a plausible trigger; rendered impact remains unverified. |
| Confirmed bug (`BUG-xx`) | The reproducibility and dual-proof gate in workspace rule 14 has been satisfied. |
| Design recommendation (`UI-REC-xx`) | Optional improvement, tied to a user goal; not counted as a defect. |
| Open question (`Q-xx`) | Expected behavior or product scope needs confirmation. |

- Missing utility classes alone are not defects. Trace the effective styles,
  constraints, component behavior, and data path. Do not invent file lines or
  runtime measurements; pasted snippets without a path can use labeled snippet lines.
- Static review never establishes visual correctness or production readiness.
  Record unavailable source/runtime explicitly. A source-only issue remains a static
  risk under this workspace's bug gate, even if the code strongly suggests failure.
- Severity follows impact: High for a blocked critical flow or inaccessible primary
  action; Medium for a materially impaired flow with a workaround; Low for a limited
  defect. Explain affected users, trigger, and workaround; confidence is High/Medium/Low.
- An untested category is **Not verified**, not Pass. **Pass** applies only to the
  stated checks and tested conditions; **N/A** requires a scope reason. Use **Risk**
  for unresolved static findings and **Fail** for confirmed defects.

## Runtime verification and QA integration

- When an authorized environment is available, exercise the affected interaction
  with representative and adversarial data: empty/partial/long content, supported
  viewport sizes, keyboard operation, and async failure/retry as relevant.
- Capture actual viewport/browser, state, data, steps, expected behavior and its
  source, and observed behavior. Exclude locator, hydration/timing, fixture/data, and
  environment faults before attributing a failure to the app. Follow rule 14 for
  clean-state reruns and annotated bug evidence.
- Browser emulation does not establish physical iOS keyboard, safe-area, or zoom
  behavior. State whether device evidence is available; retain those gaps explicitly.
- Before editing REQ/TC/spec artifacts, run `npm run qa:impact -- <REQ-id>` for the
  affected requirement and `npm run qa:gaps`, then follow the canonical authoring
  rules. If no REQ exists, do not invent acceptance criteria: record the question
  or create a requirement from an established source using the workspace workflow.
- Map applicable findings to `REQ -> AC -> TC -> script`; use `ui-geometry`, `a11y`,
  `responsive`, `idempotency`, or other existing capabilities where accurate.
- Use a focused axe scan where available plus keyboard/focus assertions for relevant
  accessibility flows. The small interactive-name helper is not a WCAG conformance scan.
- Inspect actual helper exports/signatures before use. Existing helpers in
  `playwright/tests/support/ui-checks.ts` cover horizontal overflow, text overflow,
  occlusion, interactive accessible names, responsive integrity, and broken images.
  They do not alone establish full accessibility, correct contrast, focus behavior,
  mobile keyboard behavior, or motion quality. Add focused assertions where needed.
- Use `deep-guards.ts` for relevant async resilience/idempotency scenarios and
  `captureAnnotatedBugEvidence` from `evidence.ts` for confirmed visual bugs, following
  their actual interfaces. Import test fixtures as required by the workspace.
- When intentionally injecting network faults, acknowledge only the observed injected
  failure through the helper's runtime-trap integration; never leave a broad URL/error
  allowance that could hide a later regression.
- Review-only requests produce findings, not rewrites. When fixes are authorized,
  prefer the smallest compatible patch; preserve component contracts, accessibility,
  localization, and project conventions. Do not add libraries just to satisfy a rubric.
- After spec or helper edits, enforce workspace Rule 15 code-size budgets (`*.spec.ts` $< 640/800$ lines; Page Objects, Fixtures, Support, Data, and `*.setup.ts` $< 200/250$ lines; single line $\le 500$ chars; avg line length $\le 100$ chars; no `*.ai-test.*`/`*.scratch.*`), run `npm run verify` in `playwright/`, relevant runtime tests when available, and `npm run qa:limits -- --strict` + matrix/check commands required by the workspace (or `python D:/_Master_process/master.py audit <repo> --changed-only` in external repos). Split any file breaching the limit before finishing. Report static checks separately from runtime results and any unresolved findings.

## Report

Write in the user's language. Keep these three parts, omitting empty findings rather
than filling a quota:

1. **Scope and scorecard**: Quick/Full and reason, comparison base and current source
   identity, application/source/URL reviewed; source-only or runtime evidence;
   browsers/viewports/states actually checked; a compact category table with
   Pass / Risk / Fail / Not verified / N/A and evidence or exclusion reason. Do not
   assign an overall numerical score without a defined scoring method.
2. **Findings**: confirmed defects and static risks sorted by severity, then optional
   recommendations/questions separately. Each finding includes ID, classification,
   severity, confidence, source `file:line` or exact inspected location, trigger,
   expected behavior and its basis, impact, evidence, and smallest proposed fix.
   For confirmed bugs include reproduction evidence and the required **Bối cảnh
   nghiệp vụ**. Include REQ/AC/TC links when they exist. Untested fixes are proposals.
3. **Validation and next checks**: commands run and results, runtime evidence,
   unverified conditions, and targeted follow-up scenarios. Include changed files
   only when edits were requested; full rewritten code only when useful and requested.

Example invocations:

- `$qa-ui-review Quick: review the checkout UI changes at <source path / URL>
  against <base ref>; focus on mobile layout and keyboard; report without edits.`
- `$qa-ui-review Full: review the checkout flow at <source path / URL> across
  supported viewports and states; report evidence and remaining verification gaps.`
