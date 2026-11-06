# Skill and Agent Alignment Plan

## Goal

Align QA skill discovery, routing, and validation instructions with the tools and
workspace conventions that currently exist in this repository. Do not add a custom
agent unless a distinct delegated role is justified.

## Phase 1 — Skill discovery and routing

- [x] Add valid `name` and a trigger-rich `description` to `qa-contract-testing`.
- [x] Clarify the boundary between HTTP/API testing and asynchronous
  producer-consumer contract testing.
- [x] Link contract testing from the API/system-testing skill routes.
- [x] List all repository QA skills in the README.

## Phase 2 — Correct execution and validation procedures

- [x] Replace the nonexistent `node scripts/qa-trace.js` command with the actual
  traceability and QA gate commands.
- [x] Add the required impact/gap checks before editing test artifacts and the
  applicable Playwright verification after spec changes.
- [x] Align spec-file size guidance with `.github/copilot-instructions.md`.

## Phase 3 — Portability and final review

- [x] Remove instructions that assume the Hub is installed at `D:/_QA_Test_Automation`.
- [x] Replace fixed `D:/_Master_process` audit paths with a configurable/discoverable
  path and a clear fallback when the external tool is unavailable.
- [x] Check the updated skill links, commands, frontmatter, and workspace state.

## Decisions

- Keep this as one plan file; the work is small enough not to need separate phase
  documents.
- Do not add a custom agent: the tasks are direct, single-purpose QA workflows and
  do not need tool restrictions, delegation, or a multi-stage persona.
- Treat the target repository's `AGENTS.md`, `.github/copilot-instructions.md`,
  package scripts, and `playwright/package.json` as the operational source of truth.

## Verification

- Static checks: verify frontmatter names/descriptions, relative references, and
  referenced script commands against repository files.
- Runtime checks: none required; this change updates agent documentation only.
