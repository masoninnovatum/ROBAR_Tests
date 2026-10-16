// Setting preconditions for specs whose expectations depend on a Global Setting / Print Config that the user flips (never the spec). Each helper logs in on its OWN page (closed again before the
// spec's own login, so two sessions of the account never overlap), reads the value and skips the spec with a "precondition not met" message when it is not the expected one. scripts/suite-run.js
// collects these skips in the report's "Settings to update at the end" list. Nothing is ever changed here.

import { test } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { login } from './robar';
import { readGlobalSetting } from './global-settings';
import { readParam } from './print-config';

export async function skipUnlessGlobal(browser: Browser, name: string, owner: string, expected: string, why: string): Promise<void> {
  const ctx = await browser.newContext();
  let actual: string | undefined;
  try {
    const p = await ctx.newPage();
    await login(p);
    actual = await readGlobalSetting(p, name, owner);
  } finally {
    await ctx.close();
  }
  test.skip(actual !== expected, `precondition not met: Global Setting ${name} (${owner}) is ${actual}, needs ${expected} (${why}; the user flips it, see docs/agents/settings-change-requests.md)`);
}

export async function skipUnlessPrintConfig(browser: Browser, configName: string, paramName: string, expected: string, why: string): Promise<void> {
  const ctx = await browser.newContext();
  let actual = '?';
  try {
    const p = await ctx.newPage();
    await login(p);
    actual = await readParam(p, configName, paramName).catch(() => '?');
  } finally {
    await ctx.close();
  }
  test.skip(actual !== expected, `precondition not met: Print Config ${configName}/${paramName} is ${actual}, needs ${expected} (${why}; the user flips it, see docs/agents/settings-change-requests.md)`);
}
