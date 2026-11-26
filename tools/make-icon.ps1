# Draws Beyond Steam's icon (a glowing core with two orbit arcs on a dark tile) into loader\beyondsteam.ico.
# Run: powershell -ExecutionPolicy Bypass -File tools\make-icon.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$sizes = 16, 20, 24, 32, 40, 48, 64, 256

function Draw($n) {
	$bmp = New-Object System.Drawing.Bitmap $n, $n
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.SmoothingMode = 'AntiAlias'
	$s = $n / 24.0
	# dark rounded tile
	$r = 5.5 * $s
	$path = New-Object System.Drawing.Drawing2D.GraphicsPath
	$w = $n - 1
	$path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90); $path.AddArc($w - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
	$path.AddArc($w - 2 * $r, $w - 2 * $r, 2 * $r, 2 * $r, 0, 90); $path.AddArc(0, $w - 2 * $r, 2 * $r, 2 * $r, 90, 90); $path.CloseFigure()
	$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.PointF]::new(0, 0)), ([System.Drawing.PointF]::new($n, $n)), ([System.Drawing.Color]::FromArgb(255, 24, 30, 44)), ([System.Drawing.Color]::FromArgb(255, 10, 12, 18))
	$g.FillPath($bg, $path)
	# orbit arcs: teal in front, violet behind
	$teal = [System.Drawing.Color]::FromArgb(255, 111, 227, 210)
	$violet = [System.Drawing.Color]::FromArgb(255, 141, 125, 255)
	$pen = New-Object System.Drawing.Pen $violet, ([Math]::Max(1.2, 1.9 * $s))
	$pen.StartCap = 'Round'; $pen.EndCap = 'Round'
	$state = $g.Save()
	$g.TranslateTransform(12 * $s, 12 * $s); $g.RotateTransform(-28)
	$g.DrawArc($pen, -10.2 * $s, -3.5 * $s, 20.4 * $s, 7 * $s, 180, 180)
	$g.Restore($state)
	# glowing core
	if ($n -ge 32) {
		$glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 111, 227, 210))
		$g.FillEllipse($glow, 6.6 * $s, 6.6 * $s, 10.8 * $s, 10.8 * $s)
	}
	$core = New-Object System.Drawing.SolidBrush $teal
	$g.FillEllipse($core, 8.4 * $s, 8.4 * $s, 7.2 * $s, 7.2 * $s)
	$state = $g.Save(); $g.TranslateTransform(12 * $s, 12 * $s); $g.RotateTransform(-28)
	$pen.Color = $teal
	$g.DrawArc($pen, -10.2 * $s, -3.5 * $s, 20.4 * $s, 7 * $s, 0, 180)
	$g.Restore($state)
	$g.Dispose()
	$ms = New-Object System.IO.MemoryStream
	$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
	$bmp.Dispose()
	, $ms.ToArray()
}

$pngs = foreach ($n in $sizes) { , (Draw $n) }
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $out
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
	$n = $sizes[$i]; $d = $pngs[$i]
	$bw.Write([byte]($(if ($n -ge 256) { 0 } else { $n }))); $bw.Write([byte]($(if ($n -ge 256) { 0 } else { $n })))
	$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32)
	$bw.Write([UInt32]$d.Length); $bw.Write([UInt32]$offset); $offset += $d.Length
}
foreach ($d in $pngs) { $bw.Write($d) }
[System.IO.File]::WriteAllBytes((Join-Path $root 'loader\beyondsteam.ico'), $out.ToArray())
[System.IO.File]::WriteAllBytes((Join-Path $root 'loader\icon-preview.png'), $pngs[-1])
"icon written"
