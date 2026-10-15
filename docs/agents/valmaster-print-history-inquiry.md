# ValMaster requirements - Print History Inquiry (module "Print History Inquiry", Customer Specific blank)

Pulled READ-ONLY from "ValMaster - Innovatum" (sheet 3214043046537092) on 2026-10-15: 35 rows, of which 9 are Obsolete (FRS-15.1.1.4, 15.1.2.2, 15.1.2.3, 15.1.2.4, 15.1.2.5, 15.1.3.1, 15.1.5.1, 15.1.5.2, 15.1.5.3; not listed) -> **26 active rows** (8 URS + 18 FRS). Condensed wording; the sheet is the authority. Requirements = EXPECTATION of behaviour; differences found live are annotated `deviation <id>` in the spec and logged in the DIT tracker. Test-case names in the sheet: `PHI_Security-1.1`, `PHI_Basic_Functions-1.3`, `PHI_SeeImage_Action-1.4`, `PHI_SeeDetail_Action-1.5`, `PHI_ExactReprint_Action-1.6`, `PHI_Regenerate_Action-1.7`, `PHI_AuditTrail-1.8`, `PHI_SerializationDetail_Action-1.9`.

NOTE: most FRS-15.x rows describe the OLD (pre-Dynamic UI) page: a "Select Action" drop-down + "Do Action" button, radio buttons, "Reset All", plug-in actions. The shipped page is a Dynamic UI grid (`PrintHistory` definition, gate process `PrintHist_Login`, view `v_PrintHistory`, forced filter `SP_PrintHistoryForcedFilter`); expect wording differences that are script/requirement drift, not defects.

## URS
- **URS-15.1.1** the application enforces security checkpoints. **URS-15-1.3** a plug-in module performs actions on the selected print history record. **URS-15-1.6** only one label can be selected at a time from the results. **URS-15.1.2** the screen can query the database for Print History records. **URS-15.1.4** all important actions are logged (audit trail). **URS-15.1.5** error messages are shown when required. **URS-15.1.7** correct search results on Retrieve Data.
- **SER20150611100U5.0.0** serialization functionality updates Print History records appropriately.

## Security
- **FRS-15.1.1.1** standard ROBAR password and authority verification: incorrect credentials deny access; no direct access through a URL (PHI_Security-1.1).
- **FRS-15.1.1.2** a configurable permission allows / disallows access to the application: `PrintHist_Login` (unauthorized users cannot open it from the web menu).
- **FRS-15.1.1.3** security checkpoints per action plug-in: `BP_Reprint_Label`, `BP_Exact_Reprint_Print`.

## Search / grid
- **FRS-15.1.2.1 / FRS-15.1.7.1** Column, Operator, Value drop-downs apply selection criteria; multiple filters can be combined to narrow or expand results. **FRS-15.1.7.2** filters can be added / removed, joined with "and" / "or". **FRS-15.1.7.5** the Value field is type-sensitive. **FRS-15.1.7.4** the "Reset All" button clears the results and all criteria.
- **FRS-15.1.6.1** radio buttons select only one result at a time. **FRS-15.1.7.3** the "Select Action" drop-down and "Do Action" button appear only after results are displayed.

## Actions
- **FRS-15.1.3.2** See Image: a new window with the label image. **FRS-15.1.3.3** See Detail: a new window with complete label details by print id, including reprint activity. **FRS-15.1.3.4** Exact Reprint: the print screen for an exact reprint of the label. **FRS-15.1.3.5** Regenerate: the print screen for the latest version of the label. **FRS-15.1.4.1** an audit trail is kept whenever Exact Reprint and Regenerate are performed.

## Serialization (SER20150611100, project 20150420-002)
- **F5.0.1** a submitted print request writes one record per serial number to the serial output table (Print History Serials) with the print id. **F5.0.2** users with `BP_SerializationDetail` get the "Serialization Detail" action; without it the action is not available. **F5.0.3** Serialization Detail shows Print ID, print date/time, serial #, reprint (Y/N) and the user who printed.
