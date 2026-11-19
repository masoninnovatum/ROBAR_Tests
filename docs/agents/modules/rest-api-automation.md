# REST API automation (Innovatum.API, /innoapi) - pilot notes

Started 2026-11-19. Goal: replace the SoapUI projects with Playwright API specs (`request.newContext`) + SQL checks, keeping the project-level UAT format
(`UAT_<project#>.doc`: one row per FRS with the verbatim requirement text, Result column = screenshots only).

## Where the API work stands
- Requirements: ValMaster - Innovatum, Modules `Items API`, `Master Data API`, `ROBAR Lots API` (+ `- Phase 2`), `ROBAR Printing API`, `ROBAR Label Control API`,
  `ROBAR Label Verification API`, `Destination Labeling REST API`, `Communication Manager - ESGNG NextGen API` (outbound, not testable by calling ROBAR). Test Cases column
  (FRS rows) = `UAT_<project#>`; Label Verification (20250522-001) has none mapped and its share UAT was never executed.
- Executed UATs: `\\diskstation\backedup\#Quality_Assurance\Release\...\UAT_<project#>.doc` (Destination Labeling, Items, Master Data, Lots Phase 2 in 2026.09.24_Release_7.0.3.20198+;
  Printing, Label Control in 2026.10.12_...; Lots in 2025.05.19_Release_7.0.3.19042+\UAT\). Evidence in the Result column = SoapUI request/response screenshot + SSMS query result.
- SoapUI projects: `Desktop\SOAPUI\` (DestinationLabeling.xml, RESTItemsAPI, RESTMasterDataAPI have tests; Lots/Printing/Label Control/Label Verification are request collections only).
  They hold credentials in clear text - do not copy them into the repo.
- Pilot: **Items API** (project 20260409-001, 67 FRS rows, 7 endpoints in `Innovatum.API\Controllers\ItemsController.cs`, `[ROBARAuthorize("API_Items")]`).

## Fixtures on TST703 (created 2026-11-19, user OK'd; undeletable)
- Group `CLAPIGrp`: API_DL, API_Lots, API_MD, API_Items, API_Printing, API_LC, LT_CLLabelType (one group for every API spec; specs toggle rows and restore).
- `CLAPI01` (CLAPIGrp, Atlanta Test): authorized caller. `CLAPINoApi01` (legacy group MBPWLoginGrp = Login_WebMenu only, read only): valid login, no API_* process.
- Both use the seed test password (`ROBAR.password`), like the other CL fixtures. Specs: `tests/API/API_00_Setup_Fixtures.spec.ts` (idempotent), `API_Fixture_Auth_Check.spec.ts`,
  constants in `tests/API/api-fixtures.ts`. `addUser` in `Password-Management/pr-fixtures.ts` got an optional `fullName` argument.
- Label type for item tests: existing `CLLabelType` (.btw). The API user needs `LT_CLLabelType` (it has it through CLAPIGrp).

## Confirmed live 2026-11-19 (Items API, TST703 http://vmsrvtst703/innoapi/)
- Route pattern `Items/<Action>`; `GET Items/GetByLabelType?labelType=CLLabelType` as CLAPI01 -> 200 `{"success":true,"errorMessage":"","results":[]}` (no CL items yet).
- Valid user without API_Items -> **401** body `"User not authorized for this task: API_Items."` (matches FRS F.12.2). No Authorization header -> **401** `"Authorization header missing in request"`.

## Items API spec (built 2026-11-19): `tests/API/Items_API_Requirements.spec.ts`
- One test per FRS row (`ItemsAPI.20260409.F.x.y`), 67 rows: 66 automated + F.2.9 (item routed in an active workflow) skipped; a last `zz_restore` test restores security.
- Helpers `tests/API/api-support.ts`: `http()` (records every call, never stores the Authorization header), `sql()` (READ-ONLY: one SELECT through `sqlcmd.exe -E -S db01 -d ROBARTST703`, wrapped in
  FOR JSON PATH), `itemRows()`, `setGroupProcess()` (toggles one process of CLAPIGrp through Security Management), `useEvidence()` (runs/API/Items_<stamp>/<id>.json incl. wording-difference annotations).
- Data: label type `Carton Label` (labels exist, holds the CL items of other specs) + `MBLT1` (Save As target); `Shipper Label` = type the group lacks; `MBDOCX` = non-.btw type (LT_MBDOCX granted
  to CLAPIGrp at the start, revoked by the last test); CLLabelType has NO label, so items cannot be created in it. Items are CLAPI<run id><letter> (items cannot be deleted; ~25 per run).
- Gotchas: (1) Playwright starts a NEW worker after every failed test and re-loads the spec: run id / evidence stamp are created once in the runner process via `process.env.API_RUN_ID ??=`;
  never use afterAll for slow work (it repeats). (2) `sqlcmd`: `-y 0` and `-W`/`-h` are mutually exclusive; `datediff` to a 2099 date overflows -> `datediff_big`. (3) Wrong-password calls use the unknown
  user CLAPIUnknown01 so no real user gets a failed login. (4) 401 bodies are plain JSON strings, not objects.
- Live facts: SaveAs requires SourceLabelType <> LabelType; every SaveAs returns 4 "Protected field - not applied" warnings (I_Num, I_Ver, I_Ltype, I_Template) plus "Unrecognized share name" for source
  attributes the new label type lacks; Approve records the authenticated user (no approvedBy property); GetByLabelName/GetByItemNumber with a disallowed label type = 200 + success:false +
  "Some records have been disallowed due to label type security." (allowed records still returned); GetByLabelType denied = 400. Tracker rows dated 2026-11-19.

## Evidence renderer (built 2026-11-19): `node scripts/api-evidence-render.js [evidence dir] [--all] [--only F.3.]`
- Reads runs/API/Items_<stamp>/<requirement id>.json (newest folder by default) and writes <dir>/screenshots/<id>/<nn>_http|sql|summary.png + index.json + index.html (contact sheet with the wording-difference notes).
- One image per API call (method, full URL, user, request body, status, response) and per SQL check (query + result table, cells wrap); 5 or more calls in one requirement become ONE overview table (F.1.1, F.12.2).
  Setup calls (flagged by `mustOk` -> `markLastSetup()`) are hidden unless --all. Big GET responses: only the records of this run are shown (`focus` = run id) with "N record(s) returned in total, M shown";
  long attribute lists are shortened. Passwords never reach an image (not stored in the evidence). 66 requirements -> 121 images per run; the F.2.9 skip and the restore step get none.
- Gotcha: when patching the script with a node one-liner, regex backslashes get lost - use the Edit tool for lines with / . d.

## Still open
- SQL access: DECIDED 2026-11-19 = sqlcmd (Windows login, read only) - done in api-support.ts.
- Evidence format: rendered request/response screenshots instead of SoapUI screenshots - Mason to confirm QA accepts it. Renderer BUILT 2026-11-19 (see below); filling a copy of UAT_20260409-001 with the images is not done yet.
- F.2.9 (workflow-routed item) not automated; F.12.1 only proves the OOB group ROBAR_API_Security exists and holds API_Items (no user of that group is used).
- Contradiction noticed in the executed Destination Labeling UAT: F.5.2 says "no additional named security process" but F.7.2 requires API_DL - ask before relying on either.

## Filled UAT copy (built 2026-11-19): `scripts/build-api-uat.ps1`
`node scripts/api-evidence-render.js --scale 2` (sharp pictures), then `powershell -NoProfile -File scripts\build-api-uat.ps1 -BaseDoc <fresh copy of the share UAT> -ScreenshotsDir <...\screenshots> -OutDoc <new .doc>`.
- Never touches the share (copies BaseDoc, edits the copy). Rows are found by the printed Requirement# in column 1. Old SoapUI/SSMS pictures are removed; Result cell = our pictures only (<= ~340 pt wide,
  Result column is 351 pt), Pass/Fail from the test status (passed -> Pass; failed -> Fail; no evidence -> blank + red "Not executed" text). Table 2 = VMSRVTST703, Table 4 = "Automated run (Playwright API tests)" + date,
  Table 7 (Reviewed By) cleared for a person to sign, Table 6 = factual count line (the "Test passed:" sentence only when every row passed). Version text stays `7.0.3.XXXXX` (TST703 build number not read automatically).
- Result of the first build: `runs/API/UAT_20260409-001_automated_20261119.doc` = 67 rows, 121 pictures, 66 Pass, F.2.9 not executed (red text), 7 tables, 67 pages, format identical to the share original (checked via COM; no visual render).
- To use it for the real UAT: run the spec against VAL703 (env settings: ROBAR_BASE_URL / ROBAR_DB_NAME=ROBARVAL703 ...), render, build with Environment VMSRVVAL703 and the real build number, a person reviews and signs.

## E2E suite integration (2026-11-19) and project order
- `node scripts/suite-run.js` already picks up everything under tests/ (module "API"): fixtures spec `API_00_Setup_Fixtures` (named to sort first), `API_Fixture_Auth_Check`, then one spec per API project. The Fixture_Baseline canary
  now also checks group `CLAPIGrp` (exact process set) and users CLAPI01 / CLAPINoApi01 (a killed Items run can leave LT_MBDOCX / LT_MBLT1 changed; `CANARY_FIX=1` or `--fix-fixtures` restores them).
- Order agreed with Mason (one project at a time, Label Verification excluded): Items (done) -> Destination Labeling (done, F.2.4 needs one SQL statement) -> Master Data -> Lots (+ Phase 2) -> Label Control -> Printing
  (PDF only, never a live printer). ESGNG (20240722-001) is outbound (ROBAR calls the ESG service): not testable by calling ROBAR, needs a mock server - decision pending.

## Destination Labeling API spec (built 2026-11-19): `tests/API/Destination_Labeling_API_Requirements.spec.ts`
- 26 FRS rows (DLR.20260707.F.x.y) -> 25 automated + F.2.4 skipped until the fixture order `CLAPIDLComplete01` is Complete: the API cannot set HeaderStatus. The spec creates the order; Mason (or anyone with write access)
  runs ONCE: `update PickHeader set HeaderStatus = 'Complete' where OrderNumber = 'CLAPIDLComplete01'` (database ROBARTST703). The existing Complete order DLR20260815TESTna belongs to NAUser1: never used as a write target.
- Orders `CLDL<run id><letter>` (OrderNumber is nvarchar(20), DestinationCode nvarchar(5)); the TST703 tables have extra columns NAcolumn / NAcolumn2 (PickHeader) and NADetails / NADetails2 (PickDetail) that the dynamic Fields
  feature (F.4.x) reads and writes. Activity rows: Action 'DeliveriesAPI-CreateOrUpdate', ObjectType 'Destination Labeling'; audit rows in x_PickHeader / x_PickDetail (ChangeType A / C, ChangeReason 'DeliveriesAPI-CreateOrUpdate').
- F.6.2 reads the server log `//vmsrvtst703/c$/inetpub/wwwroot/InnoAPI/Logs/AppLog_<yyyymmdd>.log` (read only; helpers logMark / logWait / logSince; log entries are written with a delay and not always in time order, so poll).
  Errors are `<Error>` entries ("Error ID: ... message" + "Type: System...."); the failed login logs only the user id.
- Live facts: overall HTTP status = 200 when at least one element succeeded, 400 when all failed, top-level success = ALL succeeded; reserved columns / unmatched names / already-mapped columns are warnings {name, message}; an
  omitted orderedQuantity on an existing line leaves it untouched; an explicit blank string overwrites. Requirement contradiction: F.5.2 (no named security process) vs F.7.2 (API_DL required): the live API applies F.7.2.
- Gotchas: FOR JSON PATH drops null columns -> sql() uses include_null_values; Playwright `data` + Accept header: use `headers`; UNC path with forward slashes (backslashes get lost when writing files through a shell here-doc).

## Workflow fixture for "item routed in a workflow" (built 2026-11-19): `tests/API/api-workflow-fixture.ts`
- The API's check is ONE flag: `Items.DocumentOwner = 'Workflow'` on any version of the item number (ItemsRepository.ItemIsInWorkflow; the Master Data API uses the same call).
- `ensureWorkflowItem(browser, createItem)`: (1) read-only SQL for a CL / MB item in an authorized label type that is already routed (the 566 existing in-workflow items of TST703 are WM* / WF* items of other specs: never a write target);
  (2) if none: create the fixture item `CLAPIWFItem01` through the API (caller's closure), create the one-step preset `CLAPIWFPreset01` (step user = the test user; name chosen so the other workflow specs' `^(MB|CL)PW(Flow|Preset)` clean-up
  leaves it alone), Campaign Manager > Send to Workflow, wait for "Status Completed", verify by SQL. The workflow is NEVER voted, so the item stays locked: later runs only do the SQL lookup (0.5 s).
- First run created: item CLAPIWFItem01 (Carton Label, v0, DocumentOwner Workflow), workflow 'Item: CLAPIWFItem01, Version: 0; Label Type: Carton Label; Label: 20241023, Version: 0' (open), preset CLAPIWFPreset01. Do NOT vote or close it.
- Items F.2.9 now automated (66 + 1 = 67 of 67 rows; 3 clean full runs: 68 passed incl. the restore step). Master Data's "Item in Workflow" test reuses the same helper.
- Filled Items UAT copy rebuilt: runs/API/UAT_20260409-001_automated_20261119_v2.doc (67 rows, 126 pictures, 67 Pass; the first copy was open in Word so it was not overwritten).

## Master Data API spec (built 2026-11-19): `tests/API/Master_Data_API_Requirements.spec.ts`
- 48 FRS rows (MDAPI.20260408.F.x.y), all automated; 3 consecutive clean runs (48 passed, ~50 s). Evidence suite name `MD` (runs/API/MD_<stamp>), render with `node scripts/api-evidence-render.js --suite MD --scale 2`.
- Data model: item schemas store items in `ItemHeaders` (ItemNumber, VersionNumber, ApprovedBy, ApprovalDateTime, EffectiveBegin/End, Active, Description, MasterDataId) + `MasterData` (Id bigint = the API's masterDataId, LongId = GUID,
  Text1..N / Int1.. columns by schema field) + `MasterDataSchemas` (IsItemSchema). Items go into `RobarMasterData` (125 fields, ShareNames md_*: md_boxname = Text19, md_fdaclass = Text25, md_devcount = Int1; 340 CL* items already there),
  non-item records into `CLSchemaData` (cl_plain = Text5, cl_count = Int1, cl_unique = Text2 ...; records cannot be deleted, ~10 per run), `MBNonItemschema2` (empty MB fixture) is only read (F.9.3).
- CLAPIGrp now also holds SCH_RobarMasterData, SCH_CLSchemaData, SCH_MBNonItemschema2 (API_PROCESSES in api-fixtures.ts; the baseline canary follows it). Unauthorized schemas used for F.14.x: `Images` (item schema; write attempts target one of its existing CL* items,
  an unapproved one picked by SQL) and `MBNonItemSchema` (MB-owned, a record id picked by SQL); every one of those requests is rejected before any write (checked unchanged in the database).
- Live facts: schema security (F.14.1) = "User not authorized for this task: SCH_<schema>." for requests that carry a schemaName (GetBySchemaName -> HTTP 401), "Some schemas have been disallowed due to Schema Security." for requests that identify an item / record
  (CreateNewVersion, SaveAs source, Retire, Approve, Update); GetByItemNumber silently drops unauthorized versions (404 "Item Number X does not exist."); GetBySchemaName unknown schema -> 404; missing parameter -> 400;
  the workflow check uses the ITEMS table (Items.DocumentOwner = 'Workflow'), so F.2.6 works with the shared fixture item although it has no master data record; message uses an EN DASH ("Item being routed in workflow – cannot be modified.").
  Retire stores effectiveEnd as the server DATE; unretire without effectiveEnd = 2099-12-31; attributes of a schema come back in an unspecified order. Tracker rows dated 2026-11-19 (approvedBy, wording).

## Lots API specs (built 2026-11-19): `Lots_API_Requirements.spec.ts` (project 20240924-001) + `Lots_API_Phase2_Requirements.spec.ts` (20260526-001), helpers `lots-helpers.ts`
- Phase 1: 53 FRS rows (LOTAPI.240924.F.x.y) + 1 supporting LCN check = 54 tests, 3 clean runs (~18 s). Phase 2: 10 rows (LOTAPI.20260526.F.x.y) + 1 supporting baseline test = 11 tests, 3 clean runs. Evidence suites `Lots` and `Lots2`.
- Tables: Lots (Id GUID, OrderNum, LotNum, ItemNumber, PrintEntity, Expires, Manufactured, Reassay, u1..u5), LotSerialNumbers, LotDataOverride, LotControlNumbers + x_ audit tables (ChangeType A / C / D, ChangeReason 'LotsAPI-Create Lot' / 'LotsAPI-Update Lot').
  A lot's key is (OrderNum, LotNum, ItemNumber, PrintEntity); blank order / lot numbers are valid keys. Item check = Items table. Settings: PrintEntityRequired = N on TST703 (no print-entity authorization), LCNRequiredForNewLot unset.
- Print history rows use the 62 existing CL lots with PrintHistory (read only; `printedLot()` picks one without serial numbers). The only writes sent to a printed lot: an update that must be ignored, one that re-sends its own current values (F.2.17), and in
  Phase 2 one marker serial number that is removed again (clean-up in finally; verified: no CLAPI-P2* serial left). LCNs for the locked-LCN rows: existing LabelControl LCNs of CL items (`existingLcns()`).
- **Known defect (tracker row): FRS LOTAPI.20260526.F.1.8** - replaceOnlyIfNotPrinted = true also blocks replaceSerials / replaceLockedLCNs / replaceShareNameOverrides on a printed lot. The F.1.8 test asserts the requirement and is marked `test.fail(...)`
  so the suite stays green and the evidence JSON status is "failed" (the UAT builder writes Fail for that row); when the API is fixed Playwright reports an unexpected pass: remove the `test.fail`.
- Live facts: response property is `updateExistingLot`; response lots[] = id, printEntity, lotNum, orderNum, itemNumber, updateExistingLot, success, errorMessage (top level success / errorMessage / lots); HTTP 400 when any lot failed, 200 otherwise;
  GetByID unknown or malformed id = 200 with lot null; GetPrintHistoryByID unknown id = 200 with the id echoed and printEvents []; GetUsingPopulated without any parameter = 400 "No parameters are provided"; an unrecognized non-Boolean flag = false.

## Label Control API spec (built 2026-11-19): `tests/API/Label_Control_API_Requirements.spec.ts`
- 71 FRS rows (RLCA.250702.F.x.y) + the `zz_restore` test = 72 tests (~2.4 min, includes the rate-limit test with a 62 s wait and two security toggles). Evidence suite `LC`. CLAPIGrp now also holds `LC_Manage_ProdAvail` (API_PROCESSES).
- The API cannot create LCNs: GET tests compare EVERY response field (26 field tests, F.6.2-F.6.26, one per field) with SQL replicas of the API's joins (LabelControl x Items x Labels, left ItemHeaders / ItemLabelMaster) for a sample of 5 CL LCNs (with/without master data, label master,
  released, unapproved master data). Write tests use the two OLDEST unreleased release-eligible CL* LCNs (LCN0000574 / 575 on TST703): release / unrelease and effective dates, always put back (try/finally). Known tiny leftovers: unrelease sets ReleasedOn = 1900-01-01 (was 2099-01-01);
  an effectiveBegin sent as YYYYMMDD loses its time of day (574 / 575 now start at midnight 2026-10-14).
- Security phase tests (F.1.8 LC_Manage_ProdAvail, F.1.9 LT_Carton Label) revoke the process from CLAPIGrp via the Security UI, assert, restore in finally; `zz_restore` checks again. The rate-limit tests (F.1.7 unknown user id, 12 failed logins: first 10 fast, 11th and 12th >= 3 s; F.1.5 NO_API_USER: FailCount unchanged, then a 62 s wait because
  the one-minute window of that user id must end) are LAST on purpose.
- Live facts: ToggleLCNRelease / UpdateLCNEffectivityDates always answer HTTP 200 (success flag in the body); both need API_LC + LC_Manage_ProdAvail (401 text lists every missing process); label type authorization is "User is not authorized to edit Label Type: <type>" (success false);
  the whole request is validated first: one bad LCN means nothing is written. x_LabelControl rows: ChangeType C, ChangeUser = API user, ChangeReason 'Release LCN' / 'Unrelease LCN' / 'Update Effective Dates', ChangeComments '', ChangeSignature 'N', ChangeServer = web server name (VMSRVTST703).
- **Test.fail rows (confirmed requirement gaps, tracker rows): F.2.1 (never 400), F.4.4 / F.4.5 / F.5.3 / F.5.4 (unknown LCN / item = success true, no message).** The evidence JSON status of those tests is "failed", so the UAT builder writes Fail for them; remove `test.fail` when the API is fixed.

## Printing API spec (built 2026-11-19): `tests/API/Printing_API_Requirements.spec.ts`, helpers `print-helpers.ts`
- 85 FRS rows (PRNTAPI.240924.F.x.y, project 20240924-002) + 1 security test + the BarTender-log audit; ~8.5 min per run (a real print is 4-10 s). Evidence suite `Print`. Endpoints `Print/PrintByLCN | PrintByItemLabelType | PrintByTemplate | GetCachedPRN | UpdatePrintAsRejected` (`API_Printing`).
- **HARD RULE kept: no live printer, and no server print.** `guard()` in print-helpers.ts refuses anything but printerModel "Microsoft Print To PDF" (the print server renders a PRN, a real PDF; nothing is printed), printerName "Microsoft Print to PDF" only WITH that model, an ipAddress equal to
  this PC (FakePrinter listens on 0.0.0.0:9100, the server's "PRN to IP" connects to it; real printer 192.168.22.44 never) or 192.0.2.1. A request with printerName and NO model is a ServerPrint: the virtual PDF printer waits for a file-name dialog, the request stays "Locked" and holds
  one BarTender engine; 4 of them blocked all printing on TST703 (2026-11-19, fixed by restarting ROBAR_PrintServer with Mason's OK, memory feedback_no_server_print_to_pdf). The last test audits `\vmsrvtst703\c$\Innovatum\BarTenderLogs\<MMDDYYYY>.txt`: every "Printer:" must be Microsoft Print to PDF
  (use string concatenation for the UNC path, path.join drops one leading slash).
- Verification by content: pdfjs text of the PRN/PDF (lot number counts labels, share-name overrides I_Desc / L_Num appear, serial numbers); JPG/PDF magic bytes; FileDataB `PID_x.prn`; PrintedImages `<yyyymm>\PID_x.prn|jpg` (PrintHistory.FileName is a share path \VMSRVTST703\Network\PrintedImages\...); Activity 'Reprint signed' / 'PrintRequest Rejected' (UserID "SysGen").
- Data: new CL lots through the Lots API per test (u1 = batch quantity for the blank PrintConfig); released CL LCN + item found by SQL (A1SuperTemplate, Carton Label); write fixtures for lock/release/effective-date tests = two unreleased CLLCEM* LCNs (A1SuperTemplate, via the Label Control API, always put back);
  serial templates CLSerITpl917248 (S_Ser, Increment) and CLSerTpl376733 (S_USerial); config 'LotNumber' (AllowNewSerialsPrintingAPI N), 'DestLabeling' (PrintServerTimeout 0.5 min) with assignToPrintServer 'CLAPINoSuchServer<run>' for F.3.3 (the call times out after 30 s, the AssignedTo value is stored).
- Reprint rule: userID + reprintReasonCode given OR (printed + copies * serialCopies) > batch quantity; PrintByItemLabelType / PrintByLCN count, a PrintByTemplate print without a lot cannot be reprinted via GetCachedPRN ("Item version number cannot be less than 0"). totalPrintedLabels counts the current print. Rejecting right after a print can lose to the server's FileCreated status (tests wait 4 s).
- Test.fail rows (tracker): F.1.9 (ghost userID not recorded), F.13.5 (cached reprint copies), F.7.3 / F.7.4 (S_USerial print defect: view PrintHistorySerials LastTouch), F.10.7 (unknown LCN = 200 internal text). Skipped: F.6.1, F.6.10 (server prints), F.11.7 (blocked by S_USerial). Wording annotations: errorMessage "" vs null, 401 plain text, AllowNewSerials default Y, URLs.
- Not automated: F.1.1, F.1.2, disabled-user rows (need an inactive undeletable fixture user: ask first).
- http() got `timeout` / `allowTimeout` options (status 0 + "no response" evidence step instead of throwing).
- Suite-run lesson (2026-11-19): the API rate limit counts per user id for one minute across specs, so the Label Control spec's failed logins leaked into the Printing spec (F.1.5 got the "Maximum number of login attempts" text). Printing uses a run-unique unknown user id (`CLAPIUnk<run>`) and waits out the window for the NO_API_USER wrong-password calls. Module run through suite-run: 368 tests, 364 passed, 0 failed, 4 skipped (DL F.2.4, Printing F.6.1 / F.6.10 / F.11.7).
