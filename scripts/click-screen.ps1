<#
 Left-clicks at one SCREEN position, but only if the window under that point belongs to the given process (WindowFromPoint -> owner process id): a real mouse click for controls that UI Automation cannot
 click (for example the tab strip of BarTender's Text Properties dialog). Usage: powershell -File click-screen.ps1 -ProcessId <pid> -X <screenX> -Y <screenY>
#>
param([Parameter(Mandatory = $true)][int]$ProcessId, [Parameter(Mandatory = $true)][int]$X, [Parameter(Mandatory = $true)][int]$Y)
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class ScrClick {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
}
'@
$pt = New-Object ScrClick+POINT; $pt.X = $X; $pt.Y = $Y
$h = [ScrClick]::WindowFromPoint($pt)
[uint32]$owner = 0; [ScrClick]::GetWindowThreadProcessId($h, [ref]$owner) | Out-Null
if ($owner -ne $ProcessId) { throw "refusing to click ${X},${Y}: the window there belongs to process ${owner}, not ${ProcessId}" }
[ScrClick]::SetCursorPos($X, $Y) | Out-Null; Start-Sleep -Milliseconds 300
[ScrClick]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [ScrClick]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 700
"clicked ${X},${Y} (process ${owner})"
