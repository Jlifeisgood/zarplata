# Draws the app icon (indigo square + banknote, same drawing as the Android icon) as PNG:
# android/web/icon-180/192/512.png for the web/PWA build and ios/.../AppIcon.appiconset/icon-1024.png (no alpha, as iOS requires).
# ASCII-only on purpose (Windows PowerShell 5.1). Usage: powershell -File tools\gen-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot

function Draw-Icon([int]$size, [string]$path, [System.Drawing.Imaging.PixelFormat]$format) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, $format
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#4F46E5'))
    $k = $size / 108.0
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (5 * $k)
    $pen.LineJoin = 'Round'; $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
    # rounded rectangle 31..77 x 40..68, radius 5
    $x = 31 * $k; $y = 40 * $k; $w = 46 * $k; $h = 28 * $k; $r = 5 * $k; $d = 2 * $r
    $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path2.AddArc($x, $y, $d, $d, 180, 90); $path2.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path2.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $path2.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path2.CloseFigure()
    $g.DrawPath($pen, $path2)
    $g.DrawEllipse($pen, (54 - 6) * $k, (54 - 6) * $k, 12 * $k, 12 * $k)
    foreach ($cx in 39, 69) { $g.FillEllipse([System.Drawing.Brushes]::White, ($cx - 2.5) * $k, (54 - 2.5) * $k, 5 * $k, 5 * $k) }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

foreach ($size in 180, 192, 512) {
    Draw-Icon $size (Join-Path $root "android\web\icon-$size.png") ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}
$ios = Join-Path $root 'ios\Zarplata\Assets.xcassets\AppIcon.appiconset'
New-Item -ItemType Directory -Force $ios | Out-Null
Draw-Icon 1024 (Join-Path $ios 'icon-1024.png') ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
