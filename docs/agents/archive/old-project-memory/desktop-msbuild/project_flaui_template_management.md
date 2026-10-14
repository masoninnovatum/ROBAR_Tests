---
name: flaui-template-management
description: "FlaUI was evaluated and implemented for Template Management's BarTender wrapper chrome (Save/Approve/Get Data/etc.), confirmed working end-to-end against the real app on 2026-09-01."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3d768f2a-4843-4191-a860-232e024eec32
  modified: 2026-09-01T18:38:52.818Z
---

Template Management's template editing hands off from the browser to a native Windows process
(`Innovatum.Sentinel.Plugin.BarTenderEdit`, launched via the Sentinel chain's `innoclient:`
protocol) that Playwright cannot see. FlaUI (FlaUI.Core/FlaUI.UIA3) was evaluated as a candidate,
implemented as a standalone CLI bridge at `C:\Users\Mason\FlaUIAutomation\` (independent of the
SVN-tracked repo, same reasoning as the Playwright folder), and bundled into the
`formal-test-script-execution` skill.

**Why:** The user wanted to know if scripted Template Management substeps (as opposed to
manual/ad-hoc BarTender canvas work) could be automated for formal test script execution.

**How to apply:** Per the test scripts at
`\\diskstation\backedup\#Unlocked_Test_Cases\Template_Management\7.0.3\`, the numbered/scored
steps only ever exercise Innovatum's own wrapper chrome around BarTender (Save, Save As, Approve,
Get Data, Restore, Comments, Close Tab, Effective Date fields) — never BarTender's own label-design
canvas. That wrapper chrome is confirmed to expose clean `Name`/`AutomationId` values (see
`btnSave`/`btnApprove`/`btnCloseTab`/etc. in the skill's FlaUI section), so FlaUI is a solid fit
for those scored steps. Actual template authoring (placing text/barcodes, binding sharenames) is
manual test-data setup done before a script run, not something scored substeps exercise — that
was confirmed by walking a full live create → bind → save → approve → close cycle on 2026-09-01,
which needed raw-coordinate (`click-at`) fallbacks for BarTender's own owner-drawn MFC/XTP
toolbars precisely because that layer isn't what scripted steps touch.

The e-signature dialog encountered during Approve is a hard boundary — see
[[feedback_automation_credential_boundary]] — automation stops there and hands off to the human.

Full details (confirmed selectors, gotchas, the credential boundary) live in the skill itself:
`.claude/skills/formal-test-script-execution/SKILL.md`, "Native Windows desktop automation
(FlaUI)" section.
