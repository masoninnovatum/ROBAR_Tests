// Shared helpers for driving the ROBAR WebMenu in @playwright/test specs.

import type { Frame, Page } from '@playwright/test';
import { ROBAR } from '../../seed';

export const BASE_URL = ROBAR.url;
export const USERNAME = ROBAR.username;
export const PASSWORD = ROBAR.password;
export const TEMPLATE_NAME = ROBAR.templateName;

/** Logs into the WebMenu. Call once per test at the top. */
export async function login(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await page.fill('.userID', USERNAME);
  await page.fill('.Password', PASSWORD);
  await page.click('.loginBtn');
  await page.waitForLoadState('networkidle');
}

/** Opens a main-menu module by its button text (e.g. "Campaign Manager", "Template Management"). */
export async function openMenuItem(page: Page, menuText: string): Promise<void> {
  await page.click(`button.menuIcon:has-text("${menuText}")`);
}

/**
 * Polls page.frames() until one whose URL contains urlIncludes (case-insensitive) appears.
 * The WebMenu loads each module into a dynamically-created iframe, so a plain frameLocator
 * doesn't work -- the frame doesn't exist yet at click time.
 */
export async function findFrame(
  page: Page,
  urlIncludes: string,
  { attempts = 30, intervalMs = 500 }: { attempts?: number; intervalMs?: number } = {}
): Promise<Frame> {
  for (let i = 0; i < attempts; i++) {
    const frame = page.frames().find((f) => f.url().toLowerCase().includes(urlIncludes.toLowerCase()));
    if (frame) return frame;
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`Frame containing "${urlIncludes}" never appeared`);
}
