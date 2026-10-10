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

