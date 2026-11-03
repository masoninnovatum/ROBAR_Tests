# Verification of a built formal script (.docx), following formal-test-script-creation skill step 7. Read-only.   powershell -File scripts/verify-formal-script.ps1 -Path "<file.docx>" [-StaleWords "word1,word2"]
param([string]$Path, [string]$StaleWords = '')
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false; $word.DisplayAlerts = 0
$issues = New-Object System.Collections.ArrayList
try {
  $doc = $word.Documents.Open($Path, [ref]$false, [ref]$true)
  $t3 = $doc.Tables.Item(3)
  $rows = $t3.Rows.Count
  $report = [ordered]@{ File = (Split-Path $Path -Leaf); Pages = $doc.ComputeStatistics(2); FormFieldsTotal = $doc.FormFields.Count; Table3Rows = $rows }
  # columns: the step table has uniform 7 columns on every non-merged row
  $bad = 0; $nonArial = 0; $attachBad = 0; $commentNotCentered = 0; $ddBad = 0; $shadeBad = 0; $boldSolid = 0; $checked = 0
  for ($r = 3; $r -le $rows; $r++) {
    $row = $t3.Rows.Item($r)
    if ($row.Cells.Count -eq 7) {
      $checked++
      foreach ($ci in 2..7) {
        $cell = $row.Cells.Item($ci); $txt = ($cell.Range.Text -replace "[\r\a\v\f]", '').Trim()
        if ($txt.Length -gt 0 -or $cell.Range.FormFields.Count -gt 0) {
          if ($cell.Range.Font.Name -ne 'Arial' -or $cell.Range.Font.Size -ne 10) { $nonArial++ }
        }
      }
      $ar = $row.Cells.Item(5); $pf = $row.Cells.Item(6); $cm = $row.Cells.Item(7)
      $trivial = ($pf.Range.FormFields.Count -eq 0)
      $isGray = ($pf.Shading.BackgroundPatternColor -eq 12566463)
      if ($trivial -ne $isGray) { $shadeBad++ }
      if ($cm.Range.FormFields.Count -ne 1) { $bad++ } elseif ($cm.Range.ParagraphFormat.Alignment -ne 1) { $commentNotCentered++ }
      foreach ($f in $ar.Range.FormFields) { if ($f.Type -eq 83) { $e = $f.DropDown.ListEntries; if ($e.Count -ne 3 -or $e.Item(1).Name -ne '___') { $ddBad++ } } }
      if ($ar.Range.Text -match 'Attachment #( +)') { if ($Matches[1].Length -ne 1) { $attachBad++ } }
      $arBold = $ar.Range.Font.Bold
      if ($arBold -eq -1) { $boldSolid++ }
    }
  }
  $t3cols = $t3.Rows.Item(2).Cells.Count
  $report.Table3HeaderCols = $t3cols
  $report.StepRowsChecked = $checked
  $report.NonArial10Cells = $nonArial
  $report.ShadingMismatch = $shadeBad
  $report.CommentFieldMissing = $bad
  $report.CommentNotCentered = $commentNotCentered
  $report.DropdownsNot3Entries = $ddBad
  $report.AttachmentSpaceWrong = $attachBad
  $report.ActualResultSolidBold = $boldSolid
  # "is not / are not / does not / has not" in Expected Result (outside quoted messages) - double negative guard
  $dbl = 0
  for ($r = 3; $r -le $rows; $r++) { $row = $t3.Rows.Item($r); if ($row.Cells.Count -eq 7) { $ex = ($row.Cells.Item(4).Range.Text -replace '"[^"]*"', ''); if ($ex -match '\b(is|are|does|has|will|shall) not\b') { $dbl++ } } }
  $report.DoubleNegativeExpected = $dbl
  # leftover words from the clone source
  $all = $doc.Content.Text; $stale = 0
  foreach ($w in ($StaleWords -split ',' | Where-Object { $_ })) { if ($all -match [regex]::Escape($w)) { $stale++ } }
  $report.StaleWordHits = $stale
  # per-table field counts
  $report.FieldsT2 = $doc.Tables.Item(2).Range.FormFields.Count; $report.FieldsT3 = $t3.Range.FormFields.Count; $report.FieldsT4 = $doc.Tables.Item(4).Range.FormFields.Count; $report.FieldsT5 = $doc.Tables.Item(5).Range.FormFields.Count
  # protection survives (then undone)
  try { $doc.Protect(2); $report.ProtectOK = $true; $doc.Unprotect() } catch { $report.ProtectOK = $false }
  $doc.Close([ref]$false)
  $report | ConvertTo-Json -Compress
}
finally { $word.Quit() }
