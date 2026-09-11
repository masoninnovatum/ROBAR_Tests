// Bridge from the Node/Playwright orchestration to the FlaUIAutomation.exe CLI tool
// (C:\Users\Mason\FlaUIAutomation), for driving native Windows desktop windows that a step needs to
// interact with outside the browser -- e.g. the BarTenderEdit wrapper that Innovatum's Sentinel chain
// launches for Template Management template editing.
//
// SAFETY -- read before calling anything except listProcesses:
// Never call waitWindow/dumpTree/click/getProperty/setText/screenshot with only a `title` on a shared
// desktop. Confirmed the hard way (see formal-test-script-execution SKILL.md): a title-only match can
// grab an unrelated window that happens to share a substring, and a screenshot can even leak a sliver
// of a DIFFERENT window's content through the captured window's edge margin. Always resolve a specific
// processId first -- via listProcesses (diffing before/after triggering the native-app launch) -- and
// pass it as `processId` to every subsequent call. `title` alone remains available only for quick,
// supervised, interactive use.

const { execFile } = require('child_process');

const EXE_PATH = 'C:\\Users\\Mason\\FlaUIAutomation\\bin\\Debug\\net8.0-windows\\FlaUIAutomation.exe';

// Node-side execFile timeout must comfortably exceed whatever --retry-seconds was passed through
// to the CLI, or Node kills the process before its own internal retry loop finishes -- confirmed
// necessary once click/getProperty/setText gained --retry-seconds (2026-09-12).
function runCli(args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    execFile(EXE_PATH, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      const lines = stdout.trim().split('\n').filter(Boolean);
      const lastLine = lines[lines.length - 1] || '';
      let parsed;
      try {
        parsed = JSON.parse(lastLine);
      } catch {
        parsed = {};
      }
      // BUG FIXED HERE (2026-09-12): this used to fall back to `{ raw: stdout, stderr }` on a
      // parse failure with NO `.error` field -- meaning a genuine execFile-level failure (the
      // process killed by Node's own `timeout` option, a crash before it printed anything) never
      // surfaced as an error to callers checking `result.error`. `until()` (and any inline
      // `if (result.error)` check) would then treat a KILLED process as if it had quietly
      // succeeded, letting the caller move on to the next step without the action ever having
      // happened. Always populate `.error` when execFile itself reports a failure.
      if (!parsed.error && err) {
        parsed.error = `FlaUIAutomation.exe failed (exitCode=${err.code ?? 'n/a'}, killed=${!!err.killed}, signal=${err.signal ?? 'n/a'}): ${err.message}`;
      }
      resolve({ ...parsed, exitCode: err ? err.code : 0, stdout, stderr });
    });
  });
}

function buildTargetArgs({ processId, title }) {
  if (processId == null && !title) {
    throw new Error('flaui_bridge: provide processId (preferred) and/or title to identify the target window.');
  }
  const args = [];
  if (processId != null) args.push('--process-id', String(processId));
  if (title) args.push('--title', title);
  return args;
}

/** --element-name/--element-automation-id narrow the search root to a NESTED dialog before
 *  looking for --name/--automation-id within it. Confirmed necessary (2026-09-11): BarTenderEdit
 *  nests dialogs several levels deep (e.g. "Change Data Source Name Wizard" inside "Text
 *  Properties" inside "BarTender Designer"), and their controls can reuse the same AutomationId
 *  across different dialogs (both the Wizard's "OK" and Text Properties' own "Close" button are
 *  AutomationId "1") -- searching the whole top-level window is genuinely ambiguous between them.
 */
function buildElementArgs({ elementName, elementAutomationId }) {
  const args = [];
  if (elementName) args.push('--element-name', elementName);
  if (elementAutomationId) args.push('--element-automation-id', elementAutomationId);
  return args;
}

/** List processes with a visible main window, optionally filtered by name substring.
 *  Use this FIRST to find the real processId before calling anything else -- see SAFETY note above.
 *  Typical pattern: snapshot before triggering the native-app launch, snapshot after, diff for the new pid.
 */
async function listProcesses(nameContains) {
  const args = ['list-processes'];
  if (nameContains) args.push('--name-contains', nameContains);
  const result = await runCli(args);
  return result.processes || [];
}

/** @param {{processId?: number, title?: string, timeoutSeconds?: number}} opts */
async function waitWindow({ processId, title, timeoutSeconds = 30 }) {
  const args = ['wait-window', ...buildTargetArgs({ processId, title }), '--timeout', String(timeoutSeconds)];
  return runCli(args);
}

/** @param {{processId?: number, title?: string, maxDepth?: number}} opts */
async function dumpTree({ processId, title, maxDepth = 4 }) {
  const args = ['dump-tree', ...buildTargetArgs({ processId, title }), '--max-depth', String(maxDepth)];
  const result = await runCli(args);
  return result.raw || result.stdout;
}

/** @param {{processId?: number, title?: string, name: string, automationId?: string, controlType?: string, elementName?: string, elementAutomationId?: string, retrySeconds?: number, method?: 'win32'|'mouse'}} opts
 *  method: 'win32' sends a raw Win32 SendMessage(BM_CLICK) instead of UI Automation entirely --
 *  bypasses the InvokePattern/mouse-click issues seen with several of BarTenderEdit's controls,
 *  as long as the control has a real native window handle (most Button-class controls do).
 *  method: 'mouse' forces a real synthesized mouse click (SendInput), skipping InvokePattern
 *  entirely -- for controls whose click handler blocks synchronously (e.g. shows a modal dialog),
 *  which makes InvokePattern.Invoke() itself hang until that dialog closes instead of failing.
 */
async function click({ processId, title, name, automationId, controlType, elementName, elementAutomationId, retrySeconds, method }) {
  const args = [
    'click',
    ...buildTargetArgs({ processId, title }),
    ...buildElementArgs({ elementName, elementAutomationId }),
    '--name', name,
  ];
  if (automationId) args.push('--automation-id', automationId);
  if (controlType) args.push('--control-type', controlType);
  if (retrySeconds) args.push('--retry-seconds', String(retrySeconds));
  if (method) args.push('--method', method);
  return runCli(args, retrySeconds ? (retrySeconds + 30) * 1000 : undefined);
}

/** Right-clicks a control by name (e.g. to open a context menu on a canvas object).
 *  @param {{processId?: number, title?: string, name: string, automationId?: string}} opts
 */
async function rightClick({ processId, title, name, automationId }) {
  const args = ['right-click', ...buildTargetArgs({ processId, title }), '--name', name];
  if (automationId) args.push('--automation-id', automationId);
  return runCli(args);
}

/** Clicks at a pixel offset from a container's top-left -- for canvas surfaces (e.g. a BarTender
 *  label design surface) with no individually-automatable child element to click directly. Read
 *  the container's BoundingRectangle first (dump-tree/get-property) to pick a safe offset.
 *  @param {{processId?: number, title?: string, name: string, automationId?: string, offsetX: number, offsetY: number, button?: 'left'|'right', retrySeconds?: number}} opts
 */
async function clickAt({ processId, title, name, automationId, offsetX, offsetY, button, retrySeconds }) {
  const args = [
    'click-at',
    ...buildTargetArgs({ processId, title }),
    '--name', name,
    '--offset-x', String(offsetX),
    '--offset-y', String(offsetY),
  ];
  if (automationId) args.push('--automation-id', automationId);
  if (button) args.push('--button', button);
  if (retrySeconds) args.push('--retry-seconds', String(retrySeconds));
  return runCli(args, retrySeconds ? (retrySeconds + 30) * 1000 : undefined);
}

/** Click-and-drags from one point to another, both as pixel offsets from a container's top-left.
 *  Read the container's BoundingRectangle first (getProperty) to compute good offsets rather than
 *  guessing -- e.g. to land centered on a canvas surface regardless of its actual size/position.
 *  @param {{processId?: number, title?: string, name: string, automationId?: string, fromOffsetX: number, fromOffsetY: number, toOffsetX: number, toOffsetY: number, retrySeconds?: number}} opts
 */
async function drag({ processId, title, name, automationId, fromOffsetX, fromOffsetY, toOffsetX, toOffsetY, retrySeconds }) {
  const args = [
    'drag',
    ...buildTargetArgs({ processId, title }),
    '--name', name,
    '--from-offset-x', String(fromOffsetX),
    '--from-offset-y', String(fromOffsetY),
    '--to-offset-x', String(toOffsetX),
    '--to-offset-y', String(toOffsetY),
  ];
  if (automationId) args.push('--automation-id', automationId);
  if (retrySeconds) args.push('--retry-seconds', String(retrySeconds));
  return runCli(args, retrySeconds ? (retrySeconds + 30) * 1000 : undefined);
}

/** @param {{processId?: number, title?: string, name: string, property: 'IsEnabled'|'Name'|'Text'|'Value'|'IsOffscreen'|'BoundingRectangle', automationId?: string, controlType?: string, elementName?: string, elementAutomationId?: string, retrySeconds?: number, expectValue?: string}} opts */
async function getProperty({ processId, title, name, property, automationId, controlType, elementName, elementAutomationId, retrySeconds, expectValue }) {
  const args = [
    'get-property',
    ...buildTargetArgs({ processId, title }),
    ...buildElementArgs({ elementName, elementAutomationId }),
    '--name', name,
    '--property', property,
  ];
  if (automationId) args.push('--automation-id', automationId);
  if (controlType) args.push('--control-type', controlType);
  if (retrySeconds) args.push('--retry-seconds', String(retrySeconds));
  if (expectValue != null) args.push('--expect-value', String(expectValue));
  return runCli(args, retrySeconds ? (retrySeconds + 30) * 1000 : undefined);
}

/** @param {{processId?: number, title?: string, name: string, value: string, automationId?: string, controlType?: string, elementName?: string, elementAutomationId?: string, retrySeconds?: number, verify?: boolean, method?: 'value'|'keyboard'|'win32'}} opts
 *  method: 'win32' sends a raw Win32 SendMessage(WM_SETTEXT) instead of UI Automation entirely --
 *  and when combined with verify, reads the value back the same way (WM_GETTEXT), so the whole
 *  round-trip bypasses UIA (and its pattern-support/caching quirks) completely. Requires the
 *  control to have a real native window handle (most Edit controls do).
 */
async function setText({ processId, title, name, value, automationId, controlType, elementName, elementAutomationId, retrySeconds, verify, method }) {
  const args = [
    'set-text',
    ...buildTargetArgs({ processId, title }),
    ...buildElementArgs({ elementName, elementAutomationId }),
    '--name', name,
    '--value', value,
  ];
  if (automationId) args.push('--automation-id', automationId);
  if (controlType) args.push('--control-type', controlType);
  if (retrySeconds) args.push('--retry-seconds', String(retrySeconds));
  if (verify) args.push('--verify', 'true');
  if (method) args.push('--method', method);
  return runCli(args, retrySeconds ? (retrySeconds + 30) * 1000 : undefined);
}

/** @param {{processId?: number, title?: string, outPath: string}} opts */
async function screenshot({ processId, title, outPath }) {
  const args = ['screenshot', ...buildTargetArgs({ processId, title }), '--out', outPath];
  return runCli(args);
}

/** Sends raw key presses to whatever currently owns OS keyboard focus -- no window target, no
 *  AutomationElement lookup. Last-resort fallback for controls that don't expose themselves to UI
 *  Automation at all (e.g. BarTenderEdit's XTP "Basic Text Objects" flyout).
 *  @param {{keys: string[]}} opts -- VirtualKeyShort names, e.g. ['RETURN'] or ['DOWN', 'RETURN']
 */
async function sendKeys({ keys }) {
  return runCli(['send-keys', '--keys', keys.join(',')]);
}

/** Diff two listProcesses() snapshots and return processes present in `after` but not `before`,
 *  matched by pid. This is the recommended way to find a just-launched native app's real pid
 *  (e.g. after triggering a Sentinel/BarTenderEdit launch from the browser) without guessing by title.
 */
function diffNewProcesses(before, after) {
  const beforePids = new Set(before.map((p) => p.pid));
  return after.filter((p) => !beforePids.has(p.pid));
}

module.exports = {
  listProcesses,
  waitWindow,
  dumpTree,
  click,
  rightClick,
  clickAt,
  drag,
  getProperty,
  setText,
  screenshot,
  sendKeys,
  diffNewProcesses,
};
