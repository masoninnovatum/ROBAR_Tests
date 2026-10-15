---
name: automation-credential-boundary
description: "Never drive password/credential fields or e-signature submissions via desktop or browser automation, even with explicit user authorization — hand off to the human and resume after."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3d768f2a-4843-4191-a860-232e024eec32
  modified: 2026-09-01T18:38:38.973Z
---

When automation (FlaUI, Playwright, or similar) reaches a field that accepts a password,
credential, or other authentication secret — including a regulatory e-signature dialog like
Innovatum's "Signature Required" (`txtUser`/`txtPassword`/`ddlReasonCodes`/`btnSubmit`) — stop and
ask the human to complete that one step themselves on the live screen, then resume automation
afterward by verifying the result (e.g. re-reading the app's own post-action state) rather than
assuming success.

**Why:** Two independent reasons, confirmed during the [[project_flaui_template_management]]
BarTenderEdit test (2026-09-01): (1) entering credentials into an auth field is a hard rule that
does not bend even when the user explicitly authorizes it — "yes, complete signature" is not
sufficient permission. (2) For an e-signature specifically, the entire regulatory point of the
control (this is an FDA-adjacent medical device labeling system) is that a human personally
attests to the approval — having automation drive it defeats the control's purpose even when the
outcome is what the human wants.

**How to apply:** In any future automation work (FlaUI desktop bridge, Playwright browser
scripts, or anything else) — when a step reaches a password/credential field or an e-signature
submission, stop the script, tell the user exactly what's needed (field names/dialog if helpful),
and ask them to complete just that step directly. Resume by checking the app's own confirmation
signal (e.g. a status label changing, an "Approved by" field appearing) rather than assuming the
handoff succeeded. This pattern is now documented in the `formal-test-script-execution` skill's
"Native Windows desktop automation (FlaUI)" section as the confirmed, standing approach for any
e-signature dialog encountered in future script runs.
