# ROBAR_Tests

Playwright-based browser automation for QA work against Innovatum Suite 7 (ROBAR) — driving the
live UI to execute formal test scripts, capture screenshots, and fill out forms. Sibling to the
`MsBuild` repo (the actual Suite 7 source, at
`C:\Users\Mason\OneDrive - Innovatum, Inc\Desktop\MsBuild`), which is where formal test scripts
and exploratory testing sessions are authored/reviewed.

## Layout

- `tests/` — `@playwright/test` spec files (`*.spec.ts`), one subfolder per ROBAR module (e.g.
  `Campaign-Manager/`, `Template-Management/`). Run with `npm test`, `npm run test:ui` for the
  interactive UI runner, or via the "Playwright Test for VS Code" extension's Test Explorer.
  `tests/support/robar.ts` holds shared login/navigation helpers — pull new cross-module helpers
  in there rather than duplicating login boilerplate per spec.
- `playwright.config.ts` / `tsconfig.json` — test runner and TypeScript config (`testDir: tests/`,
  matches `*.spec.ts`).
- `scripts/` — reusable helpers that aren't tests (form filling, screenshot/docx generation, field
  enumeration)
- `archive/` — one-off debug/exploration scripts and captured page dumps from past investigations,
  including the plain-script exploration chain that a given spec under `tests/` was consolidated
  from (see that spec's header comment for which archived scripts it supersedes)
- `output/` — completed screenshot documents and other deliverables
- `lm_explore/` — in-progress exploration

**Adding a new test:** write it as a `@playwright/test` spec (`test()`/`expect()` imported from
`@playwright/test`, using `import`/`export`, not `require`) under `tests/<module>/*.spec.ts`, not
a bare script — only `.spec.ts` files show up in VS Code's Test Explorer (requires the
"Playwright Test for VS Code" extension) and `npm test`. Use `tests/support/robar.ts`'s
`login`/`openMenuItem`/`findFrame` rather than re-deriving the WebMenu login/iframe-polling dance.

## Module Behavior Reference (QA)

`C:\Users\Mason\OneDrive - Innovatum, Inc\Desktop\MsBuild\.agents\robar-module-reference.md` is a
consolidated, living reference of how individual ROBAR modules actually behave — navigation,
required fields, security process names, bulk-action gotchas, confirmed bugs. It's built from
formal QA test scripts and live exploratory testing, and is shared across both the MsBuild repo
and this one so the knowledge doesn't have to be rediscovered per repo.

**Before automating a new module here, read that file's section for the module first.**
**Whenever a session in this repo (a Playwright run, a formal-test-script execution, ad-hoc
exploration) surfaces something new about a module's behavior** — a required field, a bug, a
UI quirk — **update that module's section in the file above** (add a new section if the module
isn't covered yet). It should stay a distilled summary, not a transcript; if you need to keep a
detailed step-by-step record, add it as a separate file here rather than bloating the reference doc.

This is the same convention already in effect in the MsBuild repo's CLAUDE.md — the file is
shared, not duplicated, so updates from either repo are immediately visible to the other.
