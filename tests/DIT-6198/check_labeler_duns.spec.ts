import { test } from '@playwright/test';
import { login, findFrame } from '../support/robar';

test('check LabelerDuns schema data for a real valid value', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.getByRole('button', { name: 'Master Data', exact: true }).click();
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  await frame.selectOption('#ddlSchemas', { label: 'LabelerDuns' });
  await page.waitForTimeout(1000);
  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2000);

  const text = await frame.locator('body').innerText();
  console.log('=== LabelerDuns records (first 3000 chars) ===');
  console.log(text.slice(0, 3000));

  // Page-level "Actions" (top toolbar: New Record/Excel Import/etc.) sorts before the row's own
  // "Actions" link in DOM order - scope to the actual grid row, same fix as the MDM search step.
  await frame.locator('tr').filter({ hasText: 'Sugar Hill' }).locator('a:has-text("Actions")').click({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await frame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  const editText = await frame.locator('body').innerText();
  console.log('=== LabelerDuns record edit page (first 1500 chars) ===');
  console.log(editText.slice(0, 1500));

  const dunsValue = await frame.getByRole('row', { name: /Labeler Duns Number/i }).getByRole('textbox').inputValue().catch((e) => 'ERROR: ' + e.message);
  const companyNameValue = await frame.getByRole('row', { name: /^Company Name/i }).getByRole('textbox').inputValue().catch((e) => 'ERROR: ' + e.message);
  console.log('=== actual field values ===');
  console.log(JSON.stringify({ dunsValue, companyNameValue }));
});
