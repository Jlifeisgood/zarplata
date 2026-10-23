# Build without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner. Output: Zarplata.apk in the project folder.
# Note: keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less files as ANSI).
[CmdletBinding()]
param([string]$Tools = 'D:\tools\android-build', [int]$VersionCode = 1, [string]$VersionName = '1.0')

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$project = Split-Path $here
$sdk = Join-Path $Tools 'sdk'
$bt = Join-Path $sdk 'build-tools\34.0.0'
$androidJar = Join-Path $sdk 'platforms\android-34\android.jar'
$env:JAVA_HOME = Join-Path $Tools 'jdk'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

foreach ($p in @($env:JAVA_HOME, $bt, $androidJar)) { if (-not (Test-Path $p)) { throw "Not found: $p" } }

function Invoke-Tool {
    param([string]$Exe)
    $ErrorActionPreference = 'Continue'
    & $Exe @args
    if ($LASTEXITCODE -ne 0) { throw "Failed: $Exe (exit $LASTEXITCODE)" }
}

# build in a folder without Cyrillic in the path
$work = Join-Path $Tools 'work-zarplata'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force "$work\assets", "$work\gen", "$work\classes", "$work\dex" | Out-Null
Copy-Item (Join-Path $here 'src') "$work\src" -Recurse
Copy-Item (Join-Path $here 'res') "$work\res" -Recurse
Copy-Item (Join-Path $here 'AndroidManifest.xml') "$work\AndroidManifest.xml"
Get-ChildItem (Join-Path $here 'web') -File | Where-Object { $_.Name -notlike 'dev-*' } | Copy-Item -Destination "$work\assets"

Write-Host '1/6 resources (aapt2)' -ForegroundColor Cyan
Invoke-Tool "$bt\aapt2.exe" compile --dir "$work\res" -o "$work\res.zip"
Invoke-Tool "$bt\aapt2.exe" link -o "$work\base.apk" -I $androidJar --manifest "$work\AndroidManifest.xml" `
    --min-sdk-version 29 --target-sdk-version 34 --version-code $VersionCode --version-name $VersionName `
    -A "$work\assets" --java "$work\gen" "$work\res.zip"

Write-Host '2/6 javac' -ForegroundColor Cyan
$sources = @(Get-ChildItem "$work\src", "$work\gen" -Recurse -Filter *.java | ForEach-Object { '"' + $_.FullName.Replace('\', '/') + '"' })
[IO.File]::WriteAllLines("$work\sources.txt", $sources)
Invoke-Tool "$env:JAVA_HOME\bin\javac.exe" --release 8 -encoding UTF-8 -nowarn -classpath $androidJar -d "$work\classes" "@$work\sources.txt"

Write-Host '3/6 d8' -ForegroundColor Cyan
$classes = @(Get-ChildItem "$work\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName })
Invoke-Tool "$bt\d8.bat" --lib $androidJar --min-api 29 --output "$work\dex" @classes

Write-Host '4/6 packaging' -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("$work\base.apk", 'Update')
try { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$work\dex\classes.dex", 'classes.dex') }
finally { $zip.Dispose() }
Invoke-Tool "$bt\zipalign.exe" -f -p 4 "$work\base.apk" "$work\aligned.apk"

Write-Host '5/6 signing key' -ForegroundColor Cyan
# the same key is required to update an installed app; the password lives outside the repo
$keystore = Join-Path $Tools 'zarplata.keystore'
$passFile = Join-Path $Tools 'zarplata.pass'
if (-not (Test-Path $keystore)) {
    $pass = -join ((48..57) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    Invoke-Tool "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $keystore -alias zarplata -keyalg RSA -keysize 2048 `
        -validity 10000 -storepass $pass -keypass $pass -dname 'CN=Zarplata'
    [IO.File]::WriteAllText($passFile, $pass)
}
$pass = [IO.File]::ReadAllText($passFile).Trim()

Write-Host '6/6 apksigner' -ForegroundColor Cyan
$apk = Join-Path $project 'Zarplata.apk'
Invoke-Tool "$bt\apksigner.bat" sign --ks $keystore --ks-pass "pass:$pass" --key-pass "pass:$pass" --out "$work\signed.apk" "$work\aligned.apk"
Copy-Item "$work\signed.apk" $apk -Force
Write-Host ("Done: {0} ({1:N1} MB)" -f $apk, ((Get-Item $apk).Length / 1MB)) -ForegroundColor Green
