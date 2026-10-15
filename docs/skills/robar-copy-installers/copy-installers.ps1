<#
.SYNOPSIS
  Copies ROBAR / Suite 7 installers from the build machine to the QA share, one new folder per build.

.DESCRIPTION
  Source : \\vmsrvbuildmachine\exe\<Version>\Installers   (top level + Modules\<group>\ sub folders)
  Target : \\vmsrvbuildmachine\dataqa\InstallersInQA\<Version>\<Version>.<Build>\   (created when missing)
  An installer is requested by a fragment of its name ("DynamicUI", "SecurityManagement", "RobarServer", "SentinelClient", "Web Help" ...).
  The build is read from the installer file name (DynamicUISetup_7.0.3.20291.exe -> 20291) unless -Build is given.
  NEVER overwrites or deletes anything: an identical file already in the target is skipped, a different file with the same name stops the script.
  Each copied file is verified by size (-Hash adds SHA256). -DryRun shows the plan and copies nothing. -List shows what the source holds.

.EXAMPLE
  .\copy-installers.ps1 -Installer DynamicUI -DryRun
  .\copy-installers.ps1 -Installer DynamicUI,SecurityManagement
  .\copy-installers.ps1 -Installer RobarServer,SentinelClient,SentinelServer -Build 20291
  .\copy-installers.ps1 -List
#>
param(
  [string]$Version = '7.0.3',
  [string[]]$Installer,
  [string]$Build,
  [switch]$DryRun,
  [switch]$List,
  [switch]$Hash,
  [string]$FolderSuffix = '',
  [string]$ReadMe = '',
  [string]$SourceRoot = '\\vmsrvbuildmachine\exe',
  [string]$DestRoot = '\\vmsrvbuildmachine\dataqa\InstallersInQA'
)

$ErrorActionPreference = 'Stop'
$src = Join-Path (Join-Path $SourceRoot $Version) 'Installers'
$dstVersion = Join-Path $DestRoot $Version
if (-not (Test-Path $src)) { Write-Host "ERROR: source folder not reachable: $src"; exit 2 }
if (-not (Test-Path $dstVersion)) { Write-Host "ERROR: target version folder not reachable: $dstVersion"; exit 2 }

function Normalize([string]$s) { ($s.ToLower() -replace '[\s_\-]', '' -replace 'setup$', '') }

# every installer in the source: name, normalized key, build, path
$pattern = '^(?<base>.+?)_(?<ver>\d+\.\d+\.\d+)\.(?<build>\d+)\.exe$'
$all = foreach ($f in (Get-ChildItem $src -Recurse -File -Filter '*.exe')) {
  if ($f.Name -match $pattern) {
    [pscustomobject]@{ Name = $f.Name; Key = (Normalize $Matches.base); Base = $Matches.base; Ver = $Matches.ver; Build = [int]$Matches.build; Path = $f.FullName; Length = $f.Length; Modified = $f.LastWriteTime }
  }
}
$all = @($all | Where-Object { $_.Ver -eq $Version })

if ($List -or -not $Installer) {
  Write-Host "Installers in $src (version $Version):"
  $all | Sort-Object Key, Build | ForEach-Object { '{0,-52} build {1}  {2,12:N0} bytes  {3}' -f $_.Name, $_.Build, $_.Length, $_.Modified }
  $builds = $all | Group-Object Build | Sort-Object { [int]$_.Name } -Descending | Select-Object -First 3
  Write-Host ("Newest builds present: " + (($builds | ForEach-Object { "$($_.Name) ($($_.Count) files)" }) -join ', '))
  if (-not $Installer) { exit 0 }
}

# resolve each request to exactly one installer (one distinct name), newest build unless -Build is given
$chosen = @()
foreach ($req in $Installer) {
  $k = Normalize $req
  $pool = @($all)
  if ($Build) { $pool = @($pool | Where-Object { "$($_.Build)" -eq $Build }) }
  $exact = @($pool | Where-Object { $_.Key -eq $k })
  $hits = if ($exact.Count) { $exact } else { @($pool | Where-Object { $_.Key -like "*$k*" }) }
  $names = @($hits | Select-Object -ExpandProperty Key -Unique)
  if ($names.Count -eq 0) { Write-Host "ERROR: no installer matches '$req'$(if ($Build) { " for build $Build" }). Run with -List to see what the source holds."; exit 3 }
  if ($names.Count -gt 1) { Write-Host "ERROR: '$req' is ambiguous. It matches: $(($hits | Select-Object -ExpandProperty Base -Unique) -join ', '). Ask for one of these names."; exit 3 }
  $newest = $hits | Sort-Object Build -Descending | Select-Object -First 1
  $chosen += $newest
}

$buildsChosen = @($chosen | Select-Object -ExpandProperty Build -Unique)
if ($buildsChosen.Count -gt 1) {
  Write-Host "ERROR: the requested installers are from different builds ($($buildsChosen -join ', ')). Pass -Build <number> to choose one."
  $chosen | ForEach-Object { Write-Host "  $($_.Name) -> build $($_.Build)" }
  exit 4
}
$newestInSource = ($all | Measure-Object Build -Maximum).Maximum
$targetBuild = $buildsChosen[0]
if ($targetBuild -lt $newestInSource) { Write-Host "NOTE: build $targetBuild is older than the newest build in the source ($newestInSource)." }

$folderName = "$Version.$targetBuild$(if ($FolderSuffix) { " $FolderSuffix" })"
$dst = Join-Path $dstVersion $folderName
Write-Host "Plan: copy $($chosen.Count) installer(s) of build $targetBuild"
Write-Host "  from $src"
Write-Host "  to   $dst$(if (Test-Path $dst) { '  (folder exists)' } else { '  (new folder)' })"
foreach ($c in $chosen) { Write-Host ('  - {0}  ({1:N0} bytes)' -f $c.Name, $c.Length) }
if ($DryRun) { Write-Host 'Dry run: nothing was copied.'; exit 0 }

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null; Write-Host "Created folder $folderName" }
$problems = 0
foreach ($c in $chosen) {
  $target = Join-Path $dst $c.Name
  if (Test-Path $target) {
    $existing = Get-Item $target
    if ($existing.Length -eq $c.Length) { Write-Host "SKIPPED (already there, same size): $($c.Name)"; continue }
    Write-Host "STOPPED: $($c.Name) already exists in the target with a DIFFERENT size ($($existing.Length) vs $($c.Length)); not overwritten."; $problems++; continue
  }
  Copy-Item -LiteralPath $c.Path -Destination $target
  $copied = Get-Item $target
  $ok = ($copied.Length -eq $c.Length)
  if ($ok -and $Hash) { $ok = ((Get-FileHash $c.Path -Algorithm SHA256).Hash -eq (Get-FileHash $target -Algorithm SHA256).Hash) }
  if ($ok) { Write-Host ('COPIED and verified: {0}  ({1:N0} bytes{2})' -f $c.Name, $copied.Length, $(if ($Hash) { ', SHA256 match' } else { '' })) }
  else { Write-Host "FAILED verification: $($c.Name) (size or hash differs after the copy)"; $problems++ }
}
if ($ReadMe) {
  $rm = Join-Path $dst 'ReadMe.txt'
  if (Test-Path $rm) { Write-Host 'ReadMe.txt already exists: left unchanged.' } else { Set-Content -Path $rm -Value $ReadMe -Encoding ASCII; Write-Host 'Wrote ReadMe.txt' }
}
Write-Host "Done: $dst"
if ($problems) { exit 5 }
