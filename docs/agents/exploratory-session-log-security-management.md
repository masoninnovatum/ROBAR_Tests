# Exploratory Session Log — Security Management

**Charter:** Read-only review of the 6 formal Security Management test scripts (network share,
`\\diskstation\backedup\#Unlocked_Test_Cases\Security_Management\7.0.2\`, covering 5 test-case
areas), then exploratory testing against the live application, following the same approach used
for Campaign Manager, Workflow Management, Master Data Management, Browser Printing, Label
Control, and Dictionary Management.

**Environment:** `http://vmsrvtst703/innovatum/WebMenu/` → Security Management, build
7.0.3.20102, account `MBUser1` (Mason Baxter). `MBUser2` (Fred Johnson, MBSomeSecurity group)
used for the module's own negative-permission tests — an intentionally recursive scenario, since
this is the very module used throughout this engagement to grant/revoke MBUser* permissions.

**Constraint honored:** No GlobalSettings values were changed. No Print Configs were relevant to
this module and none were touched. Two security processes on the MBSomeSecurity group
(`Security_EditSecurity`, `Security_EditUsersAndGroups`) were each temporarily toggled to test
both halves of the module's split-permission model, then restored to their original (both
checked) state — confirmed restored via a final Security Management check. One incidental change
to a pre-existing production group (`AL01_SecurityGroup`'s `BP_Reprint_CanSign` process, toggled
on to confirm checkbox editability) was caught and reverted within the same testing pass.

**Status:** substantial coverage of all 3 core test-case areas (basic filtering/access control,
User add/edit, Group add/edit) plus one live probe. Everything tested matched the formal scripts'
expected behavior — no confirmed bugs this session. One notable cross-module documentation
finding surfaced from the read-only review, not live testing.

## Formal Script Review — Scope Summary

6 files were read directly (small enough volume this session that delegating to parallel research
agents wasn't necessary): Security_Management-1 (test plan), -1.1 (security-controlled basic
filtering), -1.2 (add/edit users), -1.3 (add/edit groups), -1.4 (BP_Reprint_CanSign in Print by
Order), -1.5 (BP_Reprint_CanSign in Multi Document Printing). A `Versioning - ReadMe.txt` in the
same folder notes `Web_Security` was deprecated (DIT #1953) and removed from -1.1/-1.3's
references — the current scripts already reflect this.

**Confirmed out of scope this session:**
- All DB-level verification steps present in nearly every script (querying `Users`, `X_Users`,
  `Groups`, `X_Groups`, `Security`, `X_Security`, `UserEnvironment`) — no direct SQL access this
  session, consistent with every prior module.
- Security_Management-1.4 and -1.5 (`BP_Reprint_CanSign` live e-signature reprint testing in
  Print by Order and Multi Document Printing) — both require an existing printed order/lot/item
  combination plus specific PrintConfig entries (`NeedESignatureForReprint = Y`); not set up this
  session. However, reading these two scripts surfaced a valuable cross-module finding — see
  Finding 1 below.

**Confirmed in scope and exercised this session:** Users/Groups toggle and all associated filter
controls, Add/Edit User dialog (validation, duplicate detection, disabled UserID field, Active
User toggle), Add/Edit Group dialog (validation, duplicate detection, disabled Group name field),
group-membership security inheritance (a user's checkboxes lock and mirror their group's the
moment they're assigned to one, and unlock again if removed), and — critically — both directions
of the module's split-permission model (`Security_EditUsersAndGroups` without
`Security_EditSecurity`, and the reverse) tested live with MBUser2.

## Results by Feature

| Feature | Result | Notes |
|---|---|---|
| Users/Groups toggle, filters (Group/Process contains, Show processes which are, Select All, Show Active Users Only) | ✅ Working | Every control matches the formal script's described layout and behavior exactly. |
| Add/Edit Group — validation | ✅ Working | "The Group field cannot be left blank" and "Group already exists with GroupID: \<X\>" both match verbatim. |
| Add/Edit Group — edit mode | ✅ Working | Group name field confirmed genuinely disabled (overtype attempt had no effect); Description editable. |
| Add/Edit User — validation | ✅ Working | "The User ID field cannot be left blank" and "User already exists with UserID: \<X\>" match verbatim. One minor wording discrepancy — see Finding 2. |
| Add/Edit User — edit mode | ✅ Working | User Id field confirmed genuinely disabled; Full Name, Group, Active User, etc. all editable. |
| Active/Inactive user filtering | ✅ Working | "Show Active Users Only" correctly excludes a deactivated user; unchecking it shows the user again, greyed as inactive. |
| Group-membership security inheritance | ✅ Working | Assigning a previously-ungrouped user to a group instantly replaces their (until-then-editable) checkboxes with the group's (now locked, matching values). |
| Split-permission — EditUsersAndGroups only | ✅ Working | `+`/pencil icons present and functional for both Users and Groups; "Copy Security Settings From" dropdown correctly absent from the Add/Edit Group dialog; process checkboxes correctly rendered disabled. |
| Split-permission — EditSecurity only | ✅ Working | `+`/pencil icons correctly absent entirely; process checkboxes correctly enabled and editable — confirmed by toggling and reverting a real checkbox. |
| Process-description tooltip | ✅ Working | Confirmed via DOM inspection (native tooltips don't reliably render in an automated screenshot) — `title` attribute present with the correct description text. |

## Finding 1 (documentation cross-reference, high value): Security_Management-1.4 confirms the Browser Printing session's earlier "Finding 1" was not actually a defect

The Browser Printing exploratory session (this engagement, prior session) flagged a message-text
discrepancy: the live reprint-block message read *"This is a reprint, but the user is not granted
the **Reprint_Label** permission"* (no `BP_` prefix), while that session's formal script
(`BPSecurity1.3`) expected the prefixed process name `BP_Reprint_Label`. It was logged as a
"documentation-accuracy issue," implying the *product* might be correct and the *older* script
stale, or vice versa — left unresolved.

Reading Security_Management-1.4 step 1.3 this session settles it: this script's own expected
result, word for word, is *"This is a reprint, but the user is not granted the **Reprint_Label**
permission"* — no `BP_` prefix, exactly matching what was observed live in the Browser Printing
session. Security_Management-1.4/1.5 are specifically about e-signature reprint security and are
more directly authoritative on this exact message than BPSecurity1.3 (which covers Browser
Printing more broadly). This strongly suggests the live behavior is correct and it is
`BPSecurity1.3` that has the stale/inaccurate expected-result text, not the product.

**Recommendation:** Update `BPSecurity1.3`'s expected result to drop the `BP_` prefix, matching
both the live product behavior and `Security_Management-1.4`/`-1.5`'s own documented expectation.
This closes out the Browser Printing session's Finding 1 as "working as designed, formal script
needs a wording correction" rather than an open question.

## Finding 2 (minor, cosmetic): Add/Edit User's missing-Full-Name message doesn't match the formal script's wording

**Formal script expectation** (Security_Management-1.2, referencing the same validation covered
in principle by other scripts' phrasing conventions): a message reading *"Full name is required"*
(capital F, capital N, space between words, matching the field's display label "Full Name of
User").

**Live behavior observed:** the message reads *"FullName is required"* — no space between "Full"
and "Name," not matching the field's own display label directly above it. Confirmed via direct
observation triggering the validation (leave Full Name of User blank, attempt Submit).

**Impact:** Purely cosmetic — the validation logic itself is correct and blocks submission as
expected. Worth a one-line fix (add the missing space) for polish, but not a functional defect.

## Coverage Summary

- Users/Groups toggle, all filter controls (Group contains, Process contains, Show processes
  which are, Select All, Show Active Users Only, UserID/Full Name/Group dropdown): covered, all
  correct
- Add/Edit Group (create, validation, duplicate detection, edit-mode field locking): covered, all
  correct
- Add/Edit User (create, validation, duplicate detection, edit-mode field locking,
  active/inactive toggle and its effect on the Active Users filter): covered, all correct except
  Finding 2 (cosmetic)
- Group-membership security inheritance (checkbox lock-on-assign, unlock-on-remove): covered,
  correct
- Both directions of the split-permission model (`Security_EditUsersAndGroups` vs
  `Security_EditSecurity`): covered, both correct
- Process-description tooltip: covered via DOM inspection, correct
- `BP_Reprint_CanSign` live e-signature reprint flow (Security_Management-1.4/-1.5): not
  live-tested — infrastructure/test-data setup out of scope this session, but the formal-script
  read yielded Finding 1, a resolved cross-reference to a previously open question
- DB-level audit-trail verification (`Users`, `X_Users`, `Groups`, `X_Groups`, `Security`,
  `X_Security` tables): not tested — no direct SQL access this session, consistent with every
  prior module

## Recommended Follow-Up

1. Update `BPSecurity1.3`'s expected reprint-block message text to drop the `BP_` prefix,
   resolving the Browser Printing session's Finding 1 using this session's Finding 1 as the
   authoritative cross-reference.
2. Fix the missing space in the Add/Edit User "FullName is required" validation message (should
   read "Full name is required" or similar, matching the field's own label).
3. Complete `BP_Reprint_CanSign` testing for both Print by Order and Multi Document Printing in a
   session with an existing printed order/lot/item combination and the required PrintConfig
   entries (`NeedESignatureForReprint = Y`) already configured.
4. If DB access becomes available, verify the `X_Users`/`X_Groups`/`X_Security` audit-trail
   records for the test entities created this session (`MBTestGroup1`, `MBTestUser1`).
