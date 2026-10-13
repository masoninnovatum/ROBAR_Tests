#!/usr/bin/env node
// PreToolUse hook: deterministic, allowlist-based auto-approval for a narrow set of
// low-risk browser-automation tool calls against the ROBAR QA test environment.
//
// Why this exists (2026-09-17): repeated manual "Allow Claude to execute JavaScript on
// vmsrvtst703?" / site-access prompts during routine, low-risk test-data setup were the
// biggest friction point in AI-assisted E2E authoring for ROBAR. The team (Mason + Trey)
// explicitly chose a deterministic/rules-based approach over an LLM-judgment "approval
// agent" specifically to avoid a hallucination-driven auto-approval decision against a
// live environment with real consequences (real DB writes, real print jobs, a regulated
// medical-device product). See .agents/browser-automation-approval-policy.md for the full
// policy writeup and how to extend it safely.
//
// This hook ONLY ever emits an "allow" decision for a narrow, explicitly-matched set of
// cases. Anything it doesn't recognize produces no output at all, which falls through to
// today's existing behavior (ask the user) -- deny-by-default, not allow-by-default.

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(PROJECT_ROOT, '.claude', 'browser-approval-allowlist.json');
const LOG_PATH = path.join(PROJECT_ROOT, '.claude', 'logs', 'browser-auto-approvals.log');

const READ_ONLY_TOOLS = new Set([
  'mcp__Claude_Browser__read_page',
  'mcp__Claude_Browser__get_page_text',
  'mcp__Claude_Browser__find',
  'mcp__Claude_Browser__read_console_messages',
  'mcp__Claude_Browser__read_network_requests',
  'mcp__Claude_Browser__tabs_context',
  'mcp__Claude_Browser__preview_list',
  'mcp__Claude_Browser__preview_logs',
]);

// Statements this policy considers "simple test-data entry": locate one element, set its
// value, dispatch a change/input event. Nothing else is permitted in an auto-approved snippet.
const SAFE_JS_STATEMENT = /^(const|let|var)\s+\w+\s*=\s*document\.(getElementById|querySelector|getElementsByName)\(\s*(['"]).*?\3\s*\)(\[0\])?\s*;?$|^\w+(\.value\s*=\s*.*|\.dispatchEvent\(\s*new\s+Event\(\s*(['"])(change|input)\6\s*(,[^)]*)?\)\s*\)\s*;?)$/i;

const DENY_KEYWORDS = [
  'password', 'signature', 'sig', 'submit', 'print(', '.click(', 'fetch(',
  'xmlhttprequest', 'eval(', 'settimeout', 'setinterval', 'document.write',
  'innerhtml', 'location', 'cookie', 'localstorage', 'sessionstorage',
];

// Matches a string literal in the code that itself looks like it embeds a URL/protocol
// (e.g. "innoclient:abc", "https://...") -- a signal the snippet is doing more than
// setting a form field, so it must not be auto-approved.
const EMBEDDED_URL_PATTERN = /['"`][A-Za-z][A-Za-z0-9+.\-]*:\/{0,2}[^'"`]*['"`]/;

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function appendAuditLog(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // Never let logging failure block a decision either way -- but an allow decision
    // without a successful log write is a real audit gap, so surface it loudly on stderr.
    process.stderr.write('robar-browser-approval: WARNING - failed to write audit log entry\n');
  }
}

function allow(reason, auditEntry) {
  appendAuditLog(auditEntry);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function fallThrough() {
  // No output at all = no opinion = existing default behavior (ask) applies.
  process.exit(0);
}

function isReadOnlyComputerCall(toolInput) {
  return toolInput && (toolInput.action === 'screenshot' || toolInput.action === 'zoom');
}

function checkNavigate(toolInput) {
  const url = toolInput && toolInput.url;
  if (!url || typeof url !== 'string') {
    return fallThrough();
  }
  let parsed;
  try {
    // navigate accepts URLs with or without a protocol; default to https for parsing.
    parsed = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) ? url : `https://${url}`);
  } catch {
    return fallThrough();
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fallThrough(); // never auto-approve custom protocols (innoclient:, etc.)
  }
  const allowlist = readJsonSafe(ALLOWLIST_PATH, { allowedHostnames: [] });
  const hostnames = allowlist.allowedHostnames || [];
  if (!hostnames.includes(parsed.hostname)) {
    return fallThrough();
  }
  return allow(`navigate: hostname "${parsed.hostname}" is on the approved allowlist`, {
    tool: 'navigate',
    url,
  });
}

function checkJavascriptExec(toolInput) {
  const code = toolInput && toolInput.text;
  if (!code || typeof code !== 'string') {
    return fallThrough();
  }
  if (code.length > 500) {
    return fallThrough();
  }
  const lower = code.toLowerCase();
  for (const kw of DENY_KEYWORDS) {
    if (lower.includes(kw)) {
      return fallThrough();
    }
  }
  if (EMBEDDED_URL_PATTERN.test(code)) {
    return fallThrough();
  }
  const statements = code
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (statements.length === 0) {
    return fallThrough();
  }
  // Track distinct elements touched via getElementById/querySelector/getElementsByName
  // arguments -- more than 3 distinct elements is a complexity signal, deny by default.
  const elementRefs = new Set();
  for (const statement of statements) {
    if (!SAFE_JS_STATEMENT.test(statement)) {
      return fallThrough();
    }
    const selectorMatch = statement.match(/document\.(?:getElementById|querySelector|getElementsByName)\(\s*(['"])(.*?)\1\s*\)/);
    if (selectorMatch) {
      elementRefs.add(selectorMatch[2]);
    }
  }
  if (elementRefs.size > 3) {
    return fallThrough();
  }
  return allow('javascript_exec: matches the simple form-field value-assignment allowlist pattern', {
    tool: 'javascript_exec',
    code,
  });
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      return fallThrough();
    }
    const toolName = payload.tool_name;
    const toolInput = payload.tool_input || {};

    if (READ_ONLY_TOOLS.has(toolName)) {
      return allow(`${toolName}: read-only inspection tool, no state mutation`, { tool: toolName });
    }
    if (toolName === 'mcp__Claude_Browser__computer' && isReadOnlyComputerCall(toolInput)) {
      return allow(`computer(${toolInput.action}): read-only screenshot/zoom action`, {
        tool: toolName,
        action: toolInput.action,
      });
    }
    if (toolName === 'mcp__Claude_Browser__navigate') {
      return checkNavigate(toolInput);
    }
    if (toolName === 'mcp__Claude_Browser__javascript_tool') {
      return checkJavascriptExec(toolInput);
    }
    return fallThrough();
  });
}

main();
