<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: testing-tooling-limitations -->

## Known testing-tooling limitations (not product issues — noted so they aren't re-litigated)

- The Claude-in-Chrome `find`/`read_page` accessibility-tree tools do not descend into this app's
  same-origin nested iframes, so `file_upload` (which needs an element ref from those tools)
  cannot target file inputs inside module content. Any testing that requires an actual file
  upload needs a different approach or manual verification.
- **Two confirmed bugs in Campaign Manager's grid "Retrieve Items" / "Do Action" path** (found
  2026-09-04 while automating Mass Item Approve; both affect every one of the 11 "Select Action"
  bulk actions, since all of them require this same grid-select step). Both are worked around in
  `ROBAR_Tests/tests/support/campaign-manager.js`, which is the reference implementation
  for driving this flow going forward:
  1. **The grid frame auto-replays the account's last-used search filter on load, silently
     racing any immediate interaction.** Landing on the Campaign Manager grid (e.g. via the
     item-edit page's "← Campaign Manager" breadcrumb) fires an automatic `GetData` request using
     whatever filter criteria that account last searched with — before the user (or automation)
     touches anything. If a new filter is set up and "Retrieve Items" is clicked while that
     automatic request is still in flight, the click silently no-ops (no new request fires) and
     the stale automatic response is left showing — which looks exactly like "Retrieve Items
     returned the wrong item" but is really "Retrieve Items never actually ran." Fix: wait for
     that automatic `GetData` to fully resolve before touching the filter UI at all.
  2. **`RetrieveItems()`'s `GetUserEnvRecordsPerPage` AJAX call is fire-and-forget and its
     `complete` callback stores the raw jqXHR object (not the parsed response) into the hidden
     `#RecordsPerPage` field**, corrupting it to the literal string `"[object Object]"`. Since
     that call isn't awaited before the grid re-renders, its completion can land at any point —
     including *after* a workaround has already patched `#RecordsPerPage` back to a valid number —
     silently re-corrupting it before "Do Action" is clicked. Symptom: Do Action fails server-side
     model binding with `"The value '[object Object]' is not valid for RecordsPerPage."` A
     JS-level property-setter override on the element did **not** reliably fix this either (the
     app's real, native form submission appears to read the underlying value independent of a
     JS-shadowed accessor). The fix that actually held up under repeated testing: explicitly wait
     for that specific AJAX call to fully resolve after every Retrieve Items click (not just the
     grid's own `GetData` response), THEN do one plain, final fix — never patch-and-hope while a
     call from that endpoint could still be in flight.
  3. **The grid auto-restores the account's last-used filter row on load, VALUE included.**
     Landing on the Campaign Manager grid already has a filter row present (from whatever the
     account last searched for, in the current session or a previous one) — blindly clicking
     "Add Filter" adds a SECOND row instead of replacing it, turning the query into an impossible
     "old item AND new item" that can never match, which looks exactly like "Retrieve Items
     returned nothing" or "returned the wrong item." Fix: check for an existing filter row first
     and reuse it (index 0) rather than always adding a new one.
  4. **Playwright's `trace: 'retain-on-failure'` is not just overhead against this app — it
     changes real behavior.** With tracing on, the grid's Retrieve Items flow reliably got stuck
     on "Loading..." forever (even across 5 retries with generous timeouts) for a test that
     otherwise passes in ~30s with tracing off. Root cause unconfirmed, but the CDP-level
     instrumentation appears to perturb this legacy jQuery app's own timing-sensitive JS enough to
     break it. Keep tracing off for this suite by default; re-enable per-run via `--trace=on` only
     when actively debugging a specific failure, not as a standing config.
- **ASP.NET AJAX `UpdatePanel` pages + this site's CSP nonce policy don't cooperate in headless
  Playwright Chromium** (found 2026-09-09 on Print by Lot's Lot Panel, see that module's own
  section above for the product-behavior context). The page's Microsoft Ajax client framework
  fails to bootstrap (`Sys is not defined` console errors) because CSP blocks whatever
  inline/dynamic script it needs, and every affected click also logs an explicit `Executing
  inline event handler violates...CSP` violation. Symptoms: a button click that should navigate
  to a new screen instead gets a real `200 OK` POST back but re-renders the *same* screen with no
  visible change; a checkbox that triggers a partial postback can vanish from the DOM by its `id`
  afterward even though other, unrelated field state on the same page reads back correctly and
  consistently. **Confirmed NOT a real product defect** — the identical action (advancing past
  the Lot Panel to complete a print) worked cleanly in a real Chrome browser. Treat any
  UpdatePanel-driven partial-postback interaction on this app as suspect in headless Playwright
  specifically; if a step only needs to reach a screen and read a specific field/attribute, the
  DOM read is still reliable even when an unrelated cosmetic side effect looks broken — but if a
  step needs to *complete* an action gated behind such a transition, either drive that one action
  via the interactive/real browser or ask the user to do it in their own browser and hand back an
  identifier (e.g. a lot number) to resume automation with. A synthetic
  `el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}))` via
  `frame.evaluate()` is a more robust alternative to Playwright's native `.click()` for an element
  whose layout shifts unpredictably right after a preceding postback-triggering action (native
  `.click({force:true})` failed with "Element is outside of the viewport" in exactly this
  situation; the dispatched event bypasses that actionability check entirely).
- **Playwright's `headless: true` can silently launch a Chromium build with no real OS window at
  all**, which breaks any test driving a native desktop app via UI Automation (FlaUI) — found
  2026-09-11 while building Template Management's BarTender-launching tests. Recent Playwright
  versions launch a separate, dedicated "headless shell" binary (a stripped browser build with no
  windowing support, under `ms-playwright/chromium_headless_shell-*`) for `headless: true` instead
  of running the full browser headlessly like older versions did — `ms-playwright/chromium-*` (the
  real, windowed build) only gets used in headed mode. Confirmed live: a FlaUI process-title lookup
  came back with zero matches every single time under `headless: true`, and the same test found the
  window immediately once `test.use({ headless: false })` was added. **Any test that drives a
  native desktop app via `scripts/flaui_bridge.js` must set `headless: false`** regardless of the
  project's default config — there is no way to make this work headless.
- **FlaUI's `click`/`clickAt` (`scripts/flaui_bridge.js` → `FlaUIAutomation.exe`) report success
  the instant they dispatch a synthetic input, with NO verification the target actually received
  or acted on it** — confirmed by reading `Program.cs` directly (`CmdClick`/`CmdClickAt` call
  `control.Click()` / `Mouse.Click()` and immediately `WriteJson({..., clicked: true})`, no
  read-back). In practice this makes some clicks (e.g. the "Open SentinelLauncher?" native Chrome
  prompt) genuinely flaky in a way that's invisible to error-based retry logic — a "successful"
  attempt sometimes does nothing at all, silently, and a naive retry-on-error loop never notices.
  **Always verify the actual effect** (dump-tree to confirm a dialog is gone, list-processes to
  confirm a process spawned/exited) rather than trusting a reported success — see
  `ROBAR_Tests/tests/support/bartender.ts`'s `confirmSentinelLaunchPrompt` and
  `closeTemplateEditor` for the corrected pattern (retry the click AND re-check the
  real state after each attempt, not just once at the end).
- **A desktop app closing after a `Close Tab`-style click can take several real seconds**, and
  since the click itself doesn't confirm anything (see above), a test that moves on immediately can
  race a window that's still visibly closing. Confirmed by observation (Mason watching the screen)
  during Template Management test development — fix is to poll `list-processes` for the specific
  pid to actually disappear before continuing, not just wait a fixed short timeout.
- **Exploring a new browser-only flow live via `mcp__playwright__*` tools, before writing any
  FlaUI-dependent Playwright test code, is dramatically faster than trial-and-error against a
  human's terminal.** Confirmed 2026-09-11 building Template Management tests: a session logged
  into the WebMenu directly via `browser_navigate`/`browser_snapshot`/`browser_click`, confirmed the
  exact row-action dropdown structure, dialog field ids, and bulk-action page layout in a couple of
  minutes — no native-window/session-isolation issues at all, since this is pure CDP browser
  automation, not FlaUI. Only genuinely BarTender/desktop-app-driving steps need a human to run
  them and report back logs; anything that's just browser DOM interaction can and should be
  explored this way first.
- **`mcp__playwright__browser_file_upload` refuses any path outside a small allowed-roots list**
  (the current session's working directory and its `.playwright-mcp` subfolder) — confirmed live
  2026-09-14 exploring Replace Template: a real network-share `.btw` path (the same one Playwright
  test code uploads successfully via `setInputFiles`, which has no such restriction) was rejected
  with "File access denied ... outside allowed roots." This is specific to the MCP tool's own file
  chooser sandbox, not a product or Playwright-test limitation — work around it during live
  exploration by copying a small representative file into the working directory first (and deleting
  it again afterward), then write the real test using `frame.setInputFiles()`/`fileInput
  .setInputFiles()` with the real path, which is unaffected.
- **A Security Management group-permission change's propagation to an already-running IIS worker
  process is inconsistent** — sometimes a change takes effect on the next page load with no
  restart needed, sometimes it doesn't show up until a ServiceHost restart + IIS reset happens.
  Don't assume either way; re-verify the actual current state in the Security Management UI (or a
  fresh script run) after any such change before trusting it took effect, especially right after
  asking the user to make a related SQL change that also triggers a restart for unrelated reasons.

