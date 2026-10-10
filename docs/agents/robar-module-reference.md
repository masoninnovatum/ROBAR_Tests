# ROBAR Module Reference - INDEX (restructured 2026-10-09)

The single 570 KB file was split into per-module files in `modules/` (lossless; the complete original is kept as `robar-module-reference.ARCHIVE.md`). **Read the module file you need (grep or open it), not this index.** Within a module file blocks are in the order they were written: LATER blocks are newer and win over earlier ones. Statements known or suspected to be stale are listed in `superseded-review.md`.

**Adding new learnings:** append a dated block at the END of the matching `modules/<module>.md` (create a new file for a new module and add it to the table below) - do not append to this index and do not edit the ARCHIVE. Requirements per module are in `valmaster-<module>.md`; defects / observations go to `dit-tracker.md`.

| Module file | Contents |
|---|---|
| modules/00-overview-and-todos.md | overview of the whole reference, open to-dos for live testing |
| modules/bartender-sentinel-playbook.md | driving BarTender / Sentinel native dialogs with FlaUI (playbook) |
| modules/campaign-manager.md | Campaign Manager incl. bulk actions, Job Inquiry |
| modules/codes-management.md | Codes Management (+ ValMaster re-check) |
| modules/destination-labeling.md | Destination Labeling (DL) |
| modules/dictionary-management.md | Dictionary Management (+ re-check, server-side authz) |
| modules/dynamic-ui.md | generic Dynamic UI pages vs ValMaster |
| modules/field-definitions-management.md | Field Definitions Management, Item Screen Layout |
| modules/label-control.md | Label Control |
| modules/label-type-management.md | Label Type Management |
| modules/login-and-passwords.md | legacy vs new web menu login, password surfaces |
| modules/lot-management.md | Lot Management (+ re-check) |
| modules/master-data-management.md | Master Data Management (MDM), two passes |
| modules/print-entity.md | Print Entity (PrintEntityRequired = Y), user entities |
| modules/printing.md | Browser Printing, Print by Lot / Order, AddLotReasonRequired, batch quantity, Test Print, Print Request vs ValMaster, Multi Document Printing notes |
| modules/security-management.md | Security Management (+ ValMaster re-check) |
| modules/template-management.md | Template Management |
| modules/testing-tooling-limitations.md | known tooling limits (not product issues) |
| modules/webmenu-wide-issues.md | issues that are not specific to one module |
| modules/workflow-management.md | Workflow Management, Preset Management |

Old references such as "robar-module-reference.md, section X" now mean the module file above that contains section X (section titles were kept as headings inside the module files).
