# Builds a filled copy of a project-level API UAT from the screenshots made by scripts/api-evidence-render.js.
#   powershell -NoProfile -File scripts\build-api-uat.ps1 -BaseDoc <UAT .doc, a FRESH COPY of the share file> -ScreenshotsDir <runs\API\Items_..\screenshots> -OutDoc <new .doc>
# Never touches the share: it copies BaseDoc to OutDoc and edits OutDoc. Rows are found by the printed Requirement# in column 1 (never by fixed offset).
# Result column = pictures only (old pictures are removed first). Pass/Fail comes from the automated test status in index.json: passed -> Pass, failed -> Fail (red comment),
# anything else (skipped / no evidence) -> Pass/Fail left blank with a red "not executed" comment. Performed By = "Automated run (...)", Reviewed By is cleared (a person signs that).
param(
  [Parameter(Mandatory = $true)][string]$BaseDoc,
  [Parameter(Mandatory = $true)][string]$ScreenshotsDir,
  [Parameter(Mandatory = $true)][string]$OutDoc,
  [string]$Performer = 'Automated run (Playwright API tests)',
  [string]$DateText = (Get-Date).ToString('dd-MMM-yyyy').ToUpper(),
  [string]$Environment = 'VMSRVTST703',
  [string]$VersionText = '7.0.3.XXXXX'
)
$ErrorActionPreference = 'Stop'
$index = Get-Content (Join-Path $ScreenshotsDir 'index.json') -Raw | ConvertFrom-Json
Copy-Item $BaseDoc $OutDoc -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$word.AutomationSecurity = 3
$log = New-Object System.Collections.Generic.List[string]
function Clean([string]$s) { return ($s -replace "[\r\a\v\f]", '').Trim() }
try {
  $doc = $word.Documents.Open($OutDoc, $false, $false, $false)
  if ($doc.Tables.Count -ne 7) { throw "expected 7 tables, found $($doc.Tables.Count)" }
  $t5 = $doc.Tables.Item(5)
  if ((Clean $t5.Cell(1, 1).Range.Text) -ne 'Requirement#') { throw "Table 5 is not the requirement table: $(Clean $t5.Cell(1,1).Range.Text)" }
  $log.Add("shapes before: $($doc.InlineShapes.Count); Table 5 rows: $($t5.Rows.Count)")

  # header blocks
  $c1 = $doc.Tables.Item(1).Cell(1, 1).Range
  $c1.Text = (Clean $c1.Text) -replace '7\.0\.3\.\d+', $VersionText
  $doc.Tables.Item(2).Cell(1, 1).Range.Text = $Environment
  $doc.Tables.Item(4).Cell(1, 1).Range.Text = $Performer
  $doc.Tables.Item(4).Cell(1, 2).Range.Text = $DateText
  $doc.Tables.Item(7).Cell(1, 1).Range.Text = ''
  $doc.Tables.Item(7).Cell(1, 2).Range.Text = ''

  $passed = 0; $failed = 0; $notRun = 0; $imgCount = 0
  for ($r = 2; $r -le $t5.Rows.Count; $r++) {
    $id = Clean $t5.Cell($r, 1).Range.Text
    $resultCell = $t5.Cell($r, 3)
    $resultCell.Range.Text = ''                       # removes the old pictures with the text
    $t5.Cell($r, 4).Range.Text = ''
    $prop = $index.PSObject.Properties[$id]
    if (-not $prop -or $prop.Value.files.Count -eq 0) {
      $resultCell.Range.Text = 'Not executed by the automated run (no evidence).'
      $resultCell.Range.Font.Color = 255
      $notRun++; $log.Add("$id : NO EVIDENCE"); continue
    }
    $entry = $prop.Value
    $maxW = [Math]::Min(420, $resultCell.Width - 12)
    $first = $true
    foreach ($rel in $entry.files) {
      $png = Join-Path $ScreenshotsDir ($rel -replace '/', '\')
      if (-not $first) {
        $pr = $doc.Range($resultCell.Range.End - 1, $resultCell.Range.End - 1)
        $pr.InsertParagraphAfter()
      }
      $ins = $doc.Range($resultCell.Range.End - 1, $resultCell.Range.End - 1)
      $shape = $doc.InlineShapes.AddPicture($png, $false, $true, $ins)
      $shape.LockAspectRatio = -1
      if ($shape.Width -gt $maxW) { $ratio = $maxW / $shape.Width; $shape.Width = $maxW; $shape.Height = $shape.Height * $ratio }
      $first = $false; $imgCount++
    }
    if ($entry.status -eq 'passed') { $t5.Cell($r, 4).Range.Text = 'Pass'; $passed++ }
    else { $t5.Cell($r, 4).Range.Text = 'Fail'; $failed++ }
    $log.Add("$id : $($entry.status) : $($entry.files.Count) image(s)")
  }
  $notRunIds = @()
  # conclusion (Table 6): factual; no environment name, no pass claim unless every row passed
  $total = $t5.Rows.Count - 1
  if ($failed -eq 0 -and $notRun -eq 0) { $doc.Tables.Item(6).Cell(1, 1).Range.Text = 'Test passed: All requirements have been met for project # 20260409-001 (Items API).' }
  else { $doc.Tables.Item(6).Cell(1, 1).Range.Text = "Automated run: $passed of $total requirements passed, $failed failed, $notRun not executed. Not a final result: see the rows without Pass." }
  $doc.Save()
  $log.Add("pictures added: $imgCount; passed $passed, failed $failed, not executed $notRun; shapes after: $($doc.InlineShapes.Count); pages: $($doc.ComputeStatistics(2))")
  $doc.Close($false)
}
finally { $word.Quit() }
$log | ForEach-Object { Write-Output $_ }
