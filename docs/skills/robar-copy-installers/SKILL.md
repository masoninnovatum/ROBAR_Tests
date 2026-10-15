---
name: robar-copy-installers
description: >
  Stage ROBAR / Innovatum Suite 7 installers in two steps. STEP 1: copy the installer(s) a developer says are ready from the build machine
  (\\vmsrvbuildmachine\exe\<version>\Installers) into a NEW folder <version>.<build> (for example 7.0.3.20291) under \\vmsrvbuildmachine\dataqa\InstallersInQA\<version>\.
  STEP 2: copy the same installer(s) from InstallersInQA to a QA server's installer folder (TST703 or VAL703: C:\QAInstallers, reached through the c$ admin share).
  Use when the user says "copy latest DynamicUI installer for 7.0.3 to InstallersInQA", "... and to TST703", "copy it to the server", "the <module> installer is ready for build 20291",
  "put the new Sentinel / Server / Web Help installers in QA", or asks what installers the build machine holds. Never overwrites or deletes; verifies every copy.
---

# Copy installers: build machine -> InstallersInQA -> QA server

## What the user does by hand (and this skill replaces)
1. A developer says a build is done and which installer(s) to take. The user opens the build machine's `Installers` folder for that version, copies those installers, creates a folder `<version>.<build>` in `InstallersInQA\<version>` and puts them there. -> **step 1** (`copy-installers.ps1`).
2. The user then logs on to the QA server and copies the same installer(s) from InstallersInQA into `C:\QAInstallers` on that server. -> **step 2** (`deploy-installers-to-server.ps1`; no logon needed, it uses the server's `c$` share).
The user does NOT delete old installers in `C:\QAInstallers` (the folder keeps them) and performs the installs himself.

## Locations (verified 2026-10-14)
- Source: `\\vmsrvbuildmachine\exe\<version>\Installers` - big ones at the top level (`RobarServerSetup_<v>.exe`, `SentinelServerSetup_<v>.exe`, `SentinelClient_Setup_<v>.exe`, `ROBAR Web Help Setup_<v>.exe`) and ~40 module installers under `Modules\<group>\` (`InnoPagesPlugins`, `InnovatumPlugins`, `InnoAPIPlugins`, `SentinelPlugins`, `Services`, `Websites`, `Utilities`, ...). The build is in the file name: `DynamicUISetup_7.0.3.20291.exe`.
- Staging: `\\vmsrvbuildmachine\dataqa\InstallersInQA\<version>\<version>.<build>\` (older: 7.0.3.20260, 7.0.3.20254 ...; one with a suffix: `7.0.3.20123 ADUserProvisioning`). Holds only the installers that were asked for, sometimes plus a `ReadMe.txt` the user wrote ("Just ran installers, no upgrade.sql", "Run SecurityManagement_Upgrade, presented after install").
- Servers (step 2), flat folder, no per-build sub folders: **TST703** `vmsrvtst703` -> `\\vmsrvtst703\c$\QAInstallers` (always this folder, per the user); **VAL703** `vmsrvval703` -> `\\vmsrvval703\c$\QAInstallers` (confirmed by the user 2026-10-15: same C:QAInstallers as TST703; the folder was empty). Older servers (vmsrvtst704, vmsrvtst702 ...) have the folder too but are not configured: add a line to the `$Servers` table in the deploy script when the user asks. Free space was tight on TST703 (7.7 GB free of 99 GB; the Robar server installer is ~415 MB): the script checks it.

## How to run (PowerShell; both scripts live in this skill folder `C:\Users\Mason\.claude\skills\robar-copy-installers\`)
Step 1:
```
& '<skill>\copy-installers.ps1' -Installer DynamicUI -DryRun      # plan only
& '<skill>\copy-installers.ps1' -Installer DynamicUI               # copy + verify
& '<skill>\copy-installers.ps1' -Installer DynamicUI,SecurityManagement
& '<skill>\copy-installers.ps1' -Installer RobarServer,SentinelClient,SentinelServer -Build 20291
& '<skill>\copy-installers.ps1' -List                              # what the source holds + newest builds
```
Options: `-Version 7.0.3` (default), `-Build <n>`, `-FolderSuffix "<text>"`, `-ReadMe "<text>"` (only when the user dictates a note), `-Hash`, `-DryRun`, `-List`.

Step 2:
```
& '<skill>\deploy-installers-to-server.ps1' -Server TST703 -Installer DynamicUI -DryRun
& '<skill>\deploy-installers-to-server.ps1' -Server TST703 -Installer DynamicUI
& '<skill>\deploy-installers-to-server.ps1' -Server VAL703                      # every .exe in the NEWEST InstallersInQA build folder
& '<skill>\deploy-installers-to-server.ps1' -Server TST703 -Build 20254 -Installer SecurityManagement   # an older staged build, on purpose
```
Options: `-Server TST703|VAL703` (also `vmsrvtst703`), `-Version`, `-Installer`, `-Build`, `-Hash`, `-DryRun`. Without `-Build` only the newest InstallersInQA build folder is used: an installer missing from it is an ERROR, never silently taken from an older build.

## Procedure
1. Parse the request: version (default 7.0.3), installer name(s), optional build, and whether a server is named ("to TST703", "and VAL703", "to the server"). If no server is named for step 2, ask which one (TST703 or VAL703); do not guess.
2. "Latest" = the newest build in the source. If the user names a build ("ready for build .20291") and the newest differs, say so before copying.
3. Step 1: dry-run first when anything is unclear (new installer name, several installers, a typed build); for one clear match run it directly. Step 2 only after step 1 succeeded (or when the user says the installer is already staged): run it with `-DryRun` first when no `-Installer` is given (it then copies EVERYTHING in the newest build folder) or when several installers are involved.
4. Report per step: installer(s), build, full target path, "COPIED and verified" / "SKIPPED (already there)" / errors, and for step 2 the free space left on the server.
5. Ambiguous name (for example "Destination" matches four installers): ask which; an EXACT name wins over a partial one (`DestinationLabeling` = `DestinationLabelingSetup`, not the PDF / ZB variants). Mixed builds: ask for the build.
6. Offer (do not create unprompted) a `ReadMe.txt` in the staging folder when the developer gave special install steps (upgrade scripts etc.). Step 2 copies installers only.

## Guardrails
- Step 1 writes only under `InstallersInQA\<version>\`; step 2 writes only into the configured `C:\QAInstallers` of TST703 / VAL703. Neither deletes, renames or overwrites: an identical file is skipped, a different file with the same name stops the script (report it; the user decides).
- Nothing is run, installed or edited on any server; the source folder is never touched. The user installs.
- Exit codes: 0 ok, 2 share / server not reachable (VPN, network, admin-share permissions), 3 name not found or ambiguous / unknown server, 4 mixed builds, 5 copy problem, 6 not enough free space on the server.
- Never copy to a server the user did not name, and never to a server other than the configured ones.

## Notes
- Written 2026-10-14 (step 1) and 2026-10-15 (step 2). If the share layout changes (new module groups, a different build-number format), run `-List` and adjust the regex in the scripts (`<base>_<version>.<build>.exe`).
- Related: `Retrieve_Latest_703_Code` (copies source code from the same build machine into C:\DB_Copies).
