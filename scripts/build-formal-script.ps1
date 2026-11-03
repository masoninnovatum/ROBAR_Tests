# Builds one formal test script (.docx) from a JSON spec by cloning a real reference script (read-only) and rebuilding Table 1/2/3 (formal-test-script-creation skill, steps 6-6.6).
#   powershell -File scripts/build-formal-script.ps1 -SpecPath spec.json -SourcePath "<reference .doc>" -OutPath "C:\scratch\TM_X-1.0.docx"
# Spec: { docNumber, testCaseName, purpose, setup:[lines], requirements:"TM...., ...", acceptance, variables:[{alias,short,full}],
#         scenarios:[{ verify, substeps:[{ activity, expected:[lines], trivial:bool }] }] }
# Expected Result lines: 'A screenshot is attached.' becomes Attachment # + text field; every verb (is/are/does/has/will/shall) becomes a dropdown (see formfield_lib.ps1).
param([string]$SpecPath, [string]$SourcePath, [string]$OutPath)
$ErrorActionPreference = 'Stop'
$lib = 'C:\Users\Mason\.claude\skills\formal-test-script-creation\scripts'
. "$lib\formfield_lib.ps1"
. "$lib\formatting_lib.ps1"
# Override of the library's Actual Result line builder: text inside straight double quotes (an on-screen message) is copied literally, so a verb inside a quoted
# message is never turned into a dropdown; verbs outside quotes still become the ___/VERB/VERB NOT dropdown.
function Insert-ActualResultLine {
    param($doc, [int]$pos, [string]$line)
    if ($line -match '^A screenshot is attached\.?$') {
        $pos = Insert-Text $doc $pos 'Attachment # '
        return (Insert-TextField $doc $pos)
    }
    foreach ($part in [regex]::Split($line, '("[^"]*")')) {
        if ($part -match '^"[^"]*"$') { $pos = Insert-Text $doc $pos $part; continue }
        $cursor = 0
        foreach ($m in [regex]::Matches($part, $Global:VerbPattern, 'IgnoreCase')) {
            $pos = Insert-Text $doc $pos ($part.Substring($cursor, $m.Index - $cursor))
            $pos = Insert-DropdownField $doc $pos $Global:VerbDropdownEntries[$m.Value.ToLower()]
            $cursor = $m.Index + $m.Length
        }
        $pos = Insert-Text $doc $pos ($part.Substring($cursor))
    }
    return $pos
}
$spec = Get-Content $SpecPath -Raw -Encoding UTF8 | ConvertFrom-Json
$enDash = [string][char]0x2013

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($SourcePath, [ref]$false, [ref]$true)   # source stays read-only
  if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
  $doc.SaveAs2($OutPath, 16)                                          # now bound to the new .docx; every edit lands there

  # header: document number and test case name
  $hdr = $doc.Sections.Item(1).Headers.Item(1).Range
  $oldNum = ([regex]::Match($hdr.Text, 'Document Number:\s*(\S+)')).Groups[1].Value
  if ($oldNum) { $null = $hdr.Find.Execute($oldNum, $false, $false, $false, $false, $false, $true, 1, $false, $spec.docNumber, 2) }
  $hdr = $doc.Sections.Item(1).Headers.Item(1).Range
  $oldName = ([regex]::Match($hdr.Text, 'Test Case Name\s*([^\r\a]+)')).Groups[1].Value.Trim()
  if ($oldName) { $null = $hdr.Find.Execute($oldName, $false, $false, $false, $false, $false, $true, 1, $false, ($spec.testCaseName -replace '--', $enDash), 2) }

  # Table 1
  $t1 = $doc.Tables.Item(1)
  $t1.Cell(1, 2).Range.Text = [string]$spec.purpose
  $t1.Cell(2, 2).Range.Text = (@($spec.setup) -join "`r")
  $t1.Cell(3, 2).Range.Text = [string]$spec.requirements

  # Table 2 (user variables): Alias bold, Value = text field, Full Description left aligned
  $t2 = $doc.Tables.Item(2)
  while ($t2.Rows.Count -gt 1) { $t2.Rows.Item(2).Delete() }
  foreach ($v in $spec.variables) {
    $row = $t2.Rows.Add()
    $row.Cells.Item(1).Range.Text = [string]$v.alias
    $row.Cells.Item(2).Range.Text = ''
    $row.Cells.Item(3).Range.Text = [string]$v.short
    $row.Cells.Item(4).Range.Text = [string]$v.full
    Build-SingleTextFieldCell $doc $row.Cells.Item(2)
    Set-CellBold $row.Cells.Item(1) $true
    Set-CellBold $row.Cells.Item(3) $false
    Set-CellBold $row.Cells.Item(4) $false
    Set-CellLeftAligned $row.Cells.Item(4)
  }

  # Table 3: keep the two header rows, rebuild everything below
  $t3 = $doc.Tables.Item(3)
  while ($t3.Rows.Count -gt 2) { $t3.Rows.Item(3).Delete() }
  $scenarioRows = @(); $n = 0
  foreach ($sc in $spec.scenarios) {
    $n++
    $row = $t3.Rows.Add(); $scenarioRows += $t3.Rows.Count
    $row.Cells.Item(1).Range.Text = "$n."
    $row.Cells.Item(2).Range.Text = [string]$sc.verify
    $m = 0
    foreach ($ss in $sc.substeps) {
      $m++
      $r = $t3.Rows.Add()
      $r.Cells.Item(1).Range.Text = ''
      $r.Cells.Item(2).Range.Text = "$n.$m"
      $r.Cells.Item(3).Range.Text = [string]$ss.activity
      $r.Cells.Item(4).Range.Text = (@($ss.expected) -join "`r")
      $r.Cells.Item(5).Range.Text = ''; $r.Cells.Item(6).Range.Text = ''; $r.Cells.Item(7).Range.Text = ''
      foreach ($ci in 2..7) { $f = $r.Cells.Item($ci).Range.Font; $f.Name = 'Arial'; $f.Size = 10; $f.Bold = $false }
      Set-CellAutomaticShading $r.Cells.Item(5); Set-CellAutomaticShading $r.Cells.Item(6)
      Set-CellCentered $r.Cells.Item(2)
      if ($ss.trivial) {
        Set-CellGrayedOut $r.Cells.Item(5); Set-CellGrayedOut $r.Cells.Item(6)
      } else {
        Build-ActualResultCell $doc $r.Cells.Item(5) @($ss.expected)
        Build-PassFailCell $doc $r.Cells.Item(6)
        Set-CellCentered $r.Cells.Item(6)
      }
      Build-SingleTextFieldCell $doc $r.Cells.Item(7)
      Set-CellCentered $r.Cells.Item(7)
      foreach ($ci in 5, 7) { $r.Cells.Item($ci).Range.Font.Bold = $false }
    }
  }
  foreach ($idx in $scenarioRows) {
    $row = $t3.Rows.Item($idx)
    $mergeRange = $doc.Range($row.Cells.Item(2).Range.Start, $row.Cells.Item(7).Range.End)
    $mergeRange.Cells.Merge()
    $row = $t3.Rows.Item($idx)
    $row.Cells.Item(2).Range.Style = $doc.Styles.Item('h')
    Set-CellArialTenBold $row.Cells.Item(1); Set-CellArialTenBold $row.Cells.Item(2)
    Set-CellCentered $row.Cells.Item(1)
  }
  Bold-AliasOccurrences $doc $t3.Range @($spec.variables | ForEach-Object { $_.alias })
  foreach ($t in 1, 2, 3) { Set-RangeSixPtSpacing $doc.Tables.Item($t).Range }

  # Acceptance Criteria paragraph (body, outside the tables)
  foreach ($p in $doc.Paragraphs) {
    if ($p.Range.Text -like 'Acceptance Criteria:*') { $pr = $p.Range; $null = $pr.MoveEnd(1, -1); $pr.Text = 'Acceptance Criteria: ' + [string]$spec.acceptance; break }
  }

  # refresh fields incl. header/footer page numbers, save
  $doc.Repaginate(); $null = $doc.Fields.Update()
  foreach ($sec in $doc.Sections) { foreach ($h in $sec.Headers) { $null = $h.Range.Fields.Update() }; foreach ($f in $sec.Footers) { $null = $f.Range.Fields.Update() } }
  $doc.Save()
  "built $OutPath : pages $($doc.ComputeStatistics(2)), form fields $($doc.FormFields.Count), table3 rows $($doc.Tables.Item(3).Rows.Count)"
  $doc.Close([ref]$false)
}
finally { $word.Quit() }
