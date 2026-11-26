# Builds catalog\catalog.json and catalog\previews\*.jpg: what the "Get more" tab offers.
# Themes: every installed theme whose skin.json "github" block names OriginalSwayze (published repos only), plus the
# Playbox theme. Redesigns: Playbox. Run: powershell -ExecutionPolicy Bypass -File tools\make-catalog.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'catalog'
$prev = Join-Path $out 'previews'
New-Item -ItemType Directory -Force $prev | Out-Null
$owner = 'OriginalSwayze'
$steamThemes = 'C:\Program Files (x86)\Steam\millennium\themes'

# A 480px-wide still JPEG from the first frame of a theme's own header picture.
function Save-Thumb($src, $dst) {
	$img = [System.Drawing.Image]::FromFile($src)
	try {
		$w = 480; $h = [int]($img.Height * $w / $img.Width)
		$bmp = New-Object System.Drawing.Bitmap $w, $h
		$g = [System.Drawing.Graphics]::FromImage($bmp)
		$g.InterpolationMode = 'HighQualityBicubic'
		$g.DrawImage($img, 0, 0, $w, $h)
		$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
		$p = New-Object System.Drawing.Imaging.EncoderParameters 1
		$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 80L
		$bmp.Save($dst, $codec, $p)
		$g.Dispose(); $bmp.Dispose()
	} finally { $img.Dispose() }
}

function Add-Theme($dir, $id) {
	$j = Get-Content (Join-Path $dir 'skin.json') -Raw | ConvertFrom-Json
	if (-not $j.github -or $j.github.owner -ne $owner) { return $null }
	$thumb = $null
	if ($j.header_image -match '^https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/(.+)$') {
		$local = Join-Path $dir ($Matches[1] -replace '/', '\')
		if (Test-Path $local) { Save-Thumb $local (Join-Path $prev "$id.jpg"); $thumb = "previews/$id.jpg" }
	}
	[ordered]@{
		id = $id; kind = 'theme'; name = $j.name; author = $j.author; description = $j.description; version = "$($j.version)"
		repo = "$owner/$($j.github.repo_name)"; branch = 'main'; preview = $thumb
	}
}

$items = @()
foreach ($d in Get-ChildItem $steamThemes -Directory) {
	if (-not (Test-Path (Join-Path $d.FullName 'skin.json'))) { continue }
	$t = Add-Theme $d.FullName $d.Name
	if ($t) { $items += $t }
}
# The Playbox theme installs as "Kestrel", the folder name the Playbox redesign asks for.
$items += Add-Theme 'C:\Users\fgvew\OneDrive\Desktop\Playbox-Theme' 'Kestrel'

$pb = Get-Content 'C:\Users\fgvew\OneDrive\Desktop\Kestrel\millennium.toml' -Raw
$ver = [regex]::Match($pb, '(?m)^version\s*=\s*"(.*)"').Groups[1].Value
Copy-Item 'C:\Users\fgvew\OneDrive\Desktop\Playbox-Theme\media\header.png' (Join-Path $prev 'playbox.png') -Force
$items += [ordered]@{
	id = 'com.originalswayze.kestrel'; kind = 'redesign'; name = 'Playbox'; author = $owner; version = $ver
	description = '163 complete interfaces for Steam in one box: game launchers, game-menu worlds and more, switchable from a button in every top strip.'
	zip = 'https://github.com/OriginalSwayze/Playbox/releases/latest/download/Playbox-BeyondSteam.zip'; theme = 'Kestrel'; preview = 'previews/playbox.png'
}

$catalog = [ordered]@{ version = 1; updated = (Get-Date -Format 'yyyy-MM-dd'); items = $items }
$catalog | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $out 'catalog.json') -Encoding utf8
"$($items.Count) items written to $out"
