---
name: feedback-desktop-automation-window-scoping
description: "Native Windows desktop UI automation (FlaUI or similar) must scope to a specific process ID, never a bare window-title substring, or it can capture/interact with an unrelated window on the shared desktop"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3d768f2a-4843-4191-a860-232e024eec32
  modified: 2026-09-01T17:43:48.454Z
---

While building a FlaUI-based CLI bridge for native desktop UI automation (see
[[formal_test_script_execution]]'s "Native Windows desktop automation (FlaUI)" section), a
title-substring window match grabbed a real, unrelated window instead of the one just launched for
testing — twice, in direct live testing on this machine:

1. `--title "Notepad"` matched a *different*, pre-existing Notepad window (the user's own file)
   instead of the one just spawned for the test, because both had "Notepad" in the title. A
   `screenshot` call on it captured a real plaintext password visible in that file. Deleted
   immediately and disclosed to the user in the same turn.
2. After fixing window selection to require an exact process ID, `screenshot` *still* leaked a
   thin sliver of a different window's text at one edge — a separate bug (DWM's captured
   bounding rectangle includes a few pixels of transparent shadow/margin beyond the visibly
   opaque window content, so whatever sits directly behind that margin on the desktop shows
   through). `SetForeground()` + a delay did not fix this — the identical leak reproduced at the
   identical edge regardless of z-order. Fix was cropping a ~12px safety margin off all four
   captured edges before saving.

**Why this matters:** a real desktop reliably has many unrelated windows open at once (in this
session's own test: Excel with "Protected View" test-case files, Outlook, Teams, a browser with
Smartsheet tabs) — any of which a loosely-scoped automation call could inadvertently screenshot,
read text from, or click into.

**How to apply, for any future native-desktop (not browser) automation work, not just FlaUI/Template
Management specifically:**
- Always resolve a specific process ID first (list running processes with visible windows, or
  diff a before/after snapshot around the moment the target app is launched) — never act on a
  bare title/name substring match against the whole desktop.
- Even with the correct window/process scoped, treat a screen-region screenshot capture as
  capable of leaking adjacent-window content at its edges; crop a safety margin, or otherwise
  verify the capture is actually confined to the target window, before treating it as clean.
- If a capture (or any window-scoped read) unexpectedly includes content that doesn't belong to
  the intended target, stop, delete/discard the artifact immediately, and tell the user what
  happened in the same turn — don't quietly retry and hope the next one is clean.
