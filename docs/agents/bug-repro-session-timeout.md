# Bug Reproduction — WebMenu Session Timeout Ignores Non-Mouse Activity

**Status: VERIFIED, ROOT-CAUSED, deterministic.** Originated as a vague observation in
`.agents/exploratory-session-log-campaign-manager.md` ("session timed out mid-task, in-progress
selection lost"); this document replaces that thin report per Step 8 of `bug-reproduction`.

Scope note: this is a QA-analyst reproduction, not a developer fix. No code was changed, no
regression test was written, and no `git bisect` was run (this project is SVN, and no fix is
being proposed here) — Steps 1, 2, 7, and 8 of the skill were applied; Steps 3, 5, 6 (bisect,
write/verify a fix) are out of scope by request.

## 1. Minimal Reproduction Steps

1. Log into `http://vmsrvtst703/innovatum/WebMenu/` as any user.
2. From that point on, generate **any amount of activity that is not a literal mouse-move
   event** — clicks, keyboard input, dropdown changes, form submissions — for 600 seconds
   (10 minutes) measured from the last actual `mousemove`.
3. At the 600-second mark (checked every 2 seconds by a polling timer), the page redirects to
   `Default.aspx?FullScreen=true&Logout=true&Timeout=true&ForwardURL=...`, discarding any
   unsaved in-progress state — e.g., a selected Campaign Manager grid row plus a chosen bulk
   action (the case that surfaced this).

No special data, account, browser, or locale is required — this reproduces on the default
`MBUser1` test account with zero configuration.

## 2. Environment / Build

- URL: `http://vmsrvtst703/innovatum/WebMenu/`
- Build: **7.0.3.20099** (from the login page footer)
- Account: `MBUser1`
- Client: Claude Code's in-app Browser pane (Chromium-based)

## 3. Root Cause (found by reading the page's own inline script, not guessed)

The WebMenu page ships this inline timeout logic:

```javascript
var TIMEOUT_COOKIE = "InnoSession_PageTimeout";
function RefreshTimeout(){
    CheckValid();
    var seconds = 600;
    var date = new Date();
    date.setTime(date.getTime()+(seconds*1000));
    createCookie(TIMEOUT_COOKIE, date.toGMTString(), false);
}
function CheckValid() {
    var timeout = readCookie(TIMEOUT_COOKIE);
    var user = readCookie(UID_COOKIE);
    if ((new Date(timeout) < new Date())||(user != "DA2D4C58895B7F")) {
         clearInterval(Interval_Refresh);
         clearInterval(Interval_Valid);
         doTimeout();          // -> redirectToLogin(), no warning shown
    }
}
Interval_Valid = setInterval(CheckValidProxy, 2000);   // polls every 2s
document.body.addEventListener("mousemove", (event) => { RefreshTimeout(); });
```

**The only activity listener registered anywhere on the page is `mousemove`.** There is no
listener on `click`, `keydown`, `input`, `change`, or XHR/fetch activity. `CheckValid()` polls
every 2 seconds and redirects the instant the 600-second cookie expires, with **no warning
dialog** — `doTimeout()` goes straight to `redirectToLogin()`.

## 4. Expected vs. Actual

- **Expected (reasonable baseline, not a documented spec — flagging this as an assumption):**
  genuine user activity of any kind (clicking, typing, selecting) should be recognized as "not
  idle," and/or the user should get a warning before being logged out with in-progress work
  discarded.
- **Actual:** only physical mouse movement resets the timer. A user working entirely via
  keyboard, or whose interaction pattern involves long pauses between mouse movements while
  actively clicking/selecting (exactly what happened during our Campaign Manager exploration),
  is silently logged out exactly 600 seconds after their *last mouse movement* — regardless of
  how much other genuine activity happened in between — with zero warning and total loss of
  any unsaved in-progress selection or action.

## 5. Evidence (captured live, not simulated)

Direct experiment against the live cookie, confirming the mechanism precisely:

| Action dispatched | `InnoSession_PageTimeout` cookie | Changed? |
|---|---|---|
| Baseline read | `Sat, 22 Aug 2026 19:07:08 GMT` | — |
| `document.body.click()` + `keydown` event | `Sat, 22 Aug 2026 19:07:08 GMT` | **No** |
| `mousemove` event | `Sat, 22 Aug 2026 19:09:08 GMT` | **Yes — extended by exactly 600s from dispatch time** |

This confirms both halves of the root cause independently: non-mouse-move activity does
nothing to the timer, and a mouse-move — even a synthetic one with no real cursor motion —
extends it by exactly the coded 600 seconds.

## 6. Introducing Commit

Not applicable — this project is SVN, not git, and no history-bisection was performed (no
regression is claimed; this may be original, long-standing behavior). If this is worth fixing,
whoever owns the WebMenu login/session code should check `svn log` / blame on the file
containing this inline script for when the `mousemove`-only listener was introduced.

## 7. Regression Test

Not applicable — no code change is being made in this pass. If this becomes a tracked defect,
the fix-side owner should add listeners for `click`/`keydown`/`input` (or a broader
"any interaction" activity heuristic) alongside `mousemove`, and — separately — consider
warning the user before the redirect rather than silently discarding in-progress state.

## 8. Determinism Notes

Fully deterministic — no timing race, no flakiness, no environment dependence. Verified by:
reading the exact source (600-second constant, `mousemove`-only listener), and independently
confirming via live cookie manipulation that click/keydown leave the cookie unchanged while a
dispatched `mousemove` extends it by precisely 600 seconds. This satisfies Step 7's
classification as **genuinely reproducible** (not flaky, not environment-specific, not
data-dependent) — it will reproduce identically for anyone, on any build 7.0.3.20099
installation, every time.
