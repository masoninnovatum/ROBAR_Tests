<#
 Draws one freehand stroke with the pen (Draw Freehand) tool of ONE Acrobat Reader window and saves with Ctrl+S: the manual edit the QA team does on a PDF opened through Link Management > Edit.
 Scoped by process id (never by title); brings only that window to the front. Window-relative positions come from a screenshot of the Reader window (1912 px wide: pen icon at 317,291; page area x 348-1868, y 212-942).
 Usage: powershell -File acrobat-pen-edit.ps1 -ProcessId <pid> [-Scale <window width / screenshot width>] [-NoSave]
#>
param([Parameter(Mandatory = $true)][int]$ProcessId, [double]$Scale = 0, [switch]$NoSave, [string]$ClickOnly = '')
Add-Type -AssemblyName System.Windows.Forms
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
Click 317 291                      # Draw Freehand (pen)
$s = Pt 600 560
[AcroInput]::SetCursorPos($s[0], $s[1]) | Out-Null; Start-Sleep -Milliseconds 300
[AcroInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
foreach ($i in 1..20) { $a = Pt (600 + $i * 12) (560 + [Math]::Sin($i / 3.0) * 40); [AcroInput]::SetCursorPos($a[0], $a[1]) | Out-Null; Start-Sleep -Milliseconds 40 }
[AcroInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 800
"stroke drawn"
# Save = the disk icon in the top toolbar (1563,55): Ctrl+S in this Reader build opens the "Save as" dialog instead of saving in place
if (-not $NoSave) { Click 1563 55; Start-Sleep -Milliseconds 2500; "saved (Save icon)" }
