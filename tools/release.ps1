# Prepares an automatic update: writes android/web/update.json (version, SHA-256 of every file) and signs it.
#   powershell -File tools\release.ps1                                     web part only (delivered to installed apps by itself)
#   powershell -File tools\release.ps1 -VersionCode 6 -VersionName 1.3     also builds a new APK (Java or manifest changed)
# Then commit and push: GitHub publishes the files, the apps pick them up.
# Note: keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less files as ANSI).
[CmdletBinding()]
param([int]$VersionCode = 0, [string]$VersionName = '', [int]$MinApi = 1, [string]$Tools = 'D:\tools\android-build')

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot
$web = Join-Path $project 'android\web'
$manifest = Join-Path $web 'update.json'
$sig = Join-Path $web 'update.sig'
$key = Join-Path $Tools 'zarplata-update.key'
$java = Join-Path $Tools 'jdk\bin\java.exe'
if (-not (Test-Path $key)) { throw "Signing key not found: $key" }

$old = $null
if (Test-Path $manifest) { $old = [IO.File]::ReadAllText($manifest) | ConvertFrom-Json }
$version = if ($old) { [int]$old.version + 1 } else { 1 }

$apkFile = Join-Path $web 'Zarplata.apk'
if ($VersionCode -gt 0) {
    if (-not $VersionName) { throw 'VersionName is required together with VersionCode' }
    & (Join-Path $project 'android\build.ps1') -VersionCode $VersionCode -VersionName $VersionName -Tools $Tools
    Copy-Item (Join-Path $project 'Zarplata.apk') $apkFile -Force
    $apkCode = $VersionCode; $apkName = $VersionName
} elseif ($old -and $old.apk) {
    $apkCode = [int]$old.apk.code; $apkName = [string]$old.apk.name
} else {
    throw 'First release needs -VersionCode and -VersionName'
}

$sha = { param($p) (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
$skip = { param($n) ($n -like 'dev-*') -or ($n -like '*.apk') -or ($n -eq 'update.json') -or ($n -eq 'update.sig') -or ($n -eq 'sw.js') }
$rows = @(Get-ChildItem $web -File | Where-Object { -not (& $skip $_.Name) } | Sort-Object Name | ForEach-Object { '    "{0}": "{1}"' -f $_.Name, (& $sha $_.FullName) })
$text = "{`n  `"version`": $version,`n  `"minApi`": $MinApi,`n  `"apk`": { `"code`": $apkCode, `"name`": `"$apkName`", `"file`": `"Zarplata.apk`", `"sha256`": `"$(& $sha $apkFile)`" },`n  `"files`": {`n" + ($rows -join ",`n") + "`n  }`n}`n"
[IO.File]::WriteAllText($manifest, $text, (New-Object Text.UTF8Encoding($false)))

& $java (Join-Path $PSScriptRoot 'SignUpdate.java') sign $key $manifest $sig
if ($LASTEXITCODE -ne 0) { throw 'Signing failed' }
Write-Host "Update $version is ready ($($rows.Count) files, APK $apkName / $apkCode). Commit and push." -ForegroundColor Green
