<#
.SYNOPSIS
  Step 2: copies installers from InstallersInQA to a QA server's installer folder (through the server's c$ admin share, no logon needed).

.DESCRIPTION
  Source : \\vmsrvbuildmachine\dataqa\InstallersInQA\<Version>\<Version>.<Build>\   (the folder step 1, copy-installers.ps1, created)
  Target : TST703 -> \\vmsrvtst703\c$\QAInstallers      VAL703 -> \\vmsrvval703\c$\QAInstallers   (flat folder, no per-build sub folder)
  -Installer picks installers by name fragment (as in copy-installers.ps1); without it ALL .exe files of the newest build folder are copied.
  NEVER deletes or overwrites: old installers in the target stay; an identical file is skipped; a different file with the same name stops the script.
  Checks free space on the server first, verifies each copy by size (-Hash adds SHA256). -DryRun shows the plan and copies nothing.
  To add a server (for example TST704), add a line to $Servers below.

.EXAMPLE
  .\deploy-installers-to-server.ps1 -Server TST703 -Installer DynamicUI -DryRun
  .\deploy-installers-to-server.ps1 -Server TST703 -Installer DynamicUI
  .\deploy-installers-to-server.ps1 -Server VAL703                       # everything in the newest build folder
  .\deploy-installers-to-server.ps1 -Server TST703 -Build 20291 -Installer DynamicUI,SecurityManagement
#>
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$Version = '7.0.3',
  [string[]]$Installer,
  [string]$Build,
  [switch]$DryRun,
  [switch]$Hash,
  [string]$SourceRoot = '\\vmsrvbuildmachine\dataqa\InstallersInQA'
)

$ErrorActionPreference = 'Stop'
# server table: name -> host, target folder as seen through the admin share
$Servers = @{
  'tst703' = @{ Host = 'vmsrvtst703'; Target = '\\vmsrvtst703\c$\QAInstallers'; Label = 'TST703' }
  'val703' = @{ Host = 'vmsrvval703'; Target = '\\vmsrvval703\c$\QAInstallers'; Label = 'VAL703' }
}
$key = ($Server.ToLower() -replace '^vmsrv', '')
if (-not $Servers.ContainsKey($key)) { Write-Host "ERROR: unknown server '$Server'. Known: $(($Servers.Values | ForEach-Object { $_.Label }) -join ', '). Add others in the `$Servers table of this script."; exit 3 }
$srv = $Servers[$key]

$srcVersion = Join-Path $SourceRoot $Version
if (-not (Test-Path $srcVersion)) { Write-Host "ERROR: source not reachable: $srcVersion"; exit 2 }
if (-not (Test-Path $srv.Target)) { Write-Host "ERROR: target folder not reachable: $($srv.Target) (server down, no access to the admin share, or the folder is missing). Nothing was copied."; exit 2 }

function Normalize([string]$s) { ($s.ToLower() -replace '[\s_\-]', '' -replace 'setup$', '' -replace '\.exe$', '') }
$pattern = '^(?<base>.+?)_(?<ver>\d+\.\d+\.\d+)\.(?<build>\d+)\.exe$'

# candidate build folders: 7.0.3.<n>  (a folder with a suffix, like "7.0.3.20123 ADUserProvisioning", counts for its number)
$folders = @(Get-ChildItem $srcVersion -Directory | Where-Object { $_.Name -match "^$([regex]::Escape($Version))\.(?<b>\d+)" } |
  ForEach-Object { [pscustomobject]@{ Path = $_.FullName; Build = [int]($_.Name -replace "^$([regex]::Escape($Version))\.(\d+).*", '$1'); Name = $_.Name } } | Sort-Object Build -Descending)
if ($Build) { $folders = @($folders | Where-Object { "$($_.Build)" -eq $Build }) }
# without -Build only the NEWEST build folder is used: an installer missing from it is an error, never silently taken from an older build
else { $folders = @($folders | Select-Object -First 1) }
if (-not $folders.Count) { Write-Host "ERROR: no build folder$(if ($Build) { " for build $Build" }) in $srcVersion."; exit 3 }

$chosen = @()
if ($Installer) {
  foreach ($req in $Installer) {
    $k = Normalize $req
    $found = $null
    foreach ($fo in $folders) {  # newest build folder first
      $files = @(Get-ChildItem $fo.Path -File -Filter '*.exe' | Where-Object { $_.Name -match $pattern } | ForEach-Object { [pscustomobject]@{ File = $_; Key = (Normalize ($_.Name -replace '_\d+\.\d+\.\d+\.\d+\.exe$', '')); Build = $fo.Build; Folder = $fo.Name } })
      $exact = @($files | Where-Object { $_.Key -eq $k })
      $hits = @(if ($exact.Count) { $exact } else { $files | Where-Object { $_.Key -like "*$k*" } })
      if ($hits.Count -gt 1) { Write-Host "ERROR: '$req' is ambiguous in $($fo.Name): $(($hits | ForEach-Object { $_.File.Name }) -join ', ')"; exit 3 }
      if ($hits.Count -eq 1) { $found = $hits[0]; break }
    }
    if (-not $found) { Write-Host "ERROR: no installer matching '$req' in the InstallersInQA build folder $($folders[0].Name)$(if (-not $Build) { ' (the newest; pass -Build <number> for an older one)' }). Run step 1 first (copy-installers.ps1)."; exit 3 }
    $chosen += $found
  }
} else {
  $fo = $folders[0]
  $chosen = @(Get-ChildItem $fo.Path -File -Filter '*.exe' | ForEach-Object { [pscustomobject]@{ File = $_; Build = $fo.Build; Folder = $fo.Name } })
  if (-not $chosen.Count) { Write-Host "ERROR: no .exe files in $($fo.Path)."; exit 3 }
}

$builds = @($chosen | Select-Object -ExpandProperty Build -Unique)
if ($builds.Count -gt 1) {
  Write-Host "ERROR: the installers come from different InstallersInQA build folders ($($builds -join ', ')). Pass -Build <number> to choose one."
  $chosen | ForEach-Object { Write-Host "  $($_.File.Name) -> $($_.Folder)" }
  exit 4
}

$totalBytes = ($chosen | ForEach-Object { $_.File.Length } | Measure-Object -Sum).Sum
$free = $null
try { $free = (Get-CimInstance -ClassName Win32_LogicalDisk -ComputerName $srv.Host -Filter "DeviceID='C:'" -ErrorAction Stop).FreeSpace } catch { Write-Host "NOTE: could not read the free space of $($srv.Host) ($($_.Exception.Message)); copying without the space check." }

Write-Host "Plan: copy $($chosen.Count) installer(s) of build $($builds[0]) to $($srv.Label)"
Write-Host "  from $SourceRoot\$Version\$($chosen[0].Folder)"
Write-Host "  to   $($srv.Target)  (existing files stay; nothing is deleted or overwritten)"
foreach ($c in $chosen) { Write-Host ('  - {0}  ({1:N0} bytes)' -f $c.File.Name, $c.File.Length) }
if ($free -ne $null) { Write-Host ('  free space on {0} C: {1:N1} GB; this copy needs {2:N2} GB' -f $srv.Host, ($free / 1GB), ($totalBytes / 1GB)) }
if ($free -ne $null -and $free -lt ($totalBytes + 1GB)) { Write-Host "ERROR: not enough free space on $($srv.Host) (needs the copy plus 1 GB of margin). Nothing was copied."; exit 6 }
if ($DryRun) { Write-Host 'Dry run: nothing was copied.'; exit 0 }

$problems = 0
foreach ($c in $chosen) {
  $target = Join-Path $srv.Target $c.File.Name
  if (Test-Path $target) {
    $existing = Get-Item $target
    if ($existing.Length -eq $c.File.Length) { Write-Host "SKIPPED (already there, same size): $($c.File.Name)"; continue }
    Write-Host "STOPPED: $($c.File.Name) already exists on $($srv.Label) with a DIFFERENT size ($($existing.Length) vs $($c.File.Length)); not overwritten."; $problems++; continue
  }
  Copy-Item -LiteralPath $c.File.FullName -Destination $target
  $copied = Get-Item $target
  $ok = ($copied.Length -eq $c.File.Length)
  if ($ok -and $Hash) { $ok = ((Get-FileHash $c.File.FullName -Algorithm SHA256).Hash -eq (Get-FileHash $target -Algorithm SHA256).Hash) }
  if ($ok) { Write-Host ('COPIED and verified: {0}  ({1:N0} bytes{2})' -f $c.File.Name, $copied.Length, $(if ($Hash) { ', SHA256 match' } else { '' })) }
  else { Write-Host "FAILED verification: $($c.File.Name)"; $problems++ }
}
Write-Host "Done: $($srv.Target)  (on the server: C:\QAInstallers)"
if ($problems) { exit 5 }
