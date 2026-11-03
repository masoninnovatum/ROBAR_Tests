# READ-ONLY scan of Word documents: author, creation / last save date, total editing time (minutes), revisions, words, table rows, form fields. Documents are opened read-only, macros disabled, nothing is saved.
#   powershell -File scripts/scan-word-properties.ps1 -Folders "C:\a","C:\b" -Out "C:\out.csv"
param([string]$Folders, [string]$Out, [string]$PathMatch = "")
$FolderList = $Folders -split "[|]"   # a new variable: $Folders is typed [string] and would turn the array back into one string
$ErrorActionPreference = 'Continue'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
$w.AutomationSecurity = 3   # msoAutomationSecurityForceDisable
function Prop($props, $name) {
  try { $v = [System.__ComObject].InvokeMember('Item', [Reflection.BindingFlags]::GetProperty, $null, $props, @($name)); return [System.__ComObject].InvokeMember('Value', [Reflection.BindingFlags]::GetProperty, $null, $v, $null) } catch { return $null }
}
$files = foreach ($f in $FolderList) { Get-ChildItem $f -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.doc', '.docx' -and $_.Name -notlike '~$*' -and $_.Name -notmatch '-SS.docx$' -and (-not $PathMatch -or $_.FullName -match $PathMatch) } }
$rows = @(); $i = 0
foreach ($f in $files) {
  $i++
  $rec = [ordered]@{ Folder = Split-Path $f.DirectoryName -Leaf; Name = $f.Name; Ext = $f.Extension; FileCreated = $f.CreationTime.ToString('yyyy-MM-dd'); FileModified = $f.LastWriteTime.ToString('yyyy-MM-dd'); Author = ''; LastAuthor = ''; Path = $f.FullName; DocCreated = ''; LastSaved = ''; EditMinutes = ''; Revisions = ''; Words = ''; TableRows = ''; FormFields = ''; Error = '' }
  try {
    $d = $w.Documents.Open($f.FullName, $false, $true, $false)
    $props = $d.BuiltInDocumentProperties
    $rec.Author = Prop $props 'Author'
    $rec.LastAuthor = Prop $props 'Last author'
    $rec.DocCreated = (Prop $props 'Creation Date')
    $rec.LastSaved = (Prop $props 'Last Save Time')
    $rec.EditMinutes = Prop $props 'Total editing time'
    $rec.Revisions = Prop $props 'Revision number'
    $rec.Words = Prop $props 'Number of words'
    $n = 0; foreach ($t in $d.Tables) { $n += $t.Rows.Count }; $rec.TableRows = $n
    $rec.FormFields = $d.FormFields.Count
    $d.Close($false)
  } catch { $rec.Error = $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length)); try { $w.Documents | ForEach-Object { $_.Close($false) } } catch {} }
  $rows += [pscustomobject]$rec
  if ($i % 25 -eq 0) { Write-Host "$i / $($files.Count)"; $rows | Export-Csv -Path $Out -NoTypeInformation -Encoding UTF8 }
}
$rows | Export-Csv -Path $Out -NoTypeInformation -Encoding UTF8
$w.Quit()
Write-Host "done: $($rows.Count) documents -> $Out"
