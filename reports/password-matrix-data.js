// Data for the password-settings matrix workbook (one-off; DIT #6511/#6512 side quest, 2026-10-07). Expectations come from the source trace + formal scripts and are VERIFIED LIVE as the rounds run.
const SURFACES = [
  ['NL', 'New login page', 'http://vmsrvtst703/ROBAR/  (Login POST: #userIDInput, #passwordInput, "Log In")', 'Innovatum.WebMenu AccountController.Login -> InnoUser constructor (fail count, lock, disabled, expiry)'],
  ['EP', "New login page's password reset page (Expired Password)", 'http://vmsrvtst703/ROBAR/Account/ExpiredPassword (shown by Login when PasswordIsExpired; UserID, Old, New, Confirm, Submit, Cancel)', 'AccountController.ExpiredPassword POST; formal script Web_Menu_Improvements-1.1'],
  ['SM', 'Security Management (add / edit user)', 'Main menu tile "Security Management" (InnoPages/Security/Management): Add user dialog Password, Confirm, "Reset password at next logon", Active', 'SecurityController.UpdateUser -> SecurityService.AddUpdateUser -> SecurityManagementDB.SaveUser (no password-rule code)'],
  ['PC', 'Password Change module', 'Main menu tile "Password Change" = http://vmsrvtst703/Innovatum/WebMenu/ChangePwd.aspx (Username, Current, New, Confirm, Submit)', 'Web/WebMenu/ChangePwd.aspx.cs Button1_Click; process PasswordChange_Option'],
  ['PR', 'Password Reset module', 'Main menu tile "Password Reset" = http://vmsrvtst703/Innovatum/PasswordReset/ (reset / unlock, Require-change tick, e-signature)', 'Innovatum.UserMaintenance.MVC PasswordResetController + WCF PasswordResetService; process ResetPassword_Option'],
];

const SETTINGS = [
  ['PasswordMinLength', '5', 'Whole number. Fails when length < value (== value passes).', 'EP, PC, PR enforce; NL Login and SM do not.'],
  ['PasswordNeedsLetters', 'Y', "Only exactly 'Y' turns it on (case-sensitive); regex [A-Za-z].", 'EP, PC, PR enforce; NL Login and SM do not.'],
  ['PasswordNeedsNumbers', 'Y (default N; this server was changed)', "Only exactly 'Y' turns it on; regex [0-9].", 'EP, PC, PR enforce; NL Login and SM do not.'],
  ['PasswordDaysBeforeReuse', '365', 'A previously used (retired) password is blocked while (now - DATEUSED) < value days. The CURRENT password is not in the history table.', 'EP, PC, PR enforce; SM does not.'],
  ['PasswordFailLockCount', '3', 'Wrong password: FailCount+1; at FailCount >= value the user is disabled (Enabled=N). A locked user is refused even with the right password. Success clears the count.', 'Applied by the shared user code at NL login, EP (old password), PC (current password). PR: "Locked" label + unlock. SM: not applied; re-enabling does not clear the count.'],
  ['PasswordChangeDays', '90', 'Password expires when now > PasswordSet + value days.', 'Read only by InnoUser.PasswordIsExpired -> NL routes to EP; legacy login routes to ChangePwd.aspx?Expired=true.'],
  ['PasswordChangeOnReset', 'Y', 'No code reads this setting.', 'Expected: no effect on any surface (the "Require user to change password on login" / "Reset password at next logon" ticks decide).'],
];

// matrix[setting][surface] = [verdict, detail]; verdict: ENFORCED / NOT READ / GAP / INDIRECT
const MATRIX = {
  PasswordMinLength: { NL: ['NOT READ', 'Login never checks complexity (only existing passwords are verified).'], EP: ['ENFORCED', 'Your new password must be at least {0} characters (check order: match, length, letters, numbers, reuse, old password, different).'], SM: ['GAP', 'Add user accepts any length; only "Password is required" and "Password values do not match".'], PC: ['ENFORCED', 'Your password must be at least N characters! (policy checked BEFORE the current password).'], PR: ['ENFORCED', 'JS: Password is too short. Required characters: N; server: The new password was invalid.'] },
  PasswordNeedsLetters: { NL: ['NOT READ', 'n/a'], EP: ['ENFORCED', 'Your new password must contain letters'], SM: ['GAP', 'Digits-only password accepted.'], PC: ['ENFORCED', 'Your password must contain letters!'], PR: ['ENFORCED', 'JS: Password must contain letters.; server: The new password was invalid.'] },
  PasswordNeedsNumbers: { NL: ['NOT READ', 'n/a'], EP: ['ENFORCED', 'Your new password must contain numbers'], SM: ['GAP', 'Letters-only password accepted.'], PC: ['ENFORCED', 'Your password must contain numbers!'], PR: ['ENFORCED', 'JS: Password must contain numbers.; server: The new password was invalid.'] },
  PasswordDaysBeforeReuse: { NL: ['NOT READ', 'n/a'], EP: ['ENFORCED', 'That password cannot be reused at this time (history = oldpasswords; the current password is not blocked here, a separate "must be different" check exists).'], SM: ['GAP', 'No history check (new user; edit cannot set a password).'], PC: ['ENFORCED', 'That password cannot be reused at this time! (reusing the CURRENT password is NOT blocked on this page).'], PR: ['ENFORCED', 'Folded into: The new password was invalid.'] },
  PasswordFailLockCount: { NL: ['ENFORCED', 'Nth wrong password locks (Enabled=N); the screen always says Invalid UserID/Password (reason only in Activity LoginFailed).'], EP: ['INDIRECT', 'Wrong old password counts as a failed attempt (message masked as Old Password is incorrect); can lock.'], SM: ['GAP', 'Not applied; Active tick does not clear FailCount, so a re-enabled user can still be locked out.'], PC: ['INDIRECT', 'Wrong CURRENT password with an otherwise valid new one increments FailCount and can lock; wrong current + bad new shows the policy error and does NOT count.'], PR: ['INDIRECT', 'Locked users listed with "- Locked"; Unlock (or any Reset) sets FailCount 0 and Enabled Y.'] },
  PasswordChangeDays: { NL: ['ENFORCED', 'Expired (and not AD) -> Expired Password page after a correct login.'], EP: ['ENFORCED', 'The page itself does not verify expiry (can be POSTed directly).'], SM: ['NOT READ', '"Reset password at next logon" ticked stores PasswordSet = 1900-01-01 (forces EP); unticked = now.'], PC: ['NOT READ', 'Page does not read it; saves PasswordSet = now. ?Expired=true only changes the heading text.'], PR: ['NOT READ', 'Temporary reset backdates PasswordSet by 100 years (forces EP); non-temporary = now.'] },
  PasswordChangeOnReset: { NL: ['NOT READ', 'Dead setting - no code reads it.'], EP: ['NOT READ', 'Dead setting.'], SM: ['NOT READ', 'Dead setting (the tick decides).'], PC: ['NOT READ', 'Dead setting.'], PR: ['NOT READ', 'Dead setting (the "Require user to change password on login" tick, default ticked, decides).'] },
};

// Rounds = setting-value configurations the user flips (ServiceHost restart + IIS reset after each)
const ROUNDS = [
  ['R1', 'Baseline = values found on TST703 on 2026-10-07', { PasswordChangeDays: '90', PasswordChangeOnReset: 'Y', PasswordDaysBeforeReuse: '365', PasswordFailLockCount: '3', PasswordMinLength: '5', PasswordNeedsLetters: 'Y', PasswordNeedsNumbers: 'Y' }, 'No change needed (already in force).'],
  ['R2', 'Numbers off, minimum 8, reuse 0 days, lock count 5, ChangeOnReset N', { PasswordChangeDays: '90', PasswordChangeOnReset: 'N', PasswordDaysBeforeReuse: '0', PasswordFailLockCount: '5', PasswordMinLength: '8', PasswordNeedsLetters: 'Y', PasswordNeedsNumbers: 'N' }, 'Flip PasswordChangeOnReset N, PasswordDaysBeforeReuse 0, PasswordFailLockCount 5, PasswordMinLength 8, PasswordNeedsNumbers N.'],
  ['R3', 'Letters off, numbers on, minimum 1, lock count 1', { PasswordChangeDays: '90', PasswordChangeOnReset: 'Y', PasswordDaysBeforeReuse: '365', PasswordFailLockCount: '1', PasswordMinLength: '1', PasswordNeedsLetters: 'N', PasswordNeedsNumbers: 'Y' }, 'Flip PasswordChangeOnReset Y, PasswordDaysBeforeReuse 365, PasswordFailLockCount 1, PasswordMinLength 1, PasswordNeedsLetters N, PasswordNeedsNumbers Y.'],
  ['R4', 'Both complexity rules off (only length), password expiry immediate', { PasswordChangeDays: '0', PasswordChangeOnReset: 'Y', PasswordDaysBeforeReuse: '365', PasswordFailLockCount: '3', PasswordMinLength: '5', PasswordNeedsLetters: 'N', PasswordNeedsNumbers: 'N' }, 'Flip PasswordChangeDays 0, PasswordFailLockCount 3, PasswordMinLength 5, PasswordNeedsNumbers N (letters stay N). With ChangeDays 0 EVERY login goes to the Expired Password page.'],
  ['R5', 'Restore baseline', { PasswordChangeDays: '90', PasswordChangeOnReset: 'Y', PasswordDaysBeforeReuse: '365', PasswordFailLockCount: '3', PasswordMinLength: '5', PasswordNeedsLetters: 'Y', PasswordNeedsNumbers: 'Y' }, 'Restore the R1 values (required before anyone else uses TST703).'],
  ['RN', 'Follow-up (customer report): NeedsLetters N + NeedsNumbers N, all other values at baseline', { PasswordChangeDays: '90', PasswordChangeOnReset: 'Y', PasswordDaysBeforeReuse: '365', PasswordFailLockCount: '3', PasswordMinLength: '5', PasswordNeedsLetters: 'N', PasswordNeedsNumbers: 'N' }, 'Applied by the user after R5 (both rules to N, ServiceHost restart + IIS reset). Result: not reproducible - nothing enforced.'],
  ['R6 (optional)', 'Negative: blank / non-numeric numeric settings', { PasswordMinLength: 'blank', PasswordChangeDays: 'abc' }, 'Only if you agree: the code parses the raw string (Int32.Parse / Double.Parse), so expect an unhandled error; restore immediately.'],
];

// Test plan rows: id, round, surface, setting, title, precondition, steps, expected
const CASES = [];
const add = (id, round, surface, setting, title, pre, steps, expected) => CASES.push({ id, round, surface, setting, title, pre, steps, expected });

// ---- Expired Password page (EP)
add('EP-01', 'R1', 'EP', 'PasswordMinLength', 'New password shorter than the minimum', 'MB user with expired password (reset temporary via PR); min 5', 'Login on /ROBAR/, EP page: old = current, new = confirm = 4 chars with letters+digits (e.g. ab12).', 'Error "Your new password must be at least 5 characters"; password unchanged.');
add('EP-02', 'R1', 'EP', 'PasswordMinLength', 'New password exactly the minimum length', 'same', 'new = confirm = 5 chars with letters+digits (e.g. ab123).', 'Accepted (length == min passes); main menu opens.');
add('EP-03', 'R1', 'EP', 'PasswordNeedsNumbers', 'Letters-only password while numbers required', 'same, NeedsNumbers Y', 'new = confirm = abcdef.', '"Your new password must contain numbers".');
add('EP-04', 'R1', 'EP', 'PasswordNeedsLetters', 'Digits-only password while letters required', 'same, NeedsLetters Y', 'new = confirm = 123456.', '"Your new password must contain letters".');
add('EP-05', 'R1', 'EP', 'PasswordDaysBeforeReuse', 'Reuse of a previous password within 365 days', 'user changed A -> B earlier today', 'EP: new = A (the previous one).', '"That password cannot be reused at this time".');
add('EP-06', 'R1', 'EP', '(order)', 'Mismatch; new equals old; wrong old password', 'same', 'mismatch; new = old; wrong old with a valid new.', '"Passwords do not match"; "New password must be different than the current password"; "Old Password is incorrect" (and FailCount+1).');
add('EP-07', 'R1', 'EP', '(page)', 'Page anatomy and Cancel', 'same', 'Screenshot the page; UserID disabled; click Cancel.', 'Fields UserID (disabled), Old, New, Confirm, Submit, Cancel (script 1.1 step 1.3); Cancel returns to Login.');
add('EP-08', 'R2', 'EP', 'PasswordMinLength', 'Length 7 rejected, 8 accepted at minimum 8', 'min 8', 'new = 7 chars, then 8 chars (letters).', 'Rejected "at least 8 characters"; accepted at 8.');
add('EP-09', 'R2', 'EP', 'PasswordNeedsNumbers', 'Letters-only password accepted when numbers are off', 'NeedsNumbers N, NeedsLetters Y, min 8', 'new = abcdefgh.', 'Accepted.');
add('EP-10', 'R2', 'EP', 'PasswordDaysBeforeReuse', 'Reuse of the previous password with reuse days = 0', 'reuse 0; user changed A -> B', 'EP: new = A.', 'Accepted (age < 0 is never true).');
add('EP-11', 'R3', 'EP', 'PasswordNeedsLetters', 'Digits-only password accepted when letters are off', 'NeedsLetters N, NeedsNumbers Y, min 1', 'new = 123456, then new = 1.', 'Accepted; length 1 accepted at min 1.');
add('EP-12', 'R4', 'EP', 'PasswordChangeDays', 'ChangeDays = 0: every login lands on EP', 'ChangeDays 0, any MB user', 'Login with correct credentials; change the password; log off and log in again.', 'EP shown at every login (Now > PasswordSet + 0).');
add('EP-13', 'R4', 'EP', 'PasswordNeedsLetters/Numbers', 'Both rules off: only length checked', 'both N, min 5', 'new = !!!!! (5 symbols).', 'Accepted.');

// ---- Password Change module (PC)
add('PC-01', 'R1', 'PC', 'PasswordMinLength', 'New password shorter than the minimum', 'MB user, current password known; min 5', 'ChangePwd form: user, current, new = confirm = 4 chars (ab12).', '"Your password must be at least 5 characters!"');
add('PC-02', 'R1', 'PC', 'PasswordMinLength', 'New password exactly the minimum length', 'same', 'new = ab123.', 'Accepted: "Your password has been updated successfully."');
add('PC-03', 'R1', 'PC', 'PasswordNeedsNumbers', 'Letters-only', 'NeedsNumbers Y', 'new = abcdef.', '"Your password must contain numbers!"');
add('PC-04', 'R1', 'PC', 'PasswordNeedsLetters', 'Digits-only', 'NeedsLetters Y', 'new = 123456.', '"Your password must contain letters!"');
add('PC-05', 'R1', 'PC', 'PasswordDaysBeforeReuse', 'Reuse of a previous password', 'user changed A -> B', 'new = A.', '"That password cannot be reused at this time!"');
add('PC-06', 'R1', 'PC', 'PasswordDaysBeforeReuse', 'New equals the CURRENT password', 'same', 'new = current.', 'Expected ACCEPTED (no same-as-current check on this page; the current password is not in history) - differs from EP, which refuses it.');
add('PC-07', 'R1', 'PC', 'PasswordFailLockCount', 'Wrong current password + valid new password counts as a failed attempt', 'lock count 3; fresh user', 'Submit a valid new password with a wrong current password 3 times, then the right one.', 'Each time "Invalid Username/Password."; the 3rd locks the user; the right password is then refused ("User account has been locked out."); PR lists "- Locked".');
add('PC-08', 'R1', 'PC', 'PasswordFailLockCount', 'Wrong current + INVALID new password does not count', 'fresh user', 'Wrong current with new = 4 chars, repeated 4 times, then log in normally.', 'Policy message each time (checked before the current password); no lockout; login works.');
add('PC-09', 'R1', 'PC', '(access)', 'Page needs no login; tile gating', 'logged off', 'Open /Innovatum/WebMenu/ChangePwd.aspx directly; check the tile as a user without PasswordChange_Option.', 'Page works without a session (security note); tile hidden without the process.');
add('PC-10', 'R2', 'PC', 'PasswordMinLength', 'Minimum 8', 'min 8', '7 chars rejected, 8 accepted.', 'Message says 8; accepted at 8.');
add('PC-11', 'R2', 'PC', 'PasswordNeedsNumbers', 'Numbers off', 'NeedsNumbers N', 'new = abcdefgh.', 'Accepted.');
add('PC-12', 'R2', 'PC', 'PasswordDaysBeforeReuse', 'Reuse days = 0', 'reuse 0', 'new = previous password.', 'Accepted.');
add('PC-13', 'R2', 'PC', 'PasswordFailLockCount', 'Lock count 5', 'lock 5', '4 wrong current passwords then the right one; then 5 wrong.', 'Works after 4; locked after 5.');
add('PC-14', 'R3', 'PC', 'PasswordNeedsLetters', 'Letters off', 'NeedsLetters N', 'new = 123456 and new = 1 (min 1).', 'Accepted.');
add('PC-15', 'R3', 'PC', 'PasswordFailLockCount', 'Lock count 1', 'lock 1', 'one wrong current password with a valid new one; then the right one.', 'Locked immediately.');
add('PC-16', 'R4', 'PC', 'PasswordChangeDays', 'PasswordSet after a change when ChangeDays = 0', 'ChangeDays 0', 'Change the password here, then log in on /ROBAR/.', 'EP appears again at login (expired immediately).');

// ---- Password Reset module (PR)
add('PR-01', 'R1', 'PR', 'PasswordMinLength', 'Reset to a password shorter than the minimum', 'operator with ResetPassword_Option (+ Nontemporary); target = MB user', 'PR: pick target, Reset Password, new = confirm = 4 chars, e-signature, Submit.', 'Dialog "Password is too short. Required characters: 5" (client side).');
add('PR-02', 'R1', 'PR', 'PasswordNeedsLetters', 'Digits-only', 'NeedsLetters Y', 'new = 123456.', '"Password must contain letters."');
add('PR-03', 'R1', 'PR', 'PasswordNeedsNumbers', 'Letters-only', 'NeedsNumbers Y', 'new = abcdef.', '"Password must contain numbers."');
add('PR-04', 'R1', 'PR', 'MinLength / Letters / Numbers', 'Several violations at once', 'same', 'new = abc.', 'One dialog listing all failures (length and numbers).');
add('PR-05', 'R1', 'PR', 'PasswordDaysBeforeReuse', 'Reset to a previously used password', 'target changed A -> B', 'PR: reset to A.', 'Server refuses with "The new password was invalid." (no reuse-specific message).');
add('PR-06', 'R1', 'PR', 'PasswordChangeDays / ChangeOnReset', 'Temporary reset (tick on) forces a change at next login', 'tick "Require user to change password on login" ON', 'Reset; log in as the target on /ROBAR/.', '"Password reset successfully"; next login shows the Expired Password page (PasswordSet backdated 100 years).');
add('PR-07', 'R1', 'PR', 'PasswordChangeOnReset', 'Non-temporary reset (tick off) = normal password', 'operator has ResetPassword_Nontemporary', 'untick; reset; log in as target.', 'Login goes straight to the main menu; PasswordSet = now.');
add('PR-08', 'R1', 'PR', 'PasswordFailLockCount', 'Lock a user, see "- Locked", unlock', 'lock count 3', 'Lock the target via 3 wrong logins; open PR.', 'Target listed with "- Locked" in the unlock list; Unlock -> "User unlocked successfully"; login works.');
add('PR-09', 'R1', 'PR', 'PasswordFailLockCount', 'A reset also unlocks', 'locked target', 'Reset the password instead of unlocking.', 'Target can log in (FailCount 0, Enabled Y).');
add('PR-10', 'R1', 'PR', '(gating)', 'Facility / AD / process gating', 'users with and without ResetPassword_AllFacilities / _Nontemporary', 'Open PR as each.', 'Other-facility users hidden without AllFacilities; AD users not listed; tick locked ON without Nontemporary.');
add('PR-11', 'R2', 'PR', 'PasswordChangeOnReset', 'ChangeOnReset = N: tick behavior unchanged', 'ChangeOnReset N', 'Repeat PR-06 and PR-07.', 'Identical outcome (setting has no effect).');
add('PR-12', 'R2', 'PR', 'MinLength / NeedsNumbers / DaysBeforeReuse', 'Min 8, numbers off, reuse 0', 'R2 values', '7 chars rejected, 8 letters accepted, reset to the previous password accepted.', 'Follows the new values; hidden fields minLength 8 / needsNumbers false.');
add('PR-13', 'R3', 'PR', 'PasswordNeedsLetters / MinLength', 'Letters off, min 1', 'R3 values', 'new = 1 digit.', 'Accepted; hidden fields minLength 1 / needsLetters false.');
add('PR-14', 'R2', 'PR', 'PasswordFailLockCount', 'Lock count 5 changes the Locked list', 'lock 5', '4 wrong logins -> not listed; 5th -> listed.', 'Listed only at >= 5.');

// ---- New login page (NL)
add('NL-01', 'R1', 'NL', '(errors)', 'Unknown user / wrong password messages', 'none', 'U02 (non-existent) and a real user with a wrong password.', '"Invalid UserID/Password" for both (script 1.1 steps 1.1 and 1.2).');
add('NL-02', 'R1', 'NL', 'PasswordFailLockCount', 'N-1 wrong attempts then success clears the counter', 'lock 3; fresh MB user', '2 wrong passwords, 1 correct, then 2 more wrong and 1 correct.', 'Correct login each time (count cleared on success).');
add('NL-03', 'R1', 'NL', 'PasswordFailLockCount', 'Nth wrong attempt locks; the right password is then refused', 'lock 3', '3 wrong passwords, then the correct one.', 'Always "Invalid UserID/Password" (reason hidden); the correct password is refused after the 3rd; Activity LoginFailed rows hold the real reason; PR lists the user as Locked.');
add('NL-04', 'R1', 'NL', 'PasswordFailLockCount', 'Disabled vs locked look the same', 'one disabled user (Active unticked), one locked', 'Log in as each.', 'Same screen text; compare with the legacy login ("User account is disabled." / locked out) as a gap.');
add('NL-05', 'R1', 'NL', '(throttle)', 'More than 3 attempts per minute are delayed; more than 50 denied', 'any user', '5 quick wrong attempts (time them).', 'Delay grows (100 ms x n, up to 3 s); the lock counter still increments.');
add('NL-06', 'R1', 'NL', 'PasswordChangeDays', 'Expired user is routed to EP', 'user reset temporary via PR', 'Correct credentials.', 'Expired Password page ("Your password has expired and must be reset"), not the main menu.');
add('NL-07', 'R2', 'NL', 'PasswordFailLockCount', 'Lock count 5', 'lock 5', '4 wrong then correct; 5 wrong then correct.', 'Locked only at 5.');
add('NL-08', 'R3', 'NL', 'PasswordFailLockCount', 'Lock count 1', 'lock 1', '1 wrong then correct.', 'Locked immediately.');
add('NL-09', 'R4', 'NL', 'PasswordChangeDays', 'ChangeDays 0 sends every login to EP', 'ChangeDays 0', 'Correct credentials for two different users.', 'EP for both.');
add('NL-10', 'R1', 'NL', '(auto-open)', 'moduleName deep link', 'logged off', 'http://vmsrvtst703/ROBAR/Account/Login?moduleName=Print History Inquiry', 'Logs in and opens the module by default; without the security process the plain main menu opens (script 1.1 section 2).');

// ---- Security Management (SM)
add('SM-01', 'R1', 'SM', 'PasswordMinLength', 'Add a user with a 1-character password', 'MB group; MB test user id', 'Security Management > Users > Add: password = confirm = a; "Reset password at next logon" ticked.', 'EXPECTED GAP: accepted although min is 5 (DIT #6512).');
add('SM-02', 'R1', 'SM', 'PasswordNeedsLetters', 'Digits-only password', 'NeedsLetters Y', 'Add user with 123456.', 'EXPECTED GAP: accepted.');
add('SM-03', 'R1', 'SM', 'PasswordNeedsNumbers', 'Letters-only password', 'NeedsNumbers Y', 'Add user with abcdef.', 'EXPECTED GAP: accepted.');
add('SM-04', 'R1', 'SM', '(validation)', 'Only the validations that exist', 'none', 'Blank password; password != confirm; AD tick.', '"Password is required" / "Password values do not match"; AD tick disables the password fields.');
add('SM-05', 'R1', 'SM', 'PasswordChangeDays / ChangeOnReset', 'Reset at next logon ticked vs unticked', 'two new MB users', 'Add both; log in as each on /ROBAR/.', 'Ticked -> EP at first login (PasswordSet 1900-01-01); unticked -> main menu directly even with a non-conforming password (the gap Mark Fredrikson described).');
add('SM-06', 'R1', 'SM', 'PasswordFailLockCount', 'Re-enable a locked user with the Active tick', 'locked MB user', 'Edit user: untick/tick Active; try to log in.', 'EXPECTED GAP: still "locked out" because FailCount is not cleared (needs PR Unlock).');
add('SM-07', 'R1', 'SM', '(edit)', 'Edit cannot set or reset a password', 'existing MB user', 'Open Edit.', 'Password / Confirm / Reset fields are hidden in edit mode.');
add('SM-08', 'R1', 'SM', 'PasswordDaysBeforeReuse', 'New user with a previously used password', 'n/a', 'Add a user reusing an old password.', 'No history check (a new user has none); noted for completeness.');
add('SM-09', 'R2', 'SM', 'PasswordMinLength / NeedsNumbers', 'Settings change has no effect on user add', 'R2 values', 'Repeat SM-01 with 1 char; letters-only.', 'Still accepted (the gap persists with every value).');
add('SM-10', 'R2', 'SM', 'PasswordChangeOnReset', 'ChangeOnReset N does not change the tick behavior', 'ChangeOnReset N', 'Repeat SM-05.', 'Same outcome.');
add('SM-11', 'R3', 'SM', 'PasswordFailLockCount', 'Lock count 1', 'lock 1', 'Lock a user with one wrong login; check the Security grid / PR.', 'User disabled after the first failure (Active unticked in Security Management).');

module.exports = { SURFACES, SETTINGS, MATRIX, ROUNDS, CASES };
