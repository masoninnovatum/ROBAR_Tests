# ValMaster requirements - Label History Inquiry (Module `Label History Inquiry`, project 190725, pulled READ-ONLY 2026-11-03)

Sheet "ValMaster - Innovatum" (3214043046537092): 25 rows, all Active, Customer Specific blank on every row. Formal scripts (Test Cases column): `Label_History_Inquiry-1.1` (barcode / item + lot / detail) and `Label_History_Inquiry-1.2` (localization) under `\\diskstation\backedup\#Unlocked_Test_Cases\Label_History_Inquiry\`. Source of truth #1 for the specs; cite the id in spec steps.

Test cases: Label_History_Inquiry-1.1
| Id | Type | Requirement |
|---|---|---|
| LHI.190725.F.1.1 | FRS | A new web menu option called "Label History Inquiry" will be created under the "Reports and Inquiries" subsection. This module will have its PageMode setting set as "Detail" in the URLData column of the MenuWebIntegration table. |
| LHI.190725.F.1.2 | FRS | The Label History module will be unavailable to users without the "Label_History" security process. |
| LHI.190725.F.2.1 | FRS | The Label History module will contain a barcode scan field. |
| LHI.190725.F.2.2 | FRS | A Submit button will be placed to the right of the barcode scan field. |
| LHI.190725.F.2.3 | FRS | The submission of a barcode can be done using the Submit button or by pressing the ENTER key while the cursor is in the barcode scan field. |
| LHI.190725.F.2.4 | FRS | The Item Number and Lot Number derived from a scan will be populated in the Item Number and Lot Number fields on the screen. |
| LHI.190725.F.3.1 | FRS | The Label History module will contain an Item Number field, and a Lot Number field. |
| LHI.190725.F.3.2 | FRS | The Item Number and Lot Number will be passed into the same stored procedure as the barcode scan. |
| LHI.190725.F.3.3 | FRS | If Item Number and Lot Number are specified rather than a barcode, the barcode parse will be skipped in the stored procedure and the Print History records will be returned. |
| LHI.190725.F.4.7 | FRS | The Label History module will only show PrintHistory records with a PrintStatus of "Printed". |
| LHI.190725.F.5.1 | FRS | Each Print History record shown in the grid will contain a "View Detail" button |
| LHI.190725.F.5.2 | FRS | When the View Detail button is clicked for a specific row, a pop-up will be shown with the printed image, the print data values for the selected print, and the data for that specific Print History row. |
| LHI.190725.F.5.3 | FRS | If only one PrintHistory record is returned from the barcode parse stored procedure, the View Detail action will be automatically executed for that row. |

Test cases: Label_History_Inquiry-1.2
| Id | Type | Requirement |
|---|---|---|
| LHI.190725.F.1.3 | FRS | All static text in the Label History module will be localized. |

Test cases: N/A (TRS)
| Id | Type | Requirement |
|---|---|---|
| LHI.190725.F.4.1 | TRS | The name of the barcode parse stored procedure will be passed to the page using the URLData column of the MenuWebIntegration table. |
| LHI.190725.F.4.2 | TRS | The barcode parse stored procedure will take in the barcode string as its only parameter. |
| LHI.190725.F.4.3 | TRS | The barcode parse stored procedure must minimally be able to derive ItemNumber and LotNumber from the barcode to determine the applicable PrintHistory records. |
| LHI.190725.F.4.4 | TRS | The barcode parse stored procedure will be based on a standard GS1 parse. It must minimally handle AI codes 01 GTIN (14 characters), 10 Lot (no limit), 17 Expiration Date (6 characters), 11 Manufacture Date (6 characters), 21 Serial Number (no limit), 30 Quantity (no limit). |
| LHI.190725.F.4.5 | TRS | The barcode parse will use "^" as the default data terminator. |
| LHI.190725.F.4.6 | TRS | The barcode parse stored procedure returns the rows shown on the page. The default columns: LabelType, UserID, OrderNumber, Lot, ExpDate, LCN, Printer, Reprint, PrintDate. |

Test cases: NA (URS)
LHI.190725.U.1 view PrintHistory records from a product barcode scan; U.2 scan a barcode to retrieve PrintHistory records; U.3 enter ItemNumber and LotNumber to retrieve PrintHistory records; U.4 parse barcodes and display PrintHistory records using a configurable stored procedure; U.5 view the printed image and print data values of a PrintHistory record.
