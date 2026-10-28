# Draws the app icon (indigo square + banknote) as PNG for the iPhone/PWA build. ASCII-only on purpose (Windows PowerShell 5.1).
# Usage: powershell -File tools\gen-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path $PSScriptRoot) 'android\web'
foreach ($size in 180, 192, 512) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#4F46E5'))
    $k = $size / 108.0
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (5 * $k)
    $pen.LineJoin = 'Round'; $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
    # rounded rectangle 31..77 x 40..68, radius 5 (same drawing as the Android icon)
    $x = 31 * $k; $y = 40 * $k; $w = 46 * $k; $h = 28 * $k; $r = 5 * $k; $d = 2 * $r
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $d, $d, 180, 90); $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.DrawPath($pen, $path)
    $g.DrawEllipse($pen, (54 - 6) * $k, (54 - 6) * $k, 12 * $k, 12 * $k)
    $brush = [System.Drawing.Brushes]::White
    foreach ($cx in 39, 69) { $g.FillEllipse($brush, ($cx - 2.5) * $k, (54 - 2.5) * $k, 5 * $k, 5 * $k) }
    $bmp.Save((Join-Path $out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
