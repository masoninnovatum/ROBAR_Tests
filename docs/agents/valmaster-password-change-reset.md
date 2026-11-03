# ValMaster requirements - Password Change and Password Reset (pulled READ-ONLY 2026-11-02)

Sheet "ValMaster - Innovatum" (3214043046537092), Module = `Password Change` / `Password Reset`; Customer Specific blank on every row; one Obsolete row dropped. Also found: Module `ROBAR Password` (2 rows, both Obsolete: inactivity lock-out, Windows screen-saver) - ignore.
Source of truth #1 for the specs; cite the id in spec steps. Formal scripts named in the Test Cases column: `WebMenu1.5` (Web Menu), `PR_PasswordReset1.1`, `PR_UnlockAccount1.2` (look for them under `\\diskstation\backedup\#Unlocked_Test_Cases\`).

## Password Change (Module `Password Change`, 4 rows, all Active)
| Id | Requirement | Test Cases |
|---|---|---|
| URS-8.1.19 | The system will support browser based password changing for users without access to design station. | NA |
| FRS-8.1.19.1 | A browser based screen will be created that will allow a user to change passwords. | NA |
| FRS-8.1.19.2 | Illegal passwords will be recognized accordingly. The password change process will perform the same edit checks as the Designer password change processes to ensure that the preconfigured password rules found in the Settings file are followed. | WebMenu1.5 |
| FRS-8.1.19.3 | Users with expired passwords will be redirected to the password change screen upon login. | WebMenu1.5 |

## Password Reset (Module `Password Reset`, 15 Active rows)
Test case group `NA`:
| Id | Requirement |
|---|---|
| PR20121221001U100.0 | The system shall allow users to reset their password via a web menu option. ROBAR user passwords needs to be able to be reset within the Password Reset module. |
| PR20121221001U100.1 | ROBAR user accounts need to be able to be unlocked without resetting the password within the Password Reset module. |

Test case group `PR_PasswordReset1.1`:
| Id | Requirement |
|---|---|
| PR20121221001F100.0.1 | By default, newly reset passwords are immediately expired. |
| PR20121221001F100.0.2 | Security checkpoint exists to allow permitted users to reset passwords that are not immediately expired. |
| PR20121221001F100.0.3 | By default, the operating user can only reset users who share their own facility. |
| PR20121221001F100.0.4 | The operating user can reset users from facilities other than their own if they pass a security checkpoint. |
| PR20121221001F100.0.5 | Locked out users are visibly distinguishable from non-locked out users when selecting a user to reset. |
| PR20121221001F100.0.6 | Active Directory users are filtered out of the user list when selecting user to reset. |
| PR20121221001F100.0.7 | When a user's password is reset, their account will be unlocked if the fail count had been exceeded. |
| PR20121221001F100.0.8 | Existing password rules from ROBAR Settings will be used to validate new passwords. |
| PR20121221001F100.0.9 | Electronic signature is required to reset password and will be recorded in the Activity table. |

Test case group `PR_UnlockAccount1.2`:
| Id | Requirement |
|---|---|
| PR20121221001F100.1.1 | Active Directory users are included in the user list when selecting a user to unlock. |
| PR20121221001F100.1.2 | Electronic signature is required to unlock user and will be recorded in the Activity table. |
| PR20121221001F100.1.3 | When unlocking a user, the user drop down will only display users whose accounts are locked. |

Obsolete (dropped): PR20121221001U100 "Password Reset".

## Already known (modules/login-and-passwords.md, password matrix 2026-10-07/09) - to compare with these requirements
- F100.0.5 / F100.1.3: live, locked AND disabled users are listed "<id> - Locked" in both lists, and the unlock select is a separate list (unlock list shows locked users but cannot tell disabled from locked).
- F100.0.1 / 0.2: temporary reset (tick on) = Expired Password page at next login; tick off needs permission (MBUser1 allowed).
- FRS-8.1.19.2: Password Change enforces the settings, but new = current password is ACCEPTED there (Expired Password page refuses it).
- Not yet checked live: facility rules (F100.0.3 / 0.4), AD users filtering / inclusion (F100.0.6 / 1.1), e-signature + Activity table rows (F100.0.9 / 1.2), FRS-8.1.19.3 redirect (confirmed earlier as the Expired Password page, not ChangePwd.aspx).

## Live results 2026-11-02 (TST703 7.0.3.20260; specs in tests/Password-Management/)
All Password Change rows (URS-8.1.19, FRS-8.1.19.1/.2/.3) and Password Reset rows U100.0, U100.1, F100.0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9 (signature required + signer checks), 1.2, 1.3 behave as required, with these differences (annotated `deviation` in the specs): F100.0.5 / 1.3 a disabled user is shown as "Locked" and Unlock re-enables it; F100.0.4 the AllFacilities process is evaluated for the signer; FRS-8.1.19.2 new = current password accepted; FRS-8.1.19.3 after the change the user lands on the login page. NOT tested: F100.0.6 and F100.1.1 (AD users: no AD fixture), the Activity record of F100.0.9 / 1.2 (no database access).
