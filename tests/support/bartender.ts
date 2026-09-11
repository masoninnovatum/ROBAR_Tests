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

  for (let attempt = 0; attempt < 30; attempt++) {
    const stillRunning = (await flaui.listProcesses()).some((p: { pid: number }) => p.pid === bartenderPid);
    if (!stillRunning) return;
    await page.waitForTimeout(1000);
  }
  throw new Error(`Template Editor (pid ${bartenderPid}) never exited after clicking Close Tab.`);
}

/**
 * Adds a Text object to the template's canvas and binds its data source to `sharename` (e.g.
 * "I_Num") -- byte-for-byte transcription of Create_and_Approve_Template.spec.ts's "Add a Text
 * object" and "Name its data source" steps. See that file for the full troubleshooting history:
 * why "Text" must be targeted as a MenuItem, why "Normal" is chosen via a raw Enter keypress
 * instead of clicking it, why placement is a drag read against Workspace's real
 * BoundingRectangle, why centering uses BarTender's native Arrange commands instead of pixel math,
 * and why the data source is renamed via real screen coordinates on Workspace rather than looking
 * up "Sample Text" as an element (it isn't one).
 */
export async function addTextObjectBoundToSharename(page: Page, bartenderPid: number, sharename: string): Promise<void> {
  // -- Add a Text object --
  await until(
    page,
    'click the "Text" object-creation MenuItem',
    () => flaui.click({ processId: bartenderPid, name: 'Text', controlType: 'MenuItem', retrySeconds: 30 }),
    { attempts: 1 }
  );
  await page.waitForTimeout(300); // let the flyout finish rendering/taking focus before Enter
  await flaui.sendKeys({ keys: ['RETURN'] });

  // Place it on the canvas.
  const workspaceRect = await untilValue(page, 'read the Workspace canvas BoundingRectangle', () =>
    flaui.getProperty({ processId: bartenderPid, name: 'Workspace', property: 'BoundingRectangle' })
  );
  const centerX = Math.round(workspaceRect.value.Width / 2);
  const centerY = Math.round(workspaceRect.value.Height / 2);
  await until(
    page,
    'drag to place the text object on the label',
    () =>
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

  // -- Name its data source --
  await until(
    page,
    'right-click the placed text object (via Workspace coordinates)',
    () =>
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
  await until(
    page,
    'click "Properties..." in its context menu',
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
