# Exploratory Session Log — Campaign Manager Approval Workflow

**Charter:** Explore Campaign Manager's approval workflow with the MBUser1 test account to
discover requirement gaps and unexpected behaviors, given 9 of its automated ViewAndVote tests
are currently disabled for unknown reasons (see `.agents/risk-matrix.md` item 3).

**Environment:** http://vmsrvtst703/innovatum/WebMenu/ (internal dev/QA server), account
`MBUser1`, build **7.0.3.20099**.

**Status: PARTIAL — session stopped before reaching the charter's core objective.** Recorded
honestly rather than marked "covered." The actual behavior of executing a "Send to Workflow"
approval-path action was never observed.

## Session Log

| Time (relative) | Action | Observation | Tag |
|---|---|---|---|
| T+0 | Logged into WebMenu | Full main menu rendered: Data and Labels, Document Control, Printing, Reports and Inquiries, Settings — 61 menu items total, all reachable by this test account | NOTE |
| T+1 | Opened Campaign Manager | Loaded a search/filter screen with a large column picker (Item/MD field list) inside an iframe (`tabs-1_frame`, `.../Innovatum/CampaignManager/`) | NOTE |
| T+2 | Clicked "Retrieve Items" with no filter criteria set | Returned exactly 1 row: `MI060501 | Carton Label | version 0 | A1TemplateMT`, plus the message **"Some search results are not displayed due to label type security."** | QUESTION |
| T+3 | Selected the row checkbox for MI060501 | Checkbox (`jqg_gridResults_MI060501\|Carton Label\|0\|340191`) checked successfully | NOTE |
| T+4 | Set Action dropdown to "Send to Workflow" (`value=WorkFlowSendTo`) | No visible UI change (no workflow-target picker appeared) after selecting the action, before clicking Do Action | QUESTION |
| T+5 | (idle gap — resolving a Claude Code permission-prompt discussion with the user) | Page returned **"This page has timed out due to inactivity"**, wiping the selected item and action state back to the login form | BUG (candidate) |
| T+6 | Logged back in, reopened Campaign Manager, re-selected item, re-set action | — | NOTE |
| T+7 | Attempted to click "Do Action" | Session timed out a **second time** before the click completed — again during a short real-world gap, this time while the exploration itself was still moving (not an intentionally long pause) | BUG (candidate) |
| T+8 | Re-login attempt | Own tooling error (not an app bug): typed the password into the username field because a click didn't register focus before typing — caught and was mid-correction when the session was stopped | NOTE (self, not app) |

## Findings

**RISK / BUG candidates (need a real session to confirm, not yet verified as reproducible bugs):**
1. **Session inactivity timeout appears aggressive** — it fired twice during what felt like short
   gaps, and the *second* time it fired mid-task while actively working (not during a long idle
   pause), which is the more concerning case. Needs a clean, timed re-test: log in, note the
   clock, do nothing, and measure exactly how many minutes until timeout.
2. **In-progress workflow selection is silently discarded on timeout** — after selecting an item
   and choosing "Send to Workflow," the timeout returned to a bare login page with no warning and
   no state preserved. For an approval-workflow action in a regulated environment, silently
   losing an in-progress action (rather than warning first, per the HICCUPS "User expectations"
   oracle) is worth a product decision, not just a UX nitpick.
3. **"Some search results are not displayed due to label type security"** appeared on a
   completely unfiltered retrieve, for an account (`MBUser1`) that otherwise appears to have
   full menu access. Open question, not a confirmed bug: is this expected security scoping for
   this test account, or does it indicate a Label Type Security misconfiguration hiding items
   that should be visible? Needs a follow-up question to whoever owns test-account provisioning.

**Unexplored (the actual charter target):**
- What actually happens when "Do Action" is clicked with "Send to Workflow" selected — does it
  route to a specific workflow, require picking one, validate anything, and does it show up
  correctly on the receiving end (the ViewAndVote screen the 9 disabled tests target)? **Not
  observed.** This is the single most important open question from `.agents/risk-matrix.md`
  item 3, and this session did not answer it.

## Coverage

- Login / menu access: **Covered**
- Campaign Manager search/retrieve: **Partial** (retrieve behavior observed; label-type-security
  message not explained)
- Send to Workflow action execution: **Unexplored**
- ViewAndVote receiving screen: **Unexplored**
- Session timeout behavior: **Partial** (reproduced twice, not yet root-caused or timed precisely)

## Recommended Follow-Up Session

Re-run this charter in a single focused block (no interleaved permission/config discussion) to
avoid the timeout interference seen here:
1. Time the actual inactivity timeout window precisely.
2. Complete a full Send-to-Workflow action and confirm it lands correctly in the ViewAndVote
   queue.
3. Ask someone with WebMenu security-config knowledge about the label-type-security message
   before assuming it's expected behavior.
