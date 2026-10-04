# Browser-Automation Auto-Approval Policy

Implements the "approval agent with clear thresholds" idea Trey Price raised (2026-09-16 Slack
thread) for cutting down repeated manual permission prompts during AI-assisted E2E test authoring
against the ROBAR QA environment. Mason and Trey explicitly chose the **deterministic/rules-based**
approach over an LLM-judgment approval agent (2026-09-17) — Trey's own framing was "deterring
hallucination while mimicking live environments," and a fixed pattern-match either matches or it
doesn't; there's no judgment call to hallucinate. The tradeoff, accepted deliberately: this is
**narrow and rigid** — a legitimate new action outside the allowlist still prompts a human, exactly
as before, until someone extends the allowlist.

## Scope — what this does and does not cover

This addresses **Claude Code's own tool-permission friction** on this session's browser tool calls
(`mcp__Claude_Browser__*`) — the "Allow Claude to execute JavaScript on vmsrvtst703?" /
site-access class of prompts that fire on routine, low-risk test-data setup.

**It does NOT cover** the native **"Open SentinelLauncher?"** Chromium external-protocol dialog
that shows up when opening ROBAR's Printing module (`ClientPrintMethod=Sentinel`, see
`robar-module-reference.md`'s "Browser Printing" section). That dialog is OS/browser-chrome level,
outside any Claude Code tool call entirely — Playwright's `page.on('dialog')` never fires for it
either. It's handled today via FlaUI native automation in the `ROBAR_Tests` Playwright suite, not
by anything here. Don't expect this policy to touch that problem.

## Implementation

- **`.claude/hooks/robar-browser-approval.js`** — a `PreToolUse` hook (Node.js, no dependencies)
  matched against every `mcp__Claude_Browser__*` tool call via `.claude/settings.json`. Reads the
  tool call's JSON off stdin, and emits an `allow` decision ONLY for the narrow cases below —
  anything else produces no output at all, which falls through to today's default (ask the user).
  **Deny-by-default is the whole safety model here**: the hook has exactly one way to grant early
  approval and no way to actively deny/block anything it doesn't like — it can only opt out of
  having an opinion.
- **`.claude/browser-approval-allowlist.json`** — the one piece of this meant to be edited over
  time: an `allowedHostnames` array for the navigate rule (see "Extending" below).
- **`.claude/logs/browser-auto-approvals.log`** — append-only audit trail. Every auto-approved
  decision (never a denied/fell-through one, since that's just today's normal prompt) is logged
  with a timestamp and the relevant content (the URL or JS snippet). Given this is a
  regulated-environment QA workflow, having a record of what got cleared without a human look
  matters — check this file periodically, especially after extending the allowlist.

## What gets auto-approved (all four are independent; none implies the others)

1. **Read-only inspection tools** — always safe, no state mutation possible:
   `read_page`, `get_page_text`, `find`, `read_console_messages`, `read_network_requests`,
   `tabs_context`, `preview_list`, `preview_logs`, and `computer` calls where `action` is
   `screenshot` or `zoom` only.
2. **`navigate`** — only if the target URL's hostname is in `browser-approval-allowlist.json`'s
   `allowedHostnames` array AND the scheme is `http`/`https`. A custom protocol (`innoclient:`,
   etc.) never auto-approves, even to an allowed hostname — that's exactly the Sentinel-launch
   mechanism this policy explicitly stays out of (see Scope above).
3. **`javascript_tool`** (`javascript_exec`) — the narrowest, most important rule. The code must
   consist ONLY of simple statements that (a) locate one element via `getElementById`/
   `querySelector`/`getElementsByName` and (b) set its `.value` and dispatch a `change`/`input`
   event — i.e. exactly the "set a known form field for test-data setup" pattern, nothing else.
   Auto-approval is refused (falls through to asking) if the code:
   - contains any of: `password`, `signature`, `sig`, `submit`, `print(`, `.click(`, `fetch(`,
     `xmlhttprequest`, `eval(`, `settimeout`, `setinterval`, `document.write`, `innerhtml`,
     `location`, `cookie`, `localstorage`, `sessionstorage` (case-insensitive)
   - contains a string literal that itself looks like an embedded URL/protocol
   - is longer than ~500 characters, or touches more than 3 distinct elements (a complexity
     signal that it's doing more than simple test-data entry)
4. **Every other browser tool is untouched by this policy** — `computer` clicks/types/keys,
   `form_input`, `tabs_create`/`close`/`select`, `resize_window`, `preview_start`/`stop` all keep
   asking exactly as before. These weren't today's friction point, so no rules were written for
   them — extend deliberately, not by broadening an existing rule's edges.

## Verified (2026-09-17)

The hook's own decision logic was pipe-tested directly (synthesized stdin JSON, per this
project's `update-config` skill's verification method) against 9 cases: a safe JS snippet
(allowed), JS containing `password` (fell through), JS with `.click()` (fell through), navigate to
the allowed hostname (allowed), navigate elsewhere (fell through), navigate via a custom protocol
to the allowed hostname (fell through, as designed — protocol check applies independent of
hostname), a read-only tool (allowed), a `computer` screenshot (allowed), a `computer` click
(fell through, uncovered by design), and an over-complex multi-element JS snippet (fell through).
All nine matched the intended decision. The audit log correctly recorded only the four `allow`
decisions among those nine.

**What's NOT yet verified: whether Claude Code's runtime actually suppresses the specific
site-access/JS-execution permission dialog when this hook returns `allow`.** The pipe tests prove
the hook's own logic is correct; they don't prove the end-to-end integration, because that
requires a real tool-call round-trip through Claude Code's permission system, not a synthetic
stdin payload. There's also an open question about whether the "Allowed sites" browser feature we
saw earlier in this project (a distinct site-permission layer, separate from `settings.json`'s
`permissions.allow`, per that feature's own text: "Only Manual and Accept edits modes... prompt
per site") sits inside or outside what a `PreToolUse` hook decision can override. **Next real step:
try a live navigate/JS action against `vmsrvtst703` from a fresh session (after `/hooks` or a
restart, per the settings-watcher caveat below) and confirm the prompt actually doesn't appear.**
If it still prompts, this policy's hook logic is confirmed correct but something about how the
host app enforces that particular dialog sits outside `PreToolUse`'s authority — worth reporting
back rather than assuming either way.

**Settings-watcher caveat:** `.claude/settings.json` was newly created in this session (only
`settings.local.json` existed before). If the hook doesn't seem to fire at all once tried live,
open `/hooks` once to reload config, or restart the session — the settings watcher only tracks
directories that had a settings file present when the session started.

## Extending this safely

- **New allowed hostname for `navigate`:** add it to `browser-approval-allowlist.json`'s
  `allowedHostnames` array. That's it — no code change. Only add a real ROBAR test-environment
  host (e.g. a different version's VM per `.agents/e2e-cicd-readiness-plan.md`'s per-version VM
  model), never a general-purpose or customer-facing URL.
- **New JS pattern to allow:** resist the urge to loosen `SAFE_JS_STATEMENT` casually — the whole
  point of this policy is that the regex is narrow enough to reason about by inspection. If a
  genuinely new, equally-safe pattern is needed (e.g. a checkbox toggle), add it as its own
  explicit alternative in the regex rather than broadening an existing branch, and re-run the
  pipe-test battery above (safe case still allows, every existing deny case still denies) before
  trusting it.
- **Never add password/signature/print-submission patterns to the allow side, ever** — this
  mirrors the codebase's standing automation rule (never drive credential or e-signature fields,
  never execute a real physical print) and this hook must not become the place that rule gets
  quietly eroded.
- Check `.claude/logs/browser-auto-approvals.log` periodically after any allowlist change to
  confirm auto-approvals still look like what was intended.
