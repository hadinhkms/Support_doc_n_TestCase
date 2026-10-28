# UI review rubric

These are investigation prompts, not automatic failure rules. Judge against product
requirements, supported platforms, effective styles, and runtime evidence. A justified
design choice is not a bug. Use the classification and report rules in the parent skill.

## A. Layout, responsive, and content

1. **Layout and spacing.** Compare with established tokens and component conventions.
   Investigate fixed widths and arbitrary values when they cause a constraint mismatch;
   neither a non-4/8px value nor a hardcoded color alone proves a defect. Include narrow
   layouts (320 CSS px when relevant), wrapping, and browser zoom/reflow.
2. **Horizontal overflow.** Trace viewport units, margins, grid tracks, flex minimum
   sizes, tables, and intentional scroll regions. Check actual document overflow and
   access to content. `100vw`, a non-wrapping row, or a fixed width can be intentional.
3. **Long and partial data.** Exercise long names, URLs, localized prices, large counts,
   Unicode, missing optional fields, and translated labels. Check effective min sizes
   and wrapping/truncation policies. Do not require `min-w-0` everywhere or truncate
   essential information; verify that full content remains accessible when needed.

## B. Mobile and input ergonomics

4. **iOS input zoom.** Inspect effective mobile font size on editable controls; small
   text (commonly below 16 CSS px) is an investigation trigger for Safari focus zoom.
   Confirm on the supported device/browser before declaring the rendered failure.
   Do not suppress user zoom as a fix or assign High severity solely by font size.
5. **Keyboard and form inputs.** Check meaningful labels, suitable type/inputMode and
   autocomplete for the field's semantics, preservation of leading zeroes, and submit
   behavior. Test virtual keyboard exposure, scrolling, fixed CTAs, and focus visibility.
   An attribute is required only when its omission causes the identified problem.
6. **Touch targets.** Measure effective hit areas and separation, including expanded
   targets. WCAG 2.2 AA SC 2.5.8 specifies 24x24 CSS px or its permitted exceptions;
   44x44 is the SC 2.5.5 AAA target and a useful ergonomics goal. Apply product/platform
   requirements explicitly; do not label every sub-44px target an AA violation.
7. **Safe areas.** For edge-to-edge layouts, inspect viewport configuration, inset
   handling at the relevant edges, orientation, and insets already applied by a parent
   or native shell. A missing local `env()`/utility does not prove obscured content.
8. **Viewport height.** Evaluate address-bar changes, scroll containment, and keyboard
   behavior. Choose `svh`, `dvh`, existing fallbacks, or content sizing by the needed
   behavior; do not replace all `100vh` with `100dvh`. Dynamic viewport units can resize
   as browser chrome changes and do not alone solve virtual-keyboard occlusion.

## C. States, interaction, and async behavior

9. **Data states.** Evaluate applicable loading, empty, error, partial, success, and
   overflow states at the owning component/page boundary. Check usable recovery and
   preserved input. Skeletons, retries, and empty-state CTAs depend on context; do not
   require retry for a permanent permission error or skeletons for every request.
10. **Interaction and accessibility.** Check semantics, accessible names, labels,
    keyboard activation/order, visible and unobscured focus, error associations, and
    live announcements when appropriate. Check hover/touch, disabled, and pending
    behavior without requiring a particular ring, opacity, or scale effect. Test zoom,
    translated content, and RTL if supported. Shared primitives may supply these states.
11. **Async integrity.** Trace rapid clicks, Enter submits, retries, out-of-order
    responses, stale updates, and unmount/cancellation where relevant. Disabled state
    and a spinner are not proof of idempotency: inspect the guard and server contract
    when available. Assess validation timing by field semantics and user experience,
    rather than banning validation while typing.

## D. Overlays, stability, motion, and themes

12. **Overlay behavior.** Distinguish modal dialogs, non-modal popovers, menus, and
    drawers. Check applicable focus management/restoration, Escape handling, background
    interaction, scroll locking, stacking contexts/portals, nested overlays, and scrollbar
    shifts. Do not require body scroll lock or a focus trap on every popover, or prescribe
    `scrollbar-gutter` without checking the existing solution and runtime behavior.
13. **Layout stability.** Look for reserved media dimensions/aspect ratio, skeleton
    sizing, fonts, and late content above existing UI. CSS may already reserve space
    for an image without HTML dimensions. Missing attributes are a risk signal; observed
    shifts or measured CLS need runtime evidence, with the tested flow stated.
14. **Motion.** Inspect reduced-motion support, disruptive movement, exit behavior,
    and measured performance when available. Prefer transform/opacity when suitable,
    but layout animation is not inherently a defect and these properties do not guarantee
    60fps. Duration above 400ms or scale from zero is not automatically wrong.
    Require neither Framer Motion nor `AnimatePresence` for other animation systems.
15. **Theme and contrast.** Establish whether dark/high-contrast themes are supported.
    Check actual text/background and control/focus colors, including opacity, gradients,
    and states. Use computed values and a reliable contrast calculation; do not judge
    AA compliance by visual impression or require `dark:` when theme tokens handle it.
    WCAG AA text contrast is generally 4.5:1, or 3:1 for qualifying large text; evaluate
    non-text contrast separately under its applicable criterion and exceptions.

## Authoritative references

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): use the applicable criteria and exceptions.
- [Target size minimum, AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
  and [enhanced, AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).
- [MDN viewport lengths](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)
  and [viewport configuration](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport).
- [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
