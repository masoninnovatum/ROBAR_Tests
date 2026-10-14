---
name: browser-approval-hook-convention
description: "Deterministic PreToolUse hook auto-approves a narrow set of low-risk browser tool calls against the ROBAR test env, per Mason+Trey's rules-based (not LLM-judgment) decision"
metadata: 
  node_type: memory
  type: project
  originSessionId: ee794a83-4115-434a-99d8-a0a57e296335
  modified: 2026-09-17T12:31:29.981Z
---

Built 2026-09-17 in response to a colleague (Trey Price)'s Slack suggestion to build an "approval
agent with clear thresholds" for the browser side of ROBAR E2E test authoring, after repeated
manual "Allow Claude to execute JavaScript on vmsrvtst703?" prompts became the biggest friction
point in that work.

**Decision made explicitly:** deterministic/rules-based approach, not an LLM-judgment approval
agent — chosen specifically to avoid a hallucination-driven auto-approval risk against a live
regulated-environment test system (real DB writes, real print jobs). See
[[dit-tracker-convention]] for the sibling "log what you find" convention from the same general
QA-tooling effort.

**What was built:** `.claude/hooks/robar-browser-approval.js` (PreToolUse hook, wired via
`.claude/settings.json`), `.claude/browser-approval-allowlist.json` (extensible hostname list),
audit log at `.claude/logs/browser-auto-approvals.log`. Full policy writeup:
`.agents/browser-automation-approval-policy.md` in the MsBuild repo.

**Why:** Auto-approves only read-only browser inspection tools, `navigate` to an explicit
hostname allowlist (http/https only, never a custom protocol), and `javascript_tool` calls whose
code matches a strict "set one known form field's value and dispatch an event" pattern (denies by
keyword/complexity otherwise). Deny-by-default: the hook can only opt IN to early approval, never
force a denial — everything not explicitly matched falls through to the normal prompt.

**How to apply:** Point to this policy doc before extending the allowlist for a new ROBAR test
host or a new safe JS pattern — don't casually broaden the regex. Also note: as of 2026-09-17 it
was NOT yet confirmed live whether this actually suppresses the browser tool's site-permission
dialog (a possibly-separate "Allowed sites" mechanism) — the hook's own decision logic was
pipe-tested and verified correct, but the end-to-end integration needs a real live test. If Mason
reports back on that, update this memory with the confirmed outcome.

Separately, this session also does NOT solve the native "Open SentinelLauncher?" Chromium
external-protocol dialog (Sentinel/BarTender-related) — that's unrelated, handled via FlaUI in the
`ROBAR_Tests` Playwright suite, out of scope for this hook.
