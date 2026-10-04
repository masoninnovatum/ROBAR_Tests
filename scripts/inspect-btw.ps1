<#
.SYNOPSIS
  Lists the Data Source (sharename) bindings inside a BarTender .btw template file, without
  needing BarTender itself or any native UI automation.

.DESCRIPTION
  Reverse-engineered 2026-09-30 while preparing multi-sharename Template Management testing, then
  fixed the same day for a gap found in freshly-created templates. A .btw file is: a plain-text
  header (readable, includes an XML <Metadata> block) + an embedded PNG thumbnail + a
  zlib-deflate-compressed block holding the actual document, whose strings are UTF-16LE. This
  script finds and inflates that block, then scans it for Data Source bindings.

  **Two different internal layouts have been observed, and this script handles both:**
  - **Layout 1 ("mature"/converted files)** -- e.g. templates originally authored in an older
    BarTender version and carried forward, confirmed for `A1SuperTemplate_v0.btw` and its siblings
    in the shared template library, at least for their FIRST couple of bound objects: the literal
    UTF-16LE string `"Data Source"` (WITH a space) appears as a schema-level label, followed by a
    fixed 12-byte binary preamble, then the sharename itself as a plain null-terminated UTF-16LE
    string.
  - **Layout 2 (everything else)** -- covers freshly-created files (a template saved directly from
    a current BarTender build, independent of ROBAR) AND the LATER bound objects even in a
    "mature" file that Layout 1 itself only partially covers (confirmed: `A1SuperTemplate_v0.btw`
    has many more real bindings, e.g. `L_PrintEntity`/`md_brand`/`I_ShelfLife`, than the
    "Data Source"-label-only scan alone ever finds -- the label is apparently only spelled out in
    full for a file's first couple of objects). Text-anchoring on a label like `"DataSource"` or
    even the fuller `"DataSourceGeneral.DataSource"` compound path does NOT work reliably here --
    confirmed live that `"DataSource"` is itself a substring of the unrelated property name
    `"DataSourceGeneral"` (a property-browser breadcrumb, causing false matches), AND that part of
    this format's text is not even reliably decodable as flat little-endian UTF-16 in the first
    place (confirmed: a region a few bytes from a known-good match decoded byte-order-swapped).
    What IS reliable: a general-purpose length-prefixed string primitive used for EVERY string
    property in this format -- the byte sequence `FF FE FF <length-byte>` immediately followed by
    that many UTF-16LE characters. Layout 2 scans for every such string, keeps the ones matching a
    real object's own display name (`"Text N"`/`"Barcode N"` specifically -- NOT `"Box 1"`, an
    internal administrative pseudo-object confirmed to produce heavy noise if included), and takes
    the next NON-EMPTY such string after each as its bound value -- excluding candidates that are
    bare digits or leftover `"DataSource"`/`"Data Source"` label fragments (both confirmed to
    otherwise leak through as false "bindings"). Objects Layout 1 already resolved are skipped here
    to avoid a conflicting second (and typically wrong) entry for the same object.
  If a THIRD layout variant is ever found (e.g. a real difference for Barcode objects, or a
  different BarTender build), extend the relevant branch below rather than assuming one universal
  rule -- this format is not documented anywhere public and has already shown real structural
  variation between file generations. Also known (not a bug): a handful of fields, particularly in
  templates using the `prompt<Question={...}>` dynamic-token mechanism (see Dictionary Management
  in the module reference), report a literal `"Screen Data"` or `"Share Name"` instead of a real
  sharename -- this looks like a genuinely different binding TYPE (manually-entered/prompted at
  print time, not a database field), not tool noise.

.PARAMETER path
  Full path to the .btw file to inspect.

.EXAMPLE
  powershell -File scripts/inspect-btw.ps1 -path "C:\path\to\Template.btw"
#>
param([Parameter(Mandatory = $true)][string]$path)

$bytes = [System.IO.File]::ReadAllBytes($path)

function Try-InflateAt($bytes, $offset) {
    try {
        $raw = $bytes[$offset..($bytes.Length - 1)]
        $ms = New-Object System.IO.MemoryStream(, $raw)
        $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
        $out = New-Object System.IO.MemoryStream
        $ds.CopyTo($out)
        return $out.ToArray()
    }
    catch {
        return $null
    }
}

# Skip past the embedded PNG thumbnail first -- its own IDAT chunks are themselves zlib-compressed
# and can produce a false-positive "successful" inflate of meaningless PNG pixel data if scanning
# starts from byte 0. Find the LAST "IEND" (PNG end-of-image marker) and only scan for the real
# document's zlib stream after that point.
$lastIend = -1
for ($i = 0; $i -le $bytes.Length - 4; $i++) {
    if ($bytes[$i] -eq 0x49 -and $bytes[$i + 1] -eq 0x45 -and $bytes[$i + 2] -eq 0x4E -and $bytes[$i + 3] -eq 0x44) {
        $lastIend = $i
    }
}
$scanStart = if ($lastIend -ge 0) { $lastIend + 8 } else { 0 }

$zlibHeaders = @([byte[]](0x78, 0x9C), [byte[]](0x78, 0xDA), [byte[]](0x78, 0x01), [byte[]](0x78, 0x5E))
$found = $null
for ($i = $scanStart; $i -le $bytes.Length - 2 -and -not $found; $i++) {
    foreach ($h in $zlibHeaders) {
        if ($bytes[$i] -eq $h[0] -and $bytes[$i + 1] -eq $h[1]) {
            $candidate = Try-InflateAt $bytes ($i + 2)
            if ($candidate -and $candidate.Length -gt 1000) {
                $found = $candidate
                break
            }
        }
    }
}

if (-not $found) {
    Write-Host "No inflatable document stream found in $path -- format may differ from what this script expects."
    exit 1
}

$text = [System.Text.Encoding]::Unicode.GetString($found)

function Clean-Text($s) {
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $s.ToCharArray()) {
        if ([int][char]$c -ge 0x20 -and [int][char]$c -le 0x7e) { [void]$sb.Append($c) } else { [void]$sb.Append('.') }
    }
    return $sb.ToString()
}

# Reads every `FF FE FF <length-byte>` length-prefixed UTF-16LE string in the inflated buffer,
# starting the scan strictly after $afterCharIndex (a char index into $text). Returns a list of
# {CharIndex, Value} for each one found, including empty strings (length 0) -- callers filter those
# out themselves, since "the next NON-EMPTY one" is what the fresh-file layout actually needs.
function Find-LengthPrefixedStrings($bytes, $afterByteIndex, $maxCount = 20) {
    $results = @()
    $i = $afterByteIndex
    while ($i -le $bytes.Length - 4 -and $results.Count -lt $maxCount) {
        if ($bytes[$i] -eq 0xFF -and $bytes[$i + 1] -eq 0xFE -and $bytes[$i + 2] -eq 0xFF) {
            $len = $bytes[$i + 3]
            $strStart = $i + 4
            $strByteLen = $len * 2
            if ($len -eq 0) {
                $results += [PSCustomObject]@{ ByteIndex = $i; Value = '' }
                $i += 4
            }
            elseif ($strStart + $strByteLen -le $bytes.Length -and $len -le 200) {
                $strBytes = $bytes[$strStart..($strStart + $strByteLen - 1)]
                $val = [System.Text.Encoding]::Unicode.GetString($strBytes)
                # Only accept it if it looks like a real string (printable chars) -- guards against
                # a coincidental FF-FE-FF-<byte> false match inside unrelated binary data.
                $printable = $true
                foreach ($c in $val.ToCharArray()) { if ([int][char]$c -lt 0x20 -or [int][char]$c -gt 0x7e) { $printable = $false; break } }
                if ($printable) {
                    $results += [PSCustomObject]@{ ByteIndex = $i; Value = $val }
                    $i = $strStart + $strByteLen
                }
                else {
                    $i += 1
                }
            }
            else {
                $i += 1
            }
        }
        else {
            $i += 1
        }
    }
    return $results
}

$totalFound = 0
$resolvedObjects = @{} # tracks which object names Layout 1 already resolved, so Layout 2 doesn't
                        # re-process (and potentially mis-resolve) the same ones -- see Layout 2's
                        # own comment for why that matters.

# -- Layout 1: "Data Source" (with space) -- mature/converted files --
$idx = 0
while (($idx = $text.IndexOf('Data Source', $idx)) -ge 0) {
    $windowStart = [Math]::Max(0, $idx - 60)
    $labelWindow = (Clean-Text ($text.Substring($windowStart, $idx - $windowStart))).Trim('.', ' ')
    $labelMatches = [regex]::Matches($labelWindow, '[A-Za-z0-9 _\-]{2,40}')
    $label = if ($labelMatches.Count -gt 0) { $labelMatches[$labelMatches.Count - 1].Value.Trim() } else { '(unknown object)' }

    $stringStart = $idx + 11 + 6 # "Data Source" (11 chars) + the 6-UTF16-unit binary preamble
    $searchLimit = [Math]::Min($text.Length, $stringStart + 200)
    $nullPos = $text.IndexOf([char]0, $stringStart, $searchLimit - $stringStart)
    $sharename = if ($nullPos -gt $stringStart) { $text.Substring($stringStart, $nullPos - $stringStart) } else { $null }
    if ($sharename) {
        $totalFound++
        $resolvedObjects[$label] = $true
        Write-Host "  [$label] -> $sharename"
    }
    $idx += 11
}

# -- Layout 2: fresh files saved directly from a current BarTender build --
# Abandoned trying to anchor on a text label like "DataSource" or "DataSourceGeneral.DataSource" --
# confirmed live that part of this format's text is NOT reliably decodable as flat little-endian
# UTF-16 the way the rest of it is (a real quirk in the format itself, not a bug in this script: a
# direct .NET Unicode.GetString() of a region immediately preceding a known-good match like
# "Text 1" came back as garbled CJK-look-alike characters -- each one exactly the expected ASCII
# value times 256, i.e. genuinely byte-order-swapped for that stretch -- while "Text 1" and the
# actual sharename right next to it decoded perfectly normally). Text-based anchoring is therefore
# unreliable here. What IS reliable: the `FF FE FF <length-byte>` length-prefixed-string primitive
# itself, used consistently for EVERY string value in this format regardless of the byte-order
# quirk above (object names and sharenames both decode fine through it). So: scan the whole buffer
# for every such string, keep the ones that look like a real object's own display name (`"Text 4"`,
# `"Barcode 2"`, etc.), and take the very NEXT non-empty one after each as its bound sharename --
# confirmed live this pairing holds (exactly one empty placeholder string sits between an object's
# own name and its actual bound value, consistently).
# Only "Text N"/"Barcode N" are real content objects a user actually binds to a sharename in
# practice. "Box 1" (confirmed live: appears repeatedly with generic non-data properties like "Box
# Options"/"Background 1"/"Picture"/"Layer 1") is an internal administrative/UI pseudo-object, not
# real template content -- including it as an anchor produces heavy noise. Also reject a "next
# string" that's a bare digit (an unrelated boolean/flag property, not a sharename) or that itself
# is/contains "Data Source"/"DataSource" (a leftover property-LABEL fragment, not a value -- confirmed
# live this specifically mis-fires for the same early objects Layout 1 already resolves correctly,
# which is also why objects already in $resolvedObjects are skipped here entirely rather than
# risking a second, conflicting, wrong entry for the same object).
$allStrings = Find-LengthPrefixedStrings $found 0 100000
$objectNamePattern = '^(Text|Barcode) \d+$'
$seen = @{}
for ($k = 0; $k -lt $allStrings.Count; $k++) {
    if ($allStrings[$k].Value -match $objectNamePattern -and -not $resolvedObjects.ContainsKey($allStrings[$k].Value)) {
        $objectName = $allStrings[$k].Value
        $rest = $allStrings[($k + 1)..($allStrings.Count - 1)] | Where-Object { $_.Value -ne '' } | Select-Object -First 1
        if ($rest -and $rest.Value -notmatch $objectNamePattern -and $rest.Value -notmatch '^\d+$' -and $rest.Value -notmatch 'DataSource' -and $rest.Value -notmatch 'Data Source') {
            $key = "$objectName|$($rest.Value)"
            if (-not $seen.ContainsKey($key)) {
                $seen[$key] = $true
                $totalFound++
                Write-Host "  [$objectName] -> $($rest.Value)"
            }
        }
    }
}

Write-Host "Total Data Source bindings found: $totalFound"
