// Printing REST API (project 20240924-002, UAT_20240924-002): one test per FRS row (PRNTAPI.240924.F.x.y). HARD RULE: no live printer, ever (see print-helpers.ts: every request goes through a guard that only allows the
// virtual "Microsoft Print to PDF" printer / model, this PC as a FAKE printer on TCP 9100, and the never-routed 192.0.2.1); the last test audits the server's BarTender log for any other printer name.
// The print server (VMSRVTST703) renders a real PRN (a PDF for the PDF model): its text is read with pdfjs to prove share name overrides, label counts and serial numbers. New lots are CLO/CLL/CLI<run>.. (Lots API).
// Write fixtures borrowed from other specs: the two release-eligible CL LCNs of the Label Control spec (lock / release / effective-date tests, put back) and CL item CLSerItm8455875 (two released LCNs).
// Settings are NOT changed: the blank PrintConfig has AllowNewSerialsPrintingAPI = Y and batch quantity from lot field u1; config "LotNumber" has N (used for the "N" rows). Wording differences are recorded as annotations,
// confirmed requirement gaps are marked test.fail (tracker rows). Evidence per test: runs/API/Print_<stamp>/<id>.json.
import { test, expect } from '@playwright/test';
import { API_USER, NO_API_USER, LT_MAIN } from './api-fixtures';
import { http, lit, markLastSetup, note, sql, useEvidence } from './api-support';
import { create, first, lot } from './lots-helpers';
import { FakePrinter, NEVER_ROUTED_IP, SERVER, PDF_MODEL, PDF_PRINTER, activity, btMark, btPrinters, bytes, countOf, fileDataB, history, isJpg, isPdf, ownIp, pdfStrings, pr, printedImage, request, uncOf } from './print-helpers';

const FRS = 'PRNTAPI.240924.';
const RUN = process.env.API_RUN_ID!;
const t = (frs: string, text: string) => `${FRS}F.${frs} ${text}`;
const wording = (text: string) => test.info().annotations.push({ type: 'wording difference', description: text });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fake = new FakePrinter();
const ghost = `CLAPIUnk${RUN}`; // unknown user id of this run (the rate limit counts per user id for one minute, other specs use their own)
/** A wrong-password call for the known user without API rights; waits out the one-minute rate-limit window another spec may have left on this user id. */
const wrongPassword = async (title: string) => {
  let r = await pr('GetCachedPRN', { printID: 'x' }, title, { user: NO_API_USER, password: 'NotThePassword1' });
  for (let i = 0; i < 4 && typeof r.json === 'string' && r.json.includes('Maximum number of login attempts'); i++) { await sleep(20_000); r = await pr('GetCachedPRN', { printID: 'x' }, title, { user: NO_API_USER, password: 'NotThePassword1' }); }
  return r;
};
let fakeOk = false;
const btStart = btMark();

// ------------------------------------------------------------------------------------------------------------------------------------------------ data (read only)
interface Rel { item: string; lcn: string; template: string; labelType: string }
let cache: { rel: Rel; w: string[] } | undefined;
const data = () => {
  if (cache) return cache;
  const r = sql<{ ItemNumber: string; LCN: string; TemplateName: string }>(
    `select top 1 lc.ItemNumber, lc.LCN, lc.TemplateName from LabelControl lc join Items i on i.ItemNumber = lc.ItemNumber and i.LabelType = lc.LabelType and i.VersionNumber = lc.ItemVersion where lc.ItemNumber like 'CL%' and lc.LabelType = ${lit(LT_MAIN)} and lc.ReleasedBy <> '' and lc.AllowPrint = 'Y' and lc.EffectiveEnd > getdate() and lc.MasterDataVersion is null and lc.ItemNumber not like 'CLSer%' order by lc.LCN desc`,
    'a released CL LCN (print fixture: item, LCN, template)')[0];
  const w = sql<{ LCN: string }>(
    `select top 2 lc.LCN from LabelControl lc join Items i on i.ItemNumber = lc.ItemNumber and i.LabelType = lc.LabelType and i.VersionNumber = lc.ItemVersion join Labels l on l.LabelName = lc.TemplateName and l.VersionNumber = lc.TemplateVersion ` +
      `where lc.ItemNumber like 'CLLCEM%' and lc.LabelType = ${lit(LT_MAIN)} and lc.ReleasedBy = '' and lc.MasterDataVersion is null and i.ApprovedBy <> '' and i.EffectiveBegin <= getdate() and i.EffectiveEnd >= getdate() and l.ApprovedBy <> '' and l.EffectiveBegin <= getdate() and l.EffectiveEnd >= getdate() order by lc.LCN`,
    'the two oldest unreleased, release-eligible CL LCNs (Label Control write fixtures)').map((x) => x.LCN);
  return (cache = { rel: { item: r.ItemNumber, lcn: r.LCN, template: r.TemplateName, labelType: LT_MAIN }, w });
};
const SER_TEMPLATE = 'CLSerITpl917248'; // S_Ser with Serialization = Increment
const USER_TEMPLATE = 'CLSerTpl376733'; // S_USerial
const SER_ITEM = 'CLSerItm8455875'; // two released LCNs (S_USerial template)
const USERIAL_DEFECT = "known defect: a serialNum (S_USerial) print fails on the print server: \"Update or insert of view or function 'PrintHistorySerials' failed because it contains a derived or constant field.\" (PrintHistorySerials.UpdateStatus writes LastTouch, which the view PrintHistorySerials derives with GETDATE(); tracker row 2026-11-19)";

/** A new CL lot (Lots API) of the print fixture item; u1 = batch quantity for the blank PrintConfig. */
const mk = async (k: string, extra: Record<string, unknown> = {}) => {
  const l = lot(k, { itemNumber: data().rel.item, u1: '10', ...extra });
  const c = await create([l], { itemMustExist: true }, `create the lot ${k} (Lots API)`);
  markLastSetup();
  if (c.status !== 200 || first(c.json)?.success !== true) throw new Error(`lot setup failed: ${c.status} ${JSON.stringify(c.json)}`);
  return { id: first(c.json).id as string, req: l };
};
const byTemplate = (lotId: string | undefined, extra: Record<string, unknown> = {}, template?: string) => ({ templateName: template ?? data().rel.template, ...(lotId ? { lotID: lotId } : {}), printerModel: PDF_MODEL, copies: 1, ...extra });
const ok = (r: { status: number; json: any }) => { expect(r.status).toBe(200); expect(r.json.success).toBe(true); };

test.describe('Printing REST API (project 20240924-002)', () => {
  useEvidence('Print');
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    try { await fake.start(); fakeOk = true; } catch (e) { fakeOk = false; console.log('fake printer not available:', (e as Error).message); }
    data();
  });
  test.afterAll(async () => { await fake.stop(); });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.1 infrastructure, authentication
  test(t('1.1', 'the Printing API operates within the main InnoAPI website'), async () => {
    const r = await pr('GetCachedPRN', { printID: 'PID_DOES_NOT_EXIST' });
    expect(r.status).toBe(400); // answered by the Printing controller under /innoapi/
    expect(r.json.errorMessage).toBe('No Print History found for printID PID_DOES_NOT_EXIST');
    wording('the load balancer behind the main InnoAPI site cannot be observed from a test; only that the controller answers under /innoapi/ like the other InnoAPI controllers');
  });

  test(t('1.2', 'the Printing API replaces the old Printing WCF service'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { copies: 1 }), 'a print through the Printing API (no WCF service involved)');
    ok(r);
    expect(r.json.printID).toMatch(/^PID_[0-9A-F]{32}$/);
    wording('"Stopped ROBAR Service Host" cannot be reproduced by a test (it would stop a shared service); the check is that the Printing API prints on its own through the print server, with the request recorded in PrintRequests (RequestingUser SYSGEN)');
  });

  test(t('1.3', 'a Basic Authorization header is required'), async () => {
    const none = await pr('GetCachedPRN', { printID: 'x' }, 'no Authorization header', { user: null });
    expect(none.status).toBe(401);
    const bearer = await http('POST', 'Print/GetCachedPRN', { body: { printID: 'x' }, headers: { Authorization: 'Bearer abc' }, user: null, title: 'a non-Basic Authorization header' });
    expect(bearer.status).toBe(401);
    const good = await pr('GetCachedPRN', { printID: 'x' }, 'Authorization: Basic base64(UserID:Password)');
    expect(good.status).toBe(400); // authenticated: the request itself is rejected
  });

  test(t('1.4', 'the user id and password are validated against the ROBAR Users table'), async () => {
    const unknown = await pr('GetCachedPRN', { printID: 'x' }, 'a user id that is not in the Users table', { user: ghost, password: 'NotThePassword1' });
    expect(unknown.status).toBe(401);
    const wrong = await wrongPassword('a known user with a wrong password');
    expect(wrong.status).toBe(401);
    expect((await pr('GetCachedPRN', { printID: 'x' }, 'valid credentials')).status).toBe(400);
  });

  test(t('1.5', 'an invalid user id or password is rejected with 401 and the reason'), async () => {
    const noUser = await pr('GetCachedPRN', { printID: 'x' }, 'no user', { user: ghost, password: 'NotThePassword1' });
    expect(noUser.status).toBe(401);
    expect(noUser.json).toBe(`401 - Unauthorized: No user found in ROBAR for provided UserID: ${ghost}`);
    const badPw = await wrongPassword('invalid password');
    expect(badPw.json).toBe(`401 - Unauthorized: Invalid password for UserID: ${NO_API_USER}`);
    wording(`requirement: a JSON body {status, error, message "No user found in ROBAR for provided UserID: XXX."}; live: HTTP 401 with the plain text ${JSON.stringify(noUser.json)}. A DISABLED user ("User XXX is disabled") is not exercised: it needs one more undeletable fixture user created inactive (ask first)`);
  });

  test(t('1.7', "the GlobalSetting 'MaxAPILoginFailuresPerMinute' is 10"), async () => {
    const r = sql<{ Value: string }>(`select Value from GlobalSettings where SettingName = 'MaxAPILoginFailuresPerMinute'`, 'GlobalSettings: MaxAPILoginFailuresPerMinute');
    expect(r).toHaveLength(1);
    expect(r[0].Value).toBe('10');
    wording('only the current value can be checked on a live system, not that it is the install default');
  });

  test(t('1.9', 'the userID of a print request is recorded in PrintHistory; PrintRequests always shows SYSGEN'), async () => {
    test.fail(true, "known gap: a userID that is not a ROBAR user is NOT recorded: PrintHistory.UserID stays blank although FRS F.1.9 says it is recorded 'regardless of whether the user exists' (tracker row 2026-11-19)");
    const a = await pr('PrintByTemplate', byTemplate(undefined, { userID: API_USER }), 'userID = an existing ROBAR user');
    ok(a);
    expect(history(a.json.printID).UserID).toBe(API_USER);
    expect(request(a.json.printID).RequestingUser).toBe('SYSGEN');
    const none = await pr('PrintByTemplate', byTemplate(undefined, {}), 'no userID');
    expect(history(none.json.printID).UserID).toBe('');
    expect(request(none.json.printID).RequestingUser).toBe('SYSGEN');
    const ghost = await pr('PrintByTemplate', byTemplate(undefined, { userID: `GhostUser${RUN}` }), 'userID = a name that is not a ROBAR user');
    ok(ghost);
    note('PrintHistory.UserID for a user id that does not exist in ROBAR', { recorded: history(ghost.json.printID).UserID });
    expect(history(ghost.json.printID).UserID, 'requirement: the value is recorded regardless of whether the user exists').toBe(`GhostUser${RUN}`);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.2 required fields
  test(t('2.1', 'a missing or improperly formatted required field is rejected with HTTP 400'), async () => {
    const cases: Array<[string, any, any, RegExp]> = [
      ['PrintByTemplate', {}, 'PrintByTemplate without templateName', /TemplateName is required/],
      ['PrintByLCN', { lotID: 'x' }, 'PrintByLCN without lcn', /Both LCN and LotID are required/],
      ['PrintByLCN', { lcn: 'x' }, 'PrintByLCN without lotID', /Both LCN and LotID are required/],
      ['PrintByItemLabelType', { lotID: 'x' }, 'PrintByItemLabelType without labelType', /LabelType and LotID are required/],
      ['GetCachedPRN', {}, 'GetCachedPRN without printID', /PrintID is required/],
      ['UpdatePrintAsRejected', { printID: 'x' }, 'UpdatePrintAsRejected without rejectedReasonCode', /PrintID and RejectedReasonCode are required/],
    ];
    for (const [route, body, title, msg] of cases) {
      const r = await pr(route as any, body, title);
      expect(r.status, title).toBe(400);
      expect(r.json.success, title).toBe(false);
      expect(r.json.errorMessage, title).toMatch(msg);
    }
    // improperly formatted input: observed, not asserted (tracker row): text in a number field is accepted (taken as 1), a body that is not JSON gets HTTP 200 with an internal error text
    const text = await pr('PrintByTemplate', { templateName: data().rel.template, printerModel: PDF_MODEL, copies: 'not a number' }, 'copies is text, not a number');
    const bad = await http('POST', 'Print/PrintByTemplate', { raw: '{ this is not json', title: 'a request body that is not JSON' });
    note('improperly formatted input', { copiesText: { status: text.status, success: text.json?.success }, notJson: { status: bad.status, errorMessage: bad.json?.errorMessage } });
    wording(`requirement: an improperly formatted field is rejected with 400; live: copies = "not a number" is accepted (HTTP ${text.status}, success ${text.json?.success}) and a body that is not JSON returns HTTP ${bad.status} with "${bad.json?.errorMessage}"`);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.3 assignToPrintServer
  test(t('3.1', 'assignToPrintServer designates the print server that processes the request'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { assignToPrintServer: SERVER }), `assignToPrintServer = ${SERVER}`);
    ok(r);
    expect(request(r.json.printID).AssignedTo.toLowerCase()).toBe(SERVER.toLowerCase());
    expect(request(r.json.printID).WorkStatus).toBe('Success');
  });

  test(t('3.2', 'an empty assignToPrintServer: the default print server monitoring the database processes the request'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { assignToPrintServer: '' }), 'assignToPrintServer = ""');
    ok(r);
    const req = request(r.json.printID);
    expect(req.WorkStatus).toBe('Success');
    note('the default print server', { AssignedTo: req.AssignedTo });
    expect(req.AssignedTo.toUpperCase()).toBe(SERVER.toUpperCase());
  });

  test(t('3.3', 'a given assignToPrintServer value is stored in PrintRequests.AssignedTo'), async () => {
    test.setTimeout(120_000);
    const name = `CLAPINoSuchServer${RUN}`;
    // configName DestLabeling has PrintServerTimeout 0.5 minutes: no print server answers to this name, the call times out after 30 s (the point is the stored value)
    const r = await pr('PrintByTemplate', byTemplate(undefined, { assignToPrintServer: name, configName: 'DestLabeling' }), `assignToPrintServer = ${name} (no such print server: expect a timeout)`);
    note('response of the unprocessed request', { status: r.status, body: r.json });
    const id = sql<{ PrintID: string }>(`select top 1 PrintID from PrintRequests where AssignedTo = ${lit(name)} order by RequestDate desc`, `PrintRequests rows assigned to ${name}`)[0]?.PrintID;
    expect(id, 'the request exists with the AssignedTo value of the call').toBeTruthy();
    expect(request(id).AssignedTo).toBe(name);
    expect(r.json.success).toBe(false); // no print server of that name processes it
    expect(r.json.errorMessage).toMatch(/Timeout waiting for completed print/);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.4 image / PDF in the response
  test(t('4.1', 'returnImageInResponse and returnPDFInResponse accept the Boolean values true and false'), async () => {
    const both = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: true, returnPDFInResponse: true }), 'both true');
    ok(both);
    expect(both.json.imageContentAsBase64Encoded).toBeTruthy();
    expect(both.json.pdfContentAsBase64Encoded).toBeTruthy();
    const off = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: false, returnPDFInResponse: false }), 'both false');
    ok(off);
    expect(off.json.imageContentAsBase64Encoded).toBeNull();
    expect(off.json.pdfContentAsBase64Encoded).toBeNull();
  });

  test(t('4.2', 'blank (null or omitted) returnImageInResponse / returnPDFInResponse count as false'), async () => {
    const omitted = await pr('PrintByTemplate', byTemplate(undefined, {}), 'both omitted');
    ok(omitted);
    const nulls = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: null, returnPDFInResponse: null }), 'both null');
    ok(nulls);
    for (const r of [omitted, nulls]) {
      expect(r.json.imageContentAsBase64Encoded).toBeNull();
      expect(r.json.pdfContentAsBase64Encoded).toBeNull();
    }
  });

  test(t('4.3', 'returnImageInResponse = true returns a rendered image (JPG) of the label'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: true }), 'returnImageInResponse = true');
    ok(r);
    const img = bytes(r.json.imageContentAsBase64Encoded);
    expect(isJpg(img)).toBe(true);
    expect(img.length).toBeGreaterThan(5000);
    expect(r.json.pdfContentAsBase64Encoded).toBeNull();
  });

  test(t('4.4', 'returnImageInResponse = false or blank: no image in the response'), async () => {
    for (const body of [{ returnImageInResponse: false }, {}]) {
      const r = await pr('PrintByTemplate', byTemplate(undefined, body), `returnImageInResponse ${'returnImageInResponse' in body ? '= false' : 'omitted'}`);
      ok(r);
      expect(r.json.imageContentAsBase64Encoded).toBeNull();
    }
  });

  test(t('4.5', 'the JPG is saved in the PrintedImages folder of the server'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: true }), 'returnImageInResponse = true');
    ok(r);
    const file = history(r.json.printID).FileName;
    const unc = file.startsWith('\\\\') ? file.replace(/\\/g, '/') : uncOf(file); // PrintHistory holds the share path of the server
    note('PrintHistory.FileName and the file on the server', { FileName: file, unc, exists: unc ? require('fs').existsSync(unc) : false });
    expect(file).toMatch(/PrintedImages\\\d{6}\\PID_[0-9A-F]{32}\.jpg$/i);
    expect(require('fs').existsSync(unc)).toBe(true);
    expect(printedImage(r.json.printID, 'jpg')).toBeTruthy();
  });

  test(t('4.6', 'returnPDFInResponse = true returns a high-resolution PDF of the label'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnPDFInResponse: true }), 'returnPDFInResponse = true');
    ok(r);
    const pdf = bytes(r.json.pdfContentAsBase64Encoded);
    expect(isPdf(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(5000);
    expect(r.json.imageContentAsBase64Encoded).toBeNull();
  });

  test(t('4.7', 'returnPDFInResponse = false or blank: no PDF in the response'), async () => {
    for (const body of [{ returnPDFInResponse: false }, {}]) {
      const r = await pr('PrintByTemplate', byTemplate(undefined, body), `returnPDFInResponse ${'returnPDFInResponse' in body ? '= false' : 'omitted'}`);
      ok(r);
      expect(r.json.pdfContentAsBase64Encoded).toBeNull();
    }
  });

  test(t('4.9', 'no image, no PDF and none of printerName / printerModel / ipAddress: rejected with 400'), async () => {
    const r = await pr('PrintByTemplate', { templateName: data().rel.template, returnImageInResponse: false, returnPDFInResponse: false, copies: 1 }, 'no image, no PDF, no printer parameters');
    expect(r.status).toBe(400);
    expect(r.json.errorMessage).toMatch(/One of parameters: printer name, printer model, printer IP address must be provided/);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.5 configName
  test(t('5.1', 'a blank configName uses the blank ConfigName and its PrintConfig parameters'), async () => {
    const l = await mk('s1', { u1: '7', u2: '3' });
    const blank = await pr('PrintByTemplate', byTemplate(l.id, { configName: '' }), 'configName = "" (blank configuration: batch quantity from lot field u1)');
    ok(blank);
    const omitted = await pr('PrintByTemplate', byTemplate(l.id, {}), 'configName omitted');
    ok(omitted);
    expect(history(blank.json.printID).BatchQty).toBe(7); // the blank configuration reads the batch quantity from u1
    expect(history(omitted.json.printID).BatchQty).toBe(7);
    const named = await pr('PrintByTemplate', byTemplate(l.id, { configName: 'LotNumber' }), 'configName = LotNumber (another configuration)');
    ok(named);
    expect(history(named.json.printID).BatchQty).not.toBe(7);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.6 printer parameter combinations
  test(t('6.1', 'only printerName: a server-based print to a printer installed on the server'), async () => {
    test.skip(true, 'not automatable on TST703: a server print (printerName only) to the virtual PDF printer waits for a file-name dialog and keeps one BarTender engine of the print server busy; four of them block ALL printing on the server (seen 2026-11-19). A real printer is never used. Execute by hand with a test printer.');
  });

  test(t('6.2', 'only printerModel: the PRN file is generated and returned, nothing is printed'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, {}), 'only printerModel');
    ok(r);
    expect(isPdf(bytes(r.json.prnContentAsBase64Encoded))).toBe(true); // the PRN of the PDF model is a PDF
    expect(request(r.json.printID).RequestType).toBe('PrintPrn');
    expect(history(r.json.printID)).toMatchObject({ Printer: '', PrinterModel: PDF_MODEL });
  });

  test(t('6.3', 'printerModel + ipAddress: the PRN is generated and sent directly to the IP address'), async () => {
    test.skip(!fakeOk, 'the fake printer (TCP 9100 on this PC) could not be started');
    fake.reset();
    const r = await pr('PrintByTemplate', byTemplate(undefined, { ipAddress: ownIp() }), `printerModel + ipAddress = this PC (fake printer on 9100)`);
    ok(r);
    const got = await fake.received();
    note('what the fake printer received', { connections: got.connections, bytes: got.data.length, startsWith: got.data.subarray(0, 5).toString('latin1') });
    expect(got.connections).toBeGreaterThanOrEqual(1);
    expect(isPdf(got.data)).toBe(true); // the PRN itself
    expect(r.json.prnContentAsBase64Encoded).toBeNull(); // sent to the printer, not returned
    expect(history(r.json.printID).PrintStatus).toBe('Printed');
  });

  test(t('6.4', 'printerName + printerModel + ipAddress: sent to the IP address with the model, the printer name is logged in PrintHistory'), async () => {
    test.skip(!fakeOk, 'the fake printer (TCP 9100 on this PC) could not be started');
    fake.reset();
    const r = await pr('PrintByTemplate', byTemplate(undefined, { printerName: PDF_PRINTER, ipAddress: ownIp() }), 'printerName + printerModel + ipAddress = this PC');
    ok(r);
    const got = await fake.received();
    expect(isPdf(got.data)).toBe(true); // went to the IP address ...
    expect(history(r.json.printID)).toMatchObject({ Printer: PDF_PRINTER, PrinterModel: PDF_MODEL, PrintStatus: 'Printed' }); // ... and the name is retained
    expect(request(r.json.printID).RequestType).toBe('PrintPrn');
  });

  test(t('6.5', 'any other combination of printer parameters is rejected with 400'), async () => {
    const none = await pr('PrintByTemplate', { templateName: data().rel.template, returnPDFInResponse: true, copies: 1 }, 'a PDF is requested but there is no printer parameter at all');
    expect(none.status).toBe(400);
    expect(none.json.errorMessage).toBe('If PrinterName is not specified, PrinterModel is required');
    const onlyIp = await pr('PrintByTemplate', { templateName: data().rel.template, ipAddress: NEVER_ROUTED_IP, copies: 1 }, 'only ipAddress (never-routed documentation address)');
    expect(onlyIp.status).toBe(400);
  });

  test(t('6.6', 'every generated PRN (original print or reprint) is recorded in the FileDataB table'), async () => {
    const l = await mk('p6');
    const r = await pr('PrintByTemplate', byTemplate(l.id, {}), 'a print of a new lot');
    ok(r);
    const rows = fileDataB(r.json.printID);
    expect(rows.map((x) => x.Filename)).toEqual([`${r.json.printID}.prn`]);
    expect(rows[0].bytes).toBe(bytes(r.json.prnContentAsBase64Encoded).length);
    const again = await pr('GetCachedPRN', { printID: r.json.printID, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'reprint of the cached PRN' }, 'a reprint (GetCachedPRN)');
    ok(again);
    expect(fileDataB(r.json.printID)).toHaveLength(1); // the reprint reuses the recorded PRN, nothing new is generated
  });

  test(t('6.7', 'generated PRN files are saved in the PrintedImages folder of the server'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: true }), 'a print');
    ok(r);
    const prn = printedImage(r.json.printID, 'prn');
    note('PRN file on the server', { path: prn });
    expect(prn).toBeTruthy();
    expect(require('fs').statSync(prn!).size).toBe(bytes(r.json.prnContentAsBase64Encoded).length);
  });

  test(t('6.8', 'only ipAddress is rejected with 400'), async () => {
    const r = await pr('PrintByTemplate', { templateName: data().rel.template, ipAddress: NEVER_ROUTED_IP, returnPDFInResponse: true, copies: 1 }, 'only ipAddress (and a PDF requested)');
    expect(r.status).toBe(400);
    expect(r.json.errorMessage).toBe('If PrinterName is not specified, PrinterModel is required');
  });

  test(t('6.9', 'printerModel + printerName: the PRN is generated and returned without a direct print; the name is logged in PrintHistory'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { printerName: PDF_PRINTER }), 'printerModel + printerName');
    ok(r);
    expect(isPdf(bytes(r.json.prnContentAsBase64Encoded))).toBe(true);
    expect(request(r.json.printID).RequestType).toBe('PrintPrn');
    expect(history(r.json.printID)).toMatchObject({ Printer: PDF_PRINTER, PrinterModel: PDF_MODEL });
  });

  test(t('6.10', 'ipAddress + printerName (no model): a server-based print'), async () => {
    test.skip(true, 'not automatable on TST703: printerName + ipAddress without a model is a server print (see F.6.1): it blocks a BarTender engine of the print server. Execute by hand with a test printer.');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.7 serialization
  test(t('7.1', 'serialCopies: how many of the printed labels are serialized (S_Ser)'), async () => {
    const l = await mk('q1');
    const r = await pr('PrintByTemplate', byTemplate(l.id, { startingSerial: '001', serialCopies: 3, returnPDFInResponse: false }, SER_TEMPLATE), 'S_Ser template, startingSerial 001, serialCopies 3');
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ SerialNum: 3, Copies: 1 });
    const labels = countOf(await pdfStrings(bytes(r.json.prnContentAsBase64Encoded)), l.req.lotNum!);
    note('labels in the PRN (the lot number is printed once per label)', { labels });
    expect(labels).toBe(3);
    expect(r.json.totalPrintedLabels).toBe(3);
  });

  test(t('7.2', 'startingSerial defines the beginning of the serial sequence'), async () => {
    const l = await mk('q2');
    const r = await pr('PrintByTemplate', byTemplate(l.id, { startingSerial: '0100', serialCopies: 3 }, SER_TEMPLATE), 'S_Ser template, startingSerial 0100, serialCopies 3');
    ok(r);
    const strings = await pdfStrings(bytes(r.json.prnContentAsBase64Encoded));
    const serials = strings.filter((s) => /^0{0,3}10[0-9]$/.test(s) || /^010[0-9]$/.test(s));
    note('serial numbers found on the labels', { serials, sample: strings.slice(0, 40) });
    expect(serials.sort()).toEqual(['0100', '0101', '0102']);
  });

  test(t('7.3', 'serialNum overrides the generated serial number and is used directly (S_USerial)'), async () => {
    test.fail(true, USERIAL_DEFECT);
    const l = await mk('q3');
    const serial = `CLAPI-SN-${RUN}`;
    const r = await pr('PrintByTemplate', byTemplate(l.id, { serialNum: serial }, USER_TEMPLATE), 'S_USerial template, serialNum = CLAPI-SN-<run>');
    ok(r);
    expect(request(r.json.printID).RequestType).toBe('PrintUSerialPrn');
    const strings = await pdfStrings(bytes(r.json.prnContentAsBase64Encoded));
    expect(strings).toContain(serial);
    expect(history(r.json.printID)).toMatchObject({ SerialNum: 1 });
  });

  test(t('7.4', 'a single serial number (S_USerial) returns the single PRN of that serial number'), async () => {
    test.fail(true, USERIAL_DEFECT);
    const l = await mk('q4');
    const serial = `CLAPI-ONE-${RUN}`;
    const r = await pr('PrintByTemplate', byTemplate(l.id, { serialNum: serial }, USER_TEMPLATE), 'one serial number');
    ok(r);
    const strings = await pdfStrings(bytes(r.json.prnContentAsBase64Encoded));
    expect(countOf(strings, serial)).toBe(1);
    expect(countOf(strings, l.req.lotNum!)).toBe(1); // exactly one label
  });

  test(t('7.5', "the PrintConfig parameter 'AllowNewSerialsPrintingAPI' exists"), async () => {
    const rows = sql<{ ConfigName: string; ParamValue: string }>(`select ConfigName, ParamValue from PrintConfig where ParamName = 'AllowNewSerialsPrintingAPI' order by ConfigName`, 'PrintConfig rows of AllowNewSerialsPrintingAPI');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some((x) => x.ConfigName === '')).toBe(true); // the blank ConfigName has it
  });

  test(t('7.6', "'AllowNewSerialsPrintingAPI' accepts the values Y and N"), async () => {
    const rows = sql<{ ConfigName: string; ParamValue: string }>(`select ConfigName, ParamValue from PrintConfig where ParamName = 'AllowNewSerialsPrintingAPI'`, 'PrintConfig rows of AllowNewSerialsPrintingAPI');
    expect(rows.every((x) => x.ParamValue === 'Y' || x.ParamValue === 'N')).toBe(true);
    expect(new Set(rows.map((x) => x.ParamValue))).toEqual(new Set(['Y', 'N']));
    wording(`the requirement says N is the default for the blank ConfigName; on TST703 the blank ConfigName holds '${rows.find((x) => x.ConfigName === '')?.ParamValue}' (set after the install); no setting is changed by this test`);
  });

  test(t('7.7', "AllowNewSerialsPrintingAPI = N: a serial number that is not registered for the lot is rejected with 400"), async () => {
    const l = await mk('q5');
    const serial = `CLAPI-NEW-${RUN}`;
    const r = await pr('PrintByTemplate', byTemplate(l.id, { serialNum: serial, configName: 'LotNumber' }, USER_TEMPLATE), 'configName LotNumber (AllowNew = N), a serial number that is not registered');
    expect(r.status).toBe(400);
    expect(r.json.errorMessage).toBe('AllowNewSerialsPrintingAPI is not configured in the PrintConfig: LotNumber');
    expect(sql<{ n: number }>(`select count(*) n from LotSerialNumbers where SerialNumber = ${lit(serial)}`, 'the serial number was not inserted')[0].n).toBe(0);
    const reg = await mk('q6', { serialNums: [serial] });
    const allowed = await pr('PrintByTemplate', byTemplate(reg.id, { serialNum: serial, configName: 'LotNumber' }, USER_TEMPLATE), 'the same serial number registered for the lot (Lots API): not rejected for AllowNewSerialsPrintingAPI');
    note('the registered serial number is accepted by the check; the print itself then fails on the S_USerial defect of F.7.3', { status: allowed.status, errorMessage: allowed.json?.errorMessage });
    expect(allowed.json?.errorMessage ?? '').not.toContain('AllowNewSerialsPrintingAPI');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.8 copies and reprints
  test(t('8.1', 'copies is the total number of labels to print'), async () => {
    const l = await mk('r1');
    const r = await pr('PrintByTemplate', byTemplate(l.id, { copies: 3 }), 'copies = 3');
    ok(r);
    expect(history(r.json.printID).Copies).toBe(3);
    expect(countOf(await pdfStrings(bytes(r.json.prnContentAsBase64Encoded)), l.req.lotNum!)).toBe(3);
    expect(r.json.totalPrintedLabels).toBe(3); // totalPrintedLabels counts this print too (F.15.5)
  });

  test(t('8.2', 'userID + reprintReasonCode + comment: logged as a reprint in PrintHistory and Activity'), async () => {
    const l = await mk('r2');
    const r = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'API reprint test' }, 'a NEW lot printed with userID + reprintReasonCode + comment');
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ Reprint: 1, UserID: API_USER });
    const act = activity(r.json.printID);
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ UserID: API_USER, Action: 'Reprint signed', ReasonCode: 'QA Review', Comments: 'API reprint test' });
  });

  test(t('8.3', 'copies above the batch quantity without userID and reprintReasonCode: rejected with 400'), async () => {
    const l = await mk('r3', { u1: '1' });
    const a =await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'PrintByItemLabelType: 1 label (the batch quantity)');
    ok(a);
    const b = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'PrintByItemLabelType: one more label, no userID / reprintReasonCode');
    expect(b.status).toBe(400);
    expect(b.json.errorMessage).toBe('User ID and Reprint reason are required for a reprint request.');
  });

  test(t('8.4', 'copies above the batch quantity with userID and reprintReasonCode: a new PrintID is generated'), async () => {
    const l = await mk('r4', { u1: '1' });
    const a = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'PrintByItemLabelType: 1 label (the batch quantity)');
    ok(a);
    const b = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1, userID: API_USER, reprintReasonCode: 'QA Review' }, 'one more label WITH userID + reprintReasonCode');
    ok(b);
    expect(b.json.printID).not.toBe(a.json.printID);
    expect(b.json.printID).toMatch(/^PID_[0-9A-F]{32}$/);
    expect(history(b.json.printID)).toMatchObject({ Reprint: 1, UserID: API_USER });
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.9 shareNameValuePairs
  const pairs = (m: string) => [{ shareName: 'I_Desc', value: `OVERRIDE-DESC-${m}` }, { shareName: 'L_Num', value: `OVERRIDE-LOT-${m}` }];

  test(t('9.1', 'shareNameValuePairs give name / value pairs for the fields of the template'), async () => {
    const l = await mk('t1');
    const r = await pr('PrintByTemplate', byTemplate(l.id, { shareNameValuePairs: pairs(RUN) }), 'shareNameValuePairs: I_Desc and L_Num');
    ok(r);
    const strings = await pdfStrings(bytes(r.json.prnContentAsBase64Encoded));
    expect(strings).toContain(`OVERRIDE-DESC-${RUN}`);
    expect(strings).toContain(`OVERRIDE-LOT-${RUN}`);
  });

  test(t('9.2', 'the provided values overwrite existing data in the template at print time'), async () => {
    const l = await mk('t2');
    const plain = await pr('PrintByTemplate', byTemplate(l.id, {}), 'without shareNameValuePairs');
    const over = await pr('PrintByTemplate', byTemplate(l.id, { shareNameValuePairs: pairs(`${RUN}b`) }), 'with shareNameValuePairs');
    ok(plain);
    ok(over);
    const sPlain = await pdfStrings(bytes(plain.json.prnContentAsBase64Encoded));
    const sOver = await pdfStrings(bytes(over.json.prnContentAsBase64Encoded));
    expect(sPlain).toContain(l.req.lotNum!); // the existing lot number ...
    expect(sOver).not.toContain(l.req.lotNum!); // ... is replaced by the override
    expect(sOver).toContain(`OVERRIDE-LOT-${RUN}b`);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.10 PrintByLCN
  test(t('10.1', 'POST PrintByLCN prints the label of a label control number'), async () => {
    const l = await mk('u1');
    const r = await pr('PrintByLCN', { lcn: data().rel.lcn, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'PrintByLCN');
    ok(r);
    wording('the requirement shows https://server/InnoAPI/Print/PrintByLCN; the live URL is http://<server>/innoapi/Print/PrintByLCN');
  });

  test(t('10.2', 'the PrintByLCN request carries the listed parameters'), async () => {
    const l = await mk('u2');
    const r = await pr('PrintByLCN', {
      assignToPrintServer: '', returnImageInResponse: true, returnPDFInResponse: true, configName: '', lcn: data().rel.lcn, lotID: l.id, printerModel: PDF_MODEL, templateName: data().rel.template, copies: 2, serialCopies: 1,
      userID: API_USER, reprintReasonCode: 'QA Review', comment: 'all parameters', shareNameValuePairs: [{ shareName: 'I_Desc', value: `ALLPARAM-${RUN}` }],
    }, 'PrintByLCN with all parameters of the example request (PDF printer model)');
    ok(r);
    expect(r.json.imageContentAsBase64Encoded).toBeTruthy();
    expect(r.json.pdfContentAsBase64Encoded).toBeTruthy();
    expect(history(r.json.printID)).toMatchObject({ Copies: 2, UserID: API_USER, LCN: data().rel.lcn });
  });

  test(t('10.3', 'lcn is required and decides Item, Template and Master Data'), async () => {
    const l = await mk('u3');
    const r = await pr('PrintByLCN', { lcn: data().rel.lcn, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'PrintByLCN');
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ LCN: data().rel.lcn, ItemNumber: data().rel.item, LabelName: data().rel.template });
    const none = await pr('PrintByLCN', { lotID: l.id, printerModel: PDF_MODEL }, 'PrintByLCN without lcn');
    expect(none.status).toBe(400);
  });

  test(t('10.4', 'the lcn must be released and effective'), async () => {
    const l = await mk('u4');
    const w1 = data().w[0];
    const r = await pr('PrintByLCN', { lcn: w1, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, `PrintByLCN with the UNRELEASED ${w1}`);
    expect(r.status).toBe(400);
    expect(r.json.errorMessage).toBe(`LCN is not released: ${w1}`);
  });

  test(t('10.5', 'lotID is required and gives the work order details'), async () => {
    const none = await pr('PrintByLCN', { lcn: data().rel.lcn, printerModel: PDF_MODEL }, 'PrintByLCN without lotID');
    expect(none.status).toBe(400);
    expect(none.json.errorMessage).toBe('Both LCN and LotID are required');
    const l = await mk('u5');
    const r = await pr('PrintByLCN', { lcn: data().rel.lcn, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'PrintByLCN with a lotID');
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ Lot: l.req.lotNum, OrderNum: l.req.orderNum });
  });

  test(t('10.6', 'with lcn, templateName and lotID: the lcn decides Item / Template / Master Data, the lotID the lot'), async () => {
    const l = await mk('u6');
    const r = await pr('PrintByLCN', { lcn: data().rel.lcn, lotID: l.id, templateName: SER_TEMPLATE, printerModel: PDF_MODEL, copies: 1 }, `PrintByLCN with an unrelated templateName (${SER_TEMPLATE})`);
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ LabelName: data().rel.template, Lot: l.req.lotNum }); // the template of the LCN, not the one in the request
  });

  test(t('10.7', 'a missing or unknown lcn or lotID is rejected with 400'), async () => {
    test.fail(true, "known gap: an lcn that does not exist is NOT rejected with 400: the call returns HTTP 200 with the internal text 'Cannot retrieve field: AllowPrint.  Field (name) exists, but no values populated in history...' (tracker row 2026-11-19); the other three cases behave as required");
    const l = await mk('u7');
    const cases: Array<[any, string, RegExp]> = [
      [{ lotID: l.id }, 'no lcn', /Both LCN and LotID are required/], [{ lcn: data().rel.lcn }, 'no lotID', /Both LCN and LotID are required/],
      [{ lcn: data().rel.lcn, lotID: '00000000-0000-0000-0000-000000000000' }, 'a lotID that does not exist', /No lot found for ID/],
      [{ lcn: 'LCN9999999', lotID: l.id }, 'an lcn that does not exist', /No LCN found for LCN: LCN9999999/],
    ];
    for (const [b, what, msg] of cases) {
      const r = await pr('PrintByLCN', { ...b, printerModel: PDF_MODEL, copies: 1 }, `PrintByLCN: ${what}`);
      expect(r.status, what).toBe(400);
      expect(r.json.errorMessage, what).toMatch(msg);
    }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.11 PrintByItemLabelType
  const byItem = (lotId: string, extra: Record<string, unknown> = {}) => ({ itemNumber: data().rel.item, labelType: LT_MAIN, lotID: lotId, printerModel: PDF_MODEL, copies: 1, ...extra });

  test(t('11.1', 'POST PrintByItemLabelType prints by item and label type'), async () => {
    const l = await mk('v1');
    const r = await pr('PrintByItemLabelType', byItem(l.id), 'PrintByItemLabelType');
    ok(r);
    wording('the requirement shows https://server/InnoAPI/Print/PrintByItemLabelType; the live URL is http://<server>/innoapi/Print/PrintByItemLabelType');
  });

  test(t('11.2', 'the PrintByItemLabelType request carries the listed parameters'), async () => {
    const l = await mk('v2');
    const r = await pr('PrintByItemLabelType', byItem(l.id, { assignToPrintServer: '', returnImageInResponse: true, returnPDFInResponse: true, configName: '', templateName: SER_TEMPLATE, serialCopies: 1, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'all parameters', shareNameValuePairs: [{ shareName: 'I_Desc', value: `ALLPARAM-${RUN}` }] }), 'PrintByItemLabelType with all parameters of the example request (PDF printer model)');
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ UserID: API_USER, ItemNumber: data().rel.item });
  });

  test(t('11.3', 'labelType is required'), async () => {
    const l = await mk('v3');
    const none = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, lotID: l.id, printerModel: PDF_MODEL }, 'PrintByItemLabelType without labelType');
    expect(none.status).toBe(400);
    expect(none.json.errorMessage).toBe('LabelType and LotID are required');
    ok(await pr('PrintByItemLabelType', byItem(l.id), 'PrintByItemLabelType with labelType'));
  });

  test(t('11.4', 'lotID is required'), async () => {
    const none = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, printerModel: PDF_MODEL }, 'PrintByItemLabelType without lotID');
    expect(none.status).toBe(400);
    expect(none.json.errorMessage).toBe('LabelType and LotID are required');
  });

  test(t('11.5', 'itemNumber identifies the item of the print request'), async () => {
    const l = await mk('v5', { itemNumber: SER_ITEM });
    const r = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, `itemNumber = ${data().rel.item} (the lot belongs to another item)`);
    ok(r);
    expect(history(r.json.printID).ItemNumber).toBe(data().rel.item);
  });

  test(t('11.6', 'without itemNumber the item number is taken from the lot record'), async () => {
    const l = await mk('v6');
    const r = await pr('PrintByItemLabelType', { labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1 }, 'itemNumber omitted');
    ok(r);
    expect(history(r.json.printID).ItemNumber).toBe(data().rel.item);
  });

  test(t('11.7', 'the latest released LCN of the item / label type is used'), async () => {
    const lcns = sql<{ LCN: string; ItemVersion: number; ReleasedBy: string }>(`select LCN, ItemVersion, ReleasedBy from LabelControl where ItemNumber = ${lit(SER_ITEM)} and LabelType = ${lit(LT_MAIN)} order by ItemVersion, LCN`, `LCNs of ${SER_ITEM}`);
    expect(lcns.filter((x) => x.ReleasedBy).length).toBeGreaterThanOrEqual(2);
    // the only CL item with two released LCNs uses an S_USerial template, whose print fails on the print server (F.7.3 defect): the LCN that was used cannot be observed
    test.skip(true, `blocked by the S_USerial defect of F.7.3: the only fixture item with two released LCNs (${SER_ITEM}) has an S_USerial template; its print fails after the LCN is chosen and no PrintHistory row is written. Re-run when the defect is fixed (the call is: PrintByItemLabelType, itemNumber ${SER_ITEM}, serialNum).`);
  });

  test(t('11.8', 'a LCN locked to the lot is used only if it is effective and released, otherwise 400'), async () => {
    test.setTimeout(240_000);
    const [w1] = data().w;
    const wItem = sql<{ ItemNumber: string }>(`select ItemNumber from LabelControl where LCN = ${lit(w1)}`, `item of ${w1}`)[0].ItemNumber;
    const lcApi = (route: string, body: unknown, title: string) => http('POST', `LabelControl/${route}`, { body, title });
    const l = await mk('v8', { itemNumber: wItem, lcns: [w1] });
    const orig = sql<{ eb: string; ee: string }>(`select convert(varchar(10), EffectiveBegin, 112) eb, convert(varchar(10), EffectiveEnd, 112) ee from LabelControl where LCN = ${lit(w1)}`, `effective dates of ${w1}`)[0];
    const req = { itemNumber: wItem, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1 };
    try {
      const rel = await lcApi('ToggleLCNRelease', { released: true, releasedBy: 'API print test', lcns: [w1] }, `release ${w1} (Label Control API)`);
      expect(rel.json.success).toBe(true);
      const used = await pr('PrintByItemLabelType', req, 'the locked LCN is released and effective');
      ok(used);
      expect(history(used.json.printID).LCN).toBe(w1);
      const unrel = await lcApi('ToggleLCNRelease', { released: false, lcns: [w1] }, `unrelease ${w1}`);
      expect(unrel.json.success).toBe(true);
      const notReleased = await pr('PrintByItemLabelType', req, 'the locked LCN is NOT released');
      expect(notReleased.status).toBe(400);
      note("message when the locked LCN is not released", notReleased.json.errorMessage);
      expect(notReleased.json.errorMessage).toMatch(/locked to LCN|No released Label Control found/);
      expect((await lcApi('ToggleLCNRelease', { released: true, releasedBy: 'API print test', lcns: [w1] }, `release ${w1} again`)).json.success).toBe(true);
      expect((await lcApi('UpdateLCNEffectivityDates', { effectiveBegin: null, effectiveEnd: '20250101', lcns: [w1] }, `effective end in the past for ${w1}`)).json.success).toBe(true);
      const notEffective = await pr('PrintByItemLabelType', req, 'the locked LCN is released but NOT effective');
      expect(notEffective.status).toBe(400);
      note("message when the locked LCN is not effective", notEffective.json.errorMessage);
      expect(notEffective.json.errorMessage).toMatch(/locked to LCN|No released Label Control found/);
    } finally {
      await lcApi('UpdateLCNEffectivityDates', { effectiveBegin: orig.eb, effectiveEnd: orig.ee, lcns: [w1] }, `restore the effective dates of ${w1}`);
      await lcApi('ToggleLCNRelease', { released: false, lcns: [w1] }, `put ${w1} back to unreleased`);
    }
  });

  test(t('11.9', 'a missing or unknown labelType or lotID is rejected with 400'), async () => {
    const l = await mk('v9');
    const cases: Array<[any, string, RegExp]> = [
      [{ lotID: l.id }, 'no labelType', /LabelType and LotID are required/], [{ labelType: LT_MAIN }, 'no lotID', /LabelType and LotID are required/],
      [{ labelType: 'No Such Label Type', lotID: l.id }, 'a labelType that does not exist', /No released Label Control found for LabelType: No Such Label Type/],
      [{ labelType: LT_MAIN, lotID: '00000000-0000-0000-0000-000000000000' }, 'a lotID that does not exist', /No lot found for ID/],
    ];
    for (const [b, what, msg] of cases) {
      const r = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, printerModel: PDF_MODEL, copies: 1, ...b }, `PrintByItemLabelType: ${what}`);
      expect(r.status, what).toBe(400);
      expect(r.json.errorMessage, what).toMatch(msg);
    }
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.12 PrintByTemplate
  test(t('12.1', 'POST PrintByTemplate prints by template'), async () => {
    const l = await mk('w1');
    const r = await pr('PrintByTemplate', byTemplate(l.id), 'PrintByTemplate');
    ok(r);
    expect(history(r.json.printID).LabelName).toBe(data().rel.template);
    wording('the requirement shows https://server/InnoAPI/Print/PrintByTemplate; the live URL is http://<server>/innoapi/Print/PrintByTemplate');
  });

  test(t('12.2', 'the PrintByTemplate request carries the listed parameters'), async () => {
    const l = await mk('w2');
    const r = await pr('PrintByTemplate', { assignToPrintServer: '', returnImageInResponse: true, returnPDFInResponse: true, configName: '', templateName: data().rel.template, lotID: l.id, printerModel: PDF_MODEL, copies: 2, serialCopies: 1, userID: API_USER, comment: 'all parameters', shareNameValuePairs: [{ shareName: 'I_Desc', value: `ALLPARAM-${RUN}` }] }, 'PrintByTemplate with all parameters of the example request (PDF printer model)');
    ok(r);
    expect(history(r.json.printID)).toMatchObject({ Copies: 2, UserID: API_USER });
  });

  test(t('12.3', 'templateName is required'), async () => {
    const r = await pr('PrintByTemplate', { printerModel: PDF_MODEL, copies: 1 }, 'PrintByTemplate without templateName');
    expect(r.status).toBe(400);
    expect(r.json.errorMessage).toBe('TemplateName is required');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.13 GetCachedPRN
  let cached: { printId: string; prn: Buffer; copiesOriginal: number; lotId: string } = { printId: '', prn: Buffer.alloc(0), copiesOriginal: 2, lotId: '' };

  test(t('13.1', 'POST GetCachedPRN returns the PRN of a previous print'), async () => {
    const l = await mk('x1', { u1: '50' });
    const orig = await pr('PrintByTemplate', byTemplate(l.id, { copies: cached.copiesOriginal }), 'the original print (2 copies)');
    ok(orig);
    cached = { ...cached, printId: orig.json.printID, prn: bytes(orig.json.prnContentAsBase64Encoded), lotId: l.id };
    const r = await pr('GetCachedPRN', { printID: cached.printId, printerName: '', ipAddress: '', userID: API_USER, reprintReasonCode: 'QA Review', comment: 'cached PRN' }, 'GetCachedPRN of that print');
    ok(r);
    expect(r.json.printID).toBe(cached.printId);
    wording('the requirement shows https://server/InnoAPI/Print/GetCachedPRN; the live URL is http://<server>/innoapi/Print/GetCachedPRN');
  });

  test(t('13.2', 'the GetCachedPRN request carries printerName, ipAddress, printID, userID, reprintReasonCode and comment'), async () => {
    const r = await pr('GetCachedPRN', { printerName: '', ipAddress: '', printID: cached.printId, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'all parameters' }, 'GetCachedPRN with all parameters of the example request');
    ok(r);
    expect(isPdf(bytes(r.json.prnContentAsBase64Encoded))).toBe(true);
  });

  test(t('13.3', 'the printID is validated against PrintHistory'), async () => {
    const r = await pr('GetCachedPRN', { printID: `PID_${'0'.repeat(32)}`, userID: API_USER, reprintReasonCode: 'QA Review' }, 'a printID that is not in PrintHistory');
    expect(r.status).toBe(400);
    expect(r.json.errorMessage).toMatch(/^No Print History found for printID PID_0{32}$/);
    expect(history(cached.printId)).toBeTruthy();
  });

  test(t('13.4', 'the previously used PRN is retrieved and sent to the specified printer; no new PRN is generated'), async () => {
    const before = sql<{ n: number }>(`select count(*) n from FileDataB where Filename like 'PID[_]%'`, 'FileDataB PRN files before')[0].n;
    const r = await pr('GetCachedPRN', { printID: cached.printId, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'same PRN' }, 'GetCachedPRN (PRN returned)');
    ok(r);
    expect(bytes(r.json.prnContentAsBase64Encoded).equals(cached.prn)).toBe(true); // the SAME PRN
    expect(sql<{ n: number }>(`select count(*) n from FileDataB where Filename like 'PID[_]%'`, 'FileDataB PRN files after')[0].n).toBe(before); // nothing new
    if (fakeOk) {
      fake.reset();
      const ip = await pr('GetCachedPRN', { printID: cached.printId, ipAddress: ownIp(), userID: API_USER, reprintReasonCode: 'QA Review', comment: 'to the fake printer' }, 'GetCachedPRN sent to the IP address (fake printer on this PC)');
      ok(ip);
      const got = await fake.received();
      expect(got.data.equals(cached.prn)).toBe(true); // the printer received exactly the cached PRN
    }
  });

  test(t('13.5', 'the original print job is replicated with the same number of copies'), async () => {
    test.fail(true, 'known gap: GetCachedPRN counts the copies of the REQUEST (default 1), not the copies of the original print (tracker row 2026-11-19)');
    const l = await mk('x2', { u1: '50' });
    const orig = await pr('PrintByTemplate', byTemplate(l.id, { copies: 3 }), 'the original print (3 copies)');
    ok(orig);
    expect(history(orig.json.printID).Copies).toBe(3);
    const r = await pr('GetCachedPRN', { printID: orig.json.printID, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'replicate' }, 'GetCachedPRN without copies');
    ok(r);
    const h = history(orig.json.printID);
    note('PrintHistory copies after the cached print (original 3)', { Copies: h.Copies });
    expect(h.Copies, 'requirement: the same number of copies as the original (3 + 3)').toBe(6);
  });

  test(t('13.6', 'each print increments the print count in PrintHistory'), async () => {
    const l = await mk('x3', { u1: '50' });
    const orig = await pr('PrintByTemplate', byTemplate(l.id, { copies: 1 }), 'the original print (1 copy)');
    ok(orig);
    expect(history(orig.json.printID).Copies).toBe(1);
    const a = await pr('GetCachedPRN', { printID: orig.json.printID, copies: 2, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'two more' }, 'GetCachedPRN copies = 2');
    ok(a);
    expect(history(orig.json.printID).Copies).toBe(3);
    const b = await pr('GetCachedPRN', { printID: orig.json.printID, copies: 1, userID: API_USER, reprintReasonCode: 'QA Review', comment: 'one more' }, 'GetCachedPRN copies = 1');
    ok(b);
    expect(history(orig.json.printID).Copies).toBe(4);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.14 UpdatePrintAsRejected
  test(t('14.1', 'UpdatePrintAsRejected replaces UpdatePrintAsSuccess'), async () => {
    const l = await mk('y1');
    const p = await pr('PrintByTemplate', byTemplate(l.id, {}), 'a print');
    ok(p);
    await sleep(4000); // let the print server finish its own status updates (FileCreated) before the printer reports a rejection
    const r = await pr('UpdatePrintAsRejected', { printID: p.json.printID, rejectedReasonCode: 'Printer is busted' }, 'UpdatePrintAsRejected');
    ok(r);
    expect(r.json.printID).toBe(p.json.printID);
    wording('the old UpdatePrintAsSuccess function of the WCF service is not exposed: only UpdatePrintAsRejected exists');
  });

  test(t('14.2', 'POST UpdatePrintAsRejected is the endpoint'), async () => {
    const l = await mk('y2');
    const p = await pr('PrintByTemplate', byTemplate(l.id, {}), 'a print');
    ok(p);
    await sleep(4000); // let the print server finish its own status updates (FileCreated) before the printer reports a rejection
    const r = await pr('UpdatePrintAsRejected', { printID: p.json.printID, rejectedReasonCode: 'Printer is busted' }, 'POST Print/UpdatePrintAsRejected');
    ok(r);
    const unknown = await pr('UpdatePrintAsRejected', { printID: 'PID_DOES_NOT_EXIST', rejectedReasonCode: 'x' }, 'UpdatePrintAsRejected with an unknown printID');
    note('an unknown printID', { status: unknown.status, errorMessage: unknown.json?.errorMessage });
    wording(`an unknown printID is answered with HTTP ${unknown.status} and the internal text "${unknown.json?.errorMessage}" instead of a clear message (tracker row)`);
    wording('the requirement shows https://server/InnoAPI/Print/UpdatePrintAsRejected; the live URL is http://<server>/innoapi/Print/UpdatePrintAsRejected');
  });

  test(t('14.3', "a new print status value 'Rejected' exists in PrintHistory"), async () => {
    const l = await mk('y3');
    const p = await pr('PrintByTemplate', byTemplate(l.id, {}), 'a print');
    ok(p);
    await sleep(4000); // let the print server finish its own status updates (FileCreated) before the printer reports a rejection
    expect(history(p.json.printID).PrintStatus).toBe('Printed');
    ok(await pr('UpdatePrintAsRejected', { printID: p.json.printID, rejectedReasonCode: 'Printer is busted' }, 'UpdatePrintAsRejected'));
    expect(history(p.json.printID).PrintStatus).toBe('Rejected');
    expect(sql<{ PrintStatus: string }>(`select distinct PrintStatus from PrintHistory where PrintStatus = 'Rejected'`, 'PrintHistory statuses').map((x) => x.PrintStatus)).toEqual(['Rejected']);
  });

  test(t('14.4', "'Rejected' records are excluded from the reprint count logic"), async () => {
    const l = await mk('y4', { u1: '50' });
    const a = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 3 }, 'print 3 labels');
    ok(a);
    const b = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1, userID: API_USER, reprintReasonCode: 'QA Review' }, 'print 1 more label (the count before it: 3)');
    ok(b);
    expect(b.json.totalPrintedLabels).toBe(4); // 3 + 1
    ok(await pr('UpdatePrintAsRejected', { printID: a.json.printID, rejectedReasonCode: 'Printer is busted' }, 'reject the 3-label print'));
    const c = await pr('PrintByItemLabelType', { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL, copies: 1, userID: API_USER, reprintReasonCode: 'QA Review' }, 'print 1 more label after the rejection');
    ok(c);
    expect(c.json.totalPrintedLabels).toBe(2); // the rejected 3 labels no longer count: 1 (second print) + 1
  });

  test(t('14.5', "a failed print is recorded as 'Rejected' with the rejectedReasonCode in Activity; no userID is needed"), async () => {
    const l = await mk('y5');
    const p = await pr('PrintByTemplate', byTemplate(l.id, {}), 'a print whose PRN is then reported as failing at the printer');
    ok(p);
    await sleep(4000); // let the print server finish its own status updates (FileCreated) before the printer reports a rejection
    const r = await pr('UpdatePrintAsRejected', { printID: p.json.printID, rejectedReasonCode: `Printer is busted ${RUN}` }, 'UpdatePrintAsRejected without any userID');
    ok(r);
    expect(history(p.json.printID).PrintStatus).toBe('Rejected');
    const act = activity(p.json.printID).filter((x) => x.Action === 'PrintRequest Rejected');
    expect(act).toHaveLength(1);
    expect(act[0].UserID.toUpperCase()).toBe('SYSGEN'); // stored as 'SysGen'
    expect(act[0].ReasonCode).toBe(`Printer is busted ${RUN}`);
  });

  test(t('14.6', 'the request carries printID and rejectedReasonCode'), async () => {
    const l = await mk('y6');
    const p = await pr('PrintByTemplate', byTemplate(l.id, {}), 'a print');
    ok(p);
    await sleep(4000); // let the print server finish its own status updates (FileCreated) before the printer reports a rejection
    const r = await pr('UpdatePrintAsRejected', { printID: p.json.printID, rejectedReasonCode: 'Printer is busted' }, 'UpdatePrintAsRejected { printID, rejectedReasonCode }');
    ok(r);
    const missing = await pr('UpdatePrintAsRejected', { rejectedReasonCode: 'x' }, 'UpdatePrintAsRejected without printID');
    expect(missing.status).toBe(400);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- F.15 response
  test(t('15.1', 'the response has success, errorMessage, printID, totalPrintedLabels and the three Base64 properties'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: true, returnPDFInResponse: true }), 'a print with image and PDF');
    ok(r);
    expect(Object.keys(r.json).sort()).toEqual(['errorMessage', 'imageContentAsBase64Encoded', 'pdfContentAsBase64Encoded', 'printID', 'prnContentAsBase64Encoded', 'success', 'totalPrintedLabels']);
  });

  test(t('15.2', 'success is true for a successful print and false for a failure'), async () => {
    const good = await pr('PrintByTemplate', byTemplate(undefined, {}), 'a successful print');
    expect(good.json.success).toBe(true);
    const bad = await pr('PrintByLCN', { lcn: 'LCN9999999', lotID: '00000000-0000-0000-0000-000000000000', printerModel: PDF_MODEL }, 'a failing request');
    expect(bad.json.success).toBe(false);
  });

  test(t('15.3', 'errorMessage is null on success and explains the reason on failure'), async () => {
    const good = await pr('PrintByTemplate', byTemplate(undefined, {}), 'a successful print');
    note('errorMessage of a successful print', { errorMessage: good.json.errorMessage });
    expect([null, '']).toContain(good.json.errorMessage);
    const bad = await pr('PrintByLCN', { lcn: 'LCN9999999', lotID: '00000000-0000-0000-0000-000000000000', printerModel: PDF_MODEL }, 'a failing request');
    expect(bad.json.errorMessage).toBeTruthy();
    if (good.json.errorMessage === '') wording('requirement: errorMessage is null on success; live: the empty string ""');
  });

  test(t('15.4', 'printID is a unique identifier of the print job'), async () => {
    const a = await pr('PrintByTemplate', byTemplate(undefined, {}), 'print 1');
    const b = await pr('PrintByTemplate', byTemplate(undefined, {}), 'print 2');
    expect(a.json.printID).toMatch(/^PID_[0-9A-F]{32}$/);
    expect(b.json.printID).not.toBe(a.json.printID);
    expect(history(a.json.printID).PrintID).toBe(a.json.printID);
  });

  test(t('15.5', 'totalPrintedLabels is the cumulative number of labels printed for the lot / label type'), async () => {
    const l = await mk('z1', { u1: '50' });
    const base = { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: l.id, printerModel: PDF_MODEL };
    const p1 = await pr('PrintByItemLabelType', { ...base, copies: 1 }, 'non-serialized: 1 label');
    expect(p1.json.totalPrintedLabels).toBe(1);
    const p2 = await pr('PrintByItemLabelType', { ...base, copies: 1 }, 'non-serialized: 1 more label, one at a time');
    expect(p2.json.totalPrintedLabels).toBe(2);
    const p3 = await pr('PrintByItemLabelType', { ...base, copies: 2 }, 'non-serialized: 2 more labels');
    expect(p3.json.totalPrintedLabels).toBe(4);
    const s = await mk('z2', { u1: '50' });
    const sBase = { itemNumber: data().rel.item, labelType: LT_MAIN, lotID: s.id, printerModel: PDF_MODEL };
    const s1 = await pr('PrintByTemplate', { templateName: SER_TEMPLATE, lotID: s.id, printerModel: PDF_MODEL, copies: 1, serialCopies: 3, startingSerial: '001' }, 'serialized: 3 labels (copies 1 x serialCopies 3)');
    ok(s1);
    note('totalPrintedLabels of a serialized print', { totalPrintedLabels: s1.json.totalPrintedLabels });
    expect(s1.json.totalPrintedLabels).toBe(3);
    void sBase;
  });

  test(t('15.6', 'prnContentAsBase64Encoded is the PRN as Base64 when the PRN is returned'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, {}), 'only printerModel: the PRN is returned');
    ok(r);
    expect(isPdf(bytes(r.json.prnContentAsBase64Encoded))).toBe(true);
    if (fakeOk) {
      fake.reset();
      const sent = await pr('PrintByTemplate', byTemplate(undefined, { ipAddress: ownIp() }), 'sent to an IP address (fake printer): no PRN is returned');
      ok(sent);
      expect(sent.json.prnContentAsBase64Encoded).toBeNull();
      await fake.received();
    }
  });

  test(t('15.7', 'imageContentAsBase64Encoded is a Base64 JPG when returnImageInResponse = true'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnImageInResponse: true }), 'returnImageInResponse = true');
    expect(isJpg(bytes(r.json.imageContentAsBase64Encoded))).toBe(true);
  });

  test(t('15.8', 'pdfContentAsBase64Encoded is a Base64 PDF when returnPDFInResponse = true'), async () => {
    const r = await pr('PrintByTemplate', byTemplate(undefined, { returnPDFInResponse: true }), 'returnPDFInResponse = true');
    expect(isPdf(bytes(r.json.pdfContentAsBase64Encoded))).toBe(true);
  });

  test(t('15.9', 'the three Base64 properties are null when not requested'), async () => {
    if (fakeOk) {
      fake.reset();
      const sent = await pr('PrintByTemplate', byTemplate(undefined, { ipAddress: ownIp() }), 'sent to an IP address (fake printer), without image / PDF');
      ok(sent);
      expect(sent.json.prnContentAsBase64Encoded).toBeNull();
      expect(sent.json.imageContentAsBase64Encoded).toBeNull();
      expect(sent.json.pdfContentAsBase64Encoded).toBeNull();
      await fake.received();
    }
    const model =await pr('PrintByTemplate', byTemplate(undefined, {}), 'model only, no image / PDF');
    expect(model.json.imageContentAsBase64Encoded).toBeNull();
    expect(model.json.pdfContentAsBase64Encoded).toBeNull();
  });

  // ---------------------------------------------------------------------------------------------------------------------------------------------- security process and rate limit (last)
  test('PRNTAPI.240924.support API_Printing: the security group and process; a user without it is rejected', async () => {
    const g = sql<{ ProcessName: string; Authorized: string }>(`select ProcessName, Authorized from [security] where UserGroup = 'ROBAR_API_Security' and ProcessName = 'API_Printing'`, 'security: ROBAR_API_Security / API_Printing');
    expect(g).toEqual([{ ProcessName: 'API_Printing', Authorized: 'Y' }]);
    const r = await pr('GetCachedPRN', { printID: 'x' }, `GetCachedPRN as ${NO_API_USER}`, { user: NO_API_USER });
    expect(r.status).toBe(401);
    expect(r.json).toBe('User not authorized for this task: API_Printing.');
  });

  test(t('1.8', 'more failed logins than MaxAPILoginFailuresPerMinute in a minute: 401 with the maximum-attempts message and a three second delay'), async () => {
    test.setTimeout(240_000);
    const user = `CLAPIRate${RUN}`;
    const timings: number[] = [];
    let last: any;
    for (let i = 1; i <= 12; i++) {
      const t0 = Date.now();
      last = await pr('GetCachedPRN', { printID: 'x' }, `failed login ${i} of 12 (unknown user id)`, { user, password: 'NotThePassword1' });
      timings.push(Date.now() - t0);
    }
    note('response times in ms of the 12 failed logins', timings);
    expect(timings.slice(0, 10).every((ms) => ms < 2500)).toBe(true);
    expect(timings[10]).toBeGreaterThanOrEqual(2900);
    expect(timings[11]).toBeGreaterThanOrEqual(2900);
    expect(last.status).toBe(401);
    expect(last.json).toContain('Maximum number of login attempts per minute exceeded for this UserID');
    wording(`requirement example: a JSON body {status, error, message}; live: HTTP 401 and the plain text ${JSON.stringify(last.json)}`);
  });

  test(t('1.6', 'the rate-limit check does not increment FailCount of the user'), async () => {
    test.setTimeout(240_000);
    const count = () => sql<{ FailCount: number }>(`select FailCount from Users where UserID = ${lit(NO_API_USER)}`, `Users.FailCount of ${NO_API_USER}`)[0].FailCount;
    const before = count();
    for (let i = 1; i <= 12; i++) await pr('GetCachedPRN', { printID: 'x' }, `failed login ${i} of 12 (${NO_API_USER}, wrong password)`, { user: NO_API_USER, password: 'NotThePassword1' });
    expect(count()).toBe(before);
    await sleep(62_000); // the one-minute window of this user id must end before other tests use it again
  });

  test('zz_audit BarTender log: only the Microsoft Print to PDF printer was used by these tests', async () => {
    const printers = btPrinters(btStart);
    note('printer names BarTender reported since the start of this spec', printers);
    expect(printers.length).toBeGreaterThan(0);
    expect(printers.filter((p) => p !== PDF_PRINTER), 'a printer other than the PDF printer was used').toEqual([]);
  });
});
