# modules_draft - proposed per-module split of robar-module-reference.md (DRAFT for review, 2026-10-09)

Nothing in the original has been changed or removed. Each file is a lossless slice of `../robar-module-reference.md` in original order (newer blocks later = newer wins). Two additive banners mark superseded text (printing.md). `_SUPERSEDED_REVIEW.md` lists other candidates for you to decide.

| File | Lines | KB | Original line ranges |
|---|---|---|---|
| 00-overview-and-todos.md | 102 | 8 | 1-33, 34-102 |
| bartender-sentinel-playbook.md | 375 | 32 | 3963-4337 |
| campaign-manager.md | 676 | 56 | 103-773, 4941-4945 |
| codes-management.md | 19 | 7 | 4827-4837, 4890-4897 |
| destination-labeling.md | 312 | 28 | 3662-3962, 4861-4871 |
| dictionary-management.md | 104 | 19 | 2532-2623, 4881-4889, 4946-4948 |
| dynamic-ui.md | 5 | 2 | 4932-4936 |
| field-definitions-management.md | 114 | 13 | 4433-4542, 4937-4940 |
| label-control.md | 309 | 53 | 2223-2531 |
| label-type-management.md | 95 | 11 | 4338-4432 |
| login-and-passwords.md | 26 | 20 | 4801-4826 |
| lot-management.md | 84 | 11 | 4543-4617, 4872-4880 |
| master-data-management.md | 878 | 95 | 930-1137, 1138-1807 |
| print-entity.md | 16 | 4 | 4838-4845, 4853-4860 |
| printing.md | 733 | 84 | 1808-2222, 2717-3001, 4846-4852, 4898-4903, 4907-4918, 4919-4926 |
| security-management.md | 98 | 13 | 2624-2716, 4927-4931 |
| template-management.md | 660 | 60 | 3002-3661 |
| testing-tooling-limitations.md | 122 | 11 | 4679-4800 |
| webmenu-wide-issues.md | 61 | 5 | 4618-4678 |
| workflow-management.md | 159 | 30 | 774-929, 4904-4906 |

If approved: move these files to `../modules/`, replace `robar-module-reference.md` with a short index pointing at them (keep the old file as `robar-module-reference.ARCHIVE.md`), update the pointers in memory (`reference_agents_folder.md`), the skills that mention the single file (robar-module-training, uat-creation / uat-execution, MsBuild CLAUDE-style docs) and the git copy in `ROBAR_Tests/docs/agents/`.
