// Creates a new template in Template Management and uploads its .btw file.
// Consolidated from the exploratory step-by-step scripts in archive/ (template_test_1..5) into
// the single working flow they converged on (formerly template_test_6_full.js).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD, TEMPLATE_NAME } from '../support/robar';
import * as flaui from '../../scripts/flaui_bridge';

test('create a new template and upload its file', async ({ page }) => {
  // The default 120s test timeout (playwright.config.ts) is too tight once FlaUI is driving
  // BarTender -- observed live (2026-09-11) that BarTender's own startup alone can take a while
  // after its wrapper window first appears, and the retry budgets below are sized around that.
  // Bumped again (2026-09-12) after confirming live that the Signature Required dialog's fields
  // can each take on the order of 1-2 real minutes to become interactive -- the User/Password/
  // Submit steps alone now budget up to 180+90+90=360s worst case if every one needs its full
  // retry window, on top of everything before them.
  test.setTimeout(900_000);

  await login(page);

  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  await frame.click('#drpMainActions');
  await page.waitForTimeout(500);
  await frame.click('#actCreateTemplate', { force: true });
  await page.waitForTimeout(1000);

  // ROBAR_TEMPLATE_NAME (seed.ts / .env) overrides this; unset generates a random name each run.
  const templateName = TEMPLATE_NAME || 'MBFlaUITest' + Math.floor(Math.random() * 100000);
  await frame.fill('#txtTemplateName', templateName);
  await frame.fill('#txtDescription', 'Created via automated Playwright test');
  await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
  await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
  await page.waitForTimeout(500);

  const [createResponse, tokenResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
    frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
  ]);

  const createBody = await createResponse.json();
  const tokenBody = await tokenResponse.json();
  expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
  expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

  // At this point launchEditor(token) (archive/create_template_dialog.html:2300-2307) has already
  // fired as a side effect of the GetFileToken response above:
  // $("#sentinelFrame").attr("src", "innoclient:" + token). That navigates a hidden iframe to a
  // custom protocol, which triggers Chromium's native "Open Sentinel Launcher?" external-protocol
  // dialog. This is NOT a JS dialog -- page.on('dialog') never fires for it, and Playwright has no
  // API for it at all. From here FlaUI (scripts/flaui_bridge.js -> FlaUIAutomation.exe, see that
  // project's CLAUDE.md/Program.cs) drives the desktop UI Automation tree directly.
  //
  // Everything below the confirm-dialog step is transcribed from a real, previously-executed
  // session against this exact flow (screenshots + dump-tree captures under
  // C:\Users\Mason\FlaUIAutomation\run3_*.png and tree_*.txt) -- control names are load-bearing,
  // not guessed, EXCEPT the two spots flagged inline where no live dump-tree of that exact moment
  // was captured. If either of those misses, re-run with a `dump-tree`/screenshot at that step to
  // get the real name and fix the call -- don't just retry blindly.
  // Snapshot processes BEFORE confirming the launch prompt -- taking this "before" picture any
  // later (a bug in an earlier version of this test) risks the Sentinel/BarTender process already
  // existing in BOTH snapshots by the time you diff, since launching happens fast, which makes
  // diffNewProcesses find nothing and the next step spins forever with no error.
  const beforeLaunch = await flaui.listProcesses();

  const browserPid = await test.step('resolve Playwright\'s own browser process id', async () => {
    // Playwright's public Browser type has no .process()/pid accessor (only BrowserServer and
    // Electron's ElectronApplication expose that) -- confirmed via node_modules' own type defs,
    // not an oversight. Resolve the real OS process by listing candidates and disambiguating by
    // window title instead.
    //
    // Confirmed live (2026-09-11): matching on page title alone is NOT enough -- this machine had
    // a real personal Chrome window open to the exact same page title ("Innovatum Web Menu Login -
    // Google Chrome") at the same time as Playwright's own browser ("... - Google Chrome for
    // Testing"), and the first version of this check picked the wrong one, which is why the whole
    // flow silently hung waiting on a dialog in the wrong process. Playwright's bundled browser
    // identifies itself with "for Testing" in its window title -- require both.
    const pageTitle = await page.title();
    const candidates = await flaui.listProcesses('chrom'); // matches chrome.exe/chromium regardless of channel
    const browserProcess = candidates.find(
      (p: { mainWindowTitle: string }) => p.mainWindowTitle.includes(pageTitle) && p.mainWindowTitle.includes('for Testing')
    );
    if (!browserProcess) {
      throw new Error(
        `Could not find Playwright's own browser process (looked for a "chrome ... for Testing" window titled "${pageTitle}") -- ` +
          'required to safely scope the native-dialog lookup (flaui_bridge.js SAFETY note: never match by --title alone on a shared desktop).'
      );
    }
    return browserProcess.pid;
  });

  await test.step('confirm the native "Open SentinelLauncher?" prompt', async () => {
    // Confirmed live via dump-tree (2026-09-11): this prompt is NOT a separate top-level window --
    // it's an owned child window (a Chromium Views bubble, ClassName "RootView", titled
    // "Open SentinelLauncher?" -- no space, with a "?") nested inside the browser's own main
    // window in the UI Automation tree. wait-window/click's FindWindow only enumerates true
    // top-level desktop windows, so scoping by --title "Sentinel" (an earlier version of this
    // test) never finds it and just hangs until timeout. Fix: scope by --process-id ALONE (the
    // browser's own top-level window) -- FindControl then finds the button as a descendant of
    // that window, nested dialog included. Button name confirmed via the same dump-tree: "Open
    // SentinelLauncher" (ClassName MdTextButton, no space before "Launcher").
    //
    // There's no "wait for a nested control" command in this CLI (only wait-window, which is
    // top-level-only) -- retry the click instead to give the bubble time to render.
    //
    // Confirmed live (2026-09-11): a plain `click` (InvokePattern) visibly focuses/highlights this
    // button but never fires Chromium's real click handler -- the dialog just sits there. Plausible
    // this specific button (it confirms launching an arbitrary external app) deliberately ignores
    // synthetic AT invocation as a safeguard. Fix: use clickAt for a genuine synthesized mouse
    // click at real screen coordinates instead of a UIA invoke -- offsetX/offsetY are a
    // conservative inset (not the exact center, which isn't known without querying
    // BoundingRectangle -- get-property doesn't expose that property today) chosen to safely land
    // inside a button wide enough to render "Open SentinelLauncher" at normal dialog-button size.
    let clicked = false;
    for (let attempt = 0; attempt < 20 && !clicked; attempt++) {
      const result = await flaui.clickAt({ processId: browserPid, name: 'Open SentinelLauncher', offsetX: 20, offsetY: 14 });
      if (!result.error) {
        clicked = true;
      } else {
        await page.waitForTimeout(500);
      }
    }
    if (!clicked) {
      throw new Error(
        'Never managed to click "Open SentinelLauncher" -- either the prompt never appeared, or ' +
          'Chromium changed its control name/structure. Re-run dump-tree --process-id <browserPid> ' +
          '--max-depth 12 while the prompt is showing to check.'
      );
    }
  });

  const bartenderPid = await test.step('find the BarTender process Sentinel launches', async () => {
    // Confirmed live (2026-09-11): the real process is "Innovatum.Sentinel.Plugin.BarTenderEdit",
    // window title "Template Editor". Prefer diffing against the pre-launch snapshot (robust to a
    // process that was already running before this test started, e.g. a leftover from a prior
    // interrupted run); fall back to a plain name search of the current snapshot so a stale
    // leftover instance doesn't leave this step unable to ever find anything.
    let found: number | undefined;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      await page.waitForTimeout(1000);
      const after = await flaui.listProcesses();
      const spawned = flaui.diffNewProcesses(beforeLaunch, after);
      const newMatch = spawned.find((p: { pid: number; name: string }) => /bartend|sentinel/i.test(p.name));
      const anyMatch = after.find((p: { pid: number; name: string }) => /bartend|sentinel/i.test(p.name));
      if (newMatch) found = newMatch.pid;
      else if (anyMatch) found = anyMatch.pid;
    }
    if (!found) {
      throw new Error('BarTender/Sentinel process never appeared after confirming the launch prompt.');
    }
    return found;
  });

  // Retries `action` until it resolves without an `.error` field, or throws with the last error
  // once `attempts` is exhausted. Every flaui_bridge call resolves (never rejects) even when the
  // CLI fails to find its target -- confirmed live (2026-09-11): earlier versions of this test
  // called flaui.rightClick/click without checking this at all, so a failed step (BarTender not
  // yet ready, a wrong control name) silently did nothing and every step after it quietly no-opped
  // too, all the way through to a meaningless final Save. This also absorbs BarTender's slow,
  // variable startup time -- observed live to sometimes still be initializing its toolbars well
  // after the wrapper window itself is already showing.
  async function untilValue<T extends { error?: string }>(
    description: string,
    action: () => Promise<T>,
    { attempts = 30, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {}
  ): Promise<T> {
    let lastError: string | undefined;
    for (let i = 0; i < attempts; i++) {
      const result = await action();
      if (!result.error) return result;
      lastError = result.error;
      await page.waitForTimeout(delayMs);
    }
    throw new Error(`Gave up after ${attempts} attempts: ${description}. Last error: ${lastError}`);
  }

  // Same retry semantics as `untilValue`, for calls whose return value isn't needed.
  async function until(
    description: string,
    action: () => Promise<{ error?: string }>,
    opts?: { attempts?: number; delayMs?: number }
  ): Promise<void> {
    await untilValue(description, action, opts);
  }

  await test.step('configure the template in BarTender via FlaUI', async () => {
    // Wrapper window "Template Editor" (AutomationId BarTenderBanner) hosts the real
    // "<file>.btw - BarTender Designer" MDI child plus the wrapper's own Save/Get Data/Approve
    // action bar (tlpActions) -- confirmed via FlaUIAutomation/tree_textmenu.txt.
    await flaui.waitWindow({ processId: bartenderPid, title: 'Template Editor', timeoutSeconds: 60 });

    // -- Wait for BarTender to actually finish loading, not just for its window to exist --
    // Confirmed live (2026-09-11): the "Text" MenuItem click can succeed (control found, Invoke
    // doesn't throw, flyout even opens) WHILE BarTender is still mid-startup, which is too early --
    // whatever the app is still doing in the background then interferes with what follows. Gate on
    // IsEnabled specifically for the disambiguated "Text" MenuItem (not the same-named toolbar
    // GROUP -- see FindControl's comment), which should only report true once BarTender's own UI
    // considers itself ready to accept this action, not merely present in the tree.
    // Confirmed live (2026-09-12): retrying this via repeated fresh FlaUIAutomation.exe
    // invocations (the old `until` JS-level loop, up to 90 of them) is what actually made this
    // wait slow -- each invocation's own process-startup overhead is wildly inconsistent (measured
    // a ~8s gap between calls meant to be ~300ms apart), and that cost stacks on every retry. Using
    // get-property's own --retry-seconds/--expect-value instead polls inside ONE process (cheap
    // Thread.Sleep between attempts, one COM/UIA connection reused) -- same wait, far less overhead.
    // Every call below that passes its own `retrySeconds` also pins `{ attempts: 1 }` for the same
    // reason: without it, `until`'s default 30 JS-level retries would each re-invoke
    // FlaUIAutomation.exe and re-run that call's full internal retrySeconds wait, so a genuine
    // failure could take attempts * (retrySeconds + ~8s startup) to surface -- long enough to blow
    // past this test's own test.setTimeout budget and get masked as an opaque Playwright timeout
    // instead of `until`'s "Gave up after N attempts: ... Last error: ..." message.
    await until('wait for BarTender\'s toolbar to report ready (Text MenuItem enabled)', () =>
      flaui.getProperty({ processId: bartenderPid, name: 'Text', property: 'IsEnabled', controlType: 'MenuItem', retrySeconds: 90, expectValue: 'True' }),
      { attempts: 1 }
    );

    // -- Add a Text object --
    // "Text" collides by name with an unrelated docked toolbar GROUP also named "Text" in this
    // window (confirmed gotcha, see Program.cs's FindControl comment) -- MenuItem disambiguates.
    await until('click the "Text" object-creation MenuItem', () =>
      flaui.click({ processId: bartenderPid, name: 'Text', controlType: 'MenuItem', retrySeconds: 30 }),
      { attempts: 1 }
    );
    // Confirmed live (2026-09-11): clicking "Normal" by name in this flyout never works, and it's
    // not a timing issue -- a live dump-tree taken while the flyout was visually confirmed open
    // never showed it anywhere (not as a top-level window, not as a descendant of the main
    // window), even across a 2-minute polling window. This custom Xtreme Toolkit Pro (XTP) popup
    // appears not to expose its items to UI Automation at all. Fallback: send a raw Enter keypress
    // (scripts/flaui_bridge.js sendKeys -> FlaUIAutomation's send-keys, global OS keyboard input,
    // no element lookup) -- "Normal" is the first/default item under "Basic Text Objects"
    // (run3_4_after_text_click.png), so it should already have keyboard focus right after opening.
    await page.waitForTimeout(300); // let the flyout finish rendering/taking focus before Enter
    await flaui.sendKeys({ keys: ['RETURN'] });

    // Place it on the canvas. Confirmed live (2026-09-11), two corrections from the first attempt:
    // (1) it's a click-AND-DRAG to define the text object's box, not a single click -- a plain
    // click created the object but positioned it wrong; (2) a fixed pixel offset from the
    // "Workspace" MDIClient pane's top-left landed outside the label entirely, since that pane is
    // a much larger scrollable area than the visibly-centered label -- the label's actual position
    // within it depends on zoom/scroll state, which varies per run. Fix: read Workspace's real
    // BoundingRectangle and drag from-and-to points near ITS CENTER (confirmed to reliably land on
    // the label, since BarTender opens a new template zoomed-to-fit and centered in this pane) --
    // small drag distance so the resulting text box stays a normal, unremarkable size.
    const workspaceRect = await untilValue('read the Workspace canvas BoundingRectangle', () =>
      flaui.getProperty({ processId: bartenderPid, name: 'Workspace', property: 'BoundingRectangle' })
    );
    // Note: Program.cs's BoundingRectangle property echoes System.Drawing.Rectangle's own
    // PascalCase field names (Left/Top/Width/Height) via C# anonymous-object shorthand, same as
    // the existing click-at/right-click commands' own containerRect output -- not camelCase.
    const centerX = Math.round(workspaceRect.value.Width / 2);
    const centerY = Math.round(workspaceRect.value.Height / 2);
    // Rough placement only -- it just needs to land somewhere on the label so the object gets
    // created there; exact position doesn't matter here because it's precisely centered via
    // BarTender's own native Arrange commands right after, instead of pixel-offset guessing.
    await until('drag to place the text object on the label', () =>
      flaui.drag({
        processId: bartenderPid,
        name: 'Workspace',
        fromOffsetX: centerX,
        fromOffsetY: centerY,
        toOffsetX: centerX + 100,
        toOffsetY: centerY + 30,
        retrySeconds: 30,
      }),
      { attempts: 1 }
    );

    // -- Center it precisely on the label --
    // Confirmed live (2026-09-11): an earlier version of this test tried to land the object
    // exactly centered via a measured pixel-offset correction on the placement drag -- fragile
    // (tied to this specific template's size/zoom) and still visibly off on a later run. Far more
    // robust: use BarTender's own "Arrange" toolbar commands (xtpBarRight, confirmed via
    // tree_textmenu.txt), which center the SELECTED object on the template exactly, natively, with
    // no pixel math at all. The object is already selected immediately after being drawn above, so
    // no extra select-click is needed first.
    await until('center the text object horizontally on the template', () =>
      flaui.click({ processId: bartenderPid, name: 'Center Horizontally On Template', retrySeconds: 30 }),
      { attempts: 1 }
    );
    await until('center the text object vertically on the template', () =>
      flaui.click({ processId: bartenderPid, name: 'Center Vertically On Template', retrySeconds: 30 }),
      { attempts: 1 }
    );

    // -- Name its data source --
    // Confirmed sequence (run3_7_context_menu.png -> run3_8_after_properties_click.png ->
    // tree_afterprops.txt -> run3_14_wizard.png -> run3_15_after_ok.png): right-click the placed
    // "Sample Text" object, open Properties, click the Name button next to the Data Source Name
    // field (opens "Change Data Source Name Wizard"), type a name, OK, Close. Each step here
    // depends on the PRIOR step having actually landed (e.g. right-clicking "Sample Text" only
    // works if the text object really got created above), so a failure here is a strong signal to
    // go re-check the placement steps rather than this step's own control names.
    // Confirmed live (2026-09-11): "Sample Text" is NOT a real UI Automation element at all -- the
    // canvas ("AfxFrameOrView140u") has zero child elements; every placed object is just rendered
    // pixels. Every earlier attempt to find/right-click/read-rect-of "Sample Text" by name (center
    // OR border) was doomed regardless, which is the actual reason this step kept silently
    // failing/hanging -- not a click-target precision problem. Fix: skip element lookup entirely
    // and right-click via real screen coordinates on "Workspace" (which DOES exist). Now that the
    // object is precisely centered on the template (via the native Arrange commands above), its
    // own center coincides with centerX/centerY (the template sits centered in Workspace at
    // zoom-to-fit), so no extra offset is needed here the way the old drag-box-midpoint did.
    await until('right-click the placed text object (via Workspace coordinates)', () =>
      flaui.clickAt({
        processId: bartenderPid,
        name: 'Workspace',
        offsetX: centerX,
        offsetY: centerY,
        button: 'right',
        retrySeconds: 30,
      }),
      { attempts: 1 }
    );
    await until('click "Properties..." in its context menu', () =>
      flaui.click({ processId: bartenderPid, name: 'Properties...', retrySeconds: 30 }),
      { attempts: 1 }
    );

    // Confirmed (2026-09-11): this must be an actual system sharename, not an arbitrary/random
    // string -- valid sharenames are defined in the database, and "I_Num" is a real one. A random
    // suffix (an earlier version of this test used 'I_Num' + random digits, following the same
    // randomize-for-uniqueness convention as templateName above) does NOT apply here.
    const dataSourceName = 'I_Num';
    // Confirmed live (2026-09-11): "Text Properties" and everything inside it (including "Change
    // Data Source Name Wizard") are NESTED windows -- descendants of "BarTender Designer", not
    // separate top-level desktop windows -- so `title` (which only works via FindWindow's
    // top-level enumeration) can never match them; that's why these steps kept failing even though
    // the automation-ids below were already correct. Fix: use `elementName` instead, which scopes
    // FindControl's descendant search from the whole "Template Editor" window and reaches any
    // nesting depth. AutomationId 5109 is the "<none>" button next to the Data Source "Name:"
    // field, confirmed via tree_afterprops.txt/tree_afterprops2.txt.
    await until('open the Change Data Source Name Wizard', () =>
      flaui.click({ processId: bartenderPid, elementName: 'Text Properties', name: '<none>', automationId: '5109', retrySeconds: 30 }),
      { attempts: 1 }
    );
    // Confirmed live (2026-09-11): this setText call was ALSO missing automationId/controlType --
    // exactly the failure mode Program.cs's own CmdSetText comment already warns about (both the
    // Static label AND the real Edit box are named "Name:" here; without automationId, FindControl
    // matched the label every time, so the value never actually landed anywhere). AutomationId 2308
    // is the real Edit control, confirmed via a live dump-tree of this exact wizard.
    await until('type the new data source name', () =>
      flaui.setText({
        processId: bartenderPid,
        elementName: 'Change Data Source Name Wizard',
        name: 'Name:',
        automationId: '2308',
        controlType: 'Edit',
        value: dataSourceName,
        retrySeconds: 30,
      }),
      { attempts: 1 }
    );
    // AutomationId "1" here is the Wizard's own OK button -- confirmed live. Note this SAME
    // AutomationId is reused by Text Properties' own Close button below (a generic Win32
    // default-button convention), which is exactly why elementName-scoping to the right dialog
    // matters here, not just automationId alone.
    await until('confirm the wizard with OK', () =>
      flaui.click({ processId: bartenderPid, elementName: 'Change Data Source Name Wizard', name: 'OK', automationId: '1', retrySeconds: 30 }),
      { attempts: 1 }
    );
    await until('close the Text Properties dialog', () =>
      flaui.click({ processId: bartenderPid, elementName: 'Text Properties', name: 'Close', automationId: '1', retrySeconds: 30 }),
      { attempts: 1 }
    );

    // -- Save --
    // btnSave lives in the wrapper's action bar, not the BarTender Designer window itself --
    // confirmed via tree_textmenu.txt. "Template Editor" IS a genuine top-level window (unlike the
    // dialogs above), so `title` scoping is correct here.
    await until('click Save', () =>
      flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Save', automationId: 'btnSave', retrySeconds: 30 }),
      { attempts: 1 }
    );

    // -- Approve --
    // Confirmed live (2026-09-11) via screenshot: clicking Approve (btnApprove, same tlpActions
    // bar as Save -- tree_textmenu.txt) opens a "Signature Required" dialog with User / Password /
    // Reason (dropdown, defaults to "General" -- left alone here, no requirement to change it) /
    // Comments (optional, left blank) fields and Submit/Cancel buttons. Confirmed this reuses the
    // same ROBAR login credentials (USERNAME/PASSWORD from support/robar), not a separate
    // approval-specific account.
    //
    // Confirmed live (2026-09-11) via dump-tree: the "User"/"Password" text visible in the
    // screenshot are separate Static labels (lblUser/lblPassword) -- the actual Edit controls have
    // BLANK accessible names and are only identifiable by AutomationId (txtUser/txtPassword),
    // which is why the earlier name-based guess (even with controlType: 'Edit') never found
    // anything. AutomationId alone is enough here (FindControl checks automation-id before name),
    // so the --name value passed alongside it is just a readable placeholder, not load-bearing.
    // Submit is btnSubmit. Verified live: both fields visibly retained the typed value afterward
    // (screenshot), not just a ValuePattern call that silently didn't stick.
    // DO NOT use --method win32 (BM_CLICK) on this button -- confirmed live (2026-09-12) that it
    // crashes the whole Template Editor/BarTenderEdit process outright (a raw COM error,
    // "An event was unable to invoke any of the subscribers (0x80040201)", immediately followed by
    // the process disappearing entirely).
    //
    // ROOT CAUSE FOUND (2026-09-12), after two prior fixes (retrySeconds, then bounded per-attempt
    // timeouts) both failed to help: the earlier "this app's UIA bridge is just generally
    // slow/unreliable" theory was wrong for THIS specific step. Mason's live observation was the
    // key clue -- the Signature Required dialog appears almost immediately every time Approve is
    // actually clicked, so the CLICK isn't slow at all. What's actually happening: Approve's click
    // handler shows that dialog SYNCHRONOUSLY (a blocking/modal call), and plain UIA
    // InvokePattern.Invoke() is ITSELF a synchronous COM call that blocks until the click handler
    // returns -- which, for this button, doesn't happen until the dialog is closed. Invoke()
    // doesn't throw (so the existing InvokeThrew fallback never triggers) and doesn't fail -- it
    // just hangs for as long as the dialog stays open, i.e. indefinitely in an unattended run,
    // since nothing has filled it in yet. Eventually Node's own process timeout kills the frozen
    // CLI call, `until` retries, and the retry then fights an already-open orphaned dialog it
    // doesn't know about -- matching every symptom observed (Approve "timing out" on searches that
    // are individually fast, needing many attempts, taking minutes overall). Fix: --method mouse
    // forces a real synthesized mouse click (SendInput) instead of InvokePattern -- fire-and-forget
    // from the caller's side, returns immediately regardless of what the target does with it.
    // Confirmed live: 616ms (vs. hanging), dialog opens correctly.
    await until('click Approve', () =>
      flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Approve', automationId: 'btnApprove', method: 'mouse' })
    );
    // Give the dialog a moment to actually construct its child controls before the first attempt
    // to find them -- cheap insurance, not a substitute for the retry budget below.
    await page.waitForTimeout(1000);
    // Confirmed live (2026-09-11): setText into these fields "succeeds" (no error, ValuePattern
    // method reported) immediately after clicking Approve, yet the field is empty afterward.
    // Three fixes chased this before landing on the real cause -- all three were UIA-layer
    // failure modes, not real settle time: (1) a stale-cached read-back made --verify retry
    // forever even on a genuinely successful write; (2) that got misdiagnosed as a real ~1-2
    // minute app delay, inflating retrySeconds instead of fixing the cache bug; (3) with the cache
    // bug fixed, it STILL wasn't reliable. Root cause (2026-09-12): this app's UIA ValuePattern
    // support for these fields is simply unreliable in ways that don't reduce to one clean bug.
    // Real fix: bypass UI Automation entirely for both the write and the verify read via
    // --method win32 (raw Win32 SendMessage -- WM_SETTEXT to write, WM_GETTEXT to read back), the
    // same technique tools like AutoIt use for exactly this class of legacy app. retrySeconds
    // bumped to 60 (from 30) as extra margin specifically for THIS first touch of the dialog --
    // resolving "Signature Required" costs a real ~10s even when it already exists (confirmed via
    // isolated timing), and if the dialog is still mid-construction when this first runs, a "not
    // found" attempt likely costs the same ~10s as a successful one (same full-tree walk either
    // way), leaving room for only 2-3 attempts at 30s.
    await until('fill User in the Signature Required dialog', () =>
      flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtUser', automationId: 'txtUser', value: USERNAME, retrySeconds: 60, verify: true, method: 'win32' }),
      { attempts: 1 }
    );
    // Confirmed live (2026-09-11): reading back txtPassword's Value property via UI Automation
    // always returns null for this masked field, which is why --verify was avoided for it
    // earlier. Win32's WM_GETTEXT doesn't have that limitation -- Windows doesn't hide the real
    // underlying text from WM_GETTEXT, only the on-screen rendering is masked -- so --verify is
    // usable here now too, unlike with the UIA-based approach.
    await until('fill Password in the Signature Required dialog', () =>
      flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtPassword', automationId: 'txtPassword', value: PASSWORD, retrySeconds: 30, verify: true, method: 'win32' }),
      { attempts: 1 }
    );
    // Confirmed live (2026-09-12): --method win32 (BM_CLICK) hangs here too, same root cause as
    // Approve above -- SendMessage(BM_CLICK) is JUST AS SYNCHRONOUS as InvokePattern.Invoke(), and
    // Submit's click handler evidently does its real work (submitting the approval, then closing
    // the whole Template Editor/BarTenderEdit process) inside that same synchronous call. A live
    // run showed this exact CLI invocation killed by Node's timeout (SIGTERM) after hanging, and
    // immediately after, list-processes showed BarTenderEdit gone entirely -- i.e. the click DID
    // go through and the app closed as part of Submit succeeding, but the tool was still blocked
    // waiting for a reply from a window that no longer existed. Fix: --method mouse, same as
    // Approve -- a real, fire-and-forget synthesized click that returns immediately regardless of
    // what the target does with it.
    await until('submit the Signature Required dialog', () =>
      flaui.click({ processId: bartenderPid, elementName: 'Signature Required', name: 'Submit', automationId: 'btnSubmit', method: 'mouse' }),
      { attempts: 1 }
    );

    // -- Close the tab --
    // btnCloseTab lives in the same wrapper action bar as Save/Approve (confirmed via
    // tree_textmenu.txt/tree_afterprops.txt/tree_sampledata.txt -- Name="Close Tab",
    // AutomationId="btnCloseTab"), so it's scoped by `title` the same way Save/Approve are, not
    // `elementName` like the dialog-nested controls above.
    // Defaulting to --method mouse here too, same as Approve/Submit above: both of those hung (or
    // outright crashed the process, in Approve's case) under their default click method because
    // their handlers do real synchronous work -- opening a modal, submitting the approval and
    // tearing the process down -- inside the same call UI Automation/Win32 blocks on. Closing the
    // only open tab plausibly closes the whole Template Editor/BarTenderEdit process the same way,
    // so this uses the one click method already confirmed safe against that failure mode rather
    // than risking a repeat with an unverified default. Not yet confirmed live against this exact
    // button -- if it doesn't fire, re-check with a dump-tree/screenshot right after Submit.
    await until('click Close Tab on the Template Editor', () =>
      flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Close Tab', automationId: 'btnCloseTab', method: 'mouse' })
    );
  });

  await test.step('close Template Management and log out of the WebMenu', async () => {
    // Confirmed via archive/security_main.html (same WebMenu tab-bar markup as Template
    // Management): each open module tab is a jQuery UI tab (<li class="ui-tabs-tab">) containing a
    // ".ui-icon-close" span labeled "Remove Tab" next to the module's own link text. Scope by the
    // tab's text so this doesn't depend on tab position/index if "Main Menu" or another module tab
    // is also open.
    await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click();

    // Confirmed via archive/mainmenu.html: the header's Logout button has a stable id ("logout"),
    // not just visible text -- matches the "Logout" button seen in this same header row in earlier
    // page snapshots.
    await page.click('#logout');
    await page.waitForLoadState('networkidle');
  });
});
