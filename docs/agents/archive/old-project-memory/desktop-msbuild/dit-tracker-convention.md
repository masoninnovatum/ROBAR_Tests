---
name: dit-tracker-convention
description: "Standing convention to log confirmed product defects to .agents/dit-tracker.md as they're found during QA work, before they're even filed as DIT tickets"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ee794a83-4115-434a-99d8-a0a57e296335
  modified: 2026-09-16T15:32:16.877Z
---

Whenever QA work (in the MsBuild repo or the sibling `ROBAR_Tests` repo) confirms a real product
defect — not a test-script wording nit, not an environment quirk — log it in
`C:\Users\Mason\OneDrive - Innovatum, Inc\Desktop\MsBuild\.agents\dit-tracker.md` right away, even
before it has an actual DIT (Development Issue Tracking) ticket number. Update DIT#/Status once
it's filed.

**Why:** Mason asked (2026-09-16) to "keep track of DITs found" after an `ai-test-generation`
pipeline run's code investigation surfaced a real confirmed defect (MDM effective-status cached
across the print wizard, never re-checked at final Print submit — see
[[robar-qa-reference-doc-convention]] for the sibling module-reference-doc convention this
complements). The concern is losing track of defects discovered mid-session between "confirmed"
and "actually filed as a ticket."

**How to apply:** This is now also written into the MsBuild repo's `CLAUDE.md` under the "Module
Behavior Reference (QA)" section, right next to the `robar-module-reference.md` convention it
pairs with. Treat any newly-confirmed defect from formal test script review, exploratory testing,
or AI-assisted test generation as needing a `dit-tracker.md` row — don't wait to be asked per
incident.
