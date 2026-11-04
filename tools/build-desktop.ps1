# Builds android\web\Zarplata.exe (Windows launcher, see desktop\Zarplata.cs) with the app icon. ASCII-only on purpose (PowerShell 5.1).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$work = Join-Path $env:TEMP 'zarplata-desktop'
New-Item -ItemType Directory -Force $work | Out-Null

# icon: 256x256 PNG inside an .ico container (supported since Windows Vista)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Join-Path $root 'android\web\icon-512.png'))
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($src, 0, 0, 256, 256)
$g.Dispose(); $src.Dispose()
$ms = New-Object IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
$png = $ms.ToArray()
$ico = Join-Path $work 'zarplata.ico'
$w = New-Object IO.BinaryWriter([IO.File]::Create($ico))
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)
$w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0)
$w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$png.Length); $w.Write([uint32]22)
$w.Write($png); $w.Close()

$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$out = Join-Path $root 'android\web\Zarplata.exe'
& $csc /nologo /target:winexe /optimize+ /codepage:65001 "/win32icon:$ico" "/out:$out" /r:System.Windows.Forms.dll (Join-Path $root 'desktop\Zarplata.cs')
if ($LASTEXITCODE -ne 0) { throw 'csc failed' }
Write-Host ("Done: {0} ({1:N0} bytes)" -f $out, (Get-Item $out).Length) -ForegroundColor Green
