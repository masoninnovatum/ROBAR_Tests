---
name: project-wm-preset-management-deviation
description: Trial execution of WM_Preset_Management-13.1 step 1.1 surfaced a possible real deviation — Preset Management was not disabled for a user lacking WM_Create_Workflow_Preset
metadata: 
  node_type: memory
  type: project
  originSessionId: 3d768f2a-4843-4191-a860-232e024eec32
  modified: 2026-08-24T15:16:52.349Z
---

During a 2026-08-24 trial run (front-end capability test, not a formal signed execution) of
[WM_Preset_Management-13.1](file:///C:/Users/Mason/OneDrive%20-%20Innovatum,%20Inc/Desktop/WM_Preset_Management-13.1%20NEW.docx)
against test environment `http://vmsrvtst703/innovatum/WebMenu/` (build 7.0.3.20099), step 1.1 did
not match its expected result:

- Logged in as MBUser2 (intended as U02: "all security processes enabled except
  WM_Create_Workflow_Preset" per the script's Setup Requirements).
- Opened Workflow Management → Actions dropdown. Expected: "Preset Management" option disabled,
  with tooltip "User not authorized for this task WM_Create_Workflow_Preset".
- Actual: "Preset Management" appeared visually identical to "Create New Workflow" (no disabled
  styling), and clicking it successfully navigated into the Preset Management page showing a
  live "Create New" button — i.e., MBUser2 was NOT blocked.

**Why this matters:** Either (a) MBUser2 in this environment isn't actually configured without
WM_Create_Workflow_Preset (a test-data/setup issue, not a product bug), or (b) the disable/tooltip
behavior is genuinely broken. Not yet determined which — the run was stopped before further
investigation (screenshot tooling blocked continuation; see
[[feedback_browser_screenshot_limitation]]).

**How to apply:** Before formally executing WM_Preset_Management-13.1, verify MBUser2's security
profile actually excludes WM_Create_Workflow_Preset (check via ConfigManager or the Securities
table), then re-test step 1.1. If the security profile is confirmed correct and the option is still
not disabled, this is a real product defect worth filing before the test script is run for record.
