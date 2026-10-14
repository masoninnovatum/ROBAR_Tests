---
name: reference-screenshot-doc-format
description: "Where to find the canonical completed screenshot-document format and how it's structured"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 3d768f2a-4843-4191-a860-232e024eec32
  modified: 2026-08-24T15:17:03.066Z
---

Executed formal test scripts and their paired screenshot documents live on the network share at
`\\diskstation\backedup\#Quality_Assurance\Release\{release folder}\{Feature}\Executed_MSWord+_Docs\`.
Example verified: `2026.06.26_Release_7.0.3.19957+\Workflow_Management\Executed_MSWord+_Docs\`
contains `WM_View_and_Vote-3.1.doc` (the executed script) and its paired
`WM_View_and_Vote-3.1-SS.docx` (screenshot document).

**Screenshot document format** (confirmed from WM_View_and_Vote-3.1-SS.docx):
- Page header (two lines, "Header" style): the test script name (e.g. `WM_View_and_Vote-3.1`) on
  line 1, `Run {N}` on line 2 (run number for re-execution attempts).
- Body: plain default-style paragraph containing just the substep number (e.g. `1.3`, `2.3A`,
  `2.3B` — letter suffixes A/B/... used when a single substep has multiple screenshots), followed
  by a paragraph containing the inline screenshot image, followed by a blank paragraph as spacing.
  No bold/heading style on the number labels — just plain text runs.
- Standard US Letter page (12240x15840 DXA), 1" margins (1440 DXA), default 12pt minor-theme font.

Draft-example templates for this format also exist locally under `Desktop/Test Scripts - DRY RUNS
and CREATING/SCREENSHOT DOC EXAMPLES/`, but those are blank shells (no embedded images) — the
network-share copies under `Executed_MSWord+_Docs` are the real, filled-in reference to check
against. Corresponds to the [[formal-test-script-creation]] skill's execution counterpart.
