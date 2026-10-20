Attachment Management:

Attachment_Management_Requirements - Attachment Management vs ValMaster: web-menu entry, filters, Advanced Options, grid, pager, row Actions, Edit Attributes, View / Download
Attachment_Management_Security - Attachment tiles and row actions follow AM_/Attach_Upload_View and FP_Approvals_* (MB group only)
Attachment_Upload_Requirements - Attachment Upload vs ValMaster: grid, File Purpose list, popups, excluded extensions, Reset, a real two-file upload
Link_Management_Actions - Link Management actions: Link By LCN / Item / Item Version / Template / Template Version, View, Download, Edit, Detach
Link_Management_Requirements - Link Management vs ValMaster: menu, filters, includes, grid, associate drop-down and the three Link pages (read-only)
Link_Management_Security - Link Management tile, Associate drop-down, Detach and row actions follow their processes (MB group only)

Browser Printing:

Add_Lot_Reason_Required - AddLotReasonRequired: the Reason Code dialog on the print screens
Batch_Quantity_Copies - Batch Quantity x Multiplier + Extra: the Copy field on Print by Order / Print by Lot (no print)
Batch_Quantity_Reprint - Batch Quantity reprint threshold: Reprint box forced on when printed + about to print exceeds the allowed quantity (Print by Order, Print to PDF)
Batch_Quantity_Reprint_Off - ReprintBasedOnBatchQty = N: after ONE printed copy every further print is a reprint (Print by Order and Print by Lot)
Batch_Quantity_Serialized - serialized templates (S_USerial / S_Ser): Copy on Print by Order and Copies in Multi Document Printing with a batch quantity (no print)
Blank_Expiration_Date_Calculated - blank expiration date is calculated from manufacturing date + shelf life on the Lot Panel
Invalid_Combination_Blocked - invalid order/lot/item combination is blocked on every retry, never reaches the Lot Panel
Multi_Document_Printing - Multi Document Printing: entry, lot panel, label rows, preview, Test Print and real Print to PDF
Multi_Document_Printing_Batch_Quantity - Multi Document Printing: Copies = Batch Qty x Multiplier + Extra, Override Lot Data recalculation, no values -> 1, R marker after a print
Multi_Document_Printing_Label_Master - Multi Document Printing: View Master and View Compare work for an item with a label master
Multi_Document_Printing_Override_Lot - Multi Document Printing: Override Lot Data (editable fields, validation, Save, Cancel) and the print uses the overridden dates
Multi_Document_Printing_Print_Entity - Multi Document Printing, PrintEntityRequired = Y: entity dropdown, Reason Code, real Print to PDF, lot carries the chosen entity, last used entity is the default
Multi_Document_Printing_Prompts - Multi Document Printing: print-time prompts (required, Cancel) and Edit Prompt Data
Multi_Document_Printing_Security - Multi Document Printing security: tile and page need BP_MultiDocumentPrint
Print_By_Lot - @smoke @tier2 Print by Lot, PrintEntityRequired = N: no Print Entity dropdown, new lot flow, lot panel, label screen, real Print to PDF
Print_By_Lot_Reprint - Print by Lot reprint: Reprint box locked on, reason + password required, wrong password refused, reprint succeeds and is in the Reprints history
Print_By_Order - Print by Order, PrintEntityRequired = Y: entity dropdown, Reason Code, new order flow, real Print to PDF, lot carries the chosen entity, last used entity becomes the default
Print_Request_Multi_Item_Errors - Print by Order / Print by Lot: a number assigned to multiple items shows an error
Print_Request_Security - Print by Lot label screen follows BP_Change_Print_Quantity, BP_Test_Print and the reprint processes (no print)
Print_Request_Test_Print - Test Print: red Test Print button, repeatable, excluded from reprint; default printer = last used; locked after a real print
Serial_Print_To_PDF - @smoke @tier2 [usr] Print by Lot: S_USerial template, Print to PDF
Serial_Print_To_PDF - [ser] Print by Lot: S_Ser template, Print to PDF
Serial_Print_To_PDF - [ser-inc] Print by Lot: S_Ser template, Print to PDF
Serial_Print_To_PDF - [ser-counter] Print by Lot: S_Ser template, Print to PDF
Serial_Print_To_PDF - [ser-existing] Print by Lot: S_Ser (existing template SingleSer_na) template, Print to PDF
Serial_Template_Setup - [usr] create an S_USerial template, approve it, and an approved item with LCN and Label Master on it
Serial_Template_Setup - [ser] create an S_Ser template, approve it, and an approved item with LCN and Label Master on it
Serial_Template_Setup - [ser-inc] create an S_Ser template, approve it, and an approved item with LCN and Label Master on it
Serial_Template_Setup - [ser-counter] create an S_Ser template, approve it, and an approved item with LCN and Label Master on it

CM MDM PDF:

Build_Data - stage T1 - template MBPDFT<stamp> version 0, approved
Build_Data - stage T2 - template version 1 (Save As New > New Version), left UNAPPROVED
Build_Data - stage I6 - approved item MBPDF6<stamp> on the template (latest template version unapproved)
Build_Data - stage I2 - approved item MBPDF2<stamp> on A1SuperTemplate + Master Data record (v0 approved, v1 unapproved)
Build_Filter - stage F - saved filter MBMDFILTER<stamp> with Master Data Schema RobarMasterData (CM_MDM_Integration must be Y)

Campaign Manager:

Campaign_Manager_Requirements - Campaign Manager vs ValMaster: saved filters on load, default limit, Advanced Options, sort, checkboxes, No records, Exactly Matches drop-down, AND / OR
Create_Approved_Item - create a new Campaign Manager item and approve it
Export_to_Xls - export to xls submits a job for the selected item
Import_Master - import master requires a real staged .xlsx file -- not available in this environment
Item_Change_History - View History shows the audit trail for a newly created item
Item_Data_Compare - BUG: item data compare fails against a fresh item with an OLEDB error
Item_PDF_and_Symbols - Item Edit PDF and Insert Symbols buttons
Item_Translation - item translation populates a translated phrase into the selected item
Job_Inquiry - Job Inquiry finds and links back to a just-submitted job
Job_Inquiry_Requirements - Campaign Manager Job Inquiry vs ValMaster: criteria columns, no in-app link, Do Action state
Mass_Item_Approve - mass item approve approves the selected item
Mass_Item_Update - mass item update changes the selected item's Item Group
Mass_Print - mass print submits a print job for the selected item
Retire_Item - retire item marks the item inactive
Retire_Items_Bulk - bulk retire items retires the selected item
Save_and_Load_Filters - save filters persists the current query, load filters restores it
Save_as_New_Bulk - bulk save as new creates a new version of an approved item
Save_as_New_Item_or_Label_Type - save as new item / label type creates a distinct new item
Save_as_New_Version - save as new version creates version 1 from an approved item
Save_to_Pdf - save to pdf submits a job when Subfolder is provided
Save_to_Pdf - BUG: save to pdf rejects a blank Subfolder with a vague message
Send_to_Workflow - send to workflow submits an unapproved item into a workflow preset
Send_to_Workflow - BUG-CHECK: send to workflow requires Workflow Comments and a Preset
Unretire_Item - unretire item marks a retired item active again

Codes Management:

Codes_Management - Codes Management: anatomy, filters, sort / paging, Add validations and create, Edit rules
Codes_Management_Excel - Codes Management Excel Import: template, validation errors, new rows, overwrite prompt, signer rights
Codes_Management_Security - Codes Management: Web_Codes switches Add / Edit / Excel Import and the Update action; tile visibility

Cross Module:

Approved_Template_Item_MDM - new approved template -> approved item -> approved Master Data record
Dynamic_UI_Requirements - Dynamic UI vs ValMaster: icon states and Actions menu follow the header security columns; no CanView process -> not authorized message
InnoView_Requirements - InnoView vs ValMaster: report menu, the requirement reports, prompts, columns and Export (read-only)
InnoView_Security - InnoView tile and Print History reports follow Login_InnoView and Innov_ViewPrintHist (MB group only)
Scenario_Template_Item_Versions - phase A: template CL... with versions 0-7 approved and 8 unapproved
Scenario_Template_Item_Versions - phase B: master data record + item with versions 0-5 approved and 6 unapproved
Scenario_Template_Item_Versions - phase C: Label Control records for item v5 (template v6) and v6 (template v8), linked to the unapproved master data
Template_Item_MDM_LCN_Release - new template -> approved item -> Master Data record -> assign LCN -> release LCN
zz_Template_Item_LCN_Print - new template -> approved item -> Master Data record -> assign LCN -> release LCN

Destination Labeling:

Destination_Labeling - Destination Labeling: launch panel, order lookup, Create Order, destination selection, Reset
Destination_Labeling_Scan - Destination Labeling scanning: unrecognized barcode, Barcode Scan dialog (Fields Found / Required), Reset, complete scan -> No print rows
Destination_Labeling_Security - Destination Labeling: each BP_Dest_* process switches on its own control; the tile needs BP_DestinationLabeling

Dictionary Management:

Dictionary_Management - Dictionary Management: anatomy, search, New Entry, View/Edit, HTML editor and New Version rules
Dictionary_Management_Bulk - Dictionary Management Bulk Actions: Mass Approve, New Version of an approved record, version filters, Retire / Unretire, Export to Excel
Dictionary_Management_Excel - Dictionary Management Excel Import: template, validation errors, new rows, overwrite prompt, signer rights
Dictionary_Management_Requirements - Dictionary Management vs ValMaster: grid UI facts, empty-selection dialogs, Mass Approve and Mass Retire / Unretire page rules
Dictionary_Management_Requirements_Import - Dictionary Management Excel Import vs ValMaster: sheet dropdown, defaults, all-or-nothing validation, overwrite of an approved record
Dictionary_Management_Security - Dictionary Management: each DM_* process switches on its own control; the module tile needs Web_DictionaryManagement
Dictionary_Management_Server_Side_Authorization - Dictionary Management: the JSON write endpoints refuse a user without DM_NewEntry / DM_NewVersion / DM_Edit

Field Defs Management:

Field_Definitions - Field Definitions Management: layout, grid, filters, Edit Record (edit + restore) and the Create New dialog
Field_Definitions_Requirements - Field Definitions Management vs ValMaster: retrieve, pager, No records, Dictionary Language, Create confirmation (No), unauthorized double-click
Item_Screen_Layout - Item Screen Layout: tabs, moving a field between tabs, Save persists, Cancel discards (MBLT1, reverted)
Security_Gating - Field Defs Management: tile, label-type visibility and edit rights follow Web_Field_Definitions / LT_ / FD_Maintain_FieldDefs

Flex Printing:

Flex_Printing_Config_Variants - Flex Printing identifier layouts: Order+Item, Order+Lot (Item AddOnly / not AddOnly), date identifier (config restored afterwards)
Flex_Printing_Requirements - Flex Printing: entry screen, lot lookup, add-at-print-time, messages, Reset (config: Item + Lot visible, Order AddOnly)
Flex_Printing_Security - Flex Printing: tile, add-lot-at-print-time authorization (BP_FlexPrinting_Option, BP_Add_Lot_PrintTime) for an MB user

Label Control:

Assign_Control_Number - create a fresh item and assign it a Label Control Number
Attachments_Row_Action - Attachments row action opens Link Management for the record and Detach removes the file
Change_Report - Change Report completes for a record with a Label Master and saves the report to ROBAR
Change_Report_Options - Change Report options: Do Not Recreate, Grouped Master, Both, Save to Folder and Link to Prior
Compare_With_Prior - Compare With Prior reports a clean per-record error for items with no prior LCN
Compare_With_Prior_Success - Compare With Prior succeeds for an item version whose prior version has an LCN
Export_Master - @smoke @tier1 Export Master writes the master PDF to the export folder and offers a download
Export_Master_Merge - Export Master with two records: per-record PDFs without Merge, one merged PDF with Merge
Grid_Features - Label Control grid: pager, Advanced Options and Save / Load / Overwrite / Delete filter sets
Label_Control_Job_Pages_Requirements - Label Control job submission pages: fields, defaults and required-field validation (no job is submitted)
Label_Control_Requirements - Label Control page vs ValMaster: filters, dropdowns, pager, advanced options, grid, row and bulk actions (read-only)
Label_Control_Security_Requirements - Label Control tile, bulk actions and row actions follow their security processes (MB group only)
Link_Attachments - Link Attachments uploads a new file and links it to a Label Control record
Link_to_Label_Master - Link to Label Master reports a clean "not found" error for a brand-new item with no master
Link_to_Label_Master_Success - Link to Label Master: exact match, latest fallback, already-linked and update-existing branches
Manage_Production_Availability - release a freshly-assigned Label Control Number via Manage Production Availability
Manage_Production_Availability_Dates - Manage Production Availability: effective dates, un-release, multi-field and validation paths
Mass_Update_Versions - mass-update a freshly-assigned Label Control record, keeping all versions
Mass_Update_Versions_Template_MasterData - Mass Update Versions: Use Latest for the Template and Master Data dimensions, incl. a partial success
Mass_Update_Versions_Use_Latest - Mass Update Versions: Use Latest Version, with and without Allow Unapproved, for the Item dimension
Recreate_Master - Recreate Master creates a Label Master for a freshly-assigned Label Control record
Redline_Compare - Redline Compare triggers the Create Temporary Master dialog then shows a real PDF comparison
Update_Versions - Update Versions: shows current versions, blocks Submit until a change, and links an unapproved Master Data version

Label Type Management:

Label_Type_Actions - Label Type Management Actions: Excel Export, Adjust Page Size and Save/Load Search
Label_Type_Management - Label Type Management: layout, filters, View/Edit/Add dialogs (validation only) and audit
Security_Gating - Label Type Management: tile, read-only mode and edit rights follow View_LabelTypes / Web_LabelTypes

Login Password:

n_run - NeedsLetters N / NeedsNumbers N on every surface

Lot Management:

Lot_Management - Lot Management: grid, search, add (validation), edit, view, delete, audit
Lot_Management_Edit_Entity_Lock - Lot Management Edit dialog: one Print Entity -> the Print Entity dropdown is locked (PE.161004.F.7.9)
Lot_Management_Excel - Lot Management Excel: template, export (name validation, limited / unlimited), import (validation errors, create, update)
Lot_Management_Excel_Print_Entity - Lot Management Excel Import with PrintEntityRequired = Y: the PrintEntity column is checked against the importing user
Lot_Management_Print_Entity - Lot Management: the rows and the Add dialog follow the user's Print Entities
Lot_Management_Print_Entity_Off - Lot Management with PrintEntityRequired = N: ROBAR only, lots visible to every user, import accepts only ROBAR (invalid value message)
Lot_Management_Process_Icons - Lot Management: each process (Add / Change / Delete / Excel Import) switches on its own icon or menu item
Lot_Management_Requirements - Lot Management vs ValMaster: icon states, row Actions, date defaults, Excel Import page rules
Lot_Management_Save_Load_Search - Lot Management: Save Search (new / overwrite / duplicate / required) and Load Search restore the criteria
Lot_Management_Security - Lot Management security: icons per process, view-only window, and the missing server-side checks

Master Data Management:

Bulk_Assign_GTIN - Assign GTIN generates GTINs, warns before overwriting, and refuses approved records
Bulk_Assign_GTIN_Source_DI - Assign GTIN with an Add Source DI Field row derives the GTIN from the record's own DI and replaces the indicator digit
Bulk_Assign_Labels - Assign Labels creates unapproved Campaign Manager items for the selected records
Bulk_End_Distribution - End Distribution sets the distribution end date and can prepare a new DI version
Bulk_Mass_Approve - Mass Approve approves three unapproved records in one job
Bulk_Mass_Retire_Unretire - Mass Retire - Unretire: retire, mixed-selection warning, unretire
Bulk_Mass_Update - Mass Update sets a field on every selected record
Bulk_Save_As_New_Version - bulk Save as New Version refuses unapproved records and versions approved ones
Create_New_Record - new record creates item-schema and non-item-schema master data records, and rejects a duplicate item number
Data_Retrieval_Filters - For Items, Latest Version Only, Effective Only, operators and Limit Results return the expected rows
Excel_Import - Excel Import: template, valid import, failure modes, override and the overwrite prompt
Excel_Import_Security - MDM Excel Import: tile, direct URL and override checkbox follow MD_ExcelImport_Web / MD_Validation_Override
Export_to_Excel - Export to Excel: records what happens and validates the file if one arrives
MD_Job_Inquiry - MD Job Inquiry finds a Mass Approve job by its Job Id and opens its detail
Quick_Edit - Quick Edit pages through selected records and saves only the changed ones
Record_Lifecycle - MDM record lifecycle: validation, approve + lock, new version, retire / unretire, save as new record
Save_and_Load_Search - Save Search / Load Search / Overwrite / duplicate name / delete
Schemas_Dropdown_Sources_Export - Schema Dropdown sources (static / linked / query) validate, save, render and appear in Export Schema
Schemas_Field_Editor - Schemas editor: add fields with settings, persist, validate, delete (no-data fixture schema)
Schemas_Field_Settings_Effect - Schema field settings show up on a blank New Record page (required, length, mask, default, protected, hidden)
View_History - View History lists the per-version field changes, filters by field and opens a record snapshot

Print Entity:

Print_Entity_Inactive - Print Entity: an inactive entity assigned to the user never appears on the print screens
Print_Entity_Print_Screens - Print Entity (PrintEntityRequired = Y): every print screen follows the user's active entities
User_Print_Entity_Management - User Print Entity Management: grid, multi-user update, tri-state, "*" exclusivity, unsaved-changes prompt

Print History Inquiry:

Print_History_Inquiry_Requirements - Print History Inquiry vs ValMaster: security entry, search criteria, results, row actions, serialization (read-only)
Print_History_Inquiry_Security - Print History Inquiry security: PrintHist_Login gates the tile; BP_Reprint_Label / BP_Exact_Reprint_Print / BP_SerializationDetail gate the actions

Security Management:

Security_Effect_On_Login - Security Management changes drive the module tiles and the read-only Security page of a real MB user
Security_Groups - Security Management Groups: filters, add/edit group, copy security, toggle processes and Select All
Security_Management_Requirements - Security Management vs ValMaster: tooltip, reset-at-next-logon, inactive user, EditUsersAndGroups / EditSecurity gating
Security_Users - Security Management Users: filters, add/edit user, copy security, group inheritance and deactivation

Template Management:

Comments - view/edit comments supports adding, canceling an edit, editing, and deleting a comment
Create_Approved_Template_and_Item - create and approve a new template, create and approve an item using it, and assign it a Label Control Number
Create_and_Approve_Template - create a new template and upload its file
Download - download supports both row-level (single file) and bulk (zip) downloads
Edit_Attributes - edit attributes updates a template's description, and rejects a blank one
Get_Data - get data loads the associated item's data into the template, then restore reverts it
Get_Data_Master_Data - Get Data fills the template with the item's approved Master Data values (md_brand, md_primedi ...)
Get_Data_Options - Get Data options: unapproved Master Data on/off and Use Sample Data
Mass_Approve_Negative - Approve Templates: nothing selected, wrong password, incomplete form and an already-approved template
Mass_Approve_Templates - mass approve templates approves the selected template
Mass_Retire_Unretire_Templates - mass retire and unretire templates toggles the selected template
Replace_Template - replace template rejects a mismatched file type and replaces the template with a valid one
Save_As_New - save as new creates an independent copy of the template under a new name
Search_and_Filter - Template Management search and filter: criteria rows, operators, Approved dropdown, data source, limits, paging, reset
Security_Gating - Template Management: tile, label-type visibility and per-process action gating for a real MB user
Submit_to_Workflow - submit to workflow submits a template into a workflow preset
View_Edit_Template - view/edit template opens an existing template and persists a change made to it
View_Label_Characteristics - view label characteristics shows a newly created template's attributes

Workflow Management:

Attachments - workflow attachments: add, duplicate refused, closed-workflow warning, download, delete
Attachments_Security - workflow attachments security: add on open / closed, delete own / any user / closed
Edit_Workflows - Edit Workflows: add user at end / beginning, replace user, delete user on two open workflows
Edit_Workflows_Add_To_Group - Edit Workflows: Add User > Add to Group (inside a group vs insert a new group)
Edit_Workflows_Voted_Steps - Edit Workflows with an already voted step: observe warning, per-workflow messages and the resulting steps
Export_to_Excel - Workflow Management Export to Excel downloads a valid workbook with the ticked workflows (the old 503 does not reproduce)
Filters - Workflow Management filters: Included vs Can Vote, open-for-voting, status, limit, select all / page
Item_Workflow - item workflow: Send to Workflow locks the item; approving closes it Approved (by the workflow id), rejecting releases it
Linked_Documents - Linked Documents: item and template workflows open Link Management pre-filtered; a standalone workflow has no button
Linked_Documents_Security - Linked Documents security: the button is disabled without LM_View_LinkManagement and opens Link Management with it
Multi_Step_Presets - multi-step presets: sequential groups, parallel group, Vote For Entire Group, Veto
Preset_Management - Preset Management: create, add and edit steps, Save As, deactivate and delete a preset
Report - workflow summary report: required subdirectory, merged PDF and one PDF per workflow on the report share
Security_Gating - Workflow Management security: menu gating per process and the comment-required-on-reject rule
Template_Workflow - template workflow: Submit to Workflow for two templates, then approve one and reject the other
Workflow_Lifecycle - create two workflows from a preset, find and inspect them, vote one approved and one rejected in a single job
