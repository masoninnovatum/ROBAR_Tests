<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: security-management -->

## Security Management

**Purpose:** The module that governs itself and every other module in this engagement — creates
and edits `Users` and `Groups`, and toggles the `Security` table's per-Group (or per-ungrouped-user)
process authorizations that every other module's `<Prefix>_<Action>` gates read from. Testing it is
inherently recursive: it's the same screen used throughout this engagement to grant/revoke MBUser*
permissions for negative-permission tests in other modules.

**Formal scripts reviewed:** all 6 files under `Security_Management\7.0.2\` (5 test-case areas; see
`.agents/exploratory-session-log-security-management.md` for the full write-up). A
`Versioning - ReadMe.txt` in the same folder notes `Web_Security` was deprecated (DIT #1953) and
removed from the -1.1/-1.3 scripts — already reflected in the current script text.

### Layout: Users vs Groups radio, two-grid design
`Users` / `Groups` radio toggle at top-left. **Groups** (default view): `Group contains` free-text
filter + `Apply Filter`, primary grid (`Group`, `Description`), `+`/pencil icons bottom-left.
**Users**: adds a `Show Active Users Only` checkbox and a `UserID`/`Full Name`/`Group` dropdown +
`contains` field (instant-filter, no separate button); primary grid gains `UserID`, `Full Name`,
`Group` columns. Both views share a secondary grid on the right: `Process`, `Auth` (checkbox),
gated by `Process contains` (instant, case-insensitive, no Apply button needed) and a top-right
`Show processes which are: Authorized / Unauthorized / Both` radio group, plus a `Select All`
checkbox. Hovering a process name shows its description in a native `title`-attribute tooltip
(confirmed via DOM inspection — not always visible in an automated screenshot even when working).

### Add/Edit Group dialog (`+` / pencil icons)
Create mode: `Group` textbox, `Description of Group` textbox, `Copy Security Settings From`
dropdown (any existing Group or User — copies that entity's full process-authorization set onto
the new group), Submit/Cancel. Edit mode (pencil, or double-click a row): identical minus the
`Copy Security Settings From` dropdown; `Group` textbox renders **genuinely disabled** (confirmed
by selecting its text and typing over it — value doesn't change), `Description of Group` is
editable. Validation: `"The Group field cannot be left blank"`, `"Group already exists with
GroupID: <X>"` (blocks even if Description differs).

### Add/Edit User dialog (`+` / pencil icons, Users view)
Create mode fields: `User Id`, `Full Name of User`, `Email Address`, `Facility` dropdown, `Group`
dropdown, `Time Zone` dropdown (required — client-side blocks Submit with `"TimeZone is required"`
before any server round-trip happens, so a duplicate-UserID or blank-required-field test needs
every other required field filled first or the *first* client-side error masks the one you're
trying to trigger), `Active User?` (checked by default), `Authenticate Against Active Directory?`,
`Reset password at next logon` (checked by default), `Password`/`Confirm Password`, `Copy Security
Settings From`. Edit mode drops Password/Confirm Password/Copy Security Settings From entirely and
renders `User Id` **genuinely disabled** (same overtype-test confirmation as Group). Validation:
`"The User ID field cannot be left blank"`, `"User already exists with UserID: <X>"`,
`"FullName is required"` — **note the missing space**, a minor cosmetic discrepancy from the
field's own label "Full Name of User" (see the session log's Finding 2).

### Group-membership security inheritance (the core mechanic)
An **ungrouped** user's row in the Users view shows their own individually-editable process
checkboxes (white/enabled, assuming the logged-in tester has `Security_EditSecurity`). The instant
that user is assigned to a Group (via the Add/Edit User dialog's `Group` dropdown), their
checkboxes are replaced wholesale with that Group's current authorization set and become
**disabled** at the user level — greyed but still checked/unchecked to match the group. Removing
the user from the group (`Group` dropdown → `Choose one...`) reverts them to their own
individually-editable set, defaulting to all-unauthorized. This inheritance-on-assign/revert-on-
remove behavior is instantaneous and confirmed live, not just per the formal script's description.

### Split-permission model: `Security_EditUsersAndGroups` vs `Security_EditSecurity`
These two processes gate genuinely independent halves of the module, confirmed by testing both
directions live with a real negative-permission user (MBUser2 / MBSomeSecurity):

| Has `Security_EditUsersAndGroups` | Has `Security_EditSecurity` | `+`/pencil icons | Process checkboxes |
|---|---|---|---|
| ✅ | ❌ | Present, functional (minus `Copy Security Settings From` in Add/Edit Group) | Disabled |
| ❌ | ✅ | **Absent entirely** — not just disabled, not rendered at all | Enabled, fully editable |
| ✅ | ✅ (normal admin, e.g. MBUser1) | Present, full-featured | Enabled |

Neither process alone grants full module access — a user needs both to fully administer Security
Management. `View_Security` alone (no edit process) grants read-only module access only.

### Playwright-confirmed 2026-10-04 (`tests/Security-Management/`, helpers `tests/support/security.ts`, all 3/3)
Source: `Innovatum.Pages.SecurityManagement.MVC` (Views/Security/Management.cshtml, AddEditGroup/AddEditUser.cshtml) + `Innovatum.Pages.Security.WCF`. Run as the seed user; **only MB\* users/groups are ever written** (`assertMb()` guard). Groups and users can never be deleted, so `Security_Groups` / `Security_Users` leave one `MBPWG<stamp>` / `MBPWU<stamp>` behind per run (user deactivated); `Security_Effect_On_Login` uses two FIXED fixtures, group `MBPWLoginGrp` + user `MBPWLogin01` (password = seed password, no forced change).
- **Anatomy.** Frame `InnoPages/Security/Management`. Plain tables (NOT jqGrid): `#group_tableBody_tbody tr` (`td#groupID` + description), `#user_tableBody_tbody tr` (`td#userID #fullName #groupID`, hidden `td#userEnabled input`), `#processes_tableBody_tbody tr` (name td + `input.process_cb`, 412 processes on TST703). Radios `#rbUsers/#rbGroups`, `#rbAuth/#rbUnauth/#rbBoth`; filters `#groupFilterInput`+`#btnApplyGroupFilter`, `#userFilterColumnSelect`(USERID/FULLNAME/GROUP)+`#userFilterInput`+`#btnApplyUserFilter`, `#cbActiveUsersOnly`, `#processFilterInput` (**listens for `keyup` only — `fill()` needs a dispatched keyup**), `#cbSelectAll` (its container is hidden whenever a filter hides rows). Row click → `GetSecurityProcesses`; double-click opens Edit. Add/Edit icons `#btnAddRecord/#btnEditRecord` exist only with `Security_EditUsersAndGroups`; checkboxes are enabled only with `Security_EditSecurity` AND for an ungrouped user or a group.
- **There is no Save button.** Every process checkbox POSTs immediately (`UpdateSecurityProcess {userOrGroupId, process, isEnabled}`; Select All → `UpdateAllSecurityProcesses`) and persists across a reload. Add/Edit dialogs (`#addEditGroupDialog` / `#addEditUserDialog`, Submit/Cancel buttons) reload the whole Management page on success (`DefaultView=GROUP|USER`).
- **Group dialog:** ids `#group_input_groupid/_description/_copysecurity`. Messages: blank → "The Group field cannot be left blank" + **"Description is required"** (Description is mandatory); max 30 / 80 chars → "GroupID can not be longer than 30 characters" / "Description can not be longer than 80 characters"; duplicate (case-insensitive) → an error dialog "Group already exists with GroupID: X" + Continue (not an inline message). Copy-from entries read `GROUP - <name>` / `USER - <id>`; copying gives the new group exactly the source's authorizations. Edit mode: Group name disabled, Copy row present but hidden.
- **User dialog:** `#users_input_userid/_fullname/_email/_facility/_group/_timezone/_active/_adauth/_resetpassword/_password/_confirmpassword/_copysecurity`. Defaults: Active on, AD off, **Reset password at next logon ON** (uncheck it for a user who must log in directly). Blank → "The User ID field cannot be left blank", "FullName is required", "TimeZone is required", "Password is required"; too long → "UserID/FullName/Email can not be longer than 30/80/255 characters"; "Password values do not match"; duplicate → error dialog "User already exists with UserID: X". Group and Copy-security are mutually exclusive (picking one disables the other). Edit mode: User Id disabled; Active unchecked → row greyed (`rgb(170,170,170)`) and hidden by "Show Active Users Only".
- **Inheritance:** an ungrouped user has its own editable set (a created-with-copy user got 391 of the source group's 392 after one toggle). Assigning a group shows the group's set, all checkboxes + Select All disabled. **Removing the group leaves the user with NOTHING authorized (0) — the earlier individual set is gone** (tracker observation).
- **Security effect (live, as MBPWLogin01 in a second browser context):** the Web Menu login requires **`Login_WebMenu`** (`Web/WebMenu/Default.aspx MustBeAuthorizedFor`); without it the login form shows "User not authorized for this task." and no menu. With only `Login_WebMenu` the Main Menu shows just "Prompt Samples"; `MD_Management_Option` adds the **Master Data** tile, `MD_JobInquiry_Option` adds **MD Job Inquiry**, `View_Security` adds **Security Management**; removing a process removes its tile on the next login. With only `View_Security` the Security page is read-only (no Add/Edit icons, every checkbox + Select All disabled).
- **CRITICAL finding (tracker):** the write endpoints have no server-side authorization — that read-only user POSTed `UpdateSecurityProcess` for an MB group and the server returned `Success:true` and changed it (3/3). `UpdateUser/UpdateGroup/UpdateAllSecurityProcesses` look the same in code but were not posted.

### Out-of-scope this session
`BP_Reprint_CanSign` live e-signature reprint testing (Security_Management-1.4 covers Print by
Order, -1.5 covers Multi Document Printing) — both need an existing printed order/lot/item
combination plus `PrintConfig` entries (`NeedESignatureForReprint = Y`) not set up this session.
Reading these two scripts did surface a resolved cross-reference to a prior open question from the
Browser Printing session — see the session log's Finding 1: the reprint-block message
`"...not granted the Reprint_Label permission"` (no `BP_` prefix) is the scripts' own documented
expectation here, meaning the Browser Printing session's flagged discrepancy was the *older*
`BPSecurity1.3` script being stale, not a product defect. All DB-level audit-trail verification
steps (`Users`, `X_Users`, `Groups`, `X_Groups`, `Security`, `X_Security`) — no direct SQL access
this session, consistent with every prior module.

---

### Security Management vs ValMaster (SE.150915.*, 70 requirements in `valmaster-security-management.md`) — re-check 2026-10-09 (`Security_Management_Requirements.spec.ts`, headless; creates one inactive MB user `MBSMR<stamp>` per run)
- **OK:** F.8.5 the process-name cell has `title` = the process Description (BP_Reprint_Label "Allows user to reprint a label." etc.); **F.2.12** a new user has Reset-at-next-logon on and blank passwords, and the first login lands on `ChangePwd.aspx?Expired=true` ("Your password has expired. Please update your password now."); **F.2.7** an inactive user's login shows "User account is disabled." and no menu; F.7.1 / F.1.9 / F.7.2 with `View_Security` + `Security_EditUsersAndGroups` only: Add enabled, process checkboxes and Select All disabled; with `View_Security` + `Security_EditSecurity` only: the Add / Edit icons are NOT RENDERED (not just disabled), process checkboxes and Select All enabled. The older Security_Users / Security_Groups specs already match the messages of F.2.5, F.2.6, F.2.8, F.4.4, F.4.5, filters, Select All, group inheritance (F.2.11) and the Active Users Only checkbox.
- **Deviation F.9.2:** with `Security_EditUsersAndGroups` but WITHOUT `Security_EditSecurity` the Add User dialog's "Copy Security Settings From" dropdown is still ENABLED (requirement: not available). Such a user can create a user as a copy of any group (e.g. one holding every process) = privilege escalation through the UI. Wording notes: F.2.3 says "Copy Security Settings From textbox" but the dialog (and F.9.1) uses a dropdown.
- **Not tested:** F.10.1 / F.10.2 stored procedures (needs a stored procedure + the AddEditUserStoredProcedure / AddEditGroupStoredProcedure Global Settings), F.2.9 / F.3.6 / F.4.7 / F.5.6 X_Users / X_Groups inserts (database), F.1.13 / F.1.14 BP_Reprint_CanSign message (print screen; see Print_Request_Security), FRS-6.1.4.x / 6.1.6.1 (password matrix covers policy; lockout / audit log need DB).

