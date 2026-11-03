// Helpers for the Label Type Management requirement specs. Label Types cannot be deleted, and creating one auto-provisions an `LT_<name>` security process that is ENABLED for every group and user
// (LM.160202.F.4.x), so the tests use ONE CL label type, `CLLabelType` (.btw, no file purpose), created the first time and found again on every later run (user OK 2026-11-03: "create it if missing, reuse it").

import type { Frame, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import * as dui from '../support/dynamic-ui';

export const TILE = 'Label Type Management';
export const CL_LABEL_TYPE = 'CLLabelType';
export const CL_DESCRIPTION = 'CL label type for automated tests (do not delete)';

/** Looks for CLLabelType in the grid; adds it only when it is missing. Returns whether THIS call created it. The frame must be the Label Type Management Dynamic UI frame. */
export async function ensureClLabelType(page: Page, f: Frame): Promise<{ created: boolean; frame: Frame }> {
  const existing = await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', CL_LABEL_TYPE, { expectRows: false });
  if (existing.length === 1) return { created: false, frame: f };
  expect(existing, `no more than one ${CL_LABEL_TYPE}`).toEqual([]);
  const d = await dui.openFormDialog(f, 'add');
  await d.locator('#LabelType').fill(CL_LABEL_TYPE);
  await d.locator('#FileExtension').selectOption('.btw');
  await d.locator('#Description').fill(CL_DESCRIPTION);
  await d.locator('#FilePurpose').selectOption({ index: 0 });
  await dui.submitForm(f);
  expect(await dui.formError(f), 'the add is accepted').toBe('');
  await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 10_000 });
  const after = await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', CL_LABEL_TYPE);
  expect(after).toEqual([`${CL_LABEL_TYPE} .btw ${CL_DESCRIPTION}`]);
  return { created: true, frame: f };
}
