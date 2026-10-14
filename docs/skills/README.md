# Claude skills kept under version control

Backup copies of the ROBAR skills that live in `C:\Users\Mason\.claude\skills\<name>\SKILL.md` (the user-level folder is the LIVE copy that Claude loads from any session folder).
They sit here, not in `.claude/skills`, so the repo does not carry a second loadable copy of the same skill.

- `robar-smoke-test/SKILL.md` - run the smoke suite (preflight, Tier 0/1/2), triage failures, write the one-page build report. Runner: `scripts/smoke-run.js`; report builder: `scripts/smoke-report.js`.

To restore or update: copy the folder to `C:\Users\Mason\.claude\skills\`, or copy the live file back here after editing it and commit.
