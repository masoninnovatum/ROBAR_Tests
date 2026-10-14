---
name: robar-module-reference-bridge
description: "Where the shared ROBAR module behavior reference doc lives, and the convention for keeping it updated from this repo"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ff7af693-a358-44d4-a4e6-08512a266d49
  modified: 2026-09-04T14:11:56.080Z
---

The consolidated ROBAR module behavior reference (navigation, required fields, security process
names, bulk-action gotchas, confirmed bugs) lives at:

`C:\Users\Mason\OneDrive - Innovatum, Inc\Desktop\MsBuild\.agents\robar-module-reference.md`

That's a different repo (`MsBuild` — the actual Innovatum Suite 7 source, where formal test
scripts and exploratory sessions are authored/reviewed). This repo (`PlaywrightAutomation`) does
not keep its own copy — read that file directly by absolute path before automating a new module,
so the knowledge doesn't get rediscovered from scratch here.

**How to apply:** Whenever a Playwright run, formal-test-script execution, or ad-hoc exploration
in this repo surfaces something new about a module's behavior, update that module's section in
the file above (add a new section if the module isn't covered yet) — same convention as the
MsBuild repo. Keep it a distilled summary, not a transcript. This is also documented in this
repo's `CLAUDE.md` (`C:\Users\Mason\PlaywrightAutomation\CLAUDE.md`) under "Module Behavior
Reference (QA)". See [[robar-qa-reference-doc-convention]] for the MsBuild-side counterpart of
this convention.
