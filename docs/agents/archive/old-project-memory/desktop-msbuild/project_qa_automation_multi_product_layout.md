---
name: qa-automation-multi-product-layout
description: Planned repo layout and Desktop/VS Code Claude Code split once View access to real ROBAR and RONOVA source lands
metadata: 
  node_type: memory
  type: project
  originSessionId: f17840b8-5ae4-4370-bfdb-2ccb9463fc2e
  modified: 2026-09-16T15:10:14.922Z
---

**Update 2026-09-16: the ROBAR half of this plan is done.** The sibling automation repo exists at
`C:\Users\Mason\ROBAR_Tests` (Git, Playwright + `@playwright/test`), bootstrapped with
`qa-project-context` (`.agents/qa-project-context.md`), and already has a real spec suite covering
Campaign Manager, Template Management, and Master Data Management (see `tests/<Module>/*.spec.ts`).
A `risk-based-testing` pass also produced `.agents/risk-matrix.md` in the MsBuild repo. The module
reference doc is shared by pointer exactly as planned — see [[robar-qa-reference-doc-convention]].
Originally this repo may have been created under the name `PlaywrightAutomation`; it is now
`ROBAR_Tests`.

**RONOVA is still pending** — not yet explored in this workspace, no sibling `RONOVA_Tests`/
`RONOVA-Automation` repo exists yet. Original plan below, still the template to follow for RONOVA
once source access lands.

**Original plan (RONOVA portion still open):**
- Set up a separate Claude Code project per product for automated-test creation (Playwright).
- Each product gets its own **QA-owned Git automation repo, sibling to (never nested inside) the
  product's SVN source checkout** — e.g. `ROBAR_Tests/` next to `ROBAR/` (done), `RONOVA_Tests/`
  (or similar) next to `RONOVA/` (not started). One repo per product, not a shared monorepo.
- Bootstrap each automation repo with the `qa-project-context` skill, seeded from a distilled copy
  of that product's `.agents/*-module-reference.md` knowledge — not a live cross-directory read,
  since Claude Code's memory/CLAUDE.md are scoped per working directory.

**Why:** Test code can't live inside an SVN-managed product tree — nesting a Git repo inside an
SVN working copy causes `svn status` noise and risk of accidentally `svn add`-ing automation files
into the regulated product tree (see this repo's `CLAUDE.md`). Per-product (not shared) repos were
chosen because ROBAR/RONOVA likely don't share architecture.

**How to apply:** When Mason wants to start RONOVA test automation, scaffold a sibling
`RONOVA_Tests` repo and run `qa-project-context` in it, following the same pattern already
executed for ROBAR. Do not re-verify the ROBAR half — it's confirmed live, check `ROBAR_Tests`
directly if details are needed rather than trusting this memory's snapshot.
