---
name: feedback-no-customer-name-in-uats
description: "For Harini's customer-level UATs going forward, don't put \"AdTech\" (the customer name) anywhere in the document"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 62bc9438-590a-4bf7-9392-a9339ba21c3a
  modified: 2026-09-24T18:12:15.821Z
---

For new UATs created for Harini (the customer-level "high-level" UATs derived from formal test scripts — first batch was for AdTech, 2026-09-22), do not reference "AdTech" anywhere: not in the filename, the Table 1 `Test #:` value, the footer ID, or the Purpose/conclusion text. Use `UAT_{ScriptOrFeatureName}.doc` and neutral Purpose wording ("To verify that ...").

**Why:** The user asked for this on 2026-09-24. The rule is scoped to Harini's UATs, not to every UAT. The already-built files in `Desktop\AdTech_UATs\` stay as they are; the user said not to change them.

**How to apply:** Only when authoring new UATs for Harini. Don't retroactively edit the existing AdTech batch, and don't extend the rule to DIT or project-level UATs unless asked. Related: [[robar-qa-reference-doc-convention]].
