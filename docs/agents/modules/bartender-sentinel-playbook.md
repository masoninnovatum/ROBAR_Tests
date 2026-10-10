<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: bartender-sentinel-playbook -->

## Driving BarTender/Sentinel native dialogs (playbook)

Read this FIRST before writing FlaUI interaction code for any NEW BarTender Editor action or
dialog, in Template Management or any other module that ends up launching Sentinel/BarTender.
Distilled from the extensive live debugging behind `Create_and_Approve_Template.spec.ts`'s original
Approve/Signature flow and `Get_Data.spec.ts`'s Get Data/Restore flow — both took many iterations to
get right, and the same handful of gotchas caused most of that cost both times. Following this
checklist up front should turn a multi-hour debugging marathon into a first- or second-try success.

**Added 2026-10-02 (two-object label layout work):**
- **To SEE the BarTender canvas, capture the `Workspace` element, not the window.** The "Template
  Editor" top-level window is only the banner strip (action bar); the designer is a child window
  (`<file>.btw - BarTender Designer`) holding the `Workspace` pane. `flaui.screenshot()` can't narrow to
  an element, but the CLI can: `FlaUIAutomation.exe screenshot --process-id <pid> --element-name
  Workspace --out <png>` (the Node wrapper simply doesn't pass `--element-name` through). The capture
  is the label cropped 12px inside the pane on every edge, so image coords + 12 = Workspace coords.
- **Text-object spacing:** a default text box is ~68px tall (Workspace rect 1608x725, standard 4"x2"
  label). With the first object auto-centered, a second object dragged to center -80px overlapped it by
  half a line; **-135px above center (x -150) leaves ~45px of clear space.** Use
  `bartender.secondTextObjectOffset(workspaceRect)` (support/bartender.ts) rather than a literal.
- **View > Data Source Names shows each text box's sharename on the label itself** (user's tip,
  verified live 2026-10-02). The menu item is named `Data Source Names<TAB>F12` (shortcut text is part
  of the name; `flaui.click` matches by substring, `controlType: 'MenuItem'`) and it is a TOGGLE.
  `bartender.captureDataSourceNames(page, pid, outPath)` turns it on, captures the `Workspace`
  canvas, and turns it back off. The user wants this screenshot as evidence in UATs and formal test
  scripts after a template is created.
- **The Sentinel launch prompt click needs the browser in the FOREGROUND.** `clickAt` is a real
  SendInput click on whatever window is topmost at that pixel; with Slack/Word/etc. in front it "succeeds"
  against the wrong window and "Open SentinelLauncher?" never closes (failed 3x in a row after working
  all morning). `confirmSentinelLaunchPrompt` now calls `bringWindowToForeground` before every attempt.
- **Launching `BarTend.exe` standalone is NOT a shortcut here:** it opens fine
  (`C:\Program Files\Seagull\BarTender 2022\BarTend.exe <file.btw>`, Designer window ~16s later), but
  neither FlaUI nor raw Windows UI Automation can see that window (0 elements for its pid, neither
  process elevated) -- so nothing can drive it. Use the Template Management launch path instead.

**1. Ground every selector in a real dump-tree before writing any interaction code.** Don't guess
control names from a formal test script's prose or from a screenshot alone — get the actual
process id (`list-processes --name-contains bartend`) and dump the KNOWN-reachable top-level window
(`--title "Template Editor"`, generous `--max-depth` like 15-20, redirected straight to a file) while
the new dialog is open on screen. Read the file directly rather than relying on secondhand
descriptions of what's on screen.

**2. Assume any dialog opened by a BarTender button click is a NESTED CHILD WINDOW, never a real
top-level window** — even if it visually has its own title bar and close button (confirmed
misleading for Get Data, and already known for Signature Required/Text Properties/the Change Data
Source Name Wizard). Concretely:
- `title: '<the dialog's own name>'` will not resolve it — `FindWindow`'s top-level enumeration
  doesn't see it.
- Reach its controls via `elementAutomationId: '<the dialog's own AutomationId, from the dump>'`
  passed alongside `title: 'Template Editor'` (or whatever the real top-level window is) on
  `click`/`getProperty`/`setText`. Prefer this over `elementName` — a bare `elementName` search has
  been observed to time out unpredictably (a `NoClickablePointException`-adjacent failure) rather
  than resolve or fail cleanly, for reasons not fully understood.
- `dumpTree`/`screenshot` do NOT support `elementName`/`elementAutomationId` nested scoping at all
  (only `click`/`getProperty`/`setText` do) — there is no way to directly dump or screenshot a
  nested dialog by itself. Always target the nearest resolvable top-level-ish window instead and
  read the nested subtree out of that dump.
- A `processId`-only `dumpTree`/`screenshot` (no `title`) has been confirmed to consistently return
  empty/nothing for this multi-window BarTenderEdit process. Always pass an explicit `title`
  (`'Template Editor'` is the one every existing click in this suite already scopes by).
- **Confirmed exception (Template Editor's `PDF` button, 2026-09-30): not every dialog opened by a
  BarTender button click is nested inside the known window at all** — some hand off to a genuinely
  separate top-level process (PDF hands off to the system's own PDF viewer, e.g. Adobe Acrobat
  Reader, as its own process, and a crash it triggered showed up as a THIRD, unrelated top-level
  window). A `title`-scoped `dumpTree` of `'Template Editor'` showed literally no change at all after
  the click — looked exactly like a no-op. Before concluding a click did nothing, widen to a plain
  Win32 `EnumWindows` (a quick ad-hoc PowerShell/.NET P/Invoke snippet, not FlaUI) across ALL visible
  top-level windows, not just a deeper/wider dump of the window you already know about.

**3. Pick the click method deliberately, don't wait to hit a hang.** Default to `method: 'mouse'`
for ANY button that submits, confirms, or opens another dialog — i.e. anything whose click handler
plausibly does real work synchronously. Reasoning: the default click method (UI Automation's
`InvokePattern.Invoke()`) is itself a blocking synchronous COM call that hangs until the handler
returns, and a handler that does real synchronous work (shows a modal dialog, writes data) never
returns until that work is done. **`method: 'win32'` (raw `SendMessage(BM_CLICK)`) is JUST AS
SYNCHRONOUS and will hang identically** — it looks like it should help (it needs no
screen-coordinate resolution, so it seems like a good fix for a `NoClickablePointException`) but
it isn't a fix for a blocking-handler problem, only for a point-resolution problem specifically.
Only `method: 'mouse'` (real `SendInput`, fire-and-forget regardless of what the handler does) is
safe for this whole category of button. Confirmed true for Approve/Submit (original file) and Get
Data/Submit (this file) independently — treat it as the default assumption for any new
submit/confirm-style button, not a fallback to reach for after failing twice.

**4. Always pass `automationId` alongside `name` when you have it**, even for a plain (non-nested)
click. `FindControl` tries `ByAutomationId` first and returns immediately if it matches, skipping
the slower/riskier by-name fallback path entirely.

**5. Never target an individual `DataGridView` CELL by name.** A bare `--name` search against a
WinForms `DataGridView`'s individual virtualized/MSAA-bridged cell elements (e.g. an `[Edit]`-typed
cell like `"Item Number Row 0, Not sorted."`) has been confirmed to hang FlaUI's
`FindFirstDescendant` outright, regardless of how narrowly the search root is scoped (tried both the
whole containing dialog and the grid's own small subtree directly — identical hang either way). If a
specific row/cell genuinely must be clicked, use `clickAt` against the GRID CONTAINER's own
resolvable AutomationId (read its `BoundingRectangle` via `getProperty` first, then compute a pixel
offset — a standard WinForms header height (~23px) plus half a row height (~11px) is a reasonable
starting guess) rather than searching for the cell by name. Also worth checking first: does the row
actually need clicking at all, or is it already selected by default? (It was, for Get Data — the
"needs a row click" theory turned out to be based on unrelated scoping bugs, not a real requirement.)

**6. If raising `retrySeconds` reproduces the IDENTICAL error text, that's proof of a real hang, not
evidence more time would help — stop bumping the number.** `FlaUIAutomation.exe`'s own retry loop
(`PerAttemptTimeout` in `Program.cs`) caps every single sub-attempt at a hard 15 seconds internally
regardless of the `--retry-seconds` budget passed in, and `TryWithTimeout`'s `Task.Wait(timeout)`
never cancels the underlying task when it times out — a genuinely-stuck call just keeps its thread
running in the background while the retry loop starts another one. A truly slow-but-eventually-
succeeding search benefits from a bigger budget; a hung one produces the exact same failure at 20s
and at 90s. Confirm which one you're looking at (same error text = hang) before deciding whether to
widen a timeout or fix the underlying scoping/method/target instead.

**7. Strip out diagnostic scaffolding once a flow is confirmed working.** Dump-tree/screenshot
captures on every step are essential while bootstrapping a new dialog (each one is a separate
`FlaUIAutomation.exe` process launch, and skipping them is exactly why a passing test can still feel
slow), but they're pure overhead once selectors are proven. Replace them with one cheap, meaningful
assertion if one exists (e.g. a `getProperty` check that a button's `IsEnabled` state actually
flipped as a result of the action, proving it had a real effect — not just that the click didn't
throw). Relatedly: never let a `try/catch` swallow a real failure into a `console.log` only — use
`try/finally` if diagnostics-on-failure are still wanted, but let genuine errors propagate. A
"passing" test must mean the thing actually worked, not that every step silently no-opped.

**8. `method: 'mouse'` vs `'win32'` are NOT interchangeable "safe" alternatives to the UIA default —
each fails a different way, and picking wrong can crash the whole app, not just hang.** Distilled
2026-09-30 from `Create_and_Approve_Template.spec.ts`'s Approve/Signature-Required flow (the
deepest debugging in this whole suite — three misdiagnoses before the real root cause, see that
file's own inline comments for the full narrative, condensed here):
- The default click (`InvokePattern.Invoke()`) and `method: 'win32'` (`SendMessage(BM_CLICK)`) are
  **both fully synchronous** — they block until the target's click handler returns. For a button
  whose handler does real synchronous work (opens a modal dialog, submits data, tears down the
  process), neither ever returns until that work finishes — indistinguishable from a genuine hang
  from the caller's side, EXCEPT that `BM_CLICK` on a handler that closes/crashes the app mid-call
  can bring down the whole target process instead of just hanging (confirmed live: BarTenderEdit's
  Approve button crashed outright under `win32`, raw COM error `0x80040201`, process gone).
- `method: 'mouse'` (real `SendInput`, a genuine synthesized OS-level click) is the only
  fire-and-forget option — it returns immediately regardless of what the handler does, because it
  isn't a blocking call INTO the handler at all, just an OS input event. **Default to `mouse` for any
  button that submits, confirms, opens another dialog, or closes a window/tab/process** — this
  generalizes item 3 above with a concrete crash case, not just a hang case.
- **`setText`/read-back for these legacy WinForms controls is separately unreliable via UI
  Automation** (`ValuePattern`), independent of the click-method issue — confirmed live: a write
  reported success but the field stayed empty, and this survived two other misdiagnoses (a
  stale-cache read-back bug, then over-inflating `retrySeconds` to compensate) before the real fix:
  pass `method: 'win32'` on `setText` itself (raw `WM_SETTEXT`/`WM_GETTEXT`), the same technique
  legacy-automation tools like AutoIt use for exactly this class of app. This ALSO fixes verifying a
  masked password field — UIA's `Value` property always reads back `null` for a password box (by
  design, the OS hides it), but `WM_GETTEXT` doesn't have that limitation, so `verify: true` becomes
  usable there too once `method: 'win32'` is in play.
- **A dialog's fields can have BLANK accessible names** even when a `Static` label sitting next to
  them (e.g. "User:", "Password:") makes them look nameable — confirmed for BarTender's own
  Signature Required dialog (`txtUser`/`txtPassword` Edit controls have empty `Name`, the readable
  text is a separate sibling `Static` element). `automationId` alone must carry the match in that
  case; a `name` passed alongside it is then just a readable placeholder in the code, not something
  `FindControl` actually needs.
- **The same numeric `automationId` (e.g. `"1"`) is commonly reused across DIFFERENT nested dialogs**
  for their own default button (OK in one, Close in another) — a generic Win32 convention, not a
  collision bug. This is exactly why item 2's `elementName` scoping (to the specific dialog the
  button lives in) matters even when `automationId` alone looks unambiguous enough.

**9. When debugging a NEW BarTender interaction, launch BarTender standalone instead of driving the
whole web-menu round trip every iteration.** BarTender is just a third-party desktop app
(`C:\Program Files\Seagull\BarTender 2022\BarTend.exe`) — it doesn't need Sentinel, the ROBAR web
menu, or a GetFileToken round trip to open; `Start-Process BarTend.exe "<path-to-a-.btw-file>"`
opens it directly against any template file (a scratch copy of the shared `NewTemplate.btw` base is
a safe starting point, so nothing shared gets modified). The resulting window's title is simply
`"<filename> - BarTender Designer"` (no `"Template Editor"` wrapper — that wrapper is an
Innovatum/Sentinel-specific layer, absent here) and its whole control structure (Workspace, the
Arrange toolbar, the Menu Bar, etc.) is otherwise identical to what the wrapped version exposes, so
findings transfer directly. This is exactly how the `addTextObjectBoundToSharename` right-click fix
below was found and validated — several fast dump-tree/click/screenshot iterations directly against
a standalone `BarTend.exe` instance, with no login/create-template/Sentinel-prompt overhead per
attempt, then ported into `bartender.ts` and confirmed once, end-to-end, through the real web-menu
flow to prove it holds in production context. Prefer this whenever iterating on a specific
in-BarTender interaction; save the full web-menu round trip for final confirmation, not every
attempt along the way.
- One real gotcha hit this way: saving a modified template standalone (`Ctrl+S`, or the Main
  toolbar's own `Save` button — which has no distinguishing `automationId` in this window, unlike
  the Sentinel wrapper's own `btnSave`) can pop a **"Save Warning"** dialog (format/compatibility
  confirmation) that FlaUI's own `dumpTree`/`click` calls, scoped either by title or by processId
  alone, couldn't resolve or even enumerate (calls hung rather than erroring) — while raw Win32
  `EnumWindows` (a quick ad-hoc PowerShell/.NET P/Invoke snippet) found it immediately, confirming
  it really was open and blocking, not a phantom. Since the dialog reliably has OS input focus the
  moment it appears, a plain `sendKeys(['RETURN'])` (which targets whatever currently has focus, not
  a specific resolved element) dismissed it cleanly where every FlaUI-resolved-target approach had
  failed. Worth trying first for any similarly "unresolvable but definitely open" native dialog.

**10. `flaui.listProcesses()` silently filters to ONLY processes with a non-empty `MainWindowTitle`
at query time** — confirmed via `FlaUIAutomation`'s own source (`Program.cs`'s `CmdListProcesses`:
`.Where(p => p.mainWindowTitle.Length > 0)`), not documented anywhere in the CLI's own JSON output.
A just-spawned process whose window hasn't acquired a title yet (or is taking unusually long to,
e.g. under real-world resource contention after many hours of repeated launches) is **completely
invisible** to this call no matter how long or how many times you poll it — there is no way to tell
"genuinely never launched" apart from "launched fine, just titleless so far" through this call alone.
Real incident (2026-09-30): Sentinel Tray's own log confirmed `Innovatum.Sentinel.Plugin.
BarTenderEdit.exe` launched successfully and passed its own WCF `isAlive` handshake with a real PID
on every attempt, yet `listProcesses()` — polled for over 2 minutes — never found it, sending the
debugging effort down several wrong paths (suspecting Sentinel Tray itself, session timeouts, etc.)
before the title-filter was found in source. **Fix for detecting a process purely by name,
independent of whether it has a window/title yet: shell out to `Get-Process -Name '<name>'`
directly** (e.g. via Node's `child_process.execFile('powershell.exe', [...])`) rather than relying
on this tool's own `list-processes` command for that specific question.

**11. `clickAt`'s synthesized mouse click (`SendInput`) can report success while the click lands on
a COMPLETELY DIFFERENT window** — confirmed live 2026-09-30, three times in a row. `clickAt`
resolves a target element's on-screen coordinate correctly and reports a genuine successful
click (`clickedAt: true`, with the exact right coordinate inside the target's own bounding
rectangle) — but `SendInput` dispatches to whatever window is PHYSICALLY topmost at that real
screen pixel at the moment the click fires, regardless of which window FlaUI logically resolved
the coordinate from. If some other window on the desktop (a terminal, a scratch file viewer, an
editor — anything left open from other work happening on the same machine) happens to be covering
that exact screen region, the real click goes there instead, and FlaUI has no way to know or report
this — it only knows it successfully dispatched an input event at coordinate (X, Y), not what
actually received it. This silently broke the "Open SentinelLauncher?" confirm click specifically
(a before/after `dumpTree` showed the dialog completely unchanged despite three consecutive
"successful" clicks), costing significant debugging time chasing session-timeout and process-
detection theories before this was found. **Fix: force the target window to the foreground (a raw
Win32 `SetForegroundWindow`, e.g. via a small ad-hoc PowerShell/.NET P/Invoke snippet) immediately
before any `clickAt` call, and don't trust `clickedAt: true` alone — verify the expected UI change
actually happened afterward** (e.g. re-`dumpTree` and confirm the dialog/element is actually gone),
the same "don't trust the click result, verify the real effect" lesson already learned elsewhere in
this playbook (item 7), now confirmed to apply to `clickAt` specifically, not just click-method
choice. This is a strong argument for the Claude Code /Claude Desktop window itself, terminal panes,
or other tool windows being fully minimized or moved off-screen during any long unattended run of
native-automation tests — anything left visible on top of the target app is a real risk, not just
cosmetic.
- Combined with item 10 above and the already-documented WebMenu session-timeout bug (see
  "WebMenu-wide issues" — `RefreshTimeout()` only resets on a literal `mousemove`, never fires
  reliably from inside a nested iframe), these three issues together fully explain a multi-hour
  debugging session (2026-09-30) chasing what first looked like session timeouts, then process-
  detection gaps, before the real root cause (the click itself never landing) was found via a
  targeted before/after `dumpTree` around a single isolated click — a useful diagnostic pattern to
  reach for earlier next time full end-to-end reruns aren't converging: isolate the ONE step in
  question into its own minimal script rather than re-running the whole expensive flow repeatedly.

### Launching Sentinel/BarTender itself (the step before any of the above applies)
Every Template Management flow that opens BarTender (Create New Template, Replace Template, Save As
New) fires the identical launch sequence first — distilled 2026-09-30 from
`tests/support/bartender.ts` (the current, proven, reusable extraction) and
`Create_and_Approve_Template.spec.ts`'s own inline history (the original, more narrated source; kept
intentionally untouched so its proven mechanics can't be broken by changes elsewhere):
- Submitting the dialog fires `GetFileToken`, whose response navigates a hidden `#sentinelFrame` to
  an `innoclient:` custom-protocol URL — this triggers Chromium's own native, unstyled "Open
  SentinelLauncher?" confirm-external-app dialog. **Not a JS dialog** — `page.on('dialog')` never
  fires and Playwright has no API for it; everything from here on is real desktop UI Automation via
  `scripts/flaui_bridge.js`.
- That dialog is **not a separate top-level window** — it's a Chromium Views bubble (`ClassName
  "RootView"`, titled `"Open SentinelLauncher?"` — no space, with the `?`) nested INSIDE the
  browser's own top-level window. A `--title` scoped search (`FindWindow`'s top-level enumeration)
  never finds it and just hangs to timeout; the fix is scoping by the browser's own `--process-id`
  alone, letting `FindControl` reach the nested bubble as a descendant.
- Resolving that PID needs real disambiguation, not just a page-title match — confirmed live that a
  machine can have a genuine second Chrome window open to the exact same page title as Playwright's
  own browser. Playwright's bundled browser identifies itself with `"for Testing"` in its window
  title; require both the page's own title AND that substring before trusting a process match.
- Clicking that dialog's own confirm button (`"Open SentinelLauncher"`, no space before "Launcher",
  `ClassName MdTextButton`) needs `clickAt` (a real synthesized mouse click at screen coordinates),
  not a plain UIA `click` — a plain `click` visibly highlights the button (so it LOOKS like it
  worked) but never fires Chromium's real click handler for this specific external-protocol-confirm
  button, plausibly a deliberate anti-automation safeguard on Chromium's part. Even `clickAt`
  reporting success isn't proof — dump the tree after each attempt and keep retrying until the
  dialog text is actually confirmed gone, rather than trusting a "dispatched successfully" result.
- Finding the spawned BarTender/Sentinel process (`Innovatum.Sentinel.Plugin.BarTenderEdit.exe`,
  window title `"Template Editor"`) needs a **process snapshot taken BEFORE confirming the launch
  prompt** — timing-sensitive: snapshot too late and the new process may already exist in both the
  "before" and "after" pictures by the time you diff, so `diffNewProcesses` finds nothing and the
  search spins for its whole attempt budget with no error at all. Falls back to a plain name search
  of the current snapshot (matching `/bartend|sentinel/i`) so a leftover process from an earlier
  interrupted run doesn't permanently block this step.
- Window existing ≠ BarTender ready — gate on `IsEnabled` for the "Text" MenuItem (see below for why
  it must be typed as `MenuItem`, not matched by name alone) with a real `retrySeconds` poll INSIDE
  one `getProperty` call (`{ attempts: 1 }` on the JS retry wrapper) rather than stacking a JS-level
  retry loop on top — each `FlaUIAutomation.exe` invocation has its own ~8s process-startup overhead,
  and stacking retries multiplies that against the JS attempt count, easily blowing past a test's own
  timeout budget on a genuine failure while a single internal `retrySeconds` poll stays cheap (one
  process, one COM connection, a plain `Thread.Sleep` between internal attempts).

### Adding a Text object and binding its data source (Create New Template / Save As New / Replace flows)
Also distilled 2026-09-30 from the same source pair — the sequence every "add content to a fresh
BarTender template" flow shares:
- **"Text" (the object-creation command) must be targeted as a `MenuItem`, not matched by name
  alone** — this window has an unrelated, same-named docked toolbar GROUP also called "Text";
  `controlType: 'MenuItem'` is what disambiguates the two.
- The flyout item you actually want ("Normal," under "Basic Text Objects") **cannot be clicked by
  name at all** — confirmed via a live dump-tree taken while the flyout was visibly open on screen:
  it appears nowhere in the UI Automation tree, not as a top-level window, not as a descendant,
  across a full 2-minute polling window. This custom toolkit (Xtreme Toolkit Pro/XTP) apparently
  doesn't expose this popup's items to UI Automation at all — not a timing problem, a structural
  one. Fix: send a raw `Enter` keypress (global OS keyboard input, no element lookup) — "Normal" is
  the default/first item and already has keyboard focus right after the flyout opens.
  **General lesson**: if a dump-tree taken WHILE something is visibly open on screen still shows
  nothing, stop looking for a better selector — the control likely isn't exposed to automation at
  all, and a keyboard-input fallback (or a coordinate-based one, below) is the real fix.
- Placing the object is a **click-AND-DRAG, not a single click** — a plain click creates the object
  but positions it wrong. The drag's from/to points must be computed from the "Workspace" pane's own
  live `BoundingRectangle` (via `getProperty`), not a fixed pixel offset from its top-left corner —
  Workspace is a much larger scrollable MDIClient area than the visibly-centered label within it, and
  the label's actual on-screen position inside that pane depends on zoom/scroll state that varies
  per run. A small drag near the rectangle's own center reliably lands on the label, since BarTender
  opens a new template zoomed-to-fit and centered in this pane.
- **Centering uses BarTender's own native "Center Horizontally/Vertically On Template" Arrange
  commands, not pixel-offset math** — a measured/computed placement correction was tried first and
  stayed fragile (tied to that specific template's size/zoom, still visibly off on a later run); the
  native commands center the already-selected object exactly, with no math at all.
- **The placed object itself ("Sample Text") is NOT a real UI Automation element — it isn't
  queryable by name or found by dumping the canvas, because the canvas control itself
  (`AfxFrameOrView140u`) has ZERO child elements.** Every object BarTender draws on a template is
  just rendered pixels, never a real UIA node — every attempt to find/right-click/read-the-rect-of
  "Sample Text" by name is doomed regardless of retry budget, which is the actual reason this
  particular step kept silently hanging/failing before the real cause was found (not a click-target
  precision problem). Fix: right-click via real screen coordinates on "Workspace" itself (which DOES
  exist as a real element) — once the object has been centered via the native Arrange commands
  above, its own center coincides with Workspace's own center, so no extra coordinate offset is
  needed at that point.
- **Text Properties, and everything inside it (the Change Data Source Name Wizard), are NESTED
  windows** — descendants of "BarTender Designer," not separate top-level desktop windows — so
  `title` scoping never resolves them; use `elementName` scoped to the dialog's own name instead
  (same rule as playbook item 2 above, reconfirmed here independently).
- The bound sharename must be a real, DB-defined one (e.g. `I_Num`) — an arbitrary/randomized string
  does not work here the way a randomized template NAME does elsewhere in the same flow.

### Reading a `.btw` file's own sharename bindings directly (no BarTender needed)
Reverse-engineered 2026-09-30 while preparing for upcoming multi-sharename testing (multiple text
objects per template, each bound to a different sharename) — the user asked whether `.btw` files
could be examined directly, and it turned out yes, with real value: **this gives a way to verify
which sharenames are actually bound in a saved template by reading the file itself, instead of
relying solely on live FlaUI/UI checks** (which, per the click-precision gap just above, aren't
fully reliable yet for this exact purpose).

**File structure**: a `.btw` is NOT single-format — it's three parts concatenated: (1) a plain-text
header (readable as-is, includes an XML `<Metadata>` block — Author/Company/TemplateSize/Printer/
etc.), (2) an embedded PNG thumbnail image (find its end via the last `IEND` chunk marker — a file
can contain more than one `IEND`-looking byte sequence, so a robust search should scan for it
positionally rather than trusting the first hit), (3) a zlib-deflate-compressed block holding the
actual document object model, whose text is UTF-16LE. **Don't naively grab the first successful
zlib inflate in the file** — the embedded PNG's own IDAT chunks are ALSO zlib-compressed and can
produce a "successful" but meaningless inflate of pixel data if the scan starts before the PNG
actually ends; skip past the last `IEND` first, then start the zlib-header (`78 9C`/`78 DA`/`78
01`/`78 5E`) scan from there.

**Confirmed byte layout for a plain Text object's sharename binding** (reverse-engineered against
two already-known-correct answers in `A1SuperTemplate_v0.btw`, confirmed via the existing
"I_Num" documentation): the literal UTF-16LE string `"Data Source"` (11 chars) is immediately
followed by a **fixed 12-byte / 6-UTF16-code-unit binary preamble** (flags/type/size fields, not
text — includes what looks like a UTF-16 BOM but isn't one), then the actual sharename as a plain
**null-terminated UTF-16LE string**. The owning object's own internal auto-generated name (e.g.
`"Text 4"`, `"Text 13"`) appears as readable text earlier in the same region, useful as a label but
not load-bearing for the parse itself.

**Tool**: `ROBAR_Tests/scripts/inspect-btw.ps1` (`-path <file>`) implements this — lists every
`Data Source` binding found, labeled by its owning object's internal name. Confirmed working
against the whole existing template library in
`OneDrive - Innovatum, Inc\Desktop\Attachments and Upload Files\Templates\`:
- **`A1SuperTemplate_v0.btw`, `A1SuperTemplateUSERIAL_v0.btw`, `MTA1_BT2022.btw`**: two bindings
  each, `Text 4 -> I_Desc` and `Text 13 -> I_Num` — genuinely already-existing, ready-to-use
  multi-sharename examples for the upcoming testing, no new template needed to see the pattern.
- **`MTSummary2022_v0.btw`**: two bindings, `Text 4 -> S_TEMPLATE` and `Text 13 -> I_Num`.
- **`MTDX1_BT2022_v0.btw`, `MTLotTemp_v0.btw`, `PromptTest.btw`**: 0 bindings found — either these
  genuinely use no plain-Text sharename bindings, or (less likely, not yet ruled out) the
  zlib-stream-selection heuristic picked the wrong block for these specific files.
- **`MTLanguagesTemp_v0.btw`, `MTLHI01_v0.btw`**: partial resolution only — one plain Text binding
  resolved correctly (`I_Desc`), but Barcode objects and `prompt<Question={...}>`-style dynamic
  tokens (per the Dictionary Management section's own note on this syntax) don't fit the same
  fixed-12-byte-preamble assumption and come back unresolved (`?`). **Known gap, not yet fixed** —
  worth a closer look if a future test specifically needs to verify a barcode or prompt-field
  binding this same way, but plain Text objects (the case that matters for the described upcoming
  multi-sharename testing) resolve reliably.

### Get Data / Restore — see the Template Management section's own "Get Data is a nested BarTender
dialog" writeup for the full debugging trail (nested-window scoping, the two dead ends, the
final working sequence); not repeated here to avoid duplicating it. One fact from that same test
worth surfacing here since it's a general cross-module gotcha, not BarTender-specific: an
unapproved, never-submitted-to-workflow template already shows up as a selectable option in Campaign
Manager's own Create-Item Template dropdown by name — no approval is required for a template to
become usable there. Don't assume Template Management's own "Approved"/"Effective" gates (which DO
control printing eligibility) also gate simple selectability elsewhere in the app.

---

