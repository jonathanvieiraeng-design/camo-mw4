# Servidor local simples (só para testar no PC): http://localhost:8080
param([int]$Porta = 8080)
$raiz = Split-Path -Parent $PSScriptRoot
$tipos = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8';
  '.css' = 'text/css; charset=utf-8'; '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Porta/")
$l.Start()
Write-Host "Servindo $raiz em http://localhost:$Porta"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($caminho -eq '' -or $caminho.EndsWith('/')) { $caminho += 'index.html' }
  $arq = [IO.Path]::GetFullPath((Join-Path $raiz $caminho))
  $res = $ctx.Response
  $res.Headers.Add('Cache-Control', 'no-store')
  if ($arq.StartsWith($raiz) -and (Test-Path $arq -PathType Leaf)) {
    $ext = [IO.Path]::GetExtension($arq).ToLower()
    $res.ContentType = $(if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' })
    $bytes = [IO.File]::ReadAllBytes($arq)
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
  Write-Host "$($res.StatusCode) /$caminho"
}
