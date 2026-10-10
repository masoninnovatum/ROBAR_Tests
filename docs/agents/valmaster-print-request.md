# ValMaster requirements - Print Request (Print by Order / Print by Lot) - ValMaster requirements

Pulled READ-ONLY from "ValMaster - Innovatum" (sheet 3214043046537092) on 2026-10-09: 124 rows with Customer Specific blank and Req Status not Obsolete. Grouped by the Test Cases column. Requirements = EXPECTATION of behavior; live differences are findings.

## NA (30)

- **FRS-8.1.16.3** (FRS): Web Printing will be provided all order and configuration information through HTTP Get parameters in the query string.
- **FRS-8.1.17.5** (FRS): A global setting Image_Version_Management_On will control whether or not the print server manages image versions.
- **FRS-8.1.7.1** (FRS): The total batch quantity will be communicated in a user field that is specified by the user.
- **FRS-8.1.7.3** (FRS): The total printed quantity for a label type will be (Batch qty) X (Multiplier *Serial or Identical*) + (batch record qty) - This will be placed in the serialized copies of label is serialized. Or in identical copies of label if it is not serialized.
- **FRS-8.1.7.5** (FRS): A security setting will allow/disallow changes to the calculated quantities.
- **FRS-8.1.7.6** (FRS): Web Printing will show the quantity fields Quantity Produced, Identical Copies, and Serialized Copies at print time.
- **MDM20150514100U1.0.0** (URS): Print by Order, Print by modules will allow printing of mdm data on labels.
- **RBR20121227001U100.13** (URS): Two or more Database servers need to be able to be linked together In a redundant architecture. PrintIDs need to use a GUID. Summary print must use a shorter ID for Verification.
- **URS-8.1.1** (URS): 
- **URS-8.1.10** (URS): The system will allow the user to select a printer.
- **URS-8.1.11** (URS): The system will support legacy capabilities.
- **URS-8.1.13** (URS): The system will provide for 21 CFR Part 11 compliance for signatures and audit trails.
- **URS-8.1.15** (URS): The system will provide a configuration to print labels using any item or template version.
- **URS-8.1.16** (URS): Web Based Printing will interface with other software by accepting an order as input.
- **URS-8.1.17** (URS): The system will have a version-aware reprint capability from print history. This will allow a ROBAR web print client to create an exact reprint of any label
- **URS-8.1.19** (URS): Print by /Order multi modules will allow authorized users to access and select item information for / Order numbers associated with one or multiple items.
- **URS-8.1.2** (URS): The system will provide localization features for the user’s country and language.
- **URS-8.1.3** (URS): The system will support adding , retrieving and overriding information.
- **URS-8.1.4** (URS): The system will support shelf life calculation.
- **URS-8.1.7** (URS): The system will handle printing of labels based on batch quantities.
- **URS-8.1.8** (URS): The system will provide an interface to validate printed labels against label masters.
- **URS-8.1.9** (URS): The system will provide the ability to reprint labels.
- **URS.RBR.WP.101** (URS): ROBAR Web printing system shall be capable of retrieving order data and updating the ROBAR database.
- **WEB20141203U1.0.0** (URS): The system will allow override of certain data.
- **WEB20141205U1.0.0** (URS): The maximum number of labels that can be printed through a single print job will be configurable.
- **WP20121227001U102.0** (URS): Print ID naming convention needs to use a GUID which must be globally unique.
- **WP20130208001U103.0** (URS): Web Printing must allow test prints to be performed as part of the printing processes.Test Printing must be a function of the print pages.
- **WP20130208001U103.1** (URS): System must allow for as many Test Prints as needed.
- **WP20130208001U103.2** (URS): Test print must be enabled by configuration.
- **WP20130208001U103.3** (URS): Test prints must be displayed in Print History Inquiry.

## BPMasterData1.1 (10)

- **FRS-8.1.16.2** (FRS): data can be automatically entered by Web Printing or allow the user to enter data.
- **FRS-8.1.3.13** (FRS): If the user attempts to print labels using Print by Order module with an Order number that is assigned to multiple items, it will display an error.
- **WB20141205F1.0.3** (FRS): The system will allow the user to continue printing if they chose the option "Yes" when warned about the total number of labels being printed exceeds the value entered in "WarnWhenPrintedLabelsExceedsValue" setting.
- **WEB20141203F1.0.1** (FRS): The system will allow the user to enter date(s) at print time manually or by scanning a barcode when the "AllowManualDateEntry" setting is set to 'Y'.
- **WEB20141203F1.0.2** (FRS): The system will display an error message if the date entered manually or by scanning does not match the format specified in the "ManualEntryDateFormat" setting.
- **WEB20141203F1.0.3** (FRS): The system will allow the user to reenter the date if there is a formatting error.
- **WEB20141203F1.0.4** (FRS): The system will prevent the user from accessing the next print screen if the date is not entered in the correct format.
- **WEB20141203F1.0.5** (FRS): The system will automatically highlight all of the contents of a date field when a user places the cursor in it.
- **WEB20141205F1.0.2** (FRS): The system will display a warning message if the total number of labels exceeds the value specified in the "WarnWhenPrintedLabelsExceedsValue" setting.
- **WEB20141205F1.0.4** (FRS): The system will allow the user to change the values entered in the quantity and copies fields once the user chooses the "No" option when about the total number of labels being printed exceeds the value entered in "WarnWhenPrintedLabelsExceedsValue" setting.

## PHI_ExactReprint_Action-1.6 (9)

- **FRS-8.1.17.1** (FRS): ROBAR print will be changed to keep field contents used in printing a label and to associate it with the unique print ID generated. This will be kept in a new history table and will use storage algorithms to keep disk usage to a reasonable level. The ROBAR PrintHistory table will reference this table.
- **FRS-8.1.17.2** (FRS): Image files used in all label templates will be versioned and kept in a hidden folder under the ROBARIMG directory. Each time a label is printed the print server will determine whether or not the image has changed since the last time the template was printed. If the image did change it will be versioned and archived. The Exact Reprint will reference the versioned image and not the current image.
- **FRS-8.1.17.3** (FRS): A new table LabelImages will be added to store image revision history. The table will include the following columns: FileName; VersionNumber; VersionHash; EffectiveBegin; EffectiveEnd; ApprovedBy; ApprovalDateTime; LastTouch
- **FRS-8.1.17.4** (FRS): The following tables will be added to the robar database to keep print history data for Exact Reprints: PrintDataHistory- PrintID, DataID; PrintDataValues- ShareName, ShareValue, DataID. A new column OriginalPrintID will be added to the PrintHistory table to reference the original print id of a reprint.
- **FRS-8.1.17.6** (FRS): The Exact Reprint screen will display historical information about this label including, if configured, an exact image of the label. ROBAR will not go to the current version of the template or item for its data; it will all be retrieved from history.
- **FRS-8.1.17.7** (FRS): In the history record of the reprint, ROBAR will log the print ID of the original print from which the reprint was initiated. This can be used by the customer to distinguish reprint from history and regeneration of a reprint.
- **FRS-8.1.17.8** (FRS): The reprint screen will provide standard ROBAR reprint functionality which will be logged to history and shown in the list of labels printed for this work order.
- **FRS-8.1.17.9** (FRS): The Exact Reprint screen will display the standard printing options panel, a reset button that takes the user back to the order entry page, the print ID of the current print, and the print ID of the original print.
- **WP20121227001F102.0.1** (FRS): Print IDs will be changed to: PID_<Guid with - removed>, ER_PID_<Guid with - removed>

## BP_TestPrint1.2 (8)

- **WP20130208001F103.0.1** (FRS): A "Test" checkbox will be displayed as part of the print option selection panel which will change the "Print" button to a red "Test Print" button.
- **WP20130208001F103.0.2** (FRS): A system share name S_Test will be created and when the feature is activated, will contain "Test" which can be printed on the label.
- **WP20130208001F103.1.1** (FRS): The user will be able to click the "Test Print" button indefinitely until the "Test" checkbox has been unchecked.
- **WP20130208001F103.1.2** (FRS): Test prints will be excluded from reprint calculations.
- **WP20130208001F103.2.1** (FRS): Print configuration settings will determine whether test printing is shown and whether it will be required.
- **WP20130208001F103.2.2** (FRS): Test printing may be required on a per- basis (once a test print has been performed for a , the user will not be required to perform a test print for subsequent prints of that ).
- **WP20130208001F103.2.3** (FRS): Test printing may be required on a per-session basis (a user will be required to perform an initial test print for each series of consecutive prints of the same item- combination).
- **WP20130208001F103.3.1** (FRS): Test prints will be recorded with a print status of "Test Printed".

## BP_PrintbyMulti1.2 (6)

- **FRS-8.1.3.6** (FRS): The Print by multi module will allow authorized users to assign new data to items at print time using the Add button.
- **FRS-8.1.3.7** (FRS): The Print by multi module will allow authorized users to assign an existing number to items at print time given that the combination of Order and number assigned to the items is unique to those items.
- **FRS-8.1.3.8** (FRS): The Print by multi module will allow authorized users to print labels for any number that is associated with multiple items.
- **FRS-WPP8.1.19.1** (FRS): A drop down (or checkbox list) will be displayed, even if a single record is retrieved.
- **FRS-WPP8.1.19.2** (FRS): Drop down will minimally contain, /Order, Item, Exp date. A settings entry similar to print history will control any fields that are included.
- **FRS-WPP8.1.19.3** (FRS): User will select the item record to print from the drop down and go automatically to the rest of the print sequence

## Localization-1.1, Localization-1.2 (5)

- **FRS-8.1.2.1** (FRS): Each user of the system will be associated with a particular language.
- **FRS-8.1.2.3** (FRS): A Languages Supported table will be added to the ROBAR database. This table will contain an Active flag.
- **FRS-8.1.2.4** (FRS): The user will select a language from a drop down list on the Login Screen.
- **FRS-8.1.2.5** (FRS): The system will support translated error messages, and show default text if the translation is not found.
- **FRS-8.1.2.6** (FRS): The error code will be part of the error message

## BPMasterData1.2 (5)

- **FRS-8.1.6.1** (FRS): ROBAR serial counters will be supported.
- **FRS-8.1.6.2** (FRS): Serialized labels will be identified by the presence of the S_SER replacement field on the label.
- **FRS-8.1.6.3** (FRS): Web Printing will follow standard ROBAR for the serial number start value in the Settings.
- **FRS-8.1.6.4** (FRS): Web Printing will allow users to enter the starting serial number.
- **FRS-8.1.6.5** (FRS): Only authorized users will be able to specify the starting serial number. This is controlled by the Specify_Starting_Serial_Num security setting.

## May be merged with testing for other requirement(s) and/or tested indirectly. (4)

- **FRS-8.1.1.1** (FRS): The system will utilize cascading style sheets to customize the user interface.
- **FRS-8.1.1.2** (FRS): The layout will show a customer logo.
- **FRS-8.1.1.3** (FRS): The system will use an XML file to customize the display settings to be kept in a new table named PrintConfig
- **FRS-8.1.1.4** (FRS): The XML file will control how screen fields are used, and will show and protect various fields.

## BP21CFRPart11-1.1, BPMasterData1.1 (4)

- **FRS-8.1.3.1** (FRS): Web Printing will provide the ability to add a automatically if one does not exist.
- **FRS-8.1.3.2** (FRS): The manufacturing date will default to the Server date if the value is empty. And if the time zone of the workstation being used is different from that of the Server, ROBAR will offset the manufacturing date.
- **FRS-8.1.3.3** (FRS): The screen will contain an override button, and will write updates to the data regardless if the SaveAfterEdit=Y/N setting is “Y”.
- **FRS-8.1.3.4** (FRS): An activity record will be written if an override is used.

## BPMasterData1.3 (4)

- **FRS-8.1.4.1** (FRS): A setting will identify the field that holds the shelf life information.
- **FRS-8.1.4.2** (FRS): The shelf life will be calculated automatically and written back to the table if the expiration date is blank/null.
- **FRS-8.1.4.3** (FRS): Web Printing will calculate the expiration date based manufacturing date and shelf life.
- **FRS-8.1.4.4** (FRS): The manufacturing date will be derived from the server if the field is blank/null.

## BPMasterData1.2, (4)

- **FRS-8.1.5.1** (FRS): Web Printing will prompt at the item level as either text, a drop down list derived from the dictionary, or a calendar.
- **FRS-8.1.5.2** (FRS): Web Printing will use template level prompts.
- **FRS-8.1.5.3** (FRS): If there are multiple prompts, they will be gathered and displayed on one screen.
- **FRS-8.1.5.4** (FRS): If there are multiple label types associated with a particular item, the system will prompt the user to select which label type to print.

## BPMasterData1.4, BPMasterData1.5, BPSecurity 1.3 (4)

- **FRS-8.1.9.1** (FRS): Web Printing will retain a setting to control if all subsequent prints are reprints or controlled by batch quantity.
- **FRS-8.1.9.2** (FRS): The user interface will contain a check box to flag the label as a reprint. This check box will be defaulted and forced to "check" if the system decides that the label is a reprint. A system derived reprint will behave as: If a setting says all subsequent prints are reprints and this is not the first print; If QTY Based; If total of printed qty + qty about to be printed exceeds batch qty for the item/label type (take multipliers and extras into account) Ignore reprint records in history in calculation of count.
- **FRS-8.1.9.3** (FRS): Web Printing will write the reprint record to the activity table.
- **FRS-8.1.9.4** (FRS): The system will retain values named S_Reprints (“O” for original or “R” for reprint), S_Initials (initials of the signed on user, for example Sally F. Watkins would be SFW), S_User (user id of the person signed on).

## BPSecurity1.2 (3)

- **FRS-8.1.10.1** (FRS): Web Printing will utilize a drop down list to select a printer.
- **FRS-8.1.10.2** (FRS): The system will read the Characteristics table for a default printer for the particular label. The default printer is set to the last printer used to print the label, and will only be chosen if the printer exists on the user’s local machine.
- **FRS-8.1.10.3** (FRS): Printing should not be allowed after a successful print without reset.

## BP21CFRPart11-1.1, BPSecurity 1.3, WebMenu1.6 (3)

- **FRS-8.1.13.1** (FRS): Web Printing will capture digital signatures for reprints
- **FRS-8.1.13.2** (FRS): Web Printing will capture an audit trail to the database.
- **FRS-8.1.13.3** (FRS): ROBAR Browser Printing will enforce Sign-on failure limits: user will be locked out after a certain number of failed logins, as dictated by ROBAR settings.

## BP_PrintbyOrderMulti1.3, LCN_PrintbyOrderMulti1.1 (3)

- **FRS-8.1.3.10** (FRS): The Print by Order multi module will allow authorized users to assign an existing Order number to items at print time given that the combination of Order and number assigned to the items is unique to those items.
- **FRS-8.1.3.11** (FRS): The Print by Order multi module will allow authorized users to print labels for any order number that is associated with multiple items.
- **FRS-8.1.3.9** (FRS): The Print by Order multi module will allow authorized users to assign new order data to items at print time using Add button.

## BP21CFRPart11-1.1 (2)

- **FRS-8.1.11.1** (FRS): Web Printing will retain the ability to write print history records and keep a JPG of the image in the print history.
- **FRS-8.1.11.2** (FRS): The columns Print Request ID, L_U5, and Reprint will be added to the print history table.

## BPVersionSelect-1.1, BPVersionSelect-1.2 (2)

- **FRS-8.1.15.1** (FRS): Web Printing will allow the user to select the item and template version for any item and template in the system.
- **FRS-8.1.15.2** (FRS): Security at the user level will control whether a user can change versions and select unapproved and ineffective items and templates

## OBSOLETE (2)

- **FRS-8.1.16.4** (FRS): The Web Printing Reset button action will be configurable to do one of the following: Close the window; Clear the form information; Restart the data entry process with the order that was passed to it; Return to a specific URL.
- **FRS-8.1.2.2** (FRS): A User Preferences table will be added to the ROBAR database.

## BPMasterData1.4 (2)

- **FRS-8.1.8.1** (FRS): Web Printing will provide the ability to view the label master in three modes: label master only, preview of current label only, and the label master and current label preview side-by-side.
- **FRS-8.1.8.2** (FRS): Web Printing will be able to print the label master after the label has been printed.

## Test requires customer-specific environment. (2)

- **FRS.RBR.WP.101.1** (FRS): Web Printing will obtain the information directly from the ERP system when the triggering value such as a turnaround (order) number is scanned.
- **FRS.RBR.WP.101.2** (FRS): ROBAR database tables will be automatically updated once the information has been modified on the print screen.

## MDM_Print12.1 (2)

- **MDM20150514100F1.0.1** (FRS): When users attempt to print labels for a ROBAR item associated with mdm item and the template associated with the ROBAR item contains mdm components, the printing modules will print latest approved effective mdm data on the label in addition to the latest approved effective ROBAR item data.
- **MDM20150514100F1.0.2** (FRS): If the mdm item associated with a ROBAR item is ineffective or retired, the printing modules will not print the mdm data on the label even if the mdm components exist on the template.

## NOT APPLICABLE (2)

- **RBR20121227001F100.13.2** (FRS): Summary Print needs to be changed to write a RUID (relatively uniquie ID) to the verificationID column of PrintHistory
- **RBR20121227001F100.13.3** (FRS): Summary Print Verification needs to be changed to verify based on the verificationID column of PrintHistory

## Test that configuration options work correctly to produce labels with accurate data especially for those items that can impact the safe use of the product such as expiration date and number. (1)

- **FRS-8.1.1.5** (FRS): Configuration will be used to control the following: Must Exist Y/N; Can be added if user is authorized; Save Y/N; Batch Qty; Produced field name - L_U2; Item QTY Produce Multiplier – Identical; Item QTY Produce Multiplier – Serialized; Item Extra Quantity to print; Keep .PRN after print; Setting to identify shelf life field in item; Is a second print automatically a reprint (Y/N); Capture eSig for reprint (Y/N); Name of item field to show in print details (Label Stock); Caption of item field to show in print details

## BP_Printby1.1, BPMasterData1.1 (1)

- **FRS-8.1.16.1** (FRS): Web Printing will accept an order number and number as input and verify the existence of the ROBAR order.

## BP_Printby1.1 (1)

- **FRS-8.1.3.12** (FRS): If the user attempts to print labels using Print by module with a number that is assigned to multiple items, it will display an error.

## BP_Printby1.1, BP_PrintbyMulti1.2, BP_PrintbyOrderMulti1.3, LCN_PrintbyOrderMulti1.1 (1)

- **FRS-8.1.3.5** (FRS): The system will allow retrieval of information using number or Order number.

## PS_PrintHistoryImage1.1 (1)

- **RBR20121227001F100.13.1** (FRS): PrintID needs to be changed for all programs to PID_<GUID> or ER_PID_<GUID>

## N/A Not GxP (1)

- **WEB20141205F1.0.1** (FRS): The system will calculate the total number of labels being printed using the values specified in quantity and copies fields.

## BP_TestPrint1.1 (1)

- **WP20130208001F103.2.4** (FRS): Security settings will be added to determine if a user can perform test prints and override required test prints.

## MDM_SummaryLabel11.1 (1)

- **WP20140321001F100.8.1** (FRS): The global setting ShelfLifeShareName will be used to specify the share name of the item field that is to be used as the Shelf Life.
