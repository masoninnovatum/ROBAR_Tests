<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: webmenu-wide-issues -->

## WebMenu-wide issues (not specific to one module)

- **Session inactivity timeout only resets on literal `mousemove` events**, not clicks or
  keypresses. Root-caused via source + live cookie manipulation:
  `RefreshTimeout()` only fires on `mousemove`; the `InnoSession_PageTimeout` cookie is unchanged
  by click/keydown but extended by exactly 600s on mousemove. In practice this means any
  automation session doing clicks-only (no mouse jiggling) will get logged out roughly every
  8-10 minutes regardless of how recently the user "interacted." Full repro doc:
  `.agents/bug-repro-session-timeout.md`.
- Native `<select>` dropdowns in this app frequently don't respond reliably to simulated
  `.click()` on rendered `<option>` elements — use keyboard (Down/Return) navigation, or a
  properly-dispatched `change` event on a value set directly, instead.
- iframe IDs (`tabs-N_frame`) are assigned by tab-open order, not by which tab is active — don't
  assume `tabs-1_frame` is always the module you expect; check `document.querySelectorAll('iframe')`
  ids directly.
- **jQuery UI Dialog's buttonpane (Submit/Cancel/etc.) is a SIBLING of the dialog's own content
  div, never a descendant** — confirmed via `outerHTML` dump (2026-09-29, Campaign Manager's
  Approve Item dialog, `#approveItemDialog`): that div's own HTML contains only the signature
  fieldset, no buttons at all. `.dialog()` wraps whatever content div you pass it inside a
  `.ui-dialog` container as `.ui-dialog-titlebar` + (your content div) + `.ui-dialog-buttonpane`,
  all as siblings. **A locator scoped to the content div's own id/selector can therefore never
  find its own Submit/Cancel buttons** — search unscoped at the page/frame level instead
  (`.ui-dialog-buttonpane button:has-text("Submit")`), or walk up to the closest `.ui-dialog`
  ancestor first. This is why `Create_Approved_Item.spec.ts`'s original pattern searches
  `.ui-dialog-buttonpane` unscoped rather than scoping under `#approveItemDialog` — that was
  correct by construction, not an oversight; re-scoping it under the content div (as a later
  "cleanup" did) breaks it. Applies to every `.ui-dialog`-based modal in the app, not just Approve
  Item.

- **The shared `Innovatum.FilterSet`/CriteriaFilter grid widget's Approved-scope dropdown and
  Latest/Effective-Only checkboxes are a SEPARATE, easy-to-miss layer of filtering, distinct from
  the Column/Operator/Value filter row(s)** — confirmed via source
  (`Innovatum.DataManagement.Web/Scripts/innovatum/FilterSet.js` is the canonical shared
  implementation; used across Template Management, Campaign Manager, MDM, Workflow Management,
  etc., not one module's own code). The approval-scope control is a `<select>`, NOT a checkbox/
  radio — a DOM query for `input[type=checkbox], input[type=radio]` looking for it will find
  nothing and miss it entirely (confirmed the hard way, 2026-09-30). Exact selectors differ per
  module's own markup (verify per module, don't assume one universal id):
  - **Template Management**: `#drpApprove` (Knockout-bound to an object array via
    `optionsText: 'text'`, no `optionsValue` — select by the rendered label text, e.g. `"Approved
    and Unapproved"` for the neutral/no-filter option, not a raw `value` attribute), plus
    `#chkLatestVersion`/`#chkEffectiveOnly` checkboxes.
  - **Campaign Manager** (main grid, `Index.aspx`): `#drpApproved`, a plain select with real
    option values `"both"` (neutral)/`"true"` (approved only)/`"false"` (unapproved only), plus
    `#chkLatest` (defaults CHECKED) and `#chkEffective` (defaults unchecked) checkboxes.
  - **Critical operational context**: the standing test account (MBUser1) is the SAME account the
    user uses for their own manual testing — its filter/scope state is NOT guaranteed clean
    between sessions. A real incident (2026-09-30): after creating and approving a brand-new
    Template Management template (`MBCombo48666`) via the full native BarTender/Sentinel flow with
    zero errors at any step, a grid re-query for it came back "No records to view" — and so did a
    sanity-check query for `A1SuperTemplate`, a template already confirmed to exist and to have
    been found successfully earlier in the very same session. The cause was never a real failure:
    `#drpApprove` had been left on "Unapproved Only" by a separate manual-testing session using the
    same account, silently excluding every approved record regardless of how correct the Column/
    Operator/Value row was. Considerable time was spent chasing this as a suspected real bug
    (stale filter rows, label-type security, a broken retrieve mechanism) before the user
    identified the actual cause directly. **Before trusting any "no records"/empty-grid result as
    meaningful, explicitly set the approval-scope control to its neutral/"all" value and both
    Latest/Effective checkboxes to a known state for the query's actual purpose — don't just
    manage the Column/Operator/Value filter row(s) and assume that's the whole picture.**


### "Localizable Exception" sweep - static result 2026-10-10 (`ROBAR_Tests/scripts/sweep-localizations.js`)
A user-facing error whose resource key has no row in LocalizationResourceDef shows the raw text "Localizable Exception thrown with ResourceType: ... and ResourceKey: ..." (seen live: Destination Labeling Order_Already_Exists - that key IS seeded in `Localize_DestLabeling.cs` and the upgrade SQL, so TST703's DB simply lacks the row: an environment / upgrade-script gap, not a code gap). The script compares every `new InnoUserException(Err_X.Key ...)` in the 7.0.3 source with the seeds in `Innovatum.Install/.../Default_Localizations/*.cs` (two forms: `Generate("Innovatum.InnoUserException.Err_X", "Key", ...)` and `Generate(Err_X.Key, "text", "")`) and with `Robar/DB/UpgradeScripts/*.sql`. Result: 524 keys used, 670 seeded, **21 used but not seeded anywhere in source**: Err_BarTenderEdit.MachineName, Err_DirectPrint.LotSave, Err_InnovatumWeb.Ajax_User_Not_Logged_In, Err_LibDotNet.Password_Invalid, Err_Licensing.{Db_Host_Mismatch, Db_Name_Mismatch, Invalid_Host_LocalHost, License_Count_Exceed, License_Expired, License_Expired_Cant_Install, License_Too_Old_To_Install}, Err_MassItemUpdate.ItemIDs, Err_RetireItems.ItemIDs, Err_RobarFoundation.{Er4, Er31, Er202, Er901, Er10035}, Err_RobarPrintCustom.Invalid_Input, Err_RobarPrintServer.Er1, Err_ViewAndVoteService.VoteData. Most are not user-visible (install-time licensing, numeric error codes, validation field names such as ItemIDs / VoteData). Worth knowing: (1) **two copies of `Exceptions.cs`** exist with DIFFERENT enum members - `Lib/Src/DotNet/Innovatum.Lib.DotNet/Exceptions.cs` has `Err_LibDotNet.Password_Invalid` (used by that library's `InnoUser`), `Lib/Src/DotNet/Innovatum/Exceptions.cs` has `Password_or_UserName_Invalid` (the one seeded: "Invalid Username/Password."); the invalid-credentials message does show correctly live on every screen tried, so the Lib.DotNet key resolves somewhere (not verifiable without the DB); (2) `Err_InnovatumWeb.Ajax_User_Not_Logged_In` (thrown by `InnoApplicationPage` when a callback arrives after the session ended) has no seed - a session that expires during an AJAX callback may show the raw text (not reproduced). Limits: only `new InnoUserException(Err_X.Key` call sites are scanned; keys built dynamically or other exception types are not.
