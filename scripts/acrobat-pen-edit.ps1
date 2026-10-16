<#
 Draws one freehand stroke with the pen (Draw Freehand) tool of ONE Acrobat Reader window and saves it with Menu > Save: the manual edit the QA team does on a PDF opened through Link Management > Edit.
 Scoped by process id (never by title); only that process's largest visible window is brought to the front and clicked. Window-relative positions come from a screenshot of the Reader window
 (1912 px wide): Menu at 35,15; Menu > Save at 36,163; Menu > Exit application at 65,730; the page area is x 348-1868.
 The tool strip moves up/down with Acrobat's banner ("Save time with a document summary..." shown or dismissed), so the PEN POSITION IS FOUND, not assumed: the 4th icon of the left tool strip is located
 by scanning that strip's pixels (clusters of dark / blue pixels). Never click the toolbar Save icon by position (right-anchored): Menu > Save is left-anchored and does not move.
 Usage: powershell -File acrobat-pen-edit.ps1 -ProcessId <pid> [-Scale <window width / screenshot width>] [-NoSave] [-ClickOnly "x,y;x,y"]
#>
param([Parameter(Mandatory = $true)][int]$ProcessId, [double]$Scale = 0, [switch]$NoSave, [string]$ClickOnly = '')
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class AcroInput {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public static IntPtr Largest(uint pid) { IntPtr best = IntPtr.Zero; long area = 0; EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { RECT r; GetWindowRect(h, out r); long a = (long)(r.R - r.L) * (r.B - r.T); if (a > area) { area = a; best = h; } } return true; }, IntPtr.Zero); return best; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
}
'@
$p = Get-Process -Id $ProcessId
$h = [AcroInput]::Largest([uint32]$ProcessId)   # the biggest visible top-level window of THIS process (MainWindowHandle can point at a small helper window)
if ($h -eq [IntPtr]::Zero) { throw "process $ProcessId has no visible window" }
[AcroInput]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 800
$r = New-Object AcroInput+RECT
[AcroInput]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L
if ($w -lt 800 -or ($r.B - $r.T) -lt 500) { throw "refusing to click: the window of process $ProcessId is only $w x $($r.B - $r.T) (expected the full Acrobat window)" }
if ($Scale -le 0) { $Scale = $w / 1912.0 }
"window $($r.L),$($r.T) size $w x $($r.B - $r.T) scale $Scale"
function Pt([double]$x, [double]$y) { [int]($r.L + $x * $Scale), [int]($r.T + $y * $Scale) }
function Click([double]$x, [double]$y) { $a = Pt $x $y; [AcroInput]::SetCursorPos($a[0], $a[1]) | Out-Null; Start-Sleep -Milliseconds 300; [AcroInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [AcroInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 600 }
if ($ClickOnly) { foreach ($c in $ClickOnly.Split(';')) { $xy = $c.Split(','); Click ([double]$xy[0]) ([double]$xy[1]); "clicked $c" }; return }

# find the pen: 4th icon of the left tool strip (select, comment, highlight, PEN, text, sign) by scanning the strip's pixels for clusters of dark or blue (selected) pixels
$x0 = [int]($r.L + 300 * $Scale); $x1 = [int]($r.L + 334 * $Scale); $y0 = [int]($r.T + 100 * $Scale); $y1 = [int]($r.T + 620 * $Scale)
$bmp = New-Object System.Drawing.Bitmap ($x1 - $x0), ($y1 - $y0)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x0, $y0, 0, 0, $bmp.Size)
$g.Dispose()
$clusters = @(); $start = -1; $gap = 0
$bandL = [int](8 * $Scale); $bandR = [int](27 * $Scale)
for ($y = 0; $y -lt $bmp.Height; $y++) {
  $ink = $false
  for ($x = $bandL; $x -lt $bandR; $x++) {
    $c = $bmp.GetPixel($x, $y)
    if (([Math]::Min($c.R, [Math]::Min($c.G, $c.B)) -lt 140) -or (($c.B - $c.R) -gt 110)) { $ink = $true; break }
  }
  if ($ink) { if ($start -lt 0) { $start = $y }; $gap = 0 }
  elseif ($start -ge 0) { $gap++; if ($gap -gt 3) { $end = $y - $gap; $clusters += , @($start, $end); $start = -1; $gap = 0 } }
}
if ($start -ge 0) { $end = $bmp.Height - 1; $clusters += , @($start, $end) }
$bmp.Dispose()
$icons = @($clusters | Where-Object { ($_[1] - $_[0]) -ge 9 })
"tool strip clusters (height >= 10): " + (($icons | ForEach-Object { "$($_[0])-$($_[1])" }) -join ', ')
if ($icons.Count -lt 5) { throw "could not find the tool strip icons (found $($icons.Count)); is the PDF page open and the window in front?" }
$penY = $y0 + [int](($icons[3][0] + $icons[3][1]) / 2)
$penX = [int]($r.L + 317 * $Scale)
"pen icon at screen $penX,$penY"
[AcroInput]::SetCursorPos($penX, $penY) | Out-Null; Start-Sleep -Milliseconds 300
[AcroInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [AcroInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 700

$s = Pt 600 560
[AcroInput]::SetCursorPos($s[0], $s[1]) | Out-Null; Start-Sleep -Milliseconds 300
[AcroInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
foreach ($i in 1..20) { $a = Pt (600 + $i * 12) (560 + [Math]::Sin($i / 3.0) * 40); [AcroInput]::SetCursorPos($a[0], $a[1]) | Out-Null; Start-Sleep -Milliseconds 40 }
[AcroInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 800
"stroke drawn"
# Save = Menu > Save (never Save As); the toolbar Save icon is right-anchored and Ctrl+S opens "Save as" in this Reader build
if (-not $NoSave) { Click 35 15; Click 36 163; Start-Sleep -Milliseconds 2500; "saved (Menu > Save)" }
