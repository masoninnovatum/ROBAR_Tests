// UAT_6356 (DIT #6356, Print by Lot "Manufactured" field / date-picker honours the disabled attribute) executed live on VAL703, HEADED (Sentinel prompts confirmed with FlaUI -- hands off).
// Admin = the seed user (MBUser1: toggles the 3 security processes of the MB fixture group MBSome2 only); test user = MBUser2 (Fred Johnson, group MBSome2) in a SECOND browser context that logs in
// fresh for every security configuration. Env UAT_ROUND selects what runs (the SQL steps need a manual change in between, see the UAT skill's SQL protocol):
//   prep   : print ONE real lot to Microsoft Print to PDF as MBUser2 (the "already printed" lot for steps 9-12), baseline security
//   round0 : steps 1,2,5,6,9,10,13,14 (no SQL change)
//   sqlD   : steps 3,7,11,15 (LocalizationResourceDef Lot_Manafactured EditMode = Disabled, set by the user)
//   sqlE   : steps 4,8,12,16 (EditMode = Enabled)
//   restore: put the 3 processes of MBSome2 back to the baseline (all three granted)
// Per step the DOM facts (Manufactured input disabled/readonly, Override checkbox visible, date-picker trigger style, calendar opens on click) go to test-data/uat6356-results.json and a screenshot to the scratch folder.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as printing from '../support/printing';
import { PrintByLot } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const GROUP = 'MBSome2';
const TEST_USER = 'MBUser2';
const ITEM = process.env.UAT_ITEM || 'MI042801';
const SHOTS = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6356_exec`;
const STATE = path.join(__dirname, '..', '..', 'test-data', 'uat6356-state.json');
const RESULTS = path.join(__dirname, '..', '..', 'test-data', 'uat6356-results.json');
const PROCS = ['BP_AllowMfgChangeAtPrint', 'BP_AllowMfgSetAtPrint', 'Override_Lot_At_Print'] as const;

interface Cfg { chg: boolean; set: boolean; ov: boolean }
interface StepDef { n: number; cfg: Cfg; lot: 'new' | 'printed'; check: boolean; sql?: 'Disabled' | 'Enabled' }

const STEPS: StepDef[] = [
  { n: 1, cfg: { chg: true, set: false, ov: false }, lot: 'new', check: false },
  { n: 2, cfg: { chg: true, set: false, ov: true }, lot: 'new', check: false },
  { n: 3, cfg: { chg: true, set: false, ov: true }, lot: 'new', check: true, sql: 'Disabled' },
  { n: 4, cfg: { chg: true, set: false, ov: true }, lot: 'new', check: true, sql: 'Enabled' },
  { n: 5, cfg: { chg: false, set: true, ov: false }, lot: 'new', check: false },
  { n: 6, cfg: { chg: false, set: true, ov: true }, lot: 'new', check: false },
  { n: 7, cfg: { chg: false, set: true, ov: true }, lot: 'new', check: true, sql: 'Disabled' },
  { n: 8, cfg: { chg: false, set: true, ov: true }, lot: 'new', check: true, sql: 'Enabled' },
  { n: 9, cfg: { chg: false, set: true, ov: false }, lot: 'printed', check: false },
  { n: 10, cfg: { chg: false, set: true, ov: true }, lot: 'printed', check: false },
  { n: 11, cfg: { chg: false, set: true, ov: true }, lot: 'printed', check: true, sql: 'Disabled' },
  { n: 12, cfg: { chg: false, set: true, ov: true }, lot: 'printed', check: true, sql: 'Enabled' },
  { n: 13, cfg: { chg: false, set: false, ov: false }, lot: 'new', check: false },
  { n: 14, cfg: { chg: false, set: false, ov: true }, lot: 'new', check: false },
  { n: 15, cfg: { chg: false, set: false, ov: true }, lot: 'new', check: true, sql: 'Disabled' },
  { n: 16, cfg: { chg: false, set: false, ov: true }, lot: 'new', check: true, sql: 'Enabled' },
];

const readJson = (p: string, fallback: any) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const writeJson = (p: string, v: any) => fs.writeFileSync(p, JSON.stringify(v, null, 2));

test('UAT_6356 on VAL703', async ({ browser }) => {
  test.setTimeout(3_000_000);
  const round = process.env.UAT_ROUND ?? 'round0';
  fs.mkdirSync(SHOTS, { recursive: true });
  sec.assertMb(GROUP);
  const state = readJson(STATE, {});
  const results = readJson(RESULTS, {});
  const stamp = Date.now().toString().slice(-6);

  // ---- admin: toggle only the three processes of MBSome2 ----
  const adminCtx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const admin = await adminCtx.newPage();
  let secFrame: Frame | undefined;
  const setSecurity = async (cfg: Cfg, evidence?: string) => {
    secFrame = secFrame ? await sec.reopenSecurity(admin) : await sec.openSecurity(admin);
    await sec.setView(secFrame, 'GROUP');
    await sec.selectRow(admin, secFrame, sec.groupRow(secFrame, GROUP));
    const want: Record<string, boolean> = { BP_AllowMfgChangeAtPrint: cfg.chg, BP_AllowMfgSetAtPrint: cfg.set, Override_Lot_At_Print: cfg.ov };
    for (const proc of PROCS) {
      const now = await sec.readProcesses(secFrame);
      if (now[proc] !== want[proc]) {
        const r = await sec.toggleProcess(admin, secFrame, GROUP, proc, want[proc]);
        if (!r.Success) throw new Error(`toggle ${proc}: ${JSON.stringify(r)}`);
      }
    }
    secFrame = await sec.reopenSecurity(admin);
    await sec.setView(secFrame, 'GROUP');
    await sec.selectRow(admin, secFrame, sec.groupRow(secFrame, GROUP));
    const after = await sec.readProcesses(secFrame);
    for (const proc of PROCS) expect(after[proc], `${GROUP} ${proc}`).toBe(want[proc]);
    if (evidence) {
      // evidence of the saved state right before the test user logs in
      await sec.filterProcesses(secFrame, 'BP_AllowMfg');
      await admin.screenshot({ path: path.join(SHOTS, `${evidence}_security_BP_AllowMfg.png`) });
      await sec.filterProcesses(secFrame, 'Override_Lot_At_Print');
      await admin.screenshot({ path: path.join(SHOTS, `${evidence}_security_Override.png`) });
      console.log(`SECURITY ${evidence}: ${JSON.stringify(Object.fromEntries(PROCS.map((p) => [p, after[p]])))}`);
    }
  };

  // ---- test user: fresh login + Print by Lot ----
  const openTestUser = async (): Promise<{ ctx: Awaited<ReturnType<Browser['newContext']>>; p: Page; pb: PrintByLot }> => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const p = await ctx.newPage();
    await loginAs(p, TEST_USER, PASSWORD);
    const pb = new PrintByLot(p);
    await pb.open();
    return { ctx, p, pb };
  };

  /** enters the lot (and item / order when new) and stops on the Lot Panel */
  const toLotPanel = async (pb: PrintByLot, lot: string, order: string, item: string) => {
    await pb.f.locator(`#${printing.lotNumberId}`).fill(lot);
    await pb.next();
    if ((await pb.f.locator(`#${printing.itemNumberId}`).count()) > 0 && (await pb.f.locator(`#${printing.itemNumberId}`).isEditable())) {
      await pb.f.locator(`#${printing.itemNumberId}`).fill(item);
      await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
      await pb.next();
    }
  };

  const capture = async (def: StepDef) => {
    await setSecurity(def.cfg, process.env.UAT_EVIDENCE ? `step_${String(def.n).padStart(2, "0")}` : undefined);
    const { ctx, p, pb } = await openTestUser();
    try {
      const lot = def.lot === 'printed' ? state.printedLot : state.newLot;
      const order = def.lot === 'printed' ? state.printedOrder : state.newOrder;
      await toLotPanel(pb, lot, order, def.lot === 'printed' ? state.printedItem ?? ITEM : ITEM);
      const mfg = pb.f.locator('#ctl00_printContentHolder_deLot_txtLotManufactured');
      await mfg.waitFor({ state: 'visible', timeout: 20_000 });
      const ovBox = pb.f.locator('#ctl00_printContentHolder_deLot_chbLotOverride');
      const overrideVisible = (await ovBox.count()) > 0 && (await ovBox.isVisible());
      if (def.check) {
        expect(overrideVisible, `step ${def.n}: the Override checkbox must be shown`).toBe(true);
        await ovBox.check();
        await p.waitForTimeout(2500);
      }
      const trigger = pb.f.locator('#ctl00_printContentHolder_deLot_txtLotManufactured ~ img.ui-datepicker-trigger, #ctl00_printContentHolder_deLot_txtLotManufactured + img').first();
      const facts = await mfg.evaluate((e) => {
        const i = e as HTMLInputElement;
        const t = i.parentElement?.querySelector('img.ui-datepicker-trigger') as HTMLElement | null;
        return { disabled: i.disabled, readOnly: i.readOnly, value: i.value, triggerStyle: t?.getAttribute('style') ?? null, triggerClass: t?.className ?? null };
      });
      let calendarOpened = false;
      if ((await trigger.count()) > 0) {
        await trigger.click({ force: true, timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(800);
        calendarOpened = await pb.f.locator('#ui-datepicker-div').isVisible().catch(() => false);
      }
      const shot = path.join(SHOTS, `step_${String(def.n).padStart(2, '0')}.png`);
      await p.screenshot({ path: shot });
      const row = { step: def.n, round, cfg: def.cfg, sql: def.sql ?? 'baseline', lot, overrideVisible, checked: def.check, ...facts, calendarOpened, shot, at: new Date().toISOString() };
      results[def.n] = row;
      writeJson(RESULTS, results);
      console.log(`STEP ${def.n}: ${JSON.stringify({ ...row, shot: undefined })}`);
    } finally {
      await ctx.close();
    }
  };

  try {
    if (round === 'prep') {
      await setSecurity({ chg: true, set: true, ov: true });
      state.printedLot ??= `MBUATP${stamp}`;
      state.printedOrder ??= `MBUATPO${stamp}`;
      state.newLot ??= `MBUATN${stamp}`;
      state.newOrder ??= `MBUATNO${stamp}`;
      if (process.env.PREP_PRINT) {
      const { ctx, pb } = await openTestUser();
      try {
        await pb.toLabelScreen(state.printedLot, ITEM, state.printedOrder, 'Carton Label');
        const text = await pb.print();
        console.log(`prep print: ${text.slice(-160)}`);
        expect(text).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
        state.printedAt = new Date().toISOString();
        state.printedItem = ITEM;
      } finally {
        await ctx.close();
      }
      } else {
        delete state.printedLot; // no printed lot yet: PREP_PRINT=1 prints one
        delete state.printedOrder;
      }
      writeJson(STATE, state);
    } else if (round === 'restore') {
      await setSecurity({ chg: true, set: true, ov: true });
    } else {
      expect(state.newLot, 'run the prep round first').toBeTruthy();
      const only = process.env.UAT_STEPS ? process.env.UAT_STEPS.split(',').map(Number) : null;
      const wanted = (round === 'round0' ? STEPS.filter((s) => !s.sql && !results[s.n]) : STEPS.filter((s) => s.sql === (round === 'sqlD' ? 'Disabled' : 'Enabled') || (round === 'sqlE' && !s.sql && s.lot === 'printed'))).filter((s) => s.lot !== 'printed' || state.printedLot);
      for (const def of only ? STEPS.filter((s) => only.includes(s.n)) : wanted) {
        if (only && results[def.n]) results[`${def.n}_before_rerun_${Date.now()}`] = results[def.n];
        await capture(def);
      }
    }
  } finally {
    await adminCtx.close();
  }
});
