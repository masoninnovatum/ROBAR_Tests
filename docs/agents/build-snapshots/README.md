# Build snapshots

One JSON file per build (`<build banner>.json`, e.g. `7.0.3.20349.json`) holding the STRUCTURE of every non-print module page: headings, buttons, links, menu items, tabs, labels, input ids, select option lists, grid column headers and nested frames. Print tiles are not opened (they can raise the Sentinel prompt). No data is stored (selects with more than 40 options are a count marker, ids are normalised).

## Take a snapshot of the build that TST703 is running now (headless, ~3 min, read-only)

```
npm run snapshot
```

Writes `docs/agents/build-snapshots/<banner>.json` (the banner is read from the login page). Env: `SNAPSHOT_DIR` (other folder), `SNAPSHOT_SUFFIX` (adds `__suffix` to the file name), `SNAPSHOT_ONLY="Link Management,Master Data"` (just those tiles).

## Diff two builds

```
node scripts/snapshot-diff.js docs/agents/build-snapshots/<older>.json docs/agents/build-snapshots/<newer>.json
```

Prints and writes `reports/build-snapshots/diff-<older>-vs-<newer>.md`; exit code 1 when there are differences. Every difference is a change nobody asked for in a requirement: a new or removed button, dropdown option, grid column, tab, menu item or tile.

## Noise

Measured 2026-11-13: two snapshots of build 7.0.3.20349 taken minutes apart are IDENTICAL (43 of 43 modules). Getting there needed: waiting until two reads one second apart match, waiting for nested frames to load, ignoring blank helper frames, normalising GUID / long-number ids. If a diff between two builds shows a module where only list ordering or a whole page's content appears or disappears, retake that page with `SNAPSHOT_ONLY` before believing it.

## Not covered

Row-level Actions menus (need a data row), dialogs that open on a click, localized strings in other languages, the new web menu (/ROBAR/, its Settings gear), and the print tiles. The first diff will be made when the next build is installed on TST703 (baseline: 7.0.3.20349).
