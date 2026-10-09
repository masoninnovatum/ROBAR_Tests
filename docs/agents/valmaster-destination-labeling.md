# ValMaster requirements - Destination Labeling (module "Destination Labeling", Customer Specific blank)

Pulled READ-ONLY from Smartsheet "ValMaster - Innovatum" (sheet 3214043046537092) on 2026-10-08: 215 rows = 208 Active + 2 Modified + 5 Obsolete (obsolete rows are not listed). Rows with a value in "Customer Specific" are excluded by the user's rule. Grouped by the Test Cases column (formal script family DL_*). Type: URS / FRS / TRS. The sub-modules "Destination Labeling - ..." (REST API, PDF Generator, Barcode Parse SP, Batch History, Get Lot Lookup, TIBCO / REST HU) and "DX Destination Labeling" are separate ValMaster modules, not included here.

## NA (31)

- **DL.171227.U.1** (URS): System shall have the capability to support destination label printing.
- **DL.171227.U.11** (URS): System shall retrieve the appropriate destination labeling templates/documents at print time.
- **DL.171227.U.12** (URS): System shall keep track of the Packed vs Ordered Values for a given Pick Detail.
- **DL.171227.U.13** (URS): System shall allow users to reset Worklist data.
- **DL.171227.U.14** (URS): System shall load the correct printers to print labels from the Destination Labeling page.
- **DL.171227.U.15** (URS): System shall have the ability to print labels from the Destination Labeling page.
- **DL.171227.U.16** (URS): System shall allow users to manually print destination labels for a given order/material/lot.
- **DL.171227.U.17** (URS): System shall allow users to auto print destination labels for a given order/material/lot.
- **DL.171227.U.18** (URS): System shall allow users to reprint destination labels.
- **DL.171227.U.19** (URS): System shall allow users to print multiple copies of each destination label for a given order/material/lot.
- **DL.171227.U.2** (URS): System shall store and retrieve Pick Header and Pick Details associated with Destination Labeling.
- **DL.171227.U.20** (URS): System will maintain a copy of the PRN files to ensure quick printing of labels.
- **DL.171227.U.21** (URS): System shall support printing serial labels.
- **DL.171227.U.22** (URS): System shall allow users to print all labels associated with an Order without scanning each material.
- **DL.171227.U.23** (URS): System shall allow users to verify printed labels and documents.
- **DL.171227.U.24** (URS): System shall maintain action history per session.
- **DL.171227.U.25** (URS): System shall maintain history records for all destination labeling print jobs.
- **DL.171227.U.26** (URS): System shall allow users to associate Templates with destinations.
- **DL.171227.U.27** (URS): System shall associate Items with GTIN numbers.
- **DL.171227.U.28** (URS): System shall populate the correct translations on destination label.
- **DL.171227.U.29** (URS): For Destination Labeling, the system shall not support Item and Template level prompts.
- **DL.171227.U.3** (URS): System shall allow populating information from the PICK HEADER and PICK DETAIL table on the label.
- **DL.171227.U.31** (URS): System shall allow users to reset the page.
- **DL.171227.U.32** (URS): System shall check for ROBAR Licensing.
- **DL.171227.U.33** (URS): System shall allow users to view Pick Detail information.
- **DL.171227.U.4** (URS): System shall have the ability to obtain Pick Header and Pick Details from an External System.
- **DL.171227.U.5** (URS): System shall allow users to create Pick Header and Pick Details at print time.
- **DL.171227.U.6** (URS): System shall provide the status of the destination label printing order.
- **DL.171227.U.7** (URS): System shall provide Destination Codes for selection at print time.
- **DL.171227.U.8** (URS): System shall allow populating Destination Code and Destination Name on the label.
- **DL.171227.U.9** (URS): System shall display the Shipping Information for a given Pick Header record.

## DL_PrintAll (28)

- **DL.171227.F.12.1** (FRS): The Worklist grid will display Pick Detail records associated with the Order Number. The Worklist panel will contain the following: -- Show Done checkbox -- Reset All button -- Grid containing the following columns: Material, Lot, Packed, Ordered, Status.
- **DL.171227.F.12.2** (FRS): The Worklist row that the user is actively working on will be displayed as the first row of the Worklist grid and the the Worklist Status will be set to "In Progress"
- **DL.171227.F.12.3** (FRS): The Status column in the Worklist grid will be set to the 'In Progress' icon while the user is actively working on a given row.
- **DL.171227.F.12.5** (FRS): The Status column in the Worklist grid will be set to the 'Complete' icon when the Packed value is greater than or equal to the Ordered value.
- **DL.171227.F.12.6** (FRS): When the Worklist Status for all rows in the Worklist grid is set to 'Complete' icon, the background for the Destination Labeling page will turn green.
- **DL.171227.F.12.7** (FRS): While the 'Show Done' box is unchecked, the Worklist grid will only display records where the status is not set to 'Complete'. If the 'Show Done' box is checked, the grid will be refreshed to also display rows with status of 'Complete'.
- **DL.171227.F.12.8** (FRS): All rows in the Worklist grid (except the first row while it is being actively worked on) will be set to a status of 'Pending' while the Packed value is less than the Ordered value.
- **DL.171227.F.13.4** (FRS): Clicking on the -1 button, for a given row in the Worklist grid will set the Packed value to one less than its current value. When the Packed Value is less than the Ordered value, the Worklist Status will be set to "In Progress" (if the labeling grid is loaded and being processe for the row) icon or "Pending".
- **DL.171227.F.13.5** (FRS): The -1 button will not be enabled when the Packed value is 0.
- **DL.171227.F.18.1** (FRS): Users will be allowed to reprint labels and documents (using auto prints, print all or manual printing) any number of times. No electronic signature will be required for the reprint.
- **DL.171227.F.22.10** (FRS): If one or more rows in the Labeling grid encounters errors, the 'Print All' action will ignore them and attempt to print the remainder of the unprocessed rows in the Labeling grid (if any). The error will be recorded in Session History. The Worklist Status will be set to 'Pending' for the row in the Worklist grid associated with the error. Once all the rows in the Labeling grid have been processed, the Print All action will stop. The user has to click on the Print All button again in order resume printing labels for remainder of the Worklist rows.
- **DL.171227.F.22.11** (FRS): While the 'Print All' action is being processed the 'Print All' button will be disabled.
- **DL.171227.F.22.12** (FRS): The Worklist Status will be updated accordingly for each row during and after the 'Print All' action is processed.
- **DL.171227.F.22.13** (FRS): If the system encounters serialized labels (template with S_Ser or S_USerial sharename) during the 'Print All' action, the serial value will be populated with the Starting Serial value specified for the Print Config 'StartingSerialNumber' (default value will be 001). If the Print Config value is blank, the system will print embedded data.
- **DL.171227.F.22.14** (FRS, Modified): For a given Order Number, if the Worklist grid contains rows that contain a Packed value greater than equal to 0 but less than Ordered value (partially completed order), when the Print All action is selected, the system will set Copies value to the difference between the Packed and Ordered values.
- **DL.171227.F.22.15** (FRS): After a 'Print All' job is complete, if a user performs 'Reset All' action in the Worklist grid, the screen background will be made blue again, and the Print All button will be enabled. If the user clicks the 'Print All' button then only the rows with the Worklist Status 'Pending' will be processed.
- **DL.171227.F.22.17** (FRS): When the 'Print All' button is clicked, the system will start auto printing labels and documents for each Material and Lot combination in the order in which they are listed in the Worklist grid.
- **DL.171227.F.22.18** (FRS): The Packed value will be updated in the Worklist grid as the system automatically prints labels during the 'Print All' action.
- **DL.171227.F.22.19** (FRS): Session history will be recorded for all prints performed using the 'Print All' option.
- **DL.171227.F.22.2** (FRS): The 'Print All' button will be displayed along with the Worklist grid after a successful Order Number scan.
- **DL.171227.F.22.4** (FRS): The 'Print All' button will be disabled if all the rows in the Worklist grid retrieved after an Order Number scan have a Worklist Status of 'Complete'.
- **DL.171227.F.22.5** (FRS): The 'Require Verification' option will not be considered for the 'Print All' action. if the option is checked by default, the system will deselect it when the Print All button is clicked.
- **DL.171227.F.22.6** (FRS): The 'Print Multiple Copies', 'Auto Print Labels' and 'Auto Print Documents' check boxes will automatically checked (if not already) and disabled when the 'Print All' button is clicked.
- **DL.171227.F.22.7** (FRS): For each row in the Worklist grid being processed by the 'Print All' action, the Labeling grid will be displayed and it will be populated with the labels and documents associated with the Worklist row.
- **DL.171227.F.22.8** (FRS): During the 'Print All' action, the Copies field for each row in the Labeling gird will be set to the Ordered value.
- **DL.171227.F.22.9** (FRS): If a row in the Labeling grid has no printers associated with it, the 'Print All' action will ignore it.
- **DL.171227.F.27.1** (TRS): The DESTLABELING view will contain Item to DI (Device Identifier, Ex: GTIN) associations. A unique row will exist in the view for each Item Number and DIcombination (based on the ITEMS and MASTERDATA tables).
- **DL.171227.F.29.1** (FRS): If an Item or Template used for Destination Labeling contain prompt data, the page will not display them at print time.They will be ignored.

## DL_RequireVerification (24)

- **DL.171227.F.12.4** (FRS): For a given Material and Lot combination, while the 'Require Verification' box is unchecked, after all rows in the Labeling grid have been successfully processed, the Packed value is incremented by 1.
- **DL.171227.F.19.2** (FRS): The Print Config 'AutoCheckMultipleCopies' will determine if the Print Multiple Copies check box will be checked by default. The Print Config value for this parameter will be set to N by default.
- **DL.171227.F.19.3** (FRS): When the 'Print Multiple Copies' checkbox is selected, the Copies field in the Labeling grid will be editable and set to 1 by default. (not applicable for PrintAll)
- **DL.171227.F.19.4** (FRS): When the 'Print Multiple Copies' checkbox is selected and the 'Require Verification' checkbox is selected, a single verification scan from one copy of the label will be required even though multiple copies of the labels have been printed.
- **DL.171227.F.19.5** (FRS): When the 'Print Multiple Copies' checkbox is selected and the 'Require Verification' checkbox IS NOT selected, once all the labels are successfully printed, the Packed value will be set to the lowest copies value for a given row in the labeling grid for that material/lot combination.
- **DL.171227.F.19.6** (FRS): When the 'Print Multiple Copies' checkbox is selected, if the user enters a value less than 1 or a value that is not an Integer in the Copies field, the Print button will be disabled (when the user clicks out of the copies field).
- **DL.171227.F.19.7** (FRS): The Copies field will be disabled once the Print button is clicked.
- **DL.171227.F.19.8** (FRS): If the value entered in the Copies field exceeds the value specified for the Print Config 'WarnWhenPrintedLabelsExceedsValue', when the Print button is clicked, the following error message " Copies for this print row exceeds the value specified in the Print Config WarnWhenPrintedLabelsExceedsValue of "xxxxxx". Click Yes to continue printing. Click No to stop." will be displayed along with Yes and No buttons (This will ONLY be applicable for MANUAL prints and when the Print Multiple Copies option is enabled). Clicking the No option will close the dialog and the label/document will not be printed.
- **DL.171227.F.23.10** (FRS): Each time a labeling item is verified, the row in the Labeling grid will be highlighted in green. If the verification fails, then the system will attempt to parse the scan.
- **DL.171227.F.23.11** (TRS): Each successful verification is recorded in the DESTLABELINGSESSIONDETAIL table.
- **DL.171227.F.23.12** (FRS): If the Require Verification check box is checked,once all rows in the Labeling grid have been successfully verified the Worklist Packed Value will be incremented by 1.
- **DL.171227.F.23.13** (FRS): If user tries to verify a row that was already successfully verified, the message " This row has already been verified" will be displayed.
- **DL.171227.F.23.2** (FRS): The Print Config 'AutoCheckRequireVerification' will determine if the 'Require Verification' check box will be checked by default. The Print Config value for this parameter will be set to N by default.
- **DL.171227.F.23.3** (FRS): If the Require Verification check box is checked, the Packed value in the Worklist grid will be incremented by 1 when all labeling items (labels and documents) have been verified by entering (scanning) the verification code in the Barcode Scan field.
- **DL.171227.F.23.4** (FRS): The Global Setting 'DestVerificationTemplate' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will be used to specify the template used to create the verification code. The default value for this Global Setting will be '<DestCode>_<ItemNumber>_<LabelType>'.
- **DL.171227.F.23.5** (FRS): The verification code can be a combination of - columns from the DESTLABELING view. (This database view will be custom for each customer. It MUST minimally contain Item Number, Version (item) and GTIN columns) - the Destination Labeling page elements: Destination Code, Order Number, Lot Number - Static Data. For example, if the verification code must be 'RUS_AC00512_DEST1' which is the destination code followed by the item number and label type, the 'DestVerificationTemplate' parameter value will be set to <DestCode>_<ItemNumber>_<LabelType>. The column names and page elements must be enclosed in <>.
- **DL.171227.F.23.7** (FRS): The verification code (if any) will be displayed in a tool tip when hovering over the Template name (column) in the Labeling grid.
- **DL.171227.F.23.8** (FRS): For documents, the verification code will be retrieved from the Param 1 field in the ATTACHMENTFILES table.
- **DL.171227.F.23.9** (FRS): If the Require Verification check box is checked, the rows in the Labeling grid will be highlighted in yellow until they are successfully verified.
- **DL.171227.F.6.1** (FRS): The 'Order Status' field will be set to 'Incomplete ( # Items Pending)', if one or more rows in the Worklist grid have a status of 'Pending'. '#' of Pending will display the number of rows that have a Status of 'Pending'.
- **DL.171227.F.6.2** (FRS): The 'Order Status' field will be set to 'Complete (0 Items Pending)' if all rows in the Worklist grid have the Status set to 'Completed'. The Order Status will be stored and retrieved from the Header Status column in the PICKHEADER table for a given Order Number.
- **DL.171227.F.6.3** (FRS): The Order Status field will not be editable for any users.
- **DL.171227.F.8.1** (FRS): The system sharename 'Dest_Destination' will populate the Destination Code on the label. When generating PDFs or Samples the system will use the destination code associated with the default destination (specified at the item level- sharename of the item field is stored in a Global Setting). On the printed label, the system will print the Destination Code selected at print time. The sharename is case sensitive.
- **DL.171227.F.8.2** (FRS): The system sharename 'Dest_DestinationName' will populate the Destination name on the label. When generating PDFs or Samples the system will display the destination name associated with the default destination (specified at the item level- sharename of the item field is stored in a Global Setting). On the printed label, the system will print the destination name associated with the Destination Code selected at print time. The sharename is case sensitive.

## DL_GlobalSettings (18)

- **DL.171227.F.23.14** (FRS): If verification is required and the 'DestVerificationTemplate' setting is blank the error " DestVerificationTemplate Global Setting could not be found"will be displayed after a barcode scan (to retrieve material and lot information).
- **DL.171227.F.26.1** (FRS): The Global Setting 'DestTemplate_SchemaName' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will be used to specify the name of the MDM schema containing the Template to Destination links.
- **DL.171227.F.26.2** (FRS): The Global Setting 'DestTemplate_Code_SchemaField' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will be used to specify the sharename of the MDM schema field in the Destination Template Schema which will hold the Destination Codes.
- **DL.171227.F.26.3** (FRS): The Global Setting 'DestTemplate_Template_SchemaField' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will be used to specify the sharename of the MDM schema field in the Destination Template Schema which will hold the Template name.
- **DL.171227.F.26.4** (FRS): If the 'DestTemplate_Code_SchemaField', 'DestTemplate_SchemaName', 'DestTemplate_Template_SchemaField' Global Settings are not configured correctly (blank or invalid values), after a value is entered in the Barcode Scan field the error message "No print rows found for given barcode" will be displayed.
- **DL.171227.F.28.1** (FRS): The Global Setting 'DestLabelingPhraseField' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will specify the sharename of the Item or Master Data field that contains the Phrase which will be used for Destination Labeling translations. If the value specified for this setting is invalid or blank then no translations will occur (embedded template data will be used).
- **DL.171227.F.28.2** (FRS): The Global Setting 'DefaultDestination' with Setting Owner 'Innovatum' will store the sharename of the field which will hold the default destination value. The DoReplacement Engine will use the default destination to retrieve languages and populate translations. The value specified for this Global Setting can be an Item level or Master Data sharename (user has to specify the destination code in the field associated with the sharename). If the value specified for this setting is invalid or blank then no translations will occur (embedded template data will be used). This setting is not applicable to the Destination Labeling module.
- **DL.171227.F.28.4** (FRS): Based on the Destination Code it was provided, the DoReplacement Engine will obtain the list and order of all language codes from the MDM Schema specified in the Global Setting 'DestCode_SchemaName'
- **DL.171227.F.7.1** (FRS): Destination Code drop down will be populated with ACTIVE values from Master Data Management. The Global Setting 'DestCode_SchemaName' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will specify which schema will be used to store the Destination code information.
- **DL.171227.F.7.10** (FRS): If the system is unable to find the Schema specified for the Global Setting 'DestCode_SchemaName' , the error message 'Error occurred while loading all required Destination information. Please check the Destination Labeling log file for incorrect setting information.' will be displayed when the module is opened.
- **DL.171227.F.7.11** (FRS): If the Schema specified for the Global Setting 'DestCode_SchemaName' has zero records or does not contain any ACTIVE records the error message 'Error occurred while loading all required Destination information. Please check the Destination Labeling log file for incorrect setting information.' will be displayed when the module is opened.
- **DL.171227.F.7.12** (FRS): If the Global Settings required to populate the Destination Codes are improperly configured (blank or incorrect values), the error message 'Error occurred while loading all required Destination information. Please check the Destination Labeling log file for incorrect setting information' will be displayed when the module is opened.
- **DL.171227.F.7.3** (FRS): The Global Setting 'DestCode_Code_SchemaField' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will specify the sharename of the field which contains the destination code of a given destination record.
- **DL.171227.F.7.4** (FRS): The Global Setting 'DestCode_Description_SchemaField' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will specify the sharename of the field which contains the full destination name of a given destination record.
- **DL.171227.F.7.5** (FRS): The Global Setting 'DestCode_Active_SchemaField' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will specify the sharename of the field which contains the Y or N value that indicates if the Destination Code is Active (Y or N).
- **DL.171227.F.7.6** (FRS): The Global Setting 'DestCode_LangPrefix' with Setting Owner 'Innovatum.Pages.DestinationLabeling.Printing.WCF' will specify the sharename prefix of all language fields inside of the destination schema.
- **DL.171227.F.7.7** (FRS): If an Order Number is associated with a Destination Code in the PICKHEADER table it will automatically get selected in the Destination Code drop down. The drop down will be disabled.
- **DL.171227.F.7.9** (FRS): All of the Languages associated with the selected Destination Code will be displayed below the destination code on the page.

## DL_PrintingHierarchy (14)

- **DL.171227.F.14.1** (FRS): The CODES entry in the following format will be used by the Destination Labeling page to identify the printer models that are allowed to be used to print labels for a given workstation. Code = Workstation Name CodeType = 'DLP_Label' (this code type is case sensitive) Description = Comma separated list of printer models (Example: Zebra 140XiIII Plus,Zebra 220XiIII Plus (203 dpi)) This code entry will not be available in the CODES table by default. It must be configured prior to using the Destination Labeling module.
- **DL.171227.F.14.2** (FRS): The CODES entry in the following format will be used by the Destination Labeling page to identify the printer models that are allowed to be used to print documents for a given workstation. Code = Workstation Name CodeType = 'DLP_Doc' (this code type is case sensitive) Description = Comma separated list of printer models (Example: HP OfficeJet Pro 8720) This code entry will not be available in the CODES table by default. It must be configured prior to using the Destination Labeling module.
- **DL.171227.F.14.3** (FRS): Printer Model will be displayed in a tool tip when hovering over a Printer Name in the Printers column of the Labeling grid.
- **DL.171227.F.14.4** (FRS): If no printers are available because the Code entries do not exist, the Printer models are invalid or the printer model does not exist on the server etc, the error message 'No Printers' will be displayed in the Printers column for the appropriate rows in the Labeling grid.
- **DL.171227.F.14.5** (FRS): If Printer Control Maintenance records are setup for a given Material (Item Number) using Item or *, Template Name, Workstation and Printer, the system will use the record to populate the Printers drop down. The model of the Printer specified in Printer Control must match the model specified in the Codes entry.
- **DL.171227.F.14.6** (FRS): If more than one printer is available for labels or documents: - The system will attempt auto select the printer based Printer Control record specified (with Item or *, Template Name, Workstation and Printer) - If no Print Control record exists, then the system will attempt to auto select the printer based on the Printer specified in the latest Print History record for the given Workstation and Template / Document combination. - If no Print History record exists for the Workstation and Template / Document combination, the system will auto select the first printer in the list.
- **DL.171227.F.14.7** (FRS): For a given Material, if there is Printer Control record specified (with Item or *, Template Name, Workstation and Printer) and Print History entries, the Printer Control record will take precedence over the Print History entry and the appropriate printer will be selected.
- **DL.171227.F.14.8** (TRS): The Sentinel Printing Plugin will be used to obtain the list of printers available on the workstation.
- **DL.171227.F.14.9** (FRS): If only one printer model is specified in the Codes table or Printer Control for labels or documents, the Printer Name will be displayed in plain text (not in drop down) in the Printer column.
- **DL.171227.F.15.1** (FRS): Destination Labeling page will use the Sentinel Launcher to send the appropriate PRN and document files directly to the printer.
- **DL.171227.F.15.2** (FRS): "Timed Out waiting for Print Server" error message will be displayed if the Print Server does not provide a PRN in the time frame specified in the Print Config PrintServerTimeout
- **DL.171227.F.15.3** (FRS): The Print Config PrintServerTimeout will accept decimals as values. These decimals will be fractions of a minute. The default value for Destination Labeling module will be 0.5. Example: 0.25 = 15 seconds
- **DL.171227.F.16.2** (FRS): The Print button will be disabled if there are no printers available for a given row in the Labeling grid.
- **DL.171227.F.16.4** (FRS): If the manual print fails, the Print button will be re-enabled for that row.

## DL_AutoPrint (14)

- **DL.171227.F.17.1** (FRS): The Auto Print Labels checkbox, when checked, will automatically print all of the Labels populated in the Labeling grid for a given order/material/lot.
- **DL.171227.F.17.2** (FRS): The Print Config 'AutoCheckPrintLabels' will determine if the Auto Print Labels check box will be checked by default. The Print Config value for this parameter will be set to N by default.
- **DL.171227.F.17.3** (FRS): The Auto Print Documents checkbox, when checked, will automatically print all of the documents populated in the Labeling grid for a given order/material/lot.
- **DL.171227.F.17.4** (FRS): The Print Config 'AutoCheckPrintDocs' will determine if the Auto Print Docs check box will be checked by default. The Print Config value for this parameter will be set to N by default.
- **DL.171227.F.17.5** (FRS): The Print button will be disabled for all rows that are auto printed.
- **DL.171227.F.17.6** (FRS): When auto printing labels or documents, if there are no printers available for a given row, the system will ignore the row. The Status in the Labeling grid will remain Pending.
- **DL.171227.F.17.7** (FRS): If an auto print fails, the Print button will be enabled for that row.
- **DL.171227.F.20.2** (TRS): The print page will retrieve PRN from the Contents column of the DESTLABELINGCACHE table where the combination of the Hash, LCN, PrinterModel, Copies match the values currently being printed.
- **DL.171227.F.21.4** (FRS): Serialized labels will NOT be cached.No record will be inserted for a serialized print in the DESTLABELINGCACHE table.
- **DL.171227.F.21.5** (FRS): For serialized labels S_Ser and S_USerial, the system will insert a record for each serial label in the PRINTHISTORY table with a unique Print ID. The serial copies value will be recorded in the 'SerialNum' column.
- **DL.171227.F.3.1** (FRS): Each column that exists in the PICK HEADER table will be associated with a sharename using the format 'Dest_columnname'. At print time the system will replace the sharename with values from the appropriate column. If the column is blank then blank will be printed. When sample PDFs or Label master are created, the PICK HEADER values will be set to the embedded data (value will be blank if there is no embedded data).
- **DL.171227.F.9.1** (FRS): For a given Order Number, if a value is specified for any of the following columns ShipToName, ShipToAddressLineOne, ShipToAddressLineTwo, ShipToAddressLineThree in the PICKHEADER table, the Shipping Info button will displayed.
- **DL.171227.F.9.2** (FRS): Clicking on the Shipping Info button will display a dialog with the Shipping Information from the PICKHEADER table.
- **DL.171227.F.9.3** (FRS): If the ShipToName, ShipToAddressLineOne, ShipToAddressLineTwo, ShipToAddressLineThree in the PICKHEADER table are blank for an Order Number, the Shipping Info button will not be displayed.

## DL_CreateOrder (13)

- **DL.171227.F.2.1** (FRS): User will be allowed to scan a value into the Order Number field or manually enter a value and hit the Enter Key or Next button for the system to retrieve the necessary information from the PICK DETAIL and PICK HEADER tables. The Order Number field will be disabled once the data is retrieved.
- **DL.171227.F.2.4** (FRS): The message "No worklist elements found for the entered order number. OrderNumber :xxxxxxx" will be displayed - if the specified Order Number does not exist in the PICK HEADER table and there is no Stored Procedure or EXE to be executed when the Enter Key or Next button are clicked. - If the Order Number is not associated with any rows in the PICKDETAIL table.
- **DL.171227.F.3.2** (FRS): Each column that exists in the PICKDETAIL table will be associated with a sharename using the format 'Dest_columnname'. At print time the system will replace the sharename with values from the appropriate column. If the column is blank then blank will be printed. When sample PDFs or Label master are created, the PICKDETAIL values will be set to the embedded data (value will be blank if there is no embedded data).
- **DL.171227.F.3.3** (FRS): If a new column is added to PICKHEADER or PICKDETAIL table, the system will immediately take the new column into account for the purposes of 'Dest_columnname' sharename replacement.
- **DL.171227.F.33.1** (FRS): A 'Details' button will be displayed in the Worklist section.
- **DL.171227.F.33.2** (FRS): When the Details button is clicked, the Details dialog will be displayed with the following: - A Pick Header grid with all columns present in the PICKHEADER table. The grid will be populated with the Pick Header details associated with the Order Number used to populate the Worklist grid. - A Pick Details grid with all columns present in the PICKDETAIL table. The grid will be populated with the Pick Detail information associated with each row present in the Worklist grid.
- **DL.171227.F.33.3** (FRS): If a new column is added or a column is removed from the PICKDETAIL table, the Details dialog will reflect the changes.
- **DL.171227.F.5.1** (FRS): The Create Order button will allow users to create a new order at print time for a new Pick Header that does not exist in the ROBAR database or is not provided by an external system. The newly created Order Number will be written to the PICKHEADER table.
- **DL.171227.F.5.4** (FRS): When the 'Create Order' button is clicked, if the Order Number field is not blank and the value in the Order Number field does not exist in the PICKHEADER table, the system will save the Order Number to the PICKHEADER table.
- **DL.171227.F.5.5** (FRS): When the 'Create Order' button is clicked, if the Order Number field is not blank and the value does exist in the PICKHEADER table as Order Number, the system will display message "Order already exists".
- **DL.171227.F.5.6** (FRS): For newly created Pick Header entries, the Order Status will be set to 'Pending' in the database.
- **DL.171227.F.5.7** (FRS): For newly created Pick Detail entries, for each successful scan or entry of the Material, a row will be added to the Worklist grid with - Material - Lot(if any) - Packed will be set to 0. - Ordered will be set to 'N/A' - Status will be set to "In Progress" for the very first row. All other rows will be set to "Pending".
- **DL.171227.F.5.8** (FRS): For orders created using the Create Order button,(Ordered value is set to N/A), the 'Show Done' checkbox in the Worklist grid will not be applicable.

## DL_PrintHistory (10)

- **DL.171227.F.24.10** (FRS): Clicking on the Success icon for a Barcode Scan (Action will be set to the Barcode value) in the Session History dialog will display the a dialog containing a grid with the Item Number, Template Name, Label Type, Copies, Status, Printer Name, Printer Model, Auto Print columns and OK button.
- **DL.171227.F.24.4** (FRS): The Session History button will be displayed after Order details have been populated. Clicking on the Session History button will display the Session History dialog that contains the Session ID and a grid containing Action, Time and Status columns and OK button.
- **DL.171227.F.24.7** (TRS): Each time a print occurs after a Barcode Scan, the print history of that scan will be logged to the DESTLABELINGSESSIONDETAIL table. (xml will be written to the Message column).
- **DL.171227.F.24.8** (FRS): The Session History dialog will only display the Session ID and the message "No session history currently exists" until a value has been entered in the Barcode Scan field or Reset All action is performed on the Worklist.
- **DL.171227.F.24.9** (FRS): Clicking on the Error Status icon in the Session History dialog will display the error message and OK button.
- **DL.171227.F.25.1** (FRS): The Print ID associated with Destination Labeling print jobs will have the prefix of 'DEST_'.
- **DL.171227.F.25.2** (FRS): A new Print History record will be written when labels and Documents are printed for an Order, Material and Lot (if any) in a given session for the first time. All subsequent prints for that Order, Material and Lot combination during the same session will update the existing print history Print Date column with current print time and Copies will be set to the current printed total.
- **DL.171227.F.25.3** (FRS): When documents (such as IFUs) are printed, the Attachment File ID will be stored in Print History Label Name column, Sequence number of the file will be stored in the LVersion column and the File Purpose associated with the file will be stored in the Label Type column.
- **DL.171227.F.25.4** (FRS): The Print History actions Regenerate, Exact Reprint, Serialization Detail, Print Data Values and Vision Inspection Details will not be applicable to labels printed using Destination Labeling. Only the See Image and See Details actions will be applicable.
- **DL.171227.F.25.5** (FRS): The Print History actions See Image, Regenerate, Exact Reprint, Serialization Detail, Print Data Values and Vision Inspection Details will not be applicable to documents printed using Destination Labeling. Only the See Details actions will be applicable.

## (none) (10)

- **DL.171227.F.5.10** (FRS): Any errors encountered when the "AutoGeneratedSP" is executed will be displayed to the user.
- **DL.171227.F.5.9** (FRS): If a value is specified for the Global Setting "AutoGeneratedSP", the system will run the specified stored procedure when the Create Order option is selected and generate the Order Number according to the Stored Procedure logic. If the value is blank, the system will auto generate the Order Number as per current date followed by a 4 digit sequence number.
- **DL.191218.F.6.1** (FRS): The Print Config parameter 'IdleScreenColor' will specify the color used when no order is being worked on. The default value will be rgb(135, 182, 217).
- **DL.191218.F.6.2** (FRS): The Print Config parameter 'BusyScreenColor' will specify the color used while an order is being processed. The default value will be lightGray.
- **DL.191218.F.6.3** (FRS): The Print Config parameter 'CompleteScreenColor' will specify the color used when an order has been completed (with or without errors). The default value will be lightGreen.
- **DL.191218.F.6.4** (FRS): When an Order Number is entered and Next button is clicked, if all the rows in the Worklist Grid are set to a status of 'Complete' , the page background will be refreshed to be displayed in green.
- **DL.191218.F.7.1** (FRS): The Destination Labeling page will display the number of remaining scans value by calculating the total Ordered value of all the rows in the Worklist grid minus the the total Packed value of all the rows in the Worklist grid. The value will be displayed using the format X of X next to the text 'Scans Remaining'
- **DL.191218.U.6** (URS): System shall display background colors based on Order Status on the Destination Labeling page.
- **DL.191218.U.7** (URS): System shall display the number of unprocessed Worklist items.
- **DL.191218.U.9** (URS): System shall retrieve and print destination labels.

## DL_DataChecking (9)

- **DL.171227.F.11.2** (FRS): The system will retrieve the labels based on the latest released (active, released and effective) LCN for the Material (Item Number) and the 'IncludedLabelTypes' for Destination Labeling. It will not take locking of LCNs to LOT in the LOTCONTROLNUMBERS table into account.
- **DL.171227.F.11.3** (FRS): If the Item, Template or Master Data records associated with the latest released LCN are invalid (ineffective, inactive, allowprint is set to N), then the system will display the error message " LCN XXXX is associated with ineffective or inactive records". The LCN displayed in the error will be the first LCN found to be invalid. Users will not be allowed to print any labels for that barcode scan.
- **DL.171227.F.11.4** (FRS): The Effective status of the Master Data record will be taken into account if the Print Configuration 'EnforceMasterDataStatus' is set to Y for Destination Labeling.
- **DL.171227.F.11.6** (FRS): Based on the specified Destination Code and Material (Item Number), the system will retrieve the LATEST ACTIVE DISTINCT destination labeling files which are - Linked to the Item Number - Linked to the Item Number, Version combination. - Have the appropriate language code (the 2 character language ISO code) specified in the ATTACHMENTPARAMETERS table where the Parameter Purpose is set to 'DestinationLanguage' and the Parameter Value contains the language ISO code. - The file purpose associated with the file is part of the comma separated list of file purpose(s) specified in the Description field of the CODES entry where the CodeType = 'IncludedFilePurpose' and Code = 'DestLabeling'
- **DL.171227.F.28.5** (FRS): When the DoReplacement Engine identifies sharenames with the format 'Dest_Language1', 'Dest_Language2' etc, it will find the sequence of languages associated with the Destination Code and replace the Dest_Langugage1 with the first language specified for Destination Code, it will replace Dest_Language2 with the second language specified for the Destination Code, so on and so forth. For example, for a given destination code, if the language sequence is FR, ES, IT, then Dest_Language1 will be FR, Dest_Language2 will be ES.
- **DL.171227.F.28.6** (FRS): When the DoReplacement Engine identifies share names with the format 'Dest_L1_1', 'Dest_L1_2', 'Dest_L2_1', 'Dest_L2_2' etc it will find the appropriate dictionary translations for languages in the sequence in which they are specified for the Destination Code. (sharenames are case sensitive) For example, for a given destination code, if the language sequence is FR, ES, IT, then the dictionary language used for translation for Dest_L1_1 will be Dest_FR_1, the dictionary language used for translation for Dest_L2_1 will be Dest_ES_1 etc
- **DL.171227.F.28.7** (FRS): Based on the Dictionary Language and the Phrase, the DoReplacement Engine will obtain the translations from the Dictionary. Only translations associated with Approved and Effective dictionary entries will be taken into consideration for replacement. Here are the exceptions: - The ROBAR Settings such as 'DictionaryOnlyApproved', 'DictionaryOnlyEffective' should be considered at print time. - When creating a Sample at the Item level, the 'Use Unapproved Dictionary Entries' is checked.
- **DL.171227.F.28.8** (FRS): If a Destination Labeling sharename ( such as Dest_L1_1..) on the template does not need to be translated then the DoReplacementEngine will replace it with "blank" value. The component will not be printed or displayed in samples.
- **DL.171227.F.7.8** (FRS): If an Order Number is not associated with a Destination Code and the user selects a value from the Destination Code drop down at print time,the users selection will be saved back to the PICKHEADER table for the specified Order Number.

## N/A (8)

- **DL.171227.F.1.3** (TRS): Only following Print Configurations will be added to the PRINTCONFIG table and be applicable to the Destination Labeling Module: AutoCheckMultipleCopies AutoCheckPrintLabels AutoCheckPrintDocs AutoCheckRequireVerification EnforceMasterDataStatus PrintServerTimeout ExeNameAndLocation ExeTimeoutSeconds StoredProcedureName StartingSerialNumber BarcodeParseStoredProcedure WarnWhenPrintedLabelsExceedsValue
- **DL.171227.F.2.2** (TRS): The PICK HEADER table will contain the following columns: OrderNumber (Primary Key) - nvarchar(20), not null DestinationCode (2 character ISO code Ex: FR, IT) - nvarchar(5), not null ShipToName - nvarchar(150), not null ShipToAddressLineOne - nvarchar(150), not null ShipToAddressLineTwo - nvarchar(150), not null ShipToAddressLineThree - nvarchar(150), not null SourceSystem (Ex: ROBAR, SAP) - nvarchar(50), not null CreatedOn - datetime, not null CreatedBy - nvarchar(100), not null HeaderStatus (Ex Completed, Pending) - nvarchar(20), not null LastTouch - datetime, not null
- **DL.171227.F.2.3** (TRS, Modified): The PICK DETAIL table will contain the following columns: ID - nvarchar(100), not null OrderNumber (Primary Key) - nvarchar(20), not null MaterialCode (Item number) (Primary Key) - nvarchar(30), not null LotNumber ((Primary Key- Can be blank) - nvarchar(20), not null OrderedQuantity - bigint, not null ScannedQuantity - bigint, not null LastTouch - datetime, not null Sequence - bigint, not null, default(0)
- **DL.171227.F.20.1** (TRS): The table DESTLABELINGCACHE will store the contents of PRN to be used for later prints( to ensure quick regeneration of labels). The table will contain the following columns: ID (primary key) - nvarchar(50), not null PrintId - nvarchar(128), not null Hash - nvarchar(max), not null - This is used to uniquely identify a doreplacement result for a print job. It is created by the print page. TemplateName - nvarchar(50), not null TemplateVersion - bigint, not null PrinterModel - nvarchar(100), not null Copies - bigint, not null Contents - varbinary(max), not null Inserted - datetime, not null
- **DL.171227.F.24.1** (TRS): The table DESTLABELINGSESSIONDETAIL will contain the following columns: ID (Primary Key) - nvarchar(100), not null SessionID - nvarchar(100), not null Action - nvarchar(100), not null Status - nvarchar(100), not null Message - nvarchar(max), not null CreatedOn - datetime, not null This table will keep track of all activity during a given session (instance of Destination Labeling on a given workstation).
- **DL.171227.F.24.2** (TRS): The table DESTLABELINGSESSIONHEADER will contain the following columns : SessionID (Primary Key) - nvarchar(100), not null UserId - nvarchar(30), not null Workstation - nvarchar(100), not null OrderNumber - nvarchar(100), not null CreatedOn - datetime, not null LastTouch - datetime, not null This table will keep track of the header information for a given session.
- **DL.171227.F.4.3** (FRS): An EXE or Stored Procedure will connect with the external system to obtain the pick header and pick details based on a scanned Order Number at print time. Retrieved data will be written to the ROBAR PICK HEADER and PICK DETAIL tables.
- **DL.171227.F.7.2** (TRS): The schema used to obtain Destination Codes MUST minimally contain - a required column for the Destination Code - a required column for Destination Description - a required Active (Y/N) column - X number of columns to specify languages for a given Destination Code. (this will vary from customer to customer depending on the max of number destination languages they use). At least 1 language column MUST be configured. Each language column sharename must have a sequential numeric suffix, starting with 1. For example, if the prefix was configured as “dest_Lang” and there are three language fields, the sharenames for those fields must be dest_Lang1, dest_Lang2, and dest_Lang3.

## UAT (6)

- **DL.171227.F.22.16** (FRS): When the 'Print All' action is being performed, the page will automatically refresh the page timeout cookie to ensure that the webpage does not timeout due to inactivity.
- **DL.171227.F.4.1** (FRS): Destination Labeling module will have the ability to execute EXE's and Stored Procedures (Print Config ExeNameAndLocation and StoredProcedureName). EXE will be executed before the Stored Procedure if both are specified.
- **DL.171227.F.4.2** (FRS): User will be allowed to scan a value into the Order Number field or manually enter a value and hit the Enter Key or Next button in order for the system to run the EXE or Stored Procedure.
- **DL.171227.F.4.4** (FRS): The appropriate error messages passed from the EXE or Stored Procedure will be displayed on the Destination Labeling page. Example; If the Order Number does not exist in the external system or if the connection to the external system fails.
- **DL.171227.F.4.5** (FRS): The error message ' 'ExeName' did not respond' will be displayed if the Destination Labeling page does not receive a response from the EXE. The Print Config EXETimeoutSeconds will be used to specify the timeout period.
- **DL.171227.F.4.6** (FRS): The error message 'Could not access 'ExeName'' will be displayed if the Destination Labeling page is unable to access the EXE.

## DL_Security (5)

- **DL.171227.F.1.1** (FRS): Only users with the 'BP_DestLabeling' security process enabled will be allowed to access the Destination Labeling page.
- **DL.171227.F.1.2** (FRS): When the Destination Labeling page is launched the following fields will be displayed: Pick Order - Order Number field - Order Status field - Next button - Create Order button - Require Verification checkbox.
- **DL.171227.F.19.1** (FRS): The 'Print Multiple Copies' checkbox is only enabled for users with the security process BP_Dest_PrintMultipleCopies set to Y. The checkbox will not be displayed for unauthorized users.
- **DL.171227.F.23.1** (FRS): The 'Require Verification' checkbox is only enabled for users with the security process BP_Dest_RequireVerification set to Y. The checkbox will not be displayed for unauthorized users.
- **DL.171227.F.5.2** (FRS): The 'Create Order' button will only be enabled for users with the 'BP_Dest_CreateOrder' security process. The button will not be displayed for unauthorized users.

## DL_AutoPrint, DL_PrintAll (4)

- **DL.171227.F.21.1** (FRS): When a template being used for destination labeling contains the S_Ser, it will be populated with a serial value scanned during Barcode Scan. If a serial value is not provided during the Barcode Scan, the system will use the Starting Serial value specified for the Print Config 'StartingSerialNumber' (default value will be 001). If the Print Config value is blank, the system will print embedded data.
- **DL.171227.F.21.2** (FRS): When a template being used for destination labeling contains the S_USerial, it will be populated with a serial value provided during Barcode Scan. If a serial value is not provided during the Barcode Scan, the system will use the Starting Serial value specified for the Print Config 'StartingSerialNumber' (default value will be 001). If the Print Config value is blank, the system will print embedded data.
- **DL.171227.F.21.3** (FRS): If a template being used for destination labeling contains both S_Ser and S_USerial sharenames, the system will replace them both.
- **DL.171227.F.21.7** (FRS): For serial labels, if a value greater than 1 is specified in the Copies field, the system will print serial copies of the label by incrementing the serial value by 1. The serial value retrieved through the barcode scan will be used as the starting serial value. If no serial value was retrieved from the barcode scan, the value specified in the Print Config 'StartingSerialNumber' will be used as the starting serial number. If the Print Config 'StaringSerialNumber' is blank, embedded data will be used as starting serial value. Example: If starting serial value is 123, and copies is set to 3, the values 123, 124, 125 will be printed.

## DL_RegularPrinting (2)

- **DL.171227.F.11.5** (FRS): Label Types created for Destination Labeling will be excluded from Regular Print (all print modules except the destination label printing module) pages using the 'ExcludedLabelTypes' Codes functionality.
- **DL.171227.F.28.3** (FRS): This Global Setting 'DefaultDestination' will be applicable to all printing pages EXCEPT Destination Labeling and DX Printing.

## DL_PrintAll, DL_Security (2)

- **DL.171227.F.13.1** (FRS): The Reset All buttons will only be displayed for users with security process 'BP_Dest_EditWorklist' set to Y. The Reset All button and the Action column in the Worklist grid will not be displayed for unauthorized users.
- **DL.171227.F.22.1** (FRS): The 'Print All' button will allow users to print all labels associated with each row in the Worklist grid. The 'Print All' button will only be enabled for users with the security process 'BP_Dest_PrintAll' is set to Y. The button will not be displayed for unauthorized users.

## DL_PrintAll, DL_PrintHistory (2)

- **DL.171227.F.24.3** (TRS): Each time an order is entered on the Destination Labeling page, a new session is started and a record will be written to the DESTLABELINGSESSIONHEADER table.
- **DL.171227.F.24.5** (TRS): Each time a user enters a value in the Barcode Scan field, an entry will be written to the DESTLABELINGSESSIONDETAIL table.

## DL_LocalizationResources (1)

- **DL.171227.F.1.4** (FRS): All fields, buttons, error messages, column headings on the Destination Labeling page will be localized.

## DL_PrintHistory, DL_PrintingHierarchy, DL_RequireVerification (1)

- **DL.171227.F.11.1** (FRS): After a successful barcode scan, the system will display the Labeling grid with the following columns: -- Template -- Label Type -- Copies text box (This column will only displayed if the 'Print Multiple Copies' checkbox is checked) -- Status (Pending by default) -- Printers(dropdown) -- Print button The Labels and Documents to be printed will be populated in the Labeling grid.

## DL_BarcodeParseStoredProc (1)

- **DL.171227.F.11.7** (FRS): For a given Material/Lot, if no destination labeling related templates or files are available for printing, the message 'No print rows found for given barcode' will be displayed.

## DL_PrintingHierarchy, DL_RequireVerification (1)

- **DL.171227.F.16.1** (FRS): The Print button in the Labeling grid will allow users to manually print Destination Labels based on the Printers selected for a given row in the Labeling grid.

## DL_PrintingHierarchy, DL_RequireVerification, DL_DataChecking (1)

- **DL.171227.F.16.3** (FRS): The Print button in the Labeling grid will be disabled once the user clicks the Print button.

## DL_PrintAll, DL_CreateOrder (1)

- **DL.171227.F.22.3** (FRS): The 'Print All' button will not be displayed for orders created at print time (using Create Order button) where the Ordered value is set to N/A.

## DL_RequireVerification, DL_CMActions (1)

- **DL.171227.F.23.6** (FRS): The verification code can be printed on a label, displayed in Sample PDFs and Label Masters (created using SendtoWorkflow, RecreateMaster in CM) using the sharename 'Dest_Verification'. The sharename is case sensitive.The system will replace Dest_Verification sharename based on the DestVerificationTemplate. If any of the elements specified in the 'DestVerificationTemplate' are not available then the value specified in the DestVerificationTemplate will be displayed. For Example: if the DestVerificationTemplate is setup as <DestCode>_<OrderNum>_<ItemNumber>. Since the order number is not available when the sample pdf or label master is created the system will display RUS_<OrderNum>_Item123. At print time when the order number is available it will print RUS_Ord123_Item123

## DL_AutoPrint, DL_RequireVerification (1)

- **DL.171227.F.31.1** (FRS): Clicking on the Reset button will refresh the page and the Order Number, Order Status fields will be displayed and they will be blank. the Next and Create Order buttons will also be displayed.

## DL_Licensing (1)

- **DL.171227.F.32.1** (TRS): The page will check for print licensing for all print jobs including print jobs performed using cached PRN files. Note: Each Workstation, Printer combination takes up a single Print License for 24 hour period.

## DL_AutoPrint, DL_PrintAll, DL_CreateOrder (1)

- **DL.171227.F.5.3** (FRS): When the 'Create Order' button is clicked, if the Order Number field is blank, the system will automatically set the Order Number to current date followed by 4 digits starting with 0001. Example: 20180131-0001. Users will not be allowed to edit this value.
