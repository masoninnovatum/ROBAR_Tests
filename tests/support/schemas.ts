// Schemas module helpers (InnovatumMDM/Schemas/Edit/<id>), live-confirmed 2026-10-04.
//
// Reach it from the Master Data page: pick a schema, Actions (`#drpMainActions`) -> Edit Schema (`#actEditSchema`).
// Page: schema selector `select[name="schemaSelector"]`; read-only "Item Schema" / "Has Data" checkboxes; Schema Name and
// Description text inputs (`input.text-wide`); one accordion block `.md-field` per field (header = caption, share name,
// field type, trash button `.delete-field`; body = `.row-fluid` rows of <label> + control); "Add New Field" link;
// Save `#btnSaveSchema`, Cancel `#btnCancel`; Actions `#actionsDropdown` -> `#actNewSchema` / `#actExportSchema`.
// Field types: Short Text, Long Text, Integer, Decimal, Date, True/False, HTML, Dropdown List, Linked Item.
//
// IMPORTANT: there is NO delete-schema action, and once a schema HAS DATA its already-saved fields are locked (not
// editable, not deletable). Never create records in a fixture schema you still need to edit; use unsaved New Record pages
// of NON-item schemas (a blank Edit page, nothing is created until Save) to observe how a field renders.

import type { Frame, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { findFrame } from './robar';
import * as mdm from './master-data';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** From the Master Data grid frame, opens the Schemas editor for `schemaName` and returns the Schemas frame. */
export async function openSchemaEditor(page: Page, mdFrame: Frame, schemaName: string): Promise<Frame> {
  await mdm.selectSchema(mdFrame, schemaName);
  await mdFrame.click('#drpMainActions', { timeout: 5000 });
  await delay(600);
  await mdFrame.locator('#actEditSchema').click({ force: true, timeout: 5000 });
  await delay(3000);
  const f = await findFrame(page, 'Schemas');
  await f.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await delay(1000);
  return f;
}

export function fieldBlocks(f: Frame): Locator {
  return f.locator('.md-field');
}

/** The field block whose header caption is exactly `caption`. */
export function fieldBlock(f: Frame, caption: string): Locator {
  return f.locator('.md-field').filter({ has: f.locator('.md-field-caption span', { hasText: new RegExp('^\\s*' + caption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }) });
}

/** A labelled row inside a field block, e.g. row(block, 'Caption').locator('input'). */
export function row(block: Locator, label: string): Locator {
  // CSS :has(label:text-is(...)) keeps the inner match in the same frame; `.last()` picks the innermost matching row
  // (the field body also has an outer .row-fluid wrapper that contains every label).
  return block.locator(`.row-fluid:has(label:text-is("${label}"))`).last();
}

/** A checkbox rendered as `<label><input type=checkbox> Label</label>` inside a field block (Required, Protected...). */
export function checkbox(block: Locator, label: string): Locator {
  return block.locator('label', { hasText: new RegExp('^\\s*' + label + '\\s*$') }).locator('input[type="checkbox"]').first();
}

export interface NewFieldOptions {
  type?: string; // 'Short Text' (default), 'Integer', 'Dropdown List', ...
  caption: string;
  shareName: string;
  sampleData?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
  inputMask?: string;
}

/** Clicks "Add New Field" and fills the new (last) block. The block's header caption becomes `caption`. */
export async function addField(f: Frame, options: NewFieldOptions): Promise<Locator> {
  const before = await fieldBlocks(f).count();
  await f.getByText('Add New Field', { exact: false }).first().click({ timeout: 5000 });
  await expect(fieldBlocks(f)).toHaveCount(before + 1, { timeout: 5000 });
  const block = fieldBlocks(f).last();
  if (options.type) await row(block, 'Field Type').locator('select').selectOption({ label: options.type }, { timeout: 5000 });
  await row(block, 'Caption').locator('input').fill(options.caption, { timeout: 5000 });
  await row(block, 'Share Name').locator('input').fill(options.shareName, { timeout: 5000 });
  if (options.sampleData !== undefined) await row(block, 'Sample Data').locator('input').fill(options.sampleData, { timeout: 5000 });
  if (options.required !== undefined) await checkbox(block, 'Required').setChecked(options.required, { timeout: 5000 });
  if (options.minLength !== undefined) await row(block, 'Min Length').locator('input').fill(String(options.minLength), { timeout: 5000 });
  if (options.maxLength !== undefined) await row(block, 'Max Length').locator('input[type="number"]').fill(String(options.maxLength), { timeout: 5000 });
  if (options.defaultValue !== undefined) await row(block, 'Default Value').locator('input').first().fill(options.defaultValue, { timeout: 5000 });
  if (options.inputMask !== undefined) await row(block, 'Input Mask').locator('input').first().fill(options.inputMask, { timeout: 5000 });
  return block;
}

/** Clicks Save and waits for the Save response; returns its JSON ({caption: id} for newly added fields). */
export async function saveSchema(page: Page, f: Frame): Promise<any> {
  const disabled = await f.locator('#btnSaveSchema').evaluate((b) => (b as HTMLButtonElement).disabled || b.classList.contains('ui-state-disabled'), undefined, { timeout: 5000 });
  const messages = await f.locator('.validationMessage').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).textContent!.trim()).map((e) => {
      const block = e.closest('.md-field');
      const cap = block?.querySelector('.md-field-caption span')?.textContent?.trim();
      return `${cap}: ${(e as HTMLElement).textContent!.trim()}`;
    })
  );
  console.log(`saveSchema: Save disabled=${disabled}; validation messages (any visibility)=${JSON.stringify(messages)}`);
  const seen: string[] = [];
  const onRequest = (r: import('@playwright/test').Request) => { if (r.method() === 'POST') seen.push(r.url().slice(-40)); };
  page.on('request', onRequest);
  const savePromise = page.waitForResponse((r) => r.url().includes('/Schemas/Save'), { timeout: 15_000 }).catch(() => null);
  await f.click('#btnSaveSchema', { timeout: 5000 });
  await delay(2500);
  const dialogs = (await f.locator('.ui-dialog:visible').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 220));
  console.log(`saveSchema: after click, dialogs=${JSON.stringify(dialogs)} POSTs so far=${JSON.stringify(seen)}`);
  if (dialogs.some((d) => d.includes('must be corrected'))) {
    const invalid = await f.evaluate(() =>
      Array.from(document.querySelectorAll('.md-field')).map((b) => {
        const cap = b.querySelector('.md-field-caption span')?.textContent?.trim();
        const bad = Array.from(b.querySelectorAll('input, select, textarea')).filter((i) => /validationElement|invalid|error/i.test((i as HTMLElement).className) || (i as HTMLElement).getAttribute('aria-invalid') === 'true');
        const star = (b.querySelector('b.altered') as HTMLElement | null)?.style.display !== 'none';
        return bad.length || star ? `${cap}: star=${star} bad=${bad.map((i) => (i.closest('.row-fluid')?.querySelector('label')?.textContent ?? '?').trim() + '[' + (i as HTMLElement).className.slice(0, 40) + ']').join(',')}` : '';
      }).filter(Boolean)
    );
    console.log(`saveSchema: fields flagged invalid: ${JSON.stringify(invalid)}`);
  }
  // A confirmation / error dialog may be in the way: dismiss an affirmative one so the save can proceed.
  const confirm = f.locator('.ui-dialog:visible button').filter({ hasText: /^(Continue|Yes|OK)$/ }).first();
  if (dialogs.length > 0 && (await confirm.count()) > 0) await confirm.click({ timeout: 5000 }).catch(() => {});
  const response = await savePromise;
  page.off('request', onRequest);
  const body = response ? await response.json().catch(() => ({})) : { __noSaveRequest: true, posts: seen };
  await delay(1500);
  return body;
}

/**
 * Adds one option to a Dropdown List field's STATIC list: select the `<<New Option>>` entry of the multi-select, fill Option
 * Text and Option Value, click the plus button (only visible while `<<New Option>>` is selected). A Dropdown List with no
 * source configured makes the whole schema unsaveable ("Invalid fields highlighted or marked with '*' must be corrected.").
 */
export async function addStaticOption(block: Locator, text: string, value: string): Promise<void> {
  const fieldset = block.locator('fieldset');
  await fieldset.locator('select[multiple]').selectOption({ label: '<<New Option>>' }, { timeout: 5000 });
  await delay(400);
  const inputs = fieldset.locator('input[type="text"]');
  await inputs.nth(0).fill(text, { timeout: 5000 });
  await inputs.nth(1).fill(value, { timeout: 5000 });
  await fieldset.locator('button.jqButton-icon:visible').first().click({ timeout: 5000 });
  await delay(400);
}

/** Option labels currently in a Dropdown List field's static list (excluding the `<<New Option>>` entry). */
export async function staticOptions(block: Locator): Promise<string[]> {
  const all = await block.locator('fieldset select[multiple] option').allInnerTexts();
  return all.map((t) => t.trim()).filter((t) => t !== '<<New Option>>');
}
