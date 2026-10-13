# Attachment Management and Attachment Upload (ValMaster re-check 2026-10-11, TST703)

Specs (ROBAR_Tests/tests/Attachment-Management/): Attachment_Upload_Requirements (real two-file upload, group MBAUT<stamp>), Attachment_Management_Requirements, Attachment_Management_Security. Requirements: valmaster-attachment-management.md. Each passed once.

## Attachment Upload (tile "Attachment Upload", process Attach_Upload_View, page InnoPages/LinkAttachmentManagement/UploadAttachments?LinkedFromWebmenu=1)
- Grid headers File Purpose / File Name / Description / Param1 / Param2; Description pre-filled from file name; rows pre-selected; Reset empties the grid.
- Blocked extensions come from global setting AttachUploadExcludedExt, stored WITHOUT dots ("dll,exe,com,chm,sql"). Blocked file is not added; message "File extension(s) not allowed: exe" (requirement text: "File extension not allowed.").
- File Purpose list starts "Select Purpose"; Upload is disabled with tooltip "Missing File Purpose" until every selected row has a purpose. The purpose list has more entries than the defaults (Change Report, Notification, Attachment Print Time, Training Certificate, Vision Inspection, ...).
- Changing File Purpose / Param1 / Param2 on one row opens "Apply to all records?" popup (applyAllYes / applyAllNo radios, chkShowAgain, OK / Cancel).
- Upload result: "2 files uploaded successfully". New rows: Active Yes, Sequence 0, FileId GUID.

## Attachment Management (tile "Attachment Management", process AM_Attachment_Management, menu section Document Control)
- Opened from the menu the Link button is disabled; criteria filter (Add / remove filters), Retrieve Data, Advanced Options (columns incl. Active, Attachment Group, Description, File Extension, File Id, File Purpose, Last User, Originally Uploaded By, Param 1/2, Sequence, Uploaded On; row limit 500), pager "View 1 - 2 of 2", "No records to view".
- Grid cells are found via `td[aria-describedby$="_<ColumnName>"]` (hidden columns shift positions).
- Row Actions: View, Download, Edit Attributes, Assign Printer Models, Edit. Edit Attributes dialog: File Purpose select, Attachment Group, Param1, Param2, Submit / Cancel. Download gives a file download; View opens `InnoPages/LinkAttachmentManagement/ViewFile?fileId=..&act=view&version=0`.

## Security (live, MB group)
- Tiles: no processes -> neither tile; Attach_Upload_View -> only Upload tile; AM_Attachment_Management -> only Management tile.
- Row Actions are always LISTED; the process ENABLES them (others get ui-state-disabled): FP_<Purpose>_View -> View, FP_<Purpose>_Download -> Download, FP_<Purpose>_Edit -> Edit; Edit Attributes always enabled for an active row (inactive row disables it). Assign Printer Models needs AM_AssignPrinterModel AND an active row with purpose "Vision Inspection" (source AttachmentManagement.cshtml). Matches F.19.2 "disabled otherwise".

## Not covered yet
Link-related requirements (F.1.8 "Error: FP_xxxx_Link security not enabled.", F.13.x, F.12.16-19 via Label Control Link Attachments), version popup SNT.170330.F.6.x (needs multi-version document; Edit uses Sentinel), F.2.1 FP_ processes generated for a new File Purpose code (codes cannot be deleted; MB type only), Active toggle, Activity record (DB).

## Link Management re-check 2026-10-11 (TST703; Link_Management_Requirements + Link_Management_Security specs, 1 pass each; requirements in valmaster-link-management.md, 106 rows)
- Tile "Link Management" (process LM_View_LinkManagement, Document Control), page `LinkAttachmentManagement/LinkManagement`. Filter rows are RESTORED from the last session (stale rows, including blank ones, make Retrieve Data raise "Filter will take precedence over the search criteria" -> Continue); there is no Reset button, so remove rows by the "Remove" links then add one. A "Filter:" drop-down (`#drpActive`, default Active) and Latest Item / Template Version check boxes sit under Advanced Options. Include LCN / Item / Template check boxes (`#includeLCNs/Items/Templates`) are all checked by default. Grid (`#grdControl`) empty until Retrieve; columns Item Number, LCN, Template Name, Template Version, Label Type, File Name (+ hidden Purpose / Id / active / version); "View 1 - 10 of 125"; "Page of N"; "No records to view" for an unknown LCN; row Actions View, Download, Edit.
- `#ddlLinkType` navigates on the select's **click** event (selectOption alone does nothing; dispatch `click`). Options: Associate Attachments, By LCN, By Item, By Item Version, By Template, By Template Version. Pages: LinkLCNAttachments (columns Label Control Number / Item Number / Template), LinkItemAttachments (Item Number / Template + "Field Definitions for Label Type" list), LinkTemplateAttachments (LabelName / Description / LabelType); each has Retrieve Data, Add Filter, an Attach button (`#btnLinkAttachments`) and switch links "By ...".
- Global setting BrowserViewFileTypeExtensions = ".PDF,.TXT,.JPG,.JPEG,.BMP,.PNG" (F.22.1 ok).
- Security (MB group): no LM_View_LinkManagement -> no tile; Associate drop-down disabled until LM_Link_Attachments; Detach disabled until LM_Detach_Attachments (and a checked row); row View / Download / Edit are disabled until FP_<Purpose>_View / _Download / _Edit (purpose "Change Report" -> process `FP_Change Report_View`, spaces included).
- Deviations: F.7.9 / F.9.12 / F.11.10 switch links read "By LCN" etc. (not "Link by ...") and five association types exist (item / template VERSION added; requirements list three). Observation: first page of results is not strictly Items -> Templates -> LCNs (one item-only row, then LCN rows) - F.5.8 not proven either way.
- Not tested: version popup (LM.170330.F.1.x, needs a multi-version document), Edit Activity record, a real link / detach (covered by the Label Control specs Link_Attachments / Attachments_Row_Action), F.8 row-action pre-fill (covered by Attachments_Row_Action).
