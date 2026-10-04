import { test } from '@playwright/test';
import { login, findFrame } from '../support/robar';

test('check MD Job Inquiry for the successful import job', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  await page.getByRole('button', { name: 'MD Job Inquiry', exact: true }).click();
  await page.waitForTimeout(1500);
  const frame = await findFrame(page, 'JobInquiry');

  await frame.getByRole('button', { name: 'Retrieve Job Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2000);

  const text = await frame.locator('body').innerText();
  console.log('=== Job Inquiry results (first 5000 chars) ===');
  console.log(text.slice(0, 5000));
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\md_job_inquiry_results2.png', fullPage: true });
});
