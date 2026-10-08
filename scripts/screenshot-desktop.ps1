param([string]$Path = "$PSScriptRoot\..\test-results\desktop.png")
# Saves a screenshot of the whole virtual desktop (used to look at native dialogs such as the Chrome "Open SentinelLauncher?" prompt that Playwright cannot see).
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save($Path)
