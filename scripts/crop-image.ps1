# Crops a desktop screenshot (from screenshot-desktop.ps1, whole virtual desktop) to a screen rectangle, e.g. one browser window, so UAT evidence never contains other windows.
param([string]$Path, [int]$X, [int]$Y, [int]$W, [int]$H)
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
$src = [System.Drawing.Image]::FromFile($Path)
$rx = [Math]::Max(0, $X - $vs.Left); $ry = [Math]::Max(0, $Y - $vs.Top)
$rw = [Math]::Min($W, $src.Width - $rx); $rh = [Math]::Min($H, $src.Height - $ry)
$bmp = New-Object System.Drawing.Bitmap $rw, $rh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $rw, $rh), (New-Object System.Drawing.Rectangle $rx, $ry, $rw, $rh), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose(); $src.Dispose()
$tmp = "$Path.crop.png"
$bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Move-Item -Force $tmp $Path
