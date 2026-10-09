# ValMaster requirements - Dictionary Management (module "Dictionary Management")

Pulled READ-ONLY from "ValMaster - Innovatum" (sheet 3214043046537092) on 2026-10-09: 202 rows with Customer Specific blank and Req Status not Obsolete. Grouped by the Test Cases column. Requirements = EXPECTATION of behavior; live differences are findings.

## UAT_20210908-001 (40)

- **DM.20210908.F.1.10** (FRS): A 'x Remove' link will be displayed for allowing users to remove one or more criteria filters.
- **DM.20210908.F.1.11** (FRS): The Column drop-down will contain the following columns: Approved By, Approve Date, Effective Begin, Effective End, Language, Phrase, Translation, and Version. Note: The values will be displayed in alphabetical order.
- **DM.20210908.F.1.2** (FRS): For the 6.0.6 software branch and forward, the following Codes entry will be deprecated: Code Type = Dictionary Entry Types Code = L Description = Language Translation Note: There is currently no functionality behind this setting and will not be used going forward.
- **DM.20210908.F.1.22** (FRS): A "No records to view" error message will be displayed in the event that record results are not returned based on the queried search criteria filter(s).
- **DM.20210908.F.1.23** (FRS): A Reset button will be displayed allowing users to reset the Dictionary Management page. Upon selecting the button, all defined search criteria filters will be removed.
- **DM.20210908.F.1.24** (FRS): A Dictionary grid will be displayed containing the data results based on user defined criteria filters.
- **DM.20210908.F.1.25** (FRS): The Dictionary grid will contain the following columns: Actions, Phrase, Language, Translation, Version, Effective Begin, Effective End, Approved By, and Approve Date.
- **DM.20210908.F.1.26** (FRS): A checkbox will be displayed next to the Actions column header within the Dictionary grid for allowing users to select or deselect all records.
- **DM.20210908.F.1.27** (FRS): A row level checkbox will be displayed next to each record within the Dictionary grid.
- **DM.20210908.F.1.28** (FRS): A row level Actions drop-down will be displayed next to each record within the Dictionary grid.
- **DM.20210908.F.1.29** (FRS): The row level Actions drop-down will contain the following actions: New Version and View/Edit. Note: View/Edit will be displayed as the first option.
- **DM.20210908.F.1.3** (FRS): For the 6.0.6 software branch and forward, the following GlobalSettings entry will be deprecated: SettingName = DictionaryDefaultEntryType Value = L SettingOwner = LegacySettings Note: There is currently no functionality behind this setting and will not be used going forward.
- **DM.20210908.F.1.30** (FRS): A Checked Rows counter will be displayed in the bottom left corner of the Dictionary Management page which will calculate the total number of records selected by a user.
- **DM.20210908.F.1.31** (FRS): A page counter will be displayed in the bottom center of the Dictionary Management page. The Page counter will display Page X of Y.
- **DM.20210908.F.1.32** (FRS): A Record counter drop-down box will be displayed in the bottom center of the Dictionary Management page for allowing users to customize their view by selecting 10, 20, or 30 records. The drop-down will default to 10 records.
- **DM.20210908.F.1.33** (FRS): A Page view will be displayed and in the bottom right corner of the Dictionary Management page. The Page view will display as View X – Y of Y.
- **DM.20210908.F.1.36** (FRS): All buttons, links, texts, warnings and error messages, dialogues, actions, and pages for Dictionary Management page will be localized.
- **DM.20210908.F.1.8** (FRS): An '+ Add Filter' link will be displayed for allowing users to filter for and retrieve records by utilizing the ‘Column’, ‘Operator’, and ‘Value’ search criteria filters.
- **DM.20210908.F.1.9** (FRS): Users will have the ability to add and/or remove multiple search criteria filters, as the system will contain 'AND' 'OR' drop-down capabilities from which the user can select.
- **DM.20210908.F.2.18** (FRS): If there is only one worksheet available for selection within the Excel template, the ‘Sheet’ drop-down box will default to the first sheet name.
- **DM.20210908.F.2.19** (FRS): Users will be able to select the Sheet drop-down as many times as needed in order to select a different worksheet.
- **DM.20210908.F.2.24** (FRS): A page counter will be displayed in the bottom center of the Validation Errors grid. The Page counter will display Page X of Y.
- **DM.20210908.F.2.25** (FRS): A Record counter drop-down box will be displayed in the bottom center of the Validation Errors grid allowing users to customize their view by selecting 10, 20, or 30 records. The drop-down will default to 10 records.
- **DM.20210908.F.2.26** (FRS): A Page view will be displayed and in the bottom right corner of the Validation Errors grid. The Page view will display as View X – Y of Y.
- **DM.20210908.F.2.27** (FRS): When importing data and errors are encountered, users will have the ability to modify the original Excel template, reselect the file for importing, and re-validate without having to leave the page.
- **DM.20210908.F.2.3** (FRS): The Excel Import action will contain a tooltip and display the error message of "User not authorized for this task. DM_Import." when the action is hovered upon by an unauthorized user.
- **DM.20210908.F.2.38** (FRS): By default, the following values will be displayed within the Reason Code drop-down and will be populated from the Codes table. Each of the below codes will use the CodeType = DictionaryManagementReasons, Description = N/A, and Active = Y. Data Approval Data Correction New Entry Requested Change Retire/Unretire
- **DM.20210908.F.3.12** (FRS): When a user does not enter a value for Translation and then selects the Submit button, the value will be accepted, as "blank" is a valid value.
- **DM.20210908.F.6.10** (FRS): The Filename value entered by the user will be appended with .xlsx Note: If the user enters Text.txt the exported file will be Text.txt.xlsx
- **DM.20210908.F.6.3** (FRS): The Export to Excel bulk action will contain a tooltip and display the error message of "User not authorized for this task. DM_Export." when the action is hovered upon by an unauthorized user.
- **DM.20210908.F.6.4** (FRS): If the user selects the Export to Excel bulk action without selecting any records, the message of "Please select one or more records." will be displayed in a dialogue box along with an OK button.
- **DM.20210908.F.7.13** (FRS): By default, the following values will be displayed within the Reason Code drop-down and will be populated from the Codes table. Each of the below codes will use the CodeType = DictionaryManagementReasons, Description = N/A, and Active = Y. Data Approval Data Correction New Entry Requested Change Retire/Unretire
- **DM.20210908.F.7.19** (FRS): If a user selects an approved record and then selects the Mass Approve bulk action, the following error message will be displayed "One or more dictionary records are already approved.".
- **DM.20210908.F.7.3** (FRS): The Mass Approve bulk action will contain a tooltip and display the error message of "User not authorized for this task. DM_MassApprove." when the action is hovered upon by an unauthorized user.
- **DM.20210908.F.7.4** (FRS): If the user selects the Mass Approve bulk action without selecting any records, the message of "Please select one or more records." will be displayed in a dialogue box along with an OK button.
- **DM.20210908.F.8.24** (FRS): By default, the following values will be displayed within the Reason Code drop-down and will be populated from the Codes table. Each of the below codes will use the CodeType = DictionaryManagementReasons, Description = N/A, and Active = Y. Data Approval Data Correction New Entry Requested Change Retire/Unretire
- **DM.20210908.F.8.32** (FRS): When the user selects the 'Cancel' button, the dialogue will be closed and the user will be navigated back to the main Dictionary Management page.
- **DM.20210908.F.8.33** (FRS): When the user selects the 'Continue' button, the user will be navigated to the Mass Retire - Unretire Job Details page.
- **DM.20210908.F.8.4** (FRS): If the user selects the Mass Retire/Unretire bulk action without selecting any records, the message of "Please select one or more records." will be displayed in a dialogue box along with an OK button.
- **DM.20210908.F.9.1** (FRS): All buttons, links, text, and warning and error messages on each of the Job Details pages will be localized.

## DM_MassRetireUnretire-1.7 (31)

- **DM.20210908.F.2.42** (FRS): The Submit Job button will remain disabled until all required data values are provided by the user.
- **DM.20210908.F.8.1** (FRS): A Mass Retire/Unretire bulk action will be displayed within the Bulk Actions drop-down.
- **DM.20210908.F.8.10** (FRS): When records are being retired, the Effective End date value will be set to the current day's date.
- **DM.20210908.F.8.11** (FRS): When records are being unretired, users will be required to select the Effective End Date value from the date picker.
- **DM.20210908.F.8.12** (FRS): When a user selects both retired and unretired records (approved and unapproved) and then selects the bulk action, the following warning message will be displayed "You have selected both retired and unretired records. If you continue, the action you select will be applied to all records."
- **DM.20210908.F.8.13** (FRS): The warning message will be displayed in a dialogue box with Cancel and Continue buttons.
- **DM.20210908.F.8.14** (FRS): When the user selects the 'Cancel' button, the dialogue will be closed and the user will be navigated back to the main Dictionary Management page.
- **DM.20210908.F.8.16** (FRS): When the user selects the Unretire radio button, the Effective Begin Date textbox will be automatically set to the current day's date value; however, the user will have the ability to select a different value from the date picker. Users can select a past or future date value, as both will be supported. Note: The Effective Begin Date textbox will not be editable; therefore, the user would need to select a new value from the date picker.
- **DM.20210908.F.8.17** (FRS): When the user selects the Unretire radio button, the Effective End Date textbox will be automatically set to the value of 12/31/2099; however, the user will have the ability to select a different value from the date picker. Note: The Effective End Date textbox will not be editable; therefore, the user must select a date value from the date picker.
- **DM.20210908.F.8.19** (FRS): If the user does not enter a value for Job Description, the following error message will be displayed “This field is required.”
- **DM.20210908.F.8.2** (FRS): Only users who have the 'DM_MassRetireUnretire' security process enabled will be able to select the Mass Retire/Unretire bulk action. The action will be displayed in a disabled state for unauthorized users.
- **DM.20210908.F.8.20** (FRS): The electronic signature block will be displayed containing a User Name textbox, Password textbox, Reason Code drop-down, and Comment textbox.
- **DM.20210908.F.8.21** (FRS): If the user does not enter a value for User Name and/or Password, the following error message will be displayed “This field is required.”
- **DM.20210908.F.8.22** (FRS): If invalid credentials of the User Name or Password are entered, the following error message will be displayed once the user selects the Submit Job button “Invalid Username/Password: UserID: XXXX".
- **DM.20210908.F.8.23** (FRS): If the User Name and Password credentials of an unauthorized user are entered, the following error message will be displayed once the user selects the Submit Job button “User not authorized for this task. DM_MassRetireUnretire”.
- **DM.20210908.F.8.25** (FRS): If the user does not select a value from the Reason Code drop-down, the following error message will be displayed “This field is required.”
- **DM.20210908.F.8.26** (FRS): A Comment textbox will be displayed. This is an optional field that will not require a value.
- **DM.20210908.F.8.27** (FRS): The electronic signature information will be saved into the Activity table. Action: MassRetireUnretire ObjectType: Dictionary Management ObjectName: Display Id ReasonCode: The value selected by the user. Comments: The value entered by the user."
- **DM.20210908.F.8.28** (FRS): The Submit Job button will remain disabled until all required data values are provided by the user.
- **DM.20210908.F.8.29** (FRS): When the Submit Job button is selected, users will be navigated to the Mass Retire - Unretire Job Details page.
- **DM.20210908.F.8.3** (FRS): The Mass Retire/Unretire bulk action will contain a tooltip and display the error message of "User not authorized for this task. DM_MassRetireUnretire." when the action is hovered upon by an unauthorized user.
- **DM.20210908.F.8.30** (FRS): The warning message of "The effective end date will be applied to all records." will be displayed when a user submits both retired and unretired records within the same job, regardless of the radio button selected. The message will appear upon selecting the Submit Job button. Note: The warning message will be displayed regardless of approval status.
- **DM.20210908.F.8.31** (FRS): The warning message will be displayed in a dialogue box with Cancel and Continue buttons.
- **DM.20210908.F.8.5** (FRS): When the Mass Retire/Unretire bulk action is selected, users will be navigated to the Mass Retire - Unretire Job Submission page.
- **DM.20210908.F.8.6** (FRS): The Mass Retire - Unretire Job Submission page will contain the following: Dictionary Management link - this will navigate users back to the main Dictionary Management page Selected: XXX (XXX represents the number of selected records) Retire radio button Unretire radio button Effective Begin Date textbox (displayed only when Unretired radio button is selected) Effective End Date textbox (displayed only when Unretired radio button is selected) Date picker (displayed only when Unretired radio button is selected) Job Description textbox Electronic signature block Submit Job button
- **DM.20210908.F.8.7** (FRS): When a user selects only retired records (approved and unapproved) and then selects the bulk action, the Retire radio button will be grayed out and disabled on the Mass Retire - Unretire Job Submission page.
- **DM.20210908.F.8.8** (FRS): When a user selects only unretired records (approved and unapproved) and then selects the bulk action, the Unretire radio button will be grayed out and disabled on the Mass Retire - Unretire Job Submission page.
- **DM.20210908.F.8.9** (FRS): When a user selects both retired and unretired records (approved and unapproved) and then selects the bulk action, the Retire radio button will be selected by default; however, the user will have the option of being able to select the Unretire radio button. Note: Regardless of the radio button selected, the date will apply to all records selected by the user.
- **DM.20210908.F.9.2** (FRS): A Dictionary Management link will be provided on each of the Job Details pages allowing users to navigate back to the main Dictionary Management page.
- **DM.20210908.F.9.3** (FRS): Each Job Details page will display a Job Summary grid containing the following information: Display Id, Description, User Id, Created (date/time), Completed (date/time), Percent Complete, Status, and Error Message.
- **DM.20210908.F.9.5** (FRS): The localized message of "The Submitted job is being processed, please stay on this page to review the completion." will be displayed in red until the job completes.

## DM_ExcelImport_Update-1.3 (23)

- **DM.20210908.F.2.11** (FRS): When a user imports an Excel template and does not provide a value for the Effective Begin Date, by default, the date will be set to the current day's date.
- **DM.20210908.F.2.12** (FRS): When a user imports an Excel template and does not provide a value for the Effective End Date, by default, the date will be set to 12/31/2099.
- **DM.20210908.F.2.13** (FRS): When a user imports an Excel template and provides an Approved By value but does not provide a value for the ApprovalDateTime, by default, the date will be set to the current day's date.
- **DM.20210908.F.2.14** (FRS): When a user imports an Excel template and provides a future date value for the Effective Begin Date, by default, the system will accept it.
- **DM.20210908.F.2.15** (FRS): When a user imports an Excel template and provides a non-ROBAR user value for Approved By, by default, the system will accept non-user entries.
- **DM.20210908.F.2.21** (FRS): When the Validate button is selected, the Excel template will undergo a validation process which will have to pass in its entirety in order for any of the records to be processed.
- **DM.20210908.F.2.23** (FRS): When importing data and validation errors are encountered, a Validation Errors grid will be displayed highlighting any row level errors and/or any duplicate data entries encountered. Note: This grid will be displayed after the Validate button is selected.
- **DM.20210908.F.2.28** (FRS): When records within the Excel template already exist within the database, the following warning message will be displayed "The following records will replace data in the database, do you want to proceed?" Note: The warning message will appear after the user selects the Validate button.
- **DM.20210908.F.2.29** (FRS): The warning message will be be displayed in a popup dialogue along with Yes and No buttons.
- **DM.20210908.F.2.30** (FRS): When the user selects 'Yes', the dialogue will be closed, the user will be prompted to enter user credentials, and data in the database will be overwritten.
- **DM.20210908.F.2.32** (FRS): When a user without the DM_ImportOverwrite security process attempts to update records that already exist in the database, the following error message will be displayed "User not authorized for this task. DM_ImportOverwrite." Note: This error message will be displayed once the user credentials have been entered and the Submit Job button has been selected. Additionally, this error message applies if the user is overwriting existing data and not importing new data.
- **DM.20210908.F.2.33** (FRS): If the user does not enter a value for Job Description, the following error message will be displayed “This field is required.”
- **DM.20210908.F.2.34** (FRS): The electronic signature block will be displayed containing a User Name textbox, Password textbox, Reason Code drop-down, and Comment textbox.
- **DM.20210908.F.2.35** (FRS): If the user does not enter a value for User Name and/or Password, the following error message will be displayed “This field is required.”
- **DM.20210908.F.2.36** (FRS): If invalid credentials of the User Name or Password are entered, the following error message will be displayed once the user selects the Submit Job button “Invalid Username/Password: UserID: XXXXX".
- **DM.20210908.F.2.37** (FRS): If the User Name and Password credentials of an unauthorized user are entered, the following error message will be displayed once the user selects the Submit Job button “User not authorized for this task. DM_Import”. Note: This error message will be displayed once the user credentials have been entered and the Submit Job button has been selected. Additionally, this error message applies if the user is importing new data and not overwriting existing data.
- **DM.20210908.F.2.39** (FRS): If the user does not select a value from the Reason Code drop-down, the following error message will be displayed “This field is required.”
- **DM.20210908.F.2.40** (FRS): A Comment textbox will be displayed. This is an optional field that will not require a value.
- **DM.20210908.F.2.41** (FRS): The electronic signature information will be saved into the Activity table. Action: ExcelImport ObjectType: Dictionary Management ObjectName: Display Id ReasonCode: The value selected by the user. Comments: The value entered by the user."
- **DM.20210908.F.2.43** (FRS): When the Submit Job button is selected and upon successful completion, the following will be displayed: DisplayId: XXXXXXXXXX (i.e.: 202111100001) "Upload Successful." message
- **DM.20210908.F.2.44** (FRS): All newly imported entries and updates will be saved in the Dictionary and X_Dictionary tables.
- **DM.20210908.F.2.45** (FRS): All submitted import jobs will be written to the TableImporterJobs and X_TableImporterJobs tables.
- **DM.20210908.F.2.46** (FRS): The TableImporterJobs table will contain the following column headers: Id, DisplayId, SubmittingUser, Status, DateInserted, TableName, ErrorMessage, LastTouch, SignatureId, rowguid, and Data. The Id column will contain the primary key, the DateInserted column will contain the date the record was inserted, and the ErrorMessage column will contain the XML data from the newly inserted records.

## DM_ViewEdit-1.8 (18)

- **DM.20210908.F.4.1** (FRS): A New Version row level action will be displayed within the Actions drop-down for each record.
- **DM.20210908.F.4.10** (FRS): Dictionary Management will allow only one unapproved version to exist for a given record.
- **DM.20210908.F.4.11** (FRS): All newly created versions will be saved in the Dictionary and X_Dictionary tables.
- **DM.20210908.F.4.2** (FRS): Only users who have the 'DM_NewVersion' security process enabled will be able to select the New Version row level action. The action will be displayed in a disabled state for unauthorized users.
- **DM.20210908.F.4.3** (FRS): The New Version row level action will contain a tooltip and display the error message of "User not authorized for this task. DM_NewVersion." when the action is hovered upon by an unauthorized user.
- **DM.20210908.F.4.4** (FRS): When the New Version row level action is selected, a New Version dialogue box will be displayed with a message of "Are you sure you want to create a new version?" along with Yes and No buttons.
- **DM.20210908.F.4.5** (FRS): When the user selects the 'Yes' button, an Edit Record dialogue will be displayed allowing the user to update the following fields: Translation value, Effective Begin value, Effective End value, and either to select or deselect the Edit as HTML checkbox. Note: The Phrase and Language values will be disabled and cannot be edited.
- **DM.20210908.F.4.6** (FRS): When the user selects the 'No' button, the New Version dialogue will be closed and a new version will not be created.
- **DM.20210908.F.4.7** (FRS): When the New Version row level action is selected, the new version can only be created from the latest approved record available.
- **DM.20210908.F.4.9** (FRS): When the latest version of a record is unapproved and a user selects the New Version row level action, the following error message will be displayed 'A latest unapproved version ‘X’ already exists. Cannot create a new version’.
- **DM.20210908.F.5.1** (FRS): A View/Edit row level action will be displayed within the Actions drop-down for each record.
- **DM.20210908.F.5.10** (FRS): All edits performed will be saved in the Dictionary and X_Dictionary tables.
- **DM.20210908.F.5.2** (FRS): The View/Edit row level action will be driven by the Web_DictionaryManagement and DM_Edit security processes.
- **DM.20210908.F.5.4** (FRS): The View/Edit Record dialogue will be displayed containing the following: Phrase textbox, Language textbox, Translation textbox, Effective Begin textbox and date picker, Effective End textbox and date picker, Edit as HTML checkbox, and Close button. Note: All fields and data values will be displayed in a disabled state and will not be editable.
- **DM.20210908.F.5.5** (FRS): Users who have both the 'Web_DictionaryManagement' and 'DM_Edit' security processes enabled will be able to edit an unapproved record when selecting the View/Edit row level action.
- **DM.20210908.F.5.6** (FRS): Users will have the ability to double click on a single record or select the View/Edit row level action. Note: The security processes for the user and the approval status of the record will determine whether the View/Edit Record dialogue is displayed.
- **DM.20210908.F.5.7** (FRS): The View/Edit Record dialogue will be displayed containing the following: Phrase textbox, Language textbox, Translation textbox, Effective Begin textbox and date picker, Effective End textbox and date picker, Edit as HTML checkbox, and Submit button.
- **DM.20210908.F.5.8** (FRS): When a user with the appropriate security processes double clicks on an unapproved record, the user will only be able to edit the following fields: Translation, Effective Begin, Effective End, and either select or deselect the Edit as HTML checkbox.

## DM_Security-1.1 (16)

- **DM.20210908.F.1.1** (FRS): For the 6.0.6 software branch and forward, the security process ‘Maintain_Dictionary’ will be deprecated and replaced with the ‘Web_DictionaryManagement' security process.
- **DM.20210908.F.1.12** (FRS): An Actions drop-down will be displayed in the top right corner of the Dictionary Management page.
- **DM.20210908.F.1.13** (FRS): The Actions drop-down will contain the following actions: Excel Import and New Entry. Note: The actions will be displayed in alphabetical order.
- **DM.20210908.F.1.14** (FRS): A Version Filters drop-down will be displayed for allowing users to select one of the following options: Any, Approved, Last Version Is Approved, or Unapproved. Note: The values will be displayed in alphabetical order. The default will value will be set to 'Any' which will display all records.
- **DM.20210908.F.1.15** (FRS): When the 'Approved' option is selected, only approved records will be displayed.
- **DM.20210908.F.1.16** (FRS): When the 'Last Version Is Approved' option is selected, only the latest approved version of a record will be displayed.
- **DM.20210908.F.1.17** (FRS): When the 'Unapproved' option is selected, only unapproved records will be displayed.
- **DM.20210908.F.1.18** (FRS): A Latest Only checkbox will be displayed for allowing users to either retrieve the latest approved or latest unapproved records.
- **DM.20210908.F.1.19** (FRS): An Effective Only checkbox will be displayed for allowing users to only retrieve effective records.
- **DM.20210908.F.1.20** (FRS): A Retrieve Data button will be displayed for allowing users to retrieve data based on defined search criteria filter(s). Note: Record results will not be displayed until the Retrieve Data button is selected.
- **DM.20210908.F.1.21** (FRS): Search criteria filters selected by the user will be saved in the UserEnvironment table.
- **DM.20210908.F.1.34** (FRS): A Bulk Actions drop-down will be displayed on the Dictionary Management page.
- **DM.20210908.F.1.35** (FRS): The Bulk Actions drop-down will contain the following actions: Export to Excel, Mass Approve, and Mass Retire/Unretire. Note: The bulk actions will be displayed in alphabetical order.
- **DM.20210908.F.1.5** (FRS): Dictionary Management will be accessible on the Innovatum Web Menu located under the Data and Labels menu.
- **DM.20210908.F.1.6** (FRS): Only users who have the 'Web_DictionaryManagement' security process enabled will be able to access the module. In addition, the standalone module must be enabled within the MenuWebIntegration table, otherwise the module will not be displayed. Note: This security will allow a user to only view the module and not edit any records.
- **DM.20210908.F.1.7** (FRS): The Dictionary Management module will not be displayed for unauthorized users.

## DM_MassApprove-1.6 (15)

- **DM.20210908.F.7.1** (FRS): A Mass Approve bulk action will be displayed within the Bulk Actions drop-down.
- **DM.20210908.F.7.10** (FRS): If the user does not enter a value for User Name and/or Password, the following error message will be displayed “This field is required.”
- **DM.20210908.F.7.11** (FRS): If invalid credentials of the User Name or Password are entered, the following error message will be displayed once the user selects the Submit Job button “Invalid Username/Password: UserID: XXXXX".
- **DM.20210908.F.7.12** (FRS): If the User Name and Password credentials of an unauthorized user are entered, the following error message will be displayed once the user selects the Submit Job button “User not authorized for this task. DM_MassApprove”.
- **DM.20210908.F.7.14** (FRS): If the user does not select a value from the Reason Code drop-down, the following error message will be displayed “This field is required.”
- **DM.20210908.F.7.15** (FRS): A Comment textbox will be displayed. This is an optional field that will not require a value.
- **DM.20210908.F.7.16** (FRS): The electronic signature information will be saved into the Activity table. Action: MassApprove ObjectType: Dictionary Management ObjectName: Display Id ReasonCode: The value selected by the user. Comments: The value entered by the user."
- **DM.20210908.F.7.17** (FRS): The Submit Job button will remain disabled until all required data values are provided by the user.
- **DM.20210908.F.7.18** (FRS): When the Submit Job button is selected, users will be navigated to the Mass Approve Job Details page.
- **DM.20210908.F.7.2** (FRS): Only users who have the 'DM_MassApprove' security process enabled will be able to select the Mass Approve bulk action. The action will be displayed in a disabled state for unauthorized users.
- **DM.20210908.F.7.5** (FRS): When the Mass Approve bulk action is selected, the data set will be based on the search criteria filters selected by the user.
- **DM.20210908.F.7.6** (FRS): When the Mass Approve bulk action is selected, users will be navigated to the Mass Approve Job Submission page.
- **DM.20210908.F.7.7** (FRS): The Mass Approve Job Submission page will contain the following: Dictionary Management link - this will navigate users back to the main Dictionary Management page Selected: XXX (XXX represents the number of selected records) Job Description textbox Electronic signature block Submit Job button
- **DM.20210908.F.7.8** (FRS): If the user does not enter a value for Job Description, the following error message will be displayed “This field is required.”
- **DM.20210908.F.7.9** (FRS): The electronic signature block will be displayed containing a User Name textbox, Password textbox, Reason Code drop-down, and Comment textbox.

## DM_ExportToExcel-1.5 (14)

- **DM.20210908.F.6.1** (FRS): An Export to Excel bulk action will be displayed within the Bulk Actions drop-down.
- **DM.20210908.F.6.11** (FRS): The Submit Job button will remain disabled until values have been entered for the Job Description and Filename.
- **DM.20210908.F.6.12** (FRS): When the Submit Job button is selected, users will be navigated to the Export to Excel Job Details page.
- **DM.20210908.F.6.2** (FRS): Only users who have the 'DM_Export' security process enabled will be able to select the Export to Excel bulk action. The action will be displayed in a disabled state for unauthorized users.
- **DM.20210908.F.6.5** (FRS): When the Export to Excel bulk action is selected, the exported data set will be based on the search criteria filters selected by the user.
- **DM.20210908.F.6.6** (FRS): When the Export to Excel bulk action is selected, users will be navigated to the Export to Excel Job Submission page.
- **DM.20210908.F.6.7** (FRS): The Export to Excel Job Submission page will contain the following: Dictionary Management link - this will navigate users back to the main Dictionary Management page Selected: XXX (XXX represents the number of selected records) Job Description textbox Filename textbox Submit Job button
- **DM.20210908.F.6.8** (FRS): If the user does not enter a value for Job Description, the following error message will be displayed “This field is required.”
- **DM.20210908.F.6.9** (FRS): If the user does not enter a value for Filename, the following error message will be displayed “This field is required.”
- **DM.20210908.F.9.10** (FRS): When the Download Spreadsheet link is selected, users will be able to view and download the exported data results in Excel format. Note: This only applies to the Export to Excel bulk action.
- **DM.20210908.F.9.6** (FRS): A page counter will be displayed in the bottom center of the Export to Excel Job Details page. The Page counter will display Page X of Y.
- **DM.20210908.F.9.7** (FRS): A Record counter drop-down box will be displayed in the bottom center of the Export to Excel Job Details page allowing users to customize their view by selecting 10, 20, or 30 records. The drop-down will default to 10 records.
- **DM.20210908.F.9.8** (FRS): A Page view will be displayed and in the bottom right corner of the Export to Excel Job Details page. The Page view will display as View X – Y of Y.
- **DM.20210908.F.9.9** (FRS): A Download Spreadsheet link will be displayed under the Job Summary section once the job completes. Note: This only applies to the Export to Excel bulk action.

## DM_NewEntry-1.4 (13)

- **DM.20210908.F.3.1** (FRS): A New Entry action will be displayed within the Actions drop-down located in the top right corner of the Dictionary Management page.
- **DM.20210908.F.3.10** (FRS): By default, when a new record is created and the user selects a future Effective Begin date value, the value will be accepted.
- **DM.20210908.F.3.11** (FRS): By default, when a new record is created the Effective End date value will be set to 12/31/2099 unless a different value is selected by the user.
- **DM.20210908.F.3.13** (FRS): By default, the 'Edit as HTML' checkbox will be deselected.
- **DM.20210908.F.3.14** (FRS): When a user selects the 'Edit as HTML' checkbox, an HTML editor will be displayed to support data formatting. The entered value will be saved as an HTML string within the Translation column of the Dictionary table.
- **DM.20210908.F.3.15** (FRS): If a new record is created and the phrase and language combination already exists, an Error Message dialogue box will be displayed along with a Continue button. The error message of ‘Record already exists.' will be displayed.
- **DM.20210908.F.3.16** (FRS): All newly created entries will be saved in the Dictionary and X_Dictionary tables.
- **DM.20210908.F.3.2** (FRS): Only users who have the 'DM_NewEntry' security process enabled will be able to select the New Entry action. The action will be displayed in a disabled state for unauthorized users.
- **DM.20210908.F.3.3** (FRS): The New Entry action will contain a tooltip and display the error message of "User not authorized for this task. DM_NewEntry." when the action is hovered upon by an unauthorized user.
- **DM.20210908.F.3.4** (FRS): When the New Entry action is selected, a New Record dialogue box will be displayed containing the following: Phrase textbox, Language textbox, Translation textbox, Effective Begin textbox and date picker, Effective End textbox and date picker, Edit as HTML checkbox, and Submit button.
- **DM.20210908.F.3.5** (FRS): Users will have the ability to tab through each field on the dialogue.
- **DM.20210908.F.3.7** (FRS): When a user does not enter a value for Phrase and then selects the Submit button, the following error message will be displayed “This field is required.”
- **DM.20210908.F.3.8** (FRS): When a user does not enter a value for Language and then selects the Submit button, the following error message will be displayed “This field is required.”

## DM_ExcelImport-1.2 (12)

- **DM.20210908.F.2.1** (FRS): An Excel Import action will be displayed within the Actions drop-down located in the top right corner of the Dictionary Management page.
- **DM.20210908.F.2.10** (FRS): The Excel template will contain the following column headers: Phrase, Language, Translation, EffectiveBegin, EffectiveEnd, ApprovedBy, and ApprovalDateTime. Note: Phrase and Language are required fields, all other fields can be blank.
- **DM.20210908.F.2.16** (FRS): The Sheet drop-down will be auto populated with the worksheet values derived from the Excel Template selected for uploading.
- **DM.20210908.F.2.2** (FRS): Only users who have the 'DM_Import' security process enabled will be able to select the Excel Import action. The action will be displayed in a disabled state for unauthorized users.
- **DM.20210908.F.2.20** (FRS): A Validate button will be displayed. This button will remain disabled until the Excel template and Sheet value has been selected by the user.
- **DM.20210908.F.2.22** (FRS): Upon successful validation of the Excel template, the following will be displayed: "Validation Successful." message Job Description textbox Electronic signature block Submit Job button
- **DM.20210908.F.2.4** (FRS): Users who have the 'DM_Import' security process enabled will be able to import new unapproved dictionary data.
- **DM.20210908.F.2.5** (FRS): Users who have the 'DM_Import' and 'DM_ImportOverwrite' security processes enabled will be able to import new unapproved dictionary data, as well as overwrite existing unapproved dictionary data.
- **DM.20210908.F.2.6** (FRS): When users who have both the 'DM_Import' and 'DM_ImportOverwrite' security processes enabled attempt to overwrite an existing approved dictionary record, the system will allow the import and automatically create a new unapproved version of that record. Note: The unapproved version will be created if the ApprovedBy and ApprovalDateTime values are blank within the Excel file; however, if there are values for the ApprovedBy and ApprovalDateTime, the system will create a new approved version.
- **DM.20210908.F.2.7** (FRS): When the Excel Import action is selected, users will be navigated to the Dictionary Excel Data Upload page.
- **DM.20210908.F.2.8** (FRS): The Dictionary Excel Data Upload page will contain the following: Dictionary Management link - this will navigate users back to the main Dictionary Management page Download Template link File textbox Browse button Sheet drop-down Validate button
- **DM.20210908.F.2.9** (FRS): Users will have the ability to download, open, and save the Excel template upon selecting the Download Template link.

## (none) (9)

- **DM.20210908.U.1** (URS): A standalone Dictionary Management module will be available on the Innovatum Web Menu which will allow users to view, create, and maintain dictionary translations.
- **DM.20210908.U.2** (URS): Users will have the ability to import new approved and unapproved dictionary data, as well as modify existing unapproved data when performing the Excel Import action.
- **DM.20210908.U.3** (URS): Users will have the ability to create new dictionary records when performing the New Entry action.
- **DM.20210908.U.4** (URS): Users will have the ability to create new versions from existing dictionary records when performing the New Version row level action.
- **DM.20210908.U.5** (URS): Users will have the ability to view and edit existing dictionary records when performing the View/Edit row level action.
- **DM.20210908.U.6** (URS): Users will have the ability to mass export dictionary records when performing the Export to Excel bulk action.
- **DM.20210908.U.7** (URS): Users will have the ability to mass approve dictionary records when performing the Mass Approve bulk action.
- **DM.20210908.U.8** (URS): Users will have the ability to mass retire and mass unretire dictionary records when performing the Mass Retire/Unretire bulk action.
- **DM.20210908.U.9** (URS): All bulk actions submitted within the Dictionary Management module will be navigated to a corresponding Job Details page.

## DM_ExportToExcel-1.5, DM_MassApprove-1.6, DM_MassRetireUnretire-1.7 (2)

- **DM.20210908.F.10.2** (FRS): Bulk action jobs submitted for Export to Excel, Mass Approve, and Mass Retire/Unretire will be written to the CMJobs table.
- **DM.20210908.U.10** (URS): All bulk action jobs submitted via the Dictionary Management module will be viewable in the Job Inquiry web module.

## N/A (1)

- **DM.20210908.F.1.4** (TRS): The Innovatum.Pages.DictionaryManagement.MVC and Innovatum.Pages.DictionaryManagement.WCF InnoPages plugins will be created to support users in creating and maintaining dictionary translations.

## UAT_20210909-001 (1)

- **DM.20210908.F.10.1** (FRS): Bulk action jobs submitted for Export to Excel, Mass Approve, and Mass Retire/Unretire will be accessible within the Job Inquiry web module. Note: This applies for new installs and not upgrades.

## UAT-20210908-001 (1)

- **DM.20210908.F.2.17** (FRS): The worksheet values within the Sheet drop-down will be displayed in alphabetical order. The default value of (Select a sheet) will be the first value in the list.

## DM_ExcelImport_update-1.3 (1)

- **DM.20210908.F.2.31** (FRS): When the user selects 'X' or 'No', the dialogue will be closed, the job will be aborted, and the user will remain on the Dictionary Excel Data Upload page. Note: The Validate button will be disabled until the user selects a new file or sheet.

## DM_Entry-1.4 (1)

- **DM.20210908.F.3.9** (FRS): By default, when a new record is created the Effective Begin date value will be set to the current day's date unless a different value is selected by the user.

## DM_NewEdit-1.8 (1)

- **DM.20210908.F.4.8** (FRS): When the latest approved version of a record is not selected and a user selects the New Version row level action, the following error message will be displayed 'A latest approved version ‘X’ already exists. Cannot create a new version’.

## DM-ViewEdit-1.8 (1)

- **DM.20210908.F.5.3** (FRS): When the View/Edit row level action is selected and the user only has the Web_DictionaryManagement security process enabled, a View/Edit Record dialogue will be displayed regardless of the record's approval status.

## DM_MassRetieUnretire-1.7 (1)

- **DM.20210908.F.8.15** (FRS): When the user selects the 'Continue' button, the user will then have the option of selecting either the Retire or Unretire radio button.

## DM_ExportToExcel-1.5, DM_MassApprove-1.6 DM_MassRetireUnretire-1.7 (1)

- **DM.20210908.F.9.4** (FRS): Each Job Details page will display a Job Details grid containing the following columns: Phrase, Language, Translation, Approved By, Approve Date, Effective Begin, Effective End, and Message. Note: Error messages will be displayed in the Message column.
