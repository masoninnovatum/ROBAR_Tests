---
name: feedback-browser-screenshot-limitation
description: "Claude in Chrome / browser tools cannot persist screenshots to a file Claude can access, blocking automated screenshot-document assembly"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3d768f2a-4843-4191-a860-232e024eec32
  modified: 2026-08-24T15:16:41.401Z
---

When driving "Claude in Chrome" (mcp__claude-in-chrome__computer) against an internal test
environment, screenshots taken with `save_to_disk: true` do NOT land anywhere accessible to
Claude's local file tools (Bash/Read/PowerShell) on the machine running Claude Code, even when
the user confirms no download notification or Save-As dialog appeared. Verified three ways in one
session: (1) searched Downloads/Pictures/Documents/all Claude app-data folders — nothing; (2) took
an OS-level screenshot via PowerShell (System.Drawing) — it captured Claude Code's own desktop,
not the user's Chrome window, meaning the automated browser session isn't running on the same
visible desktop/machine as the file tools; (3) searched the session's temp/cache directories for
any auto-persisted tool-image blobs — nothing.

**Why:** The browser being automated ("your real Chrome") and the machine where Bash/PowerShell/Read
execute are not guaranteed to be the same physical screen, even though paths look local
(`C:\Users\Mason\...`). Claude can *see* screenshots inline (multimodal content) well enough to
verify page state and describe it accurately, but has no raw byte access to save that image to disk.

**How to apply:** Before promising to assemble a screenshot document (e.g. for
[[formal_test_script_execution]] work like WM_Preset_Management-13.1), verify screenshot capture
actually reaches a file Claude can read — don't assume `save_to_disk` works. If it doesn't, ask the
user up front whether they'll capture screenshots manually (Win+Shift+S, sent to Claude) rather than
discovering the limitation mid-run. Don't spend more than one quick check re-verifying this in future
sessions unless the underlying tooling changes.
