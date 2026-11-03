# ValMaster requirements - MD Job Inquiry (pulled READ-ONLY 2026-11-03)

Sheet "ValMaster - Innovatum" (3214043046537092). There is NO module "MD Job Inquiry"; the page is covered by two rows of Module `Master Data Management` (Customer Specific blank on both):
| Id | Requirement | Test Cases |
|---|---|---|
| MDM20140512034F1.0.1 | A job inquiry function will be available to view job status and error conditions | MDM_Job_Inquiry8.1 (`\\diskstation\backedup\#Unlocked_Test_Cases\MDM\7.0.3\`) |
| MDE.250128.F.3.23 | Any Master Data captions displayed on the MD Job Inquiry page will be displayed only in English even if a user has selected a Language option other than English and the localizations are available. | UAT_20250128-002 |
(MDE.250128.F.3.26 is the same statement for Transmission Inquiry / Transmission History.) The other "Job Inquiry" rows (`FRS.RBR.CM.107.*`, Module `Job Inquiry`) belong to the CAMPAIGN MANAGER Job Inquiry page (see modules/campaign-manager.md).

Formal script MDM_Job_Inquiry8.1 (7.0.3): as a user with all security open Master Data, select a schema, filter Unapproved, check the sample items, Bulk Actions > Mass Approve, job description "NewInfo", sign, Submit Job (note the Job ID, screenshot); close Master Data; Main Menu > Reports and Inquiries > MD Job Inquiry (screenshot); filter Column Display Id, Operator Exactly Matches, value = the Job ID, Retrieve Job Data (screenshot); View Detail on the row: the Job Detail page is the same as in the submit step. Acceptance: "MDM Job Inquiry shows the details and error messages for all jobs completed within MDM."
Specs: `tests/Master-Data-Management/MD_Job_Inquiry.spec.ts` (the formal script, fresh Mass Approve job) + `MD_Job_Inquiry_Requirements.spec.ts` (read-only, all filters, every job type, error conditions, language) + `MD_Job_Inquiry_Security.spec.ts`.
