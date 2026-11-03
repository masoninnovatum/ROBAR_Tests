# ValMaster requirements - Label Type Management (pulled READ-ONLY 2026-11-03)

Sheet "ValMaster - Innovatum" (3214043046537092), Module `Label Type Management`: 37 rows, 8 Obsolete dropped (LM.160202.F.1.3, LM.160202.F.1.4, LM.160202.F.2.3, LM.160202.F.2.4, LM.160202.F.2.5, LM.160202.F.2.6, LM.160202.F.2.7, LM.160202.F.2.9), 29 kept; Customer Specific blank on every row. Formal scripts: LT_Management-1.1 (module, grid, search) and LT_Management-1.2 (add / edit / security processes) under `\\diskstation\backedup\#Unlocked_Test_Cases\Label_Type_Management\`. Source of truth #1; cite the id in spec steps.

Test cases: LT_Management-1.1
| Id | Type | Status | Requirement |
|---|---|---|---|
| LM.160202.F.1.1 | FRS | Active | Only users with the ‘Web_LabelTypes' security process will be allowed to add or edit a Label Type. |
| LM.160202.F.1.2 | FRS | Active | The Label Type Management 'View_LabelTypes' security process will need to be enabled within the Web Menu Integration table in order for users to access and view the module. |
| LM.160202.F.1.5 | FRS | Active | The 'LabelType' grid will allow the user to select a Label Type by highlighting a row and double clicking. |
| LM.160202.F.1.6 | FRS | Active | Users will have the ability to search for existing 'Label Type' related data by using search filters. |
| LM.160202.F.1.7 | FRS | Active | Users will have the ability to filter and retrieve records by 'Column', 'Operator', and 'Value' search criteria. |
| LM.160202.F.1.8 | FRS | Active | Record results will not be loaded and displayed until the user selects the 'Retrieve Data' button. |
| LM.160202.F.1.9 | FRS | Active | Users will have the ability to add or remove multiple query filters. The system will provide the 'AND' 'OR' drop-down capabilities from which the user can select. |
| LM.160202.F.1.10 | FRS | Active | A “No records to view” message will be displayed if the selection criteria does not find any matching data. |
| LM.160202.F.1.11 | FRS | Active | A page counter will be displayed and located in the bottom center of the Label Type Management UI. The page counter will display as Page X of X. |
| LM.160202.F.1.12 | FRS | Active | A record counter drop-down box will be displayed and located in the bottom center of the Label Type Management UI. The dropdown will default to 10 records. The user will have the ability to customize their view by selecting 10, 20, or 30 records. |
| LM.160202.F.1.13 | FRS | Active | A page view will be displayed and located in the bottom right corner of the Label Type Management UI. The page view will display as View X – X of X. The maximum number of results displayed will be 9999 at a given time. |
| LM.160202.F.3.3 | FRS | Active | Users will have the ability to access the ‘Edit Record' dialogue box by double clicking on a single record. |

Test cases: LT_Management-1.1, LT_Management-1.2
| Id | Type | Status | Requirement |
|---|---|---|---|
| LM.160202.F.3.1 | FRS | Modified | Only users with the ‘Web_LabelTypes' security process will have the ability to edit existing 'Label Type' records. |

Test cases: LT_Management-1.2
| Id | Type | Status | Requirement |
|---|---|---|---|
| LM.160202.F.2.1 | FRS | Modified | Only users with the ‘Web_LabelTypes' security process will have the ability to add new Label Types. |
| LM.160202.F.2.2 | FRS | Active | A ‘+’ icon will be displayed in the bottom left corner of the ‘Label Type’ grid and will allow users to create new 'Label Type' records. |
| LM.160202.F.2.8 | FRS | Active | When adding a new 'Label Type', records will be inserted into the LabelTypes and X_LabelTypes tables. |
| LM.160202.F.2.10 | FRS | Active | If a user attempts to add a label type and that label type already exists then the following error message will be displayed 'Label type already exists'. |
| LM.160202.F.3.2 | FRS | Active | A ‘pencil’ icon will be displayed in the bottom left corner of the ‘Label Type' grid, and it will allow users to edit existing 'Label Type' records by displaying the 'Edit Record' dialogue box. |
| LM.160202.F.3.4 | FRS | Active | When a user selects the 'pencil' icon to edit an existing 'LabelType', only the 'Description' text-box can be changed. |
| LM.160202.F.3.5 | FRS | Active | When editing an existing 'LabelType', the record will be updated in the LabelTypes and X_LabelTypes tables. |
| LM.160202.F.3.6 | FRS | Active | All LabelType data that is written to the LabelTypes table will also be added to the X_LabelTypes table and recorded as a ChangeType record. |
| LM.160202.F.4.1 | FRS | Active | For all newly created label types, a new LT_LabelType security process will be created and inserted into the ‘Processes’ and X_Processes tables. |
| LM.160202.F.4.2 | FRS | Active | For all newly created label types, a new LT_LabelType ‘ProcessName’ will be added and assigned (enabled) in the ‘Security’ table for all ‘Groups’ and all individual ‘Users’. |
| LM.160202.F.4.3 | FRS | Active | For all newly created label types, "LT_" will be added as a prefix. |
| LM.160202.F.4.4 | FRS | New | For all newly created label types, records will be written to the following tables: Security X_Security Processes X_Processes |

Test cases: NA
| Id | Type | Status | Requirement |
|---|---|---|---|
| LM.160202.U.1 | URS | Active | Label Type Management functionality will be web enabled. |
| LM.160202.U.2 | URS | Active | The system will allow users to add new Label Types through the use of the Label Type Management Web Module. |
| LM.160202.U.3 | URS | Active | The system will allow users to edit existing Label Types through the use of the Label Type Management Web Module. |
| LM.160202.U.4 | URS | Active | The system will create new security process entries for all newly added label types though the use of the Label Type Management Web Module. |
