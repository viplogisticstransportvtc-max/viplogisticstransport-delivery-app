$ErrorActionPreference = 'Stop'
$release = 'https://github.com/jvanstraten/TruckTel/releases/download/v0.1.2/trucktel.zip'
Write-Host 'V.I.P LOGISTICS TRANSPORT DELIVERY APP - TruckTel installer' -ForegroundColor Cyan
Write-Host 'This installer supports both Euro Truck Simulator 2 (ETS2) and American Truck Simulator (ATS).' -ForegroundColor Yellow
Write-Host ''

function Normalize([string]$v) { if ([string]::IsNullOrWhiteSpace($v)) { return $null }; return ($v -replace '\\\\','\\').TrimEnd('\\') }
$roots = New-Object System.Collections.Generic.List[string]
foreach ($key in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam')) {
  try { $p=(Get-ItemProperty -Path $key -ErrorAction Stop).SteamPath; if($p -and (Test-Path $p)){[void]$roots.Add((Normalize $p))} } catch {}
}
if(Test-Path 'C:\Program Files (x86)\Steam'){[void]$roots.Add('C:\Program Files (x86)\Steam')}
if(Test-Path 'C:\Program Files\Steam'){[void]$roots.Add('C:\Program Files\Steam')}
$libs=New-Object System.Collections.Generic.List[string]
foreach($r in ($roots|Select-Object -Unique)){
  [void]$libs.Add($r)
  $vdf=Join-Path $r 'steamapps\libraryfolders.vdf'
  if(Test-Path $vdf){
    $txt=Get-Content -Raw $vdf
    foreach($m in [regex]::Matches($txt,'"path"\s*"([^"]+)"')){ $p=Normalize ($m.Groups[1].Value); if($p -and (Test-Path $p)){[void]$libs.Add($p)} }
  }
}
$candidates=@()
foreach($l in ($libs|Select-Object -Unique)){
  $candidates += @{Name='ETS2';Path=(Join-Path $l 'steamapps\common\Euro Truck Simulator 2')}
  $candidates += @{Name='ATS';Path=(Join-Path $l 'steamapps\common\American Truck Simulator')}
}
$candidates=@($candidates|Where-Object{Test-Path (Join-Path $_.Path 'bin\win_x64')})
if(!$candidates.Count){Write-Host 'No ETS2 or ATS installation found.' -ForegroundColor Yellow; exit 0}
$temp=Join-Path $env:TEMP 'vip-trucktel.zip'; $extract=Join-Path $env:TEMP 'vip-trucktel-extract'
Invoke-WebRequest -Uri $release -OutFile $temp -UseBasicParsing
if(Test-Path $extract){Remove-Item $extract -Recurse -Force}; Expand-Archive -Path $temp -DestinationPath $extract -Force
foreach($g in $candidates|Sort-Object Name,Path -Unique){
  $plugins=Join-Path $g.Path 'bin\win_x64\plugins'; New-Item -ItemType Directory -Force -Path $plugins|Out-Null
  Write-Host "Installing TruckTel into $($g.Name): $plugins" -ForegroundColor Yellow
  Get-ChildItem $extract -Force|ForEach-Object{Copy-Item $_.FullName -Destination $plugins -Recurse -Force}
  Write-Host "$($g.Name) installation complete." -ForegroundColor Green
}
Write-Host 'TruckTel installation complete for all detected SCS games.' -ForegroundColor Green
