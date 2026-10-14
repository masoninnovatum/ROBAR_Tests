---
name: robar-qa-reference-doc-convention
description: Standing convention to update the ROBAR module behavior reference doc whenever formal test scripts or exploratory testing sessions are done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a7dddb1f-0979-49b2-9712-3c6855b69bda
  modified: 2026-09-16T15:10:00.509Z
---

Whenever the user shares formal QA test scripts for a ROBAR/Innovatum Suite 7 module, or a live
exploratory testing session against a module wraps up (in the MsBuild repo OR the sibling
`ROBAR_Tests` repo at `C:\Users\Mason\ROBAR_Tests` — this repo was renamed from
`PlaywrightAutomation` at some point after 2026-09-04; both CLAUDE.md files and the code already
use the new name), update `.agents/robar-module-reference.md` in the MsBuild repo with what was
learned for that module's section (required fields, security process names, bulk-action
behaviors, confirmed bugs). Add a new section if the module isn't covered yet.

**Why:** The user explicitly asked (2026-08-25) to retain everything learned from the Campaign
Manager and Workflow Management formal-script reviews and exploratory sessions for future use, and
confirmed they want this to apply automatically to any scripts shared in the future — not just a
one-time consolidation. On 2026-09-04 the user asked to bridge this knowledge into
`PlaywrightAutomation` (a separate repo that runs Playwright automation against the live UI); the
chosen approach was a pointer, not a copy, so the file stays singular and both repos read/write
the same one.

**How to apply:** This convention is also written into both repos' `CLAUDE.md` files — MsBuild's
under "Module Behavior Reference (QA)", and PlaywrightAutomation's under the same heading (which
points at the file by absolute path instead of duplicating it). This memory entry is a backup in
case a working directory or CLAUDE.md ever changes. Keep the full step-by-step record in a
separate `.agents/exploratory-session-log-*.md` file per session (in the MsBuild repo) —
`robar-module-reference.md` itself should stay a distilled summary, not a transcript. See also
[[robar-module-reference]] (conceptual link — the actual file lives in the repo, not in memory).
