# Atualiza data/mw4.json com os desafios publicados pelo CODMunity (MP, DMZ e Warzone).
#
#   powershell -ExecutionPolicy Bypass -File tools/atualizar-dados.ps1
#   powershell -ExecutionPolicy Bypass -File tools/atualizar-dados.ps1 -Fonte caminho\mw4.json   (arquivo já baixado)
#
# O que muda: níveis das Militares, nomes/desafios/metas das Especiais e do Completionist, categoria
# das armas sem categoria. O que NÃO muda: ids de armas e camos (o seu progresso continua ligado a eles).
# Armas que a fonte ainda marca como "TBD" ou fora do tracker (Camo = 0) não são adicionadas.
param(
  [string]$Fonte = 'https://codmunity.gg/api/public/camo-tracker/mw4?lang=pt',
  [string]$Arquivo = (Join-Path (Split-Path -Parent $PSScriptRoot) 'data\mw4.json')
)
$ErrorActionPreference = 'Stop'

# ---------- leitura ----------
$enc = New-Object System.Text.UTF8Encoding($false)
$dados = [IO.File]::ReadAllText($Arquivo, $enc) | ConvertFrom-Json
if ($Fonte -match '^https?://') {
  Write-Host "Baixando $Fonte"
  $txt = (Invoke-WebRequest -UseBasicParsing $Fonte -UserAgent 'Mozilla/5.0').Content
  # Invoke-WebRequest do PS 5.1 pode decodificar como Latin-1; refaz em UTF-8
  $txt = $enc.GetString([Text.Encoding]::GetEncoding(28591).GetBytes($txt))
} else {
  $txt = [IO.File]::ReadAllText($Fonte, $enc)
}
$cod = $txt | ConvertFrom-Json

# ---------- tradução dos desafios ----------
function Traduzir([string]$t) {
  $s = $t.Trim().TrimEnd('.')
  $s = $s -replace '\s+against (Players|Enemies)', '' -replace '\s+in DMZ$', ''
  $m = [regex]::Match($s, '^Get (\d+) (?:Player |Enemy )?Kills? (?:within|in) (\d+) [Ss]econds')
  if ($m.Success) { return "$($m.Groups[1].Value) kills em $($m.Groups[2].Value) segundos" }
  $m = [regex]::Match($s, '^Get (\d+) (?:Player |Enemy )?Kills in a match \d+ times')
  if ($m.Success) { return "$($m.Groups[1].Value) kills em uma partida" }
  if ($s -match 'in a single match') { return 'Kills em uma única partida' }
  if ($s -match 'without taking damage from the Target') { return 'Kills sem tomar dano do alvo' }
  $m = [regex]::Match($s, '^Get (\d+) (?:Player |Enemy )?Kills without (dying|Dying|taking [Dd]amage|Reloading|releasing the trigger)')
  if ($m.Success) {
    $o = @{ dying = 'sem morrer'; reloading = 'sem recarregar'; 'releasing the trigger' = 'sem soltar o gatilho' }[$m.Groups[2].Value.ToLower()]
    if (-not $o) { $o = 'sem tomar dano' }
    return "Séries de $($m.Groups[1].Value) kills $o"
  }
  if ($s -match '^Destroy') { return 'Destruir killstreaks ou veículos' }
  $mapa = [ordered]@{
    'Point Blank' = 'Kills à queima-roupa'; 'Longshot' = 'Kills de longa distância'; 'Mounted' = 'Kills com a arma apoiada'
    'Hipfire' = 'Kills sem mirar (hipfire)'; 'Headshot' = 'Headshots'; 'Double Kills' = 'Double kills'
    'One Shot' = 'Kills com 1 tiro'; 'Quickscope' = 'Kills de quickscope'; 'Direct Shot' = 'Kills com acerto direto'
    'from [Bb]ehind' = 'Kills pelas costas'; 'Aiming Down Sight|ADS' = 'Kills mirando (ADS)'; 'Crouched' = 'Kills agachado'
    'Focused' = 'Kills em foco'; 'Jumping' = 'Kills pulando'; 'Ledge Hanging' = 'Kills pendurado em beirada'
    '[Mm]oving' = 'Kills em movimento'; 'Prone' = 'Kills de bruços'; '[Ss]ilencer' = 'Kills com silenciador'
    'Akimbo' = 'Kills com akimbo'; 'Heavy Melee Finisher' = 'Kills com finalização pesada'
    'Miri \d+MM' = 'Kills com o lança-granadas Miri 40MM'; 'sliding' = 'Kills deslizando'
  }
  foreach ($k in $mapa.Keys) { if ($s -match $k) { return $mapa[$k] } }
  Write-Warning "Sem tradução: $t"
  return $s
}

function Meta([string]$t) {
  $m = [regex]::Match($t, '(\d+) times')
  if ($m.Success) { return [int]$m.Groups[1].Value }
  $m = [regex]::Match($t, '(\d+)')
  if ($m.Success) { return [int]$m.Groups[1].Value }
  return $null
}

function NovoDesafio($c) {
  $txt = [ordered]@{ MP = $c.Challenge; DMZ = $c.ChallengeDMZ; WZ = $c.ChallengeWZ }
  $pt = [ordered]@{}; $meta = [ordered]@{}
  foreach ($k in 'MP', 'DMZ', 'WZ') { $pt[$k] = Traduzir $txt[$k]; $meta[$k] = Meta $txt[$k] }
  $r = [ordered]@{ meta = [pscustomobject]$meta; original = [pscustomobject]$txt }
  if ($pt.MP -eq $pt.DMZ -and $pt.MP -eq $pt.WZ) { $r.desafio = $pt.MP; $r.desafio_modo = $null }
  else { $r.desafio = 'Varia por modo'; $r.desafio_modo = [pscustomobject]$pt }
  return $r
}

# ---------- junção ----------
function Norm([string]$s) { $s.ToLower() -replace '[^a-z0-9]', '' }
$catMap = @{ 'Assault Rifle' = 'AR'; 'SMG' = 'SMG'; 'Shotgun' = 'Shotgun'; 'LMG' = 'LMG'; 'Marksman Rifle' = 'Marksman';
  'Sniper' = 'Sniper'; 'Pistol' = 'Pistol'; 'Launcher' = 'Launcher'; 'Melee' = 'Melee' }
$porArma = @{}
foreach ($c in $cod.page.challenges) { $k = Norm $c.WeaponName; if (-not $porArma[$k]) { $porArma[$k] = @() }; $porArma[$k] += $c }
$catCod = @{}
foreach ($w in $cod.page.weapons) { $catCod[(Norm $w.WeaponName)] = $w }

function Montar($antigo, $c) {
  $d = NovoDesafio $c
  $o = [ordered]@{ id = $antigo.id; nome = $c.Name; nome_status = 'confirmado'; desafio = $d.desafio }
  if ($d.desafio_modo) { $o.desafio_modo = $d.desafio_modo }
  $o.meta = $d.meta
  $o.desafio_en = $d.original
  $o.status = 'confirmado'
  return [pscustomobject]$o
}

$log = @()
foreach ($a in $dados.armas) {
  $lista = $porArma[(Norm $a.nome)]
  if (-not $lista) { $log += "!! $($a.nome): não encontrada na fonte"; continue }
  if ($lista | Where-Object { $_.Challenge -eq 'TBD' }) { $log += "!! $($a.nome): fonte ainda TBD"; continue }
  $mil = @($lista | Where-Object { $_.SubCategory -eq 'Military Camos' } | Sort-Object ID)
  $esp = @($lista | Where-Object { $_.SubCategory -eq 'Special Camos' } | Sort-Object ID)
  $cmp = @($lista | Where-Object { $_.SubCategory -eq 'Completionist' })

  if (-not $a.categoria -and $catCod[(Norm $a.nome)]) {
    $a.categoria = $catMap[$catCod[(Norm $a.nome)].Category]; $a.categoria_status = 'confirmado'
    $log += "   $($a.nome): categoria $($a.categoria)"
  }
  for ($i = 0; $i -lt [Math]::Min(8, $mil.Count); $i++) {
    if ("$($mil[$i].Level)" -match '^\d+$') { $a.militares[$i].nivel = [int]$mil[$i].Level; $a.militares[$i].nivel_status = 'confirmado' }
  }

  # Especiais: casa por nome; depois pela meta de MP; depois pela posição. O id antigo é mantido.
  $livres = [Collections.ArrayList]@($esp)
  $par = @{}
  foreach ($e in $a.especiais) {
    $x = $livres | Where-Object { $_.Name -eq $e.nome } | Select-Object -First 1
    if ($x) { $par[$e.id] = $x; $livres.Remove($x) }
  }
  foreach ($e in $a.especiais) {
    if ($par[$e.id] -or -not $e.meta) { continue }
    $x = $livres | Where-Object { (Meta $_.Challenge) -eq $e.meta.MP } | Select-Object -First 1
    if ($x) { $par[$e.id] = $x; $livres.Remove($x) }
  }
  foreach ($e in $a.especiais) { if (-not $par[$e.id] -and $livres.Count) { $par[$e.id] = $livres[0]; $livres.RemoveAt(0); $log += "?? $($a.nome) $($e.id): casada por posição" } }
  $a.especiais = @($a.especiais | ForEach-Object { if ($par[$_.id]) { Montar $_ $par[$_.id] } else { $_ } })
  $a.completionist = @($a.completionist | ForEach-Object {
    $alvo = @{ 'gold' = 'Gold'; 'platinum' = 'Platinum'; 'harmonic-break' = 'Harmonic Break' }[$_.id]
    $x = $cmp | Where-Object { $_.Name -eq $alvo } | Select-Object -First 1
    if ($x) { $n = Montar $_ $x; $n.nome = $_.nome; $n } else { $_ }
  })
}
foreach ($k in $porArma.Keys) {
  if (-not ($dados.armas | Where-Object { (Norm $_.nome) -eq $k })) { $log += "-- Fora do app (fonte: $($porArma[$k][0].WeaponName))" }
}

# Regras confirmadas pela fonte
$dados.regras | Add-Member -Force -NotePropertyName harmonic_platinum_minimo -NotePropertyValue 33
$dados.versao_dados = '0.3'
$dados.data_levantamento = (Get-Date).ToString('yyyy-MM-dd')

# ---------- escrita (mesmo formato: objetos curtos numa linha) ----------
function Str($s) {
  $b = New-Object Text.StringBuilder('"')
  foreach ($ch in $s.ToCharArray()) {
    switch ($ch) { '"' { [void]$b.Append('\"') } '\' { [void]$b.Append('\\') } "`n" { [void]$b.Append('\n') } "`r" { [void]$b.Append('\r') } "`t" { [void]$b.Append('\t') }
      default { if ([int]$ch -lt 32) { [void]$b.Append(('\u{0:x4}' -f [int]$ch)) } else { [void]$b.Append($ch) } } }
  }
  [void]$b.Append('"'); $b.ToString()
}
function Linha($v) {
  if ($null -eq $v) { return 'null' }
  if ($v -is [bool]) { return $(if ($v) { 'true' } else { 'false' }) }
  if ($v -is [string]) { return Str $v }
  if ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) { return "$v" }
  if ($v -is [array] -or $v -is [Collections.IList]) { return '[' + (($v | ForEach-Object { Linha $_ }) -join ', ') + ']' }
  $ps = $v.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' }
  return '{ ' + (($ps | ForEach-Object { (Str $_.Name) + ': ' + (Linha $_.Value) }) -join ', ') + ' }'
}
function Json($v, [int]$n) {
  $pad = '  ' * $n
  $l = Linha $v
  $temObj = ($v -is [array] -or $v -is [Collections.IList]) -and ($v | Where-Object { $_ -is [pscustomobject] })
  if ($null -eq $v -or $v -is [string] -or $v -is [ValueType] -or ($pad.Length + $l.Length -le 130 -and -not ($temObj -and $l.Length -gt 60))) { return $l }
  $p2 = '  ' * ($n + 1)
  if ($v -is [array] -or $v -is [Collections.IList]) {
    return "[`n" + (($v | ForEach-Object { $p2 + (Json $_ ($n + 1)) }) -join ",`n") + "`n$pad]"
  }
  $ps = $v.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' }
  return "{`n" + (($ps | ForEach-Object { $p2 + (Str $_.Name) + ': ' + (Json $_.Value ($n + 1)) }) -join ",`n") + "`n$pad}"
}
[IO.File]::WriteAllText($Arquivo, (Json $dados 0) + "`n", $enc)
$log | ForEach-Object { Write-Host $_ }
Write-Host "OK: $Arquivo atualizado (versao_dados $($dados.versao_dados))."
