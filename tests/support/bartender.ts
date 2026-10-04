// Shared FlaUI helpers for getting past the native Sentinel/BarTenderEdit launch that Template
// Management triggers (Create New Template, Replace Template, and Save As New all fire the same
// GetFileToken -> #sentinelFrame -> "Open SentinelLauncher?" -> "Template Editor" desktop window
// sequence), regardless of what a test does -- or doesn't do -- inside BarTender afterward.
//
// This is a byte-for-byte transcription of the sequence proven live in
// tests/Template-Management/Create_and_Approve_Template.spec.ts (see that file's inline comments
// for the full troubleshooting history behind each step), not a reinterpretation of it -- an
// earlier version of this file "cleaned up" the extraction (different snapshot timing, a different
// click method) and that introduced real, hard-to-diagnose failures the original code doesn't have.
// Deliberately kept in sync with that file's exact ordering and mechanics; the one intentional
// deviation is confirmSentinelLaunchPrompt's dialog-close verification, called out where it happens.
// That file is intentionally left untouched by this module -- its own proven, working sequence
// can't be affected by changes made here.

import type { Page } from '@playwright/test';
import * as flaui from '../../scripts/flaui_bridge';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Forces a process's main window to the foreground. clickAt's SendInput click lands on whatever
 * window is physically topmost at that screen pixel, so if anything else (Slack, Word, another
 * browser) is in front of Playwright's Chromium, a "successful" click on the Sentinel prompt hits the
 * wrong window and the prompt never closes. Confirmed live (2026-10-02): the launch worked all
 * morning, then failed repeatedly once other windows were open on top. Best-effort -- Windows may
 * still refuse a background process's foreground request, which is why callers retry. */
async function bringWindowToForeground(pid: number): Promise<void> {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class FgWin {
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@ -ErrorAction SilentlyContinue
    $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
    if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
      [FgWin]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
      [FgWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    }
    `,
  ]).catch(() => {});
}

/** Retries `action` until it resolves without an `.error` field, or throws with the last error
 * once `attempts` is exhausted. Pass `{ attempts: 1 }` whenever `action` already carries its own
 * `retrySeconds` -- see Create_and_Approve_Template.spec.ts's comment on why stacking the two
 * retry layers can multiply worst-case wait time far past a sane test timeout. */
export async function untilValue<T extends { error?: string }>(
  page: Page,
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

/** Same retry semantics as `untilValue`, for calls whose return value isn't needed. */
export async function until(
  page: Page,
  description: string,
  action: () => Promise<{ error?: string }>,
  opts?: { attempts?: number; delayMs?: number }
): Promise<void> {
  await untilValue(page, description, action, opts);
}

/** Resolves Playwright's own browser process id -- required to safely scope the native
 * "Open SentinelLauncher?" dialog lookup (flaui_bridge.js SAFETY note: never match by --title
 * alone on a shared desktop). Confirmed live (2026-09-11): matching on page title alone is NOT
 * enough -- this machine had a real personal Chrome window open to the exact same page title
 * ("Innovatum Web Menu Login - Google Chrome for Testing"), and the first version of this check
 * picked the wrong one, which is why the whole flow silently hung waiting on a dialog in the wrong
 * process. Playwright's bundled browser identifies itself with "for Testing" in its window title --
 * require both. One-shot lookup, no internal retry -- matches Create_and_Approve_Template
 * .spec.ts exactly, which relies on this same call succeeding first-try once headed mode is used. */
export async function resolveBrowserPid(page: Page): Promise<number> {
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
}

/** Confirms the native "Open SentinelLauncher?" prompt. Not a JS dialog -- page.on('dialog') never
 * fires for it, and Playwright has no API for it at all; it's an owned Chromium Views bubble nested
 * inside the browser's own top-level window (ClassName "RootView", titled "Open SentinelLauncher?"
 * -- no space, with a "?"). wait-window/click's FindWindow only enumerates true top-level desktop
 * windows, so scoping by --title "Sentinel" never finds it. Fix: scope by --process-id ALONE (the
 * browser's own top-level window) -- FindControl then finds the button as a descendant of that
 * window, nested dialog included. Button name confirmed via dump-tree: "Open SentinelLauncher"
 * (ClassName MdTextButton, no space before "Launcher").
 *
 * A plain `click` (InvokePattern) visibly focuses/highlights this button but never fires
 * Chromium's real click handler -- the dialog just sits there. Fix: clickAt for a genuine
 * synthesized mouse click at real screen coordinates instead of a UIA invoke -- offsetX/offsetY
 * are a conservative inset (not the exact center) chosen to safely land inside the button.
 * Confirmed live (2026-09-11) that switching this to `click`'s `method: 'mouse'` (FlaUI's own
 * resolved-clickpoint mouse click, which works for several BarTenderEdit buttons elsewhere) does
 * NOT work for this specific external-protocol Chromium bubble -- it reports success but never
 * actually launches anything, while this exact clickAt keeps working.
 *
 * DELIBERATE DEVIATION from Create_and_Approve_Template.spec.ts: that file's version trusts
 * clickAt's "no error" result and moves on. Confirmed live (2026-09-11) via dump-tree that both
 * clickAt and click report success the instant they dispatch the synthetic input, with NO
 * verification the target actually received it -- in practice this specific click is flaky enough
 * that a "successful" attempt sometimes does nothing at all. So this dump-trees the window after
 * every attempt and keeps retrying the click until the dialog is actually confirmed gone, instead
 * of trusting a report that doesn't mean what it sounds like it means. */
export async function confirmSentinelLaunchPrompt(page: Page, browserPid: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tree = await flaui.dumpTree({ processId: browserPid, maxDepth: 15 });
    if (!(tree || '').includes('Open SentinelLauncher?')) {
      return; // dialog confirmed gone -- a prior click (or none needed) already succeeded
    }
    await bringWindowToForeground(browserPid);
    await page.waitForTimeout(200);
    await flaui.clickAt({ processId: browserPid, name: 'Open SentinelLauncher', offsetX: 20, offsetY: 14 });
    await page.waitForTimeout(500);
  }
  throw new Error(
    'The "Open SentinelLauncher?" dialog never closed after repeated click attempts -- ' +
      'either it never appeared in the first place, or Chromium changed its control name/structure. ' +
      'Re-run dump-tree --process-id <browserPid> --max-depth 15 while the prompt is showing to check.'
  );
}

/** Finds the BarTender/Sentinel process spawned after confirming the launch prompt. Confirmed live:
 * the real process is "Innovatum.Sentinel.Plugin.BarTenderEdit", window title "Template Editor".
 * Prefers diffing against the pre-launch snapshot (robust to a process that was already running
 * before this test started, e.g. a leftover from a prior interrupted run); falls back to a plain
 * name search of the current snapshot so a stale leftover instance doesn't leave this step unable
 * to ever find anything. `beforeLaunch` must be captured (via flaui.listProcesses()) immediately
 * before the click that fires GetFileToken -- taking it any later risks the Sentinel/BarTender
 * process already existing in BOTH snapshots by the time you diff, since launching happens fast,
 * which makes diffNewProcesses find nothing and this spin for its full attempt budget with no
 * error. */
export async function findBartenderProcess(page: Page, beforeLaunch: Array<{ pid: number; name: string }>): Promise<number> {
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
}

/**
 * Full sequence from "we're about to submit a dialog that will fire GetFileToken" to "the Template
 * Editor window is up and BarTender itself is ready to accept input" -- everything Create New
 * Template, Replace Template, and Save As New share before they diverge into their own
 * BarTender-side steps. Call this immediately after the click that submits the dialog (and its
 * CreateNewTemplate/GetFileToken responses have resolved) -- it takes its own process snapshot
 * first, at the same point in the sequence Create_and_Approve_Template.spec.ts does.
 */
export async function launchTemplateEditor(page: Page): Promise<number> {
  // Snapshot processes BEFORE confirming the launch prompt -- taking this "before" picture any
  // later risks the Sentinel/BarTender process already existing in BOTH snapshots by the time you
  // diff, since launching happens fast, which makes diffNewProcesses find nothing and the next
  // step spin forever with no error.
  const beforeLaunch = await flaui.listProcesses();

  const browserPid = await resolveBrowserPid(page);
  await confirmSentinelLaunchPrompt(page, browserPid);
  const bartenderPid = await findBartenderProcess(page, beforeLaunch);
  await flaui.waitWindow({ processId: bartenderPid, title: 'Template Editor', timeoutSeconds: 60 });

  // Wait for BarTender to actually finish loading, not just for its window to exist -- gate on
  // IsEnabled specifically for the disambiguated "Text" MenuItem (not the same-named toolbar
  // GROUP), which should only report true once BarTender's own UI considers itself ready to accept
  // this action, not merely present in the tree. { attempts: 1 } is deliberate: retrySeconds
  // already does the waiting inside one process/CLI invocation -- see the top-of-file note and
  // Create_and_Approve_Template.spec.ts's comment on why stacking JS-level retries on top of that
  // multiplies worst-case wait time.
  await until(
    page,
    'wait for BarTender\'s toolbar to report ready (Text MenuItem enabled)',
    () =>
      flaui.getProperty({
        processId: bartenderPid,
        name: 'Text',
        property: 'IsEnabled',
        controlType: 'MenuItem',
        retrySeconds: 90,
        expectValue: 'True',
      }),
    { attempts: 1 }
  );

  return bartenderPid;
}

/**
 * Clicks Close Tab on the Template Editor -- works equally whether or not `saveTemplate` was
 * called first, since it doesn't touch BarTender's save state itself. Observed live (2026-09-11)
 * closing a freshly-created, untouched template this way without it showing the "Save any changes
 * made to this template to ROBAR?" prompt documented in TM_ViewEditTemplates-1.7 for a template
 * that WAS edited -- but not yet confirmed reliably reproducible for an unsaved template given how
 * much flakiness this whole launch sequence has shown. If that prompt does appear, this will need
 * a follow-up click to dismiss it (select "No") before the window actually closes.
 *
 * Confirmed live (2026-09-11): BarTender/Sentinel's own shutdown after Close Tab can visibly take
 * several real seconds -- and, like every other click in this file, the click itself only reports
 * that the synthetic input was dispatched, not that the window actually closed. Waits for the
 * process to actually exit before returning, so a caller's next action (e.g. querying the grid and
 * opening a row-level action) never races a BarTender window that's still closing.
 */
export async function closeTemplateEditor(page: Page, bartenderPid: number): Promise<void> {
  await until(page, 'click Close Tab on the Template Editor', () =>
    flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Close Tab', automationId: 'btnCloseTab', method: 'mouse' })
  );

  let exited = false;
  for (let attempt = 0; attempt < 30 && !exited; attempt++) {
    const stillRunning = (await flaui.listProcesses()).some((p: { pid: number }) => p.pid === bartenderPid);
    if (!stillRunning) {
      exited = true;
    } else {
      await page.waitForTimeout(1000);
    }
  }
  if (!exited) throw new Error(`Template Editor (pid ${bartenderPid}) never exited after clicking Close Tab.`);
  // The editor WINDOW being gone is not enough: the Sentinel plugin / BarTender can keep closing for several more seconds and a
  // still-closing window can end up on top of the browser (seen live 2026-10-04). Wait for them, then bring the browser back up.
  await waitForBartenderClosed(page);
}

/**
 * Processes still alive after BarTender's "Close Tab": the Sentinel BarTenderEdit plugin (any instance) plus any BarTender
 * process that still owns a window. (flaui.listProcesses() only lists processes with a main window title, so it cannot see the
 * plugin process.)
 */
export async function bartenderLeftovers(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-Process | Where-Object { $_.ProcessName -like 'Innovatum.Sentinel.Plugin.BarTenderEdit*' -or (($_.ProcessName -like 'bartend*' -or $_.ProcessName -like 'BarTender*') -and $_.MainWindowHandle -ne 0) } | ForEach-Object { $_.ProcessName + ':' + $_.Id }`,
    ]);
    return stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Waits (up to `timeoutSeconds`) until `bartenderLeftovers()` is empty, then raises Playwright's browser window. Soft: logs, never throws. */
export async function waitForBartenderClosed(page: Page, timeoutSeconds = 90): Promise<boolean> {
  let leftovers: string[] = [];
  for (let attempt = 0; attempt < timeoutSeconds; attempt++) {
    leftovers = await bartenderLeftovers();
    if (leftovers.length === 0) break;
    if (attempt % 5 === 0) console.log(`waiting for BarTender to close: ${JSON.stringify(leftovers)}`);
    await page.waitForTimeout(1000);
  }
  if (leftovers.length > 0) console.log(`BarTender processes still present after ${timeoutSeconds}s: ${JSON.stringify(leftovers)}`);
  await page.waitForTimeout(1000);
  try {
    await bringWindowToForeground(await resolveBrowserPid(page));
  } catch {
    // best effort only
  }
  return leftovers.length === 0;
}

export interface AddTextObjectOptions {
  /**
   * When true (the default), the object is centered on the template via BarTender's native
   * "Center Horizontally/Vertically On Template" Arrange commands after placement -- matches the
   * original single-object behavior exactly. Set to false for a SECOND (or later) object on the
   * same template -- centering always aims at the same dead-center spot, so a second centered
   * object would land exactly on top of the first one. When false, the object is left wherever
   * `placeAtOffset` (or the default placement point) put it.
   */
  center?: boolean;
  /**
   * Workspace-relative offset (in the same coordinate space `getProperty('Workspace',
   * 'BoundingRectangle')` reports, i.e. pixels from Workspace's own top-left) to drag-place this
   * object at. Defaults to Workspace's own center -- fine for a single, centered object, but for
   * multiple objects on one template, pass a distinct offset per call so they don't stack on each
   * other.
   *
   * **Don't compute this as a fraction of Workspace's full Width/Height (confirmed live
   * 2026-09-30, caught by the user watching a real run)** -- e.g. `Width * 0.25` looks like a
   * reasonable "quarter of the way across" offset but actually overshoots the label entirely,
   * landing the object on the surrounding canvas background instead. The label only occupies a
   * portion of the visibly-larger Workspace pane (confirmed: the same Workspace rect this session
   * reported `Width: 1608, Height: 725` for a 4"x2" label at 227% zoom -- the label itself is
   * nowhere near that large in the same units). Workspace's own CENTER (`Width/2, Height/2`) is
   * the one point already proven, repeatedly, to land reliably on the label -- offset a SECOND
   * object from THAT anchor by a modest, fixed amount instead (center minus ~150/~135 -- see
   * `secondTextObjectOffset`; the earlier ~150/~80 hit the right ANCHOR but was too close, so the
   * two objects' text overlapped by about half a line, confirmed visually 2026-10-02), not from
   * Workspace's raw top-left corner by a large fraction of its full size.
   */
  placeAtOffset?: { x: number; y: number };
}

/**
 * Placement for a SECOND text object on a template whose first object was auto-centered (the
 * default of `addTextObjectBoundToSharename`), leaving visible space between the two. Pass the
 * result as `placeAtOffset` together with `center: false`.
 *
 * Measured live (2026-10-02, the standard 4"x2" Carton Label at the default zoom, Workspace rect
 * 1608x725): a default text box is ~68px tall and the centered object's box spans roughly
 * center +/- 34px. The second object is placed ABOVE it: 135px above center leaves ~45px of clear
 * space between the two objects' text, with both well inside the label. 80px above (the old value)
 * overlapped the centered object by about half a line.
 */
export function secondTextObjectOffset(workspace: { Width: number; Height: number }): { x: number; y: number } {
  return {
    x: Math.round(workspace.Width / 2) - 150,
    y: Math.round(workspace.Height / 2) - 135,
  };
}

/**
 * Adds a Text object to the template's canvas and binds its data source to `sharename` (e.g.
 * "I_Num") -- byte-for-byte transcription of Create_and_Approve_Template.spec.ts's "Add a Text
 * object" and "Name its data source" steps, EXCEPT for the Properties step (see below). See that
 * file for the full troubleshooting history: why "Text" must be targeted as a MenuItem, why
 * "Normal" is chosen via a raw Enter keypress instead of clicking it, why placement is a drag read
 * against Workspace's real BoundingRectangle, and why centering uses BarTender's native Arrange
 * commands instead of pixel math.
 *
 * **Opening Properties via the `Edit` menu, not a right-click (fixed 2026-09-30):** the original
 * version right-clicked at Workspace's own computed center as a stand-in for the placed object's
 * true center, on the assumption the object ends up exactly there after centering. Confirmed live
 * (2026-09-30, investigated by launching BarTender standalone via `BarTend.exe` directly --
 * independent of the ROBAR web menu entirely, since BarTender is just a third-party desktop app --
 * to iterate faster without the Sentinel-launch round trip) that this assumption doesn't hold
 * precisely enough: the object WAS genuinely centered on the template (confirmed both via the
 * Undo button's own label, "Undo Center Vertically On Template", and by direct visual inspection),
 * but Workspace's own bounding-rectangle center is evidently NOT exactly the same point as the
 * template's/object's true center in this environment, and the right-click missed, landing on the
 * label instead of the object. Root fix: the object stays selected after being placed and
 * centered (confirmed: Arrange commands act on the current selection with no extra select-click
 * needed), so `Edit > Properties...` (a real menu item, confirmed via dump-tree to carry the
 * shortcut label "Alt+Enter") opens the exact same "Text Properties" dialog with no coordinate
 * targeting of the object at all -- eliminating the precision problem entirely rather than tuning
 * it. Confirmed live for TWO objects placed at two different positions in the same template
 * (one centered, one deliberately off-center), both opened Properties via this same menu path with
 * no failures across repeated attempts.
 */
export async function addTextObjectBoundToSharename(
  page: Page,
  bartenderPid: number,
  sharename: string,
  { center = true, placeAtOffset }: AddTextObjectOptions = {}
): Promise<void> {
  // -- Add a Text object --
  await until(
    page,
    'click the "Text" object-creation MenuItem',
    () => flaui.click({ processId: bartenderPid, name: 'Text', controlType: 'MenuItem', retrySeconds: 30 }),
    { attempts: 1 }
  );
  await page.waitForTimeout(300); // let the flyout finish rendering/taking focus before Enter
  await flaui.sendKeys({ keys: ['RETURN'] });

  // Place it on the canvas. Default target is Workspace's own center (fine for a single object);
  // pass `placeAtOffset` for additional objects so they don't stack on top of each other.
  const workspaceRect = await untilValue(page, 'read the Workspace canvas BoundingRectangle', () =>
    flaui.getProperty({ processId: bartenderPid, name: 'Workspace', property: 'BoundingRectangle' })
  );
  const targetX = placeAtOffset?.x ?? Math.round(workspaceRect.value.Width / 2);
  const targetY = placeAtOffset?.y ?? Math.round(workspaceRect.value.Height / 2);
  await until(
    page,
    'drag to place the text object on the label',
    () =>
      flaui.drag({
        processId: bartenderPid,
        name: 'Workspace',
        fromOffsetX: targetX,
        fromOffsetY: targetY,
        toOffsetX: targetX + 100,
        toOffsetY: targetY + 30,
        retrySeconds: 30,
      }),
    { attempts: 1 }
  );

  // -- Center it precisely on the label (skip for a 2nd+ object -- see AddTextObjectOptions) --
  if (center) {
    await until(
      page,
      'center the text object horizontally on the template',
      () => flaui.click({ processId: bartenderPid, name: 'Center Horizontally On Template', retrySeconds: 30 }),
      { attempts: 1 }
    );
    await until(
      page,
      'center the text object vertically on the template',
      () => flaui.click({ processId: bartenderPid, name: 'Center Vertically On Template', retrySeconds: 30 }),
      { attempts: 1 }
    );
  }

  // -- Name its data source --
  // Opens Properties via the Edit menu -- the object is already selected from placement/centering
  // above, so this needs no click on the object itself and no coordinate targeting at all (see
  // this function's own doc comment for why the previous right-click approach was replaced).
  await until(
    page,
    'open the Edit menu',
    () => flaui.click({ processId: bartenderPid, name: 'Edit', controlType: 'MenuItem', retrySeconds: 15 }),
    { attempts: 1 }
  );
  await until(
    page,
    'click "Properties..." in the Edit menu',
    () => flaui.click({ processId: bartenderPid, name: 'Properties...', retrySeconds: 30 }),
    { attempts: 1 }
  );
  await until(
    page,
    'open the Change Data Source Name Wizard',
    () => flaui.click({ processId: bartenderPid, elementName: 'Text Properties', name: '<none>', automationId: '5109', retrySeconds: 30 }),
    { attempts: 1 }
  );
  await until(
    page,
    'type the new data source name',
    () =>
      flaui.setText({
        processId: bartenderPid,
        elementName: 'Change Data Source Name Wizard',
        name: 'Name:',
        automationId: '2308',
        controlType: 'Edit',
        value: sharename,
        retrySeconds: 30,
      }),
    { attempts: 1 }
  );
  await until(
    page,
    'confirm the wizard with OK',
    () => flaui.click({ processId: bartenderPid, elementName: 'Change Data Source Name Wizard', name: 'OK', automationId: '1', retrySeconds: 30 }),
    { attempts: 1 }
  );
  await until(
    page,
    'close the Text Properties dialog',
    () => flaui.click({ processId: bartenderPid, elementName: 'Text Properties', name: 'Close', automationId: '1', retrySeconds: 30 }),
    { attempts: 1 }
  );
}

/**
 * Captures the label canvas with BarTender's View > Data Source Names overlay on, so each text box
 * shows the sharename it is bound to -- the evidence screenshot the user wants in UATs and formal
 * test scripts after a template is created. Turns the overlay on, captures the `Workspace` element
 * (the label canvas -- the "Template Editor" window itself is only the banner strip) to `outPath`,
 * then turns it back off so the user's BarTender view setting isn't left changed.
 *
 * The menu item's real name is "Data Source Names<TAB>F12" (shortcut text included) and it is a toggle;
 * flaui.click matches by substring. Confirmed live 2026-10-02.
 */
export async function captureDataSourceNames(page: Page, bartenderPid: number, outPath: string): Promise<void> {
  const toggle = async (what: string) => {
    await until(page, `open the View menu (${what})`, () =>
      flaui.click({ processId: bartenderPid, name: 'View', controlType: 'MenuItem', retrySeconds: 15 }), { attempts: 1 });
    await page.waitForTimeout(500);
    await until(page, `click View > Data Source Names (${what})`, () =>
      flaui.click({ processId: bartenderPid, name: 'Data Source Names', controlType: 'MenuItem', retrySeconds: 15 }), { attempts: 1 });
    await page.waitForTimeout(1000);
  };

  await toggle('on');
  await flaui.screenshot({ processId: bartenderPid, elementName: 'Workspace', outPath });
  await toggle('off');
}

/** Clicks Save in the Template Editor wrapper's action bar -- byte-for-byte transcription of
 * Create_and_Approve_Template.spec.ts's "-- Save --" step. btnSave lives in the wrapper's action
 * bar, not the BarTender Designer window itself; "Template Editor" IS a genuine top-level window
 * (unlike the Text Properties/Wizard dialogs above), so `title` scoping is correct here. */
export async function saveTemplate(page: Page, bartenderPid: number): Promise<void> {
  await until(
    page,
    'click Save',
    () => flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Save', automationId: 'btnSave', retrySeconds: 30 }),
    { attempts: 1 }
  );
}
