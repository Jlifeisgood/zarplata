# Local static server for checking the UI in a browser: serves android\web on http://localhost:8769
param([int]$Port = 8769)
$root = Join-Path (Split-Path $PSScriptRoot) 'android\web'
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json' }
$l = New-Object Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "serving $root on http://localhost:$Port/"
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $path) { $path = 'index.html' }
    $file = Join-Path $root $path
    if ((Test-Path $file -PathType Leaf) -and ([IO.Path]::GetFullPath($file).StartsWith($root))) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $c.Response.Headers.Add('Cache-Control', 'no-store')
      $c.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { } finally { $c.Response.Close() }
}
