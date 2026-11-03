# ValMaster requirements - Data Schemas (Settings > Schemas) (pulled READ-ONLY 2026-11-03)

Sheet "ValMaster - Innovatum" (3214043046537092). There is NO module "Schemas": the schema requirements are Active rows of Module `Master Data Management` whose text or test case names a schema (57 rows, Customer Specific rows dropped: MDE.250128.F.4.3 / F.4.4 = Intuitive Surgical). Source of truth #1 for the specs; cite the id in spec steps.
Formal scripts (Test Cases column; `\\diskstation\backedup\#Unlocked_Test_Cases\MDM\7.0.3\`): **MDM_DataSchemas2.1** (listing, add / edit / view schema, field properties), **2.2** (tabs and field order), **2.3** (linked / external-data drop-downs), **2.4** (Must be unique, Edit Mask), **MDM_Security3.2** (schema and field level security, `MC_` processes), MDM_New_Record21.1 (New Record dialogs), MDM_Actions5.2 (export captions), UAT_20250128-002 (localized captions).
Specs: `tests/Master-Data-Management/Schemas_Field_Editor.spec.ts`, `Schemas_Field_Settings_Effect.spec.ts`, `Schemas_Dropdown_Sources_Export.spec.ts` (+ `Schemas_Requirements`, `Schemas_Security` from 2026-11-03); helper `tests/support/schemas.ts`.

Test cases: (none)
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20150421100U1.0.0 |  | Active | Master data schema fields can be setup to only accept unique data. |

Test cases: COMTradingPartner1.3
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20150313100F1.1.3 |  | Active | For each trading partner the system will support a status column in the item Schema which will be updated as transmissions occur. |

Test cases: MDM_Actions5.2
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20150512100F3.0.2 |  | Active | By default the system will export data using column headings from the database. Users will be given an option "Use MDM column caption" which will allow users to export data using captions specified by the user at the schema level for each field. |

Test cases: MDM_DataSchemas2.1
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512003F1.0.1 |  | Active | The master data schema listing pages will contain a grid showing all schemas that have been identified. |
| MDM20140512003F1.0.2 |  | Active | The master data schema listing page will allow for the addition of new schema |
| MDM20140512003F1.0.3 |  | Active | The master data schema listing page will allow for the editing of existing schema |
| MDM20140512003F1.0.4 |  | Active | The master data schema listing page will allow for the review of existing schema |
| MDM20140512004F1.0.8 |  | Active | The system will allow authorized users to add data fields to tabs within a schema. |
| MDM20140512004F1.1.3 |  | Active | The system will allow users to assign XML configuration values to the selected field which are then used throughout the system. |

Test cases: MDM_DataSchemas2.2
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512004F1.0.3 |  | Active | The system will allow creation and assignment of multiple tabs per schema. |
| MDM20140512004F1.0.4 |  | Active | The system will allow authorized users to add new tabs to a schema |
| MDM20140512004F1.0.5 |  | Active | The system will allow authorized users to rename schema tabs |
| MDM20140512004F1.0.6 |  | Active | The system will allow authorized users to delete schema tabs. |
| MDM20140512004F1.0.7 |  | Active | The system will allow authorized users to edit the sequence of schema tabs. |
| MDM20140512004F1.0.9 |  | Active | The system will allow fields to be moved from one tab to another within a schema. |
| MDM20140512004F1.1.0 |  | Active | The system will allow sequence of schema fields to be changed within a tab. |
| MDM20140512004F1.1.2 |  | Active | The system will allow users to select the type of field from a predetermined number of fields in the master data table. |

Test cases: MDM_Data_Edit4.2, MDM_Data_Edit4.2_v6.0.1
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20150512100F2.0.3 |  | Active | Mass update action will display an error message and prevent the user from submitting a job if the schema field selected by the user for update is setup to be unique. |

Test cases: MDM_Data_Schemas2.1
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512004F1.1.5 |  | Active | The system will allow for schema fields to be set up so that they cannot be left blank. |
| MDM20140512004F1.1.6 |  | Active | The system will allow for schema fields to be protected, such that users cannot enter data. |
| MDM20140512004F1.1.8 |  | Active | The system will allow schema fields to be configured such that they can be redirected to a specified URL to select custom data. |
| MDM20140512004F1.2.1 |  | Active | The system will allow schema fields to be configured such that the fields can retrieve data from XML based content management systems. |
| MDM20140512032F1.0.1 |  | Active | The ROBAR MDM System will support an unlimited number of schema each with their own definition of columns and capabilities. |
| MDM20150611100F1.0.1 |  | Active | When adding a new record to an item schema on the mdm page, user will be required to enter an item number before they can click 'Submit' and create a master data record. |
| MDM20150611100F1.0.2 |  | Active | New non item schema records will only be created once the user clicks the 'Save' button on the master data edit page upon recording appropriate data. |

Test cases: MDM_Data_Schemas2.3
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512004F1.1.7 |  | Active | The system will allow for schema fields to be drop-down fields that pull from other schemas using the UI and XML configurations. |
| MDM20140512004F1.2.0 |  | Active | The system will allow for data retrieval from an external data source accessible by SQL. |
| MDM20150313100F1.0.5 |  | Active | MDM items with fields on a run schedule pointing to a remote database will only be updated with new data if they are the latest approved version or unapproved version. |

Test cases: MDM_Data_Schemas2.4
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20150421100F1.0.1 |  | Active | A “Must be unique” Check box will be available on the schema edit page for each schema field. |
| MDM20150421100F1.0.2 |  | Active | Data entered into a schema fields marked as "Must be unique", cannot be used for any other master data item in that schema. |
| MDM20150421100F1.0.3 |  | Active | If a user enters data that is not unique in a schema field for which the "Must Be Unique" box is checked, an error message will be displayed. |
| MDM20150421100F1.0.4 |  | Active | A Global Setting will determine whether Inactive records will be included within the validation check for the Uniqueness rule. SettingName = UniqueVal_IncludeInactive SettingOwner = Innovatum.DataManagement.Web Value = Y/N. The Value will be set to 'Y' by default. |
| MDM20150421101F1.0.1 |  | Active | Users will be allowed to specify the expected data pattern for an mdm item field in the 'Edit Mask' text box at the schema field level. |
| MDM20150421101F1.0.2 |  | Active | The system will display an error message if the data entered in to an mdm field associated with an edit mask does not match the specified pattern. |

Test cases: MDM_New_Record21.1
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512035F1.0.2 |  | Active | When the "New Record" option is selected from the Actions drop down on the Master Data Edit page to create an Item schema record, the Create New Master Data dialog will be displayed with the following: - Schema - Read Only text - Item Number text box - Description text box - Submit button |
| MDM20140512035F1.0.3 |  | Active | Once the Submit button is selected in the Create New Master Data dialog, the Master Data Edit page will be displayed with - Item Number and Description set to the value specified by the user. - Version set to 0 - Schema Name set to the schema for which the record was created - Approved By set to Unapproved - Effective Begin set to the current date - Effective End set to 12/31/2099 - All other fields / tabs displayed according to the schema setup. |
| MDM20140512035F1.0.4 |  | Active | When the "New Record" option is selected from the Actions drop down on the Master Data Edit page to create a Non Item schema record, the Edit page will be refreshed to display the fields / tabs according to the schema setup. |

Test cases: MDM_Security3.2
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512003F1.0.5 |  | Active | A security checkpoint will exist in the system to control whether a user has authority to add new schemas, make changes to schemas, and view schemas. |
| MDM20150421102F1.0.1 |  | Active | Security processes created to control access to individual schema fields will contain the prefix 'MC_'. |
| MDM20150421102F1.0.2 |  | Active | A 'Edit Security' drop down containing available schema field level security processes will be displayed for each schema field set up on the schema edit page. |
| MDM20150421102F1.0.3 |  | Active | If 'Edit Security' drop down is tied to a security process for a schema field, only users with that security process will be allowed to edit that particular field at the mdm item level. |
| MDM20150421102F1.0.4 |  | Active | A 'View Security' drop down containing available schema field level security processes will be displayed for each schema field set up on the schema edit page. |
| MDM20150421102F1.0.5 |  | Active | If 'View Security' drop down is tied to a security process for a schema field, only users with that security process will be allowed view that particular field at the mdm item level. |
| MDM20150421102F1.0.6 |  | Active | If the 'View Security' drop down is blank for a given schema field, any user with permission to view mdm items will be able to do so. |
| MDM20150421102F1.0.7 |  | Active | If the 'Edit Security' drop down is blank for a given schema field, any user with permission to edit mdm items will be able to do so. |

Test cases: May be merged with testing for other requirement(s).
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20150512100F5.0.1 |  | Active | When the data source of a linked schema is changed,the first time the users accesses the mdm item containing the linked field whose data source has been modified, the system will display a message near the item field letting the user know that a change has occurred. |

Test cases: NA
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDM20140512003U1.0.0 |  | Active | The system will allow access to different schema of data. |
| MDM20140512004U1.0.0 |  | Active | The system will allow authorized users to edit details of a particular schema. |
| MDM20140512007U1.0.0 |  | Active | The system will allow Master Data field definitions to be aware if someone else has changed the master data schema. |
| MDM20140512010U1.0.0 |  | Active | The system will require share names within all schemas to be unique. |
| MDM20140512032U1.0.0 |  | Active | The MDM system will have the ability to support an unlimited number of distinct schema. |
| MDM20150421101U1.0.0 |  | Active | Master Data schema fields can be setup to accept data that fits a specific pattern. |
| MDM20150421102U1.0.0 |  | Active | There will be master data schema field level security. |

Test cases: UAT_20250128-002
| Id | Type | Status | Requirement |
|---|---|---|---|
| MDE.250128.F.2.12 |  | Modified | On the Master Data Mass Update Job Submissions page, warnings will be populated based on localization entries where the ResourceType is Innovatum.DataManagement.Web.Views.MasterDataMassUpdate.<SchemaName> and the ResourceKey is warningMessage. When a warning message is displayed on the Job Submissions page, the user will not be prevented from submitting the job. The stored procedure SP_MDM_ValidateData will not be used to retrieve warnings. |
| MDE.250128.F.3.10 |  | Active | To localize Master Data Captions, in the LOCALIZATIONRESOURCEDEF table - The ResourceType will be set to 'Innovatum.DataManagement.Web.Views.MasterData.Edit.MASTERDATASCHEMANAME' for a given schema. - The ResourceKey will be set to the Sharename of the Master Data field that will be localized. - The ResourceValue will be set to blank. - The Description will be set to blank. - The LastTouch will be set to the date when the record is last modified. |
| MDE.250128.F.3.11 |  | Active | To localize Master Data Captions, in the LOCALIZATIONRESOURCES table - The ResourceType will be set to 'Innovatum.DataManagement.Web.Views.MasterData.Edit.MASTERDATASCHEMANAME' for a given schema. - The CultureCode will be set to the language code associated with the localization. - The ResourceKey will be set to the Sharename of the Master Data field that will be localized. - The ResourceValue will be set to the localization value. - The LastTouch will be set to the date when the record is last modified. |
| MDE.250128.F.3.12 |  | Active | When a user selects a language on the ROBAR login or Main menu, and in the Master Data module the user selects a Master Data schema that has localizations associated with it, English Field captions will be replaced with the Resource Value specified in the LOCALIZATIONRESOURCES TABLE for that Schema specified in the ResourceType. If localization entries are not available in the LOCALIZATIONRESOURCES table for a field, then the English value will be shown. |
