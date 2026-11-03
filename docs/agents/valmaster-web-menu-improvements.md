# ValMaster requirements - Web Menu Improvements (new web menu `/ROBAR/`) (pulled READ-ONLY 2026-11-02)

Sheet "ValMaster - Innovatum" (3214043046537092), Module = `Web Menu Improvements` (project 20230612-001, dev Mark Fredrikson), 73 rows, all Active, Customer Specific blank on every row. Source of truth #1 for the specs; cite the id in spec steps. Formal scripts named in the Test Cases column: `Web_Menu_Improvements-1` / `-1.1` (password reset + auto-open module) / `-1.2` (notifications, dashboards, favorites) under `\\diskstation\backedup\#Unlocked_Test_Cases\Web_Menu_Improvements\`; UATs `UAT_20230612-001`, `UAT_20230612-002_SSO` (SSO/OAuth2 needs an external IdP: not automatable here).
Related modules the requirements point to (Settings menu): Dashboards Management, Dashboards Link Management, Notifications Management, Notifications Link Management (Dynamic UI pages); the Password rows overlap the already trained Expired Password page (modules/login-and-passwords.md).

Test cases: UAT_20230612-002_SSO
| Id | Type | Requirement |
|---|---|---|
| WMI.230612.F.1.1 | FRS | In addition to the standard ROBAR authentication, LDAP and AD Authentication capabilities, the Web Menu will accept authentication from external systems using OAuth2. |
| WMI.230612.F.1.2 | FRS | When authenticating via OAuth2, the appropriate login option will be displayed on the login page. Selecting the option will redirect the user to enter credentials if accessing the page for the first time or if the single sign on password is no longer available or valid ( for e.g. browser cache is cleared or password expired in the external system). For all subsequent logins, the user will be redirected to the ROBAR Main Menu or the default ROBAR module page as specified in the URL. |
| WMI.230612.F.1.3 | FRS | Users will also be presented with UserID and Password fields to allow alternate access. "Invalid UserID/Password" message will be displayed if the UserID is not found in the ROBAR database or if the UserID or password are incorrect. |
| WMI.230612.F.1.4 | FRS | Single Sign on capability will not be applicable to the Electronic Signature required within the ROBAR modules. |
| WMI.230612.F.1.5 | FRS | Regardless of the sign in methodology, once a user is logged into the system, their USERID will be displayed on the top panel of the ROBAR Web Menu. |
| WMI.230612.F.1.6 | FRS | A user logging into the ROBAR WEB MENU using Single Sign on capability will be recorded in the ACTIVITY table. |

Test cases: (none)
| Id | Type | Requirement |
|---|---|---|
| WMI.230612.F.1.7 | TRS | If the ROBAR server hosting the single sign on capability does not have access to the internet, the system will support manual load of the JSON configuration and security authentication Keys for the OAuth2 rather than reaching out to the web. |
| WMI.230612.F.7.6 | FRS | Placing the cursor over a Module name in the Modules list will display a tool tip with the name of the security process required to access the module. |
| WMI.230612.U.1 | URS | System shall support single sign on capability. |
| WMI.230612.U.10 | URS | System shall allow users to log out of the system. |
| WMI.230612.U.11 | URS | System shall allow user to edit the Page Title. |
| WMI.230612.U.2 | URS | System shall allow users to reset the ROBAR password. |
| WMI.230612.U.3 | URS | System shall support the ability to auto open a module based on the URL used to access the login screen |
| WMI.230612.U.4 | URS | System shall provide a Settings menu. |
| WMI.230612.U.5 | URS | System shall support dashboards for reporting purposes. |
| WMI.230612.U.6 | URS | System shall display user and system notifications. |
| WMI.230612.U.7 | URS | System shall allow users to specify favorite modules. |
| WMI.230612.U.8 | URS | System shall support timeout due to user inactivity. |
| WMI.230612.U.9 | URS | System shall support localization. |

Test cases: Web_Menu_Improvements-1.2
| Id | Type | Requirement |
|---|---|---|
| WMI.230612.F.10.1 | FRS | A Log Off button will be provided on the top panel of the ROBAR Web Menu.Selecting the Log off button will redirect the user to the login page. |
| WMI.230612.F.4.1 | FRS | A "wheel" icon will be provided on the ROBAR Web Menu main page to represent the Settings Menu. |
| WMI.230612.F.4.2 | FRS | Selecting the wheel icon will display the list of modules available to create and maintain certain system level settings. The Settings panel will be hidden after selecting a module or clicking on the Settings option again. |
| WMI.230612.F.5.10 | FRS | The Web Menu will allow users to access one or more dashboards. Only one dashboard at a time will be displayed on the main page of the ROBAR Web Menu. |
| WMI.230612.F.5.4 | FRS | When adding a dashboard entry, the following fields will be provided: - Name - This value will be used to define a name for the dashboard entry. - SourceURL - This value will be used to specify the URL to the dashboard input. (For e.g. PowerBI report url) - PlaceHolderURLforIE - If a dashboard is not IE compatible, the URL specified in this field will be used if the user launches the ROBAR Web Menu using IE. - IECompatible - This flag will be used to specify if a dashboard input is IECompatible. - Active - This flag will be used to specify if the dashboard is enabled or disabled. |
| WMI.230612.F.5.9 | FRS | The ROBAR Web Menu will provide a default dashboard, that will be accessible by all Users,Groups, Print Entities and will be active. |
| WMI.230612.F.6.10 | FRS | When a user associated with an active notification logs into the ROBAR Web Menu. The ROBAR Notification pop up is automatically displayed with the appropriate notification content (Message, Attachment (if any) )and the Acknowledge checkbox. |
| WMI.230612.F.6.11 | FRS | Once a user selects the Acknowledge option, they no longer will see the automatic pop up on login. Their acknowledgement is recorded and will be available as part of the Acknowledgement History row level action on Notifications Management page. |
| WMI.230612.F.6.12 | FRS | A "bell" icon will be provided on the main ROBAR Web Menu page which will allow users to view currently active Notifications that apply to the user logged into the system. |
| WMI.230612.F.6.4 | FRS | Selecting the Acknowledgement History option will display a pop up dialog with a grid. The grid will display the following: - UserID - This value will display the userId of the user who performed the attachment download or acknowledgement. - AttachmentDownloadedOn - This value indicates if a user downloaded the attachment associated with the notification and when. The value will be blank if the attachment was not downloaded. -AcknowledgedOn - This value will indicate if the user selected the 'Acknowledge' checkbox on the ROBAR Notifications dialog. The value will be blank if the Acknowledge box was not checked. |
| WMI.230612.F.6.5 | FRS | When adding a new notification through the Notifications Management module, the following fields will be provided: - Name : This field will be used to specify the name of the notification. - Message: This field will be used to specify the notification content. - AttachmentFileName : This drop down will be used to specify any documents that need to be associated with the notification. The drop down will be populated by files from the Attachments Management module with a file purpose of 'NotificationAttachment'. - EffectiveBegin : This date field will be used to specify the start date for notification display. - EffectiveEnd : This date field will be used to specify the end date for notification display. - DaysToKeepAfterExpiration : This text field will be used to specify the number of days to display the notification past the EffectiveEnd date. |
| WMI.230612.F.7.2 | FRS | Single clicking on a module name will open it in a tab format within the ROBAR Web Menu. An 'x' will be provided for each tab which will allow users to close the tab. |
| WMI.230612.F.7.3 | FRS | A 'Star" icon will be provided next to each module in the list. Selecting the star icon will tag the Module as a favorite. |
| WMI.230612.F.7.4 | FRS | Modules tagged as favorite will be displayed at the top of the Modules list in alphabetical order. Deselecting the star icon will move the module down the list to the appropriate position based on alphabetical order. |

Test cases: UAT_20230612-001
| Id | Type | Requirement |
|---|---|---|
| WMI.230612.F.11.1 | FRS | A Global Setting 'PageTitle' with the SettingOwner 'Innovatum.WebMenu' will be used to specify the title of the ROBAR Web Menu page. This title will be displayed in the browser tab. By default this value will be set to 'ROBAR Web Menu'. |
| WMI.230612.F.2.10 | FRS | Selecting the Reset button will redirect the user to the main ROBAR Web Menu login page and the password will not be reset. |
| WMI.230612.F.2.2 | FRS | The password reset capability will only be applicable to ROBAR user accounts. The page will not allow users to reset Active Directory/LDAP or Single Sign On passwords. |
| WMI.230612.F.4.3 | FRS | Each option provided under the Setting list will be in alphabetical order and will be controlled by ROBAR Security. |
| WMI.230612.F.4.4 | FRS | The wheel option will be disabled if a user is not authorized to access any of the Settings related modules. |
| WMI.230612.F.5.11 | FRS | If a user is authorized to access only one dashboard, it will be selected by default in the dashboard drop down. The contents of the dashboard will be automatically loaded on the main page of the Web Menu. |
| WMI.230612.F.5.12 | FRS | If a user is authorized access more than one dashboard, a drop down of dashboards will be provided. The first dashboard in the list will be selected and loaded by default on the main page of the Web Menu. |
| WMI.230612.F.5.13 | FRS | If a user is not authorized to access any dashboards, the main page of the Web Menu will either load a blank page or a predefined ROBAR module if specified in the URL. |
| WMI.230612.F.5.2 | TRS | The Dashboards Management page will be built using the Dynamic UI capability. The WEBMENUDASHBOARDS table will be used. This table will be replicated. The table will contain the following columns: - ID (PK, nvarchar(50), not null) - Name (nvarchar(50), not null) - SourceURL (nvarchar(max), not null) - PlaceHolderURLForIE (nvarchar(max), not null) - IECompatible (nvarchar(1), not null) - Active (nvarchar(1), not null) |
| WMI.230612.F.5.6 | TRS | The Dashboards Link Management module will be built using the Dynamic UI capability. The WEBMENUDASHBOARDLINKAGES table will be used. This table will be replicated. The table will contain the following columns: - ID (PK, nvarchar(50), not null) - UserID (nvarchar(30), not null) - GroupID (nvarchar(30), not null) - PrintEntity (nvarchar(30), not null) - DashboardName (nvarchar(50), not null) - Active (nvarchar(1), not null) |
| WMI.230612.F.6.2 | TRS | The Notifications Management page will be built using the Dynamic UI capability. The WEBMENUNOTIFICATIONS table will be used. This table will be replicated. The table will contain the following columns: - ID (PK, nvarchar(50), not null) - Name (nvarchar(50), not null) - Message (nvarchar(max), not null) - AttachmentFileName (nvarchar(255), not null) - EffectiveBegin (datetime, not null) - EffectiveEnd (datetime, not null) - DaysToKeepAfterExpiration (bigint, not null) |
| WMI.230612.F.6.6 | FRS | Once a notification has been setup in the Notification Management module, the notifications can then be linked to a combination of UserID, GroupID and PrintEntity via the Notifications Link Management module under the Settings menu. Only users with the security process 'Notifications_Link_Management' will be allowed to access the page. The option will not be displayed for unauthorized users. |
| WMI.230612.F.6.7 | TRS | The Notifications Link Management module will be built using the Dynamic UI capability. The WEBMENUNOTIFICATIONLINKAGES table will be used. This table will be replicated. The table will contain the following columns: - ID (PK, nvarchar(50), not null) - UserID (nvarchar(30), not null) - GroupID (nvarchar(30), not null) - PrintEntity (nvarchar(30), not null) - NotificationName (nvarchar(50), not null) |
| WMI.230612.F.7.5 | TRS | Modules tagged as favorites will be silently loaded in the background to reduce the page load time when the user selects the module. |
| WMI.230612.F.8.1 | FRS | The inactivity time period is defined by the Global Setting 'WebTimeoutInMinutes' with Setting Owner 'Innovatum.WebMenu'. By default this value will be set to '30'. |
| WMI.230612.F.8.2 | FRS | If there is no user activity detected for the duration defined by the WebtimeOutInMinutes Global Setting, the ROBAR Web Menu page will display an inactivity count down. The count down value will be set to 60 seconds. |
| WMI.230612.F.8.3 | FRS | If any user activity is detected during the countdown, the user session will remain active. If there is no activity detected, the user will be logged out of the ROBAR Web Menu and the login page will be displayed with the message "Timed out due to inactivity". |
| WMI.230612.F.9.1 | FRS | A Language drop down will be provided to reflect the localization data configured in the ROBAR database. By default "English" language will be selected. |
| WMI.230612.F.9.2 | FRS | Selecting a language other than English from the Language drop down will cause the login and ROBAR module pages to display field headings, error messages etc in the appropriate translations as specified in the LOCALIZATIONRESOURCES table. |
| WMI.230612.F.9.3 | FRS | For a given field or message in ROBAR, if no entry is found in the LOCALIZATIONRESOURCES table for a selected language, the default English value specified in the LOCALIZATIONRESOURCESDEF table will be displayed. |

Test cases: Web_Menu_Improvements-1.1
| Id | Type | Requirement |
|---|---|---|
| WMI.230612.F.2.1 | FRS | The combination of the value specified for the Global Setting 'PasswordChangeDays' and the PasswordSet date in the USERS table will be used to determine if a user's ROBAR password has expired and needs to be reset. |
| WMI.230612.F.2.3 | FRS | If the ROBAR user account password entered by a user is expired, a password reset page will be displayed with the following: - UserID - Old Password - New Password - Confirm New Password - Submit and Reset buttons - A message stating "Your password has expired and must be reset" |
| WMI.230612.F.2.4 | FRS | If the Old Password entered by the user is incorrect, the message "Old Password is incorrect" will be displayed once the Submit button is selected. |
| WMI.230612.F.2.5 | FRS | If the values entered in the New Password and the Confirm New Password fields do not match, the message "Passwords do not match" will be displayed once the Submit button is selected. |
| WMI.230612.F.2.6 | FRS | The Submit button will not be enabled if the UserID field, the Old Password, the New Password or the Confirm New Password fields are blank. |
| WMI.230612.F.2.7 | FRS | If the New Password does not meet the GlobalSettings 'PasswordMinLength', 'PasswordNeedsLetters', 'PasswordNeedsNumbers' requirements, the appropriate message will be displayed once the Submit button is selected. |
| WMI.230612.F.2.8 | FRS | The GlobalSetting 'PasswordDaysBeforeReuse' will be used to determine if a user can reuse an old password. |
| WMI.230612.F.2.9 | FRS | Once all password reset criteria is met and the Submit button is selected, the user's password will be updated in the USERS table. The change will be recorded in the X_USERS table. |
| WMI.230612.F.3.1 | FRS | The Web Menu will allow users to pass a module name as a parameter in the URL. This will ensure that the module opens by default when the user is logged into the ROBAR Web Menu. |
| WMI.230612.F.3.2 | FRS | If the user is not authorized to access the module, then the default ROBAR Web Menu dashboard will be displayed. |

Test cases: Web_Menu_Improvements-1.2, UAT_20230612-001
| Id | Type | Requirement |
|---|---|---|
| WMI.230612.F.5.1 | FRS | The Web Menu will integrate with reporting tools such as Power BI. The Dashboards Management module, under the Settings menu, will allow users to setup reports to be displayed in the dashboard of the ROBAR Web Menu. Only users with the security process 'Dashboards_Management' will be allowed to access the module. The option will not be displayed for unauthorized users. |
| WMI.230612.F.5.3 | FRS | By default the following functionality will be enabled in the Dashboards Management page. - Search capability - Save and Load filters - Adjust Page Size - Add, Edit, View and Delete rows in the result grid. |
| WMI.230612.F.5.5 | FRS | Once a dashboard report has been setup in the Dashboards Management module the notifications can then be linked to a combination of UserID, GroupID and PrintEntity via the Dashboards Link Management module under the Settings menu. Only users with the security process 'Dashboards_Link_Management' will be allowed to access the page. The option will not be displayed for unauthorized users. |
| WMI.230612.F.5.7 | FRS | By default the following functionality will be enabled in the Dashboards Link Management page. - Search capability - Save and Load filters - Adjust Page Size - Add, Edit, View and Delete rows in the result grid. |
| WMI.230612.F.5.8 | FRS | The Dashboards Link Management page allow users to link a dashboard report to a specific UserID/GroupID/ PrintEntity or the '*' entry can be used to specify application to ALL UserIDs/GroupIDs/Print Entities. |
| WMI.230612.F.6.1 | FRS | The Notifications Management module, under the Settings menu, will allow users to setup notifications in the system. Only users with the security process 'Notifications_Management' will be allowed to access the module. The option will not be displayed for unauthorized users. |
| WMI.230612.F.6.3 | FRS | By default the following functionality will be enabled in the Notifications Management page. - Search capability - Save and Load filters - Adjust Page Size - Add, Edit, View and Delete rows in the result grid. - A row level action 'Acknowledgement History' |
| WMI.230612.F.6.8 | FRS | By default the following functionality will be enabled in the Notifications Link Management page. - Search capability - Save and Load filters - Adjust Page Size - Add, Edit, View and Delete rows in the result grid. |
| WMI.230612.F.6.9 | FRS | The Notifications Link Management page allow users to link notification(s) to a specific UserID/GroupID/ PrintEntity or the '*' entry can be used to specify application to ALL UserIDs/GroupIDs/Print Entities. |
| WMI.230612.F.7.1 | FRS | Selecting the "Modules" option on the ROBAR Main Web Menu page will display the list of modules the user is authorized to access. The modules will be displayed in alphabetical order. The modules panel will be hidden after selecting a module or clicking on the Modules option again. |
