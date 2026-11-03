// Findings Mason deemed NON-ISSUES (2026-11-02): never include them in a Training Issues Report. Matched by description prefix (module + date are not unique).
module.exports = [
  'A user who can only VIEW Security Management', // 2026-10-04 Security Management: view-only user can still change authorizations
  'A user holding only LE_View_Lots',             // 2026-09-16 Lot Management / Dynamic UI: no server-side authorization on add / edit / delete
  "An MDM item's approved / effective status",    // 2026-09-16 Browser Printing (MDM): approved/effective status cached in the print wizard
  'A user without DM_NewVersion',                 // 2026-10-09 Dictionary Management: NewVersion authorization
];
