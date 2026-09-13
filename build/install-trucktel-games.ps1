$ErrorActionPreference = 'Stop'
$release = 'https://github.com/jvanstraten/TruckTel/releases/download/v0.1.2/trucktel.zip'
$log = Join-Path $env:TEMP 'vip-logistics-trucktel-install.log'
"V.I.P LOGISTICS TRANSPORT DELIVERY APP - TruckTel installer $(Get-Date)" | Set-Content -Path $log -Encoding UTF8

function Log($message) {
  $message | Tee-Object -FilePath $log -Append | Out-Host
}

function Normalize-PathValue([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  return ($value -replace '\\\\','\\').TrimEnd('\\')
}

$steamRoots = New-Object System.Collections.Generic.List[string]
$defaultSteam = 'C:\Program Files (x86)\Steam'
if (Test-Path $defaultSteam) { [void]$steamRoots.Add($defaultSteam) }
foreach ($key in @(
  'HKCU:\Software\Valve\Steam',
  'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam',
  'HKLM:\SOFTWARE\Valve\Steam'
)) {
  try {
    $p = (Get-ItemProperty -Path $key -ErrorAction Stop).SteamPath
    if ($p) { $p = Normalize-PathValue $p; if (Test-Path $p) { [void]$steamRoots.Add($p) } }
  } catch {}
}

$libraryRoots = New-Object System.Collections.Generic.List[string]
foreach ($root in ($steamRoots | Select-Object -Unique)) {
  if (Test-Path $root) { [void]$libraryRoots.Add($root) }
  $vdf = Join-Path $root 'steamapps\libraryfolders.vdf'
  if (Test-Path $vdf) {
    try {
      $text = Get-Content -Raw -LiteralPath $vdf
      foreach ($m in [regex]::Matches($text, '"path"\s*"([^"]+)"')) {
        $path = Normalize-PathValue ($m.Groups[1].Value -replace '\\\\','\\')
        if ($path -and (Test-Path $path)) { [void]$libraryRoots.Add($path) }
      }
    } catch { Log "Could not read Steam library file $vdf : $($_.Exception.Message)" }
  }
}

$gameCandidates = New-Object System.Collections.Generic.List[object]
$names = @(
  @{ Name='ETS2'; Folder='Euro Truck Simulator 2' },
  @{ Name='ATS'; Folder='American Truck Simulator' }
)
foreach ($library in ($libraryRoots | Select-Object -Unique)) {
  foreach ($game in $names) {
    $gamePath = Join-Path $library ("steamapps\common\" + $game.Folder)
    if (Test-Path (Join-Path $gamePath 'bin\win_x64')) {
      [void]$gameCandidates.Add([pscustomobject]@{Name=$game.Name; Path=$gamePath})
    }
  }
}

# Also check the two most common standalone paths if Steam's library file was unavailable.
foreach ($path in @(
  'C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2',
  'C:\Program Files (x86)\Steam\steamapps\common\American Truck Simulator',
  'C:\Program Files\Steam\steamapps\common\Euro Truck Simulator 2',
  'C:\Program Files\Steam\steamapps\common\American Truck Simulator'
)) {
  $name = if ($path -match 'American Truck Simulator') { 'ATS' } else { 'ETS2' }
  if (Test-Path (Join-Path $path 'bin\win_x64')) { [void]$gameCandidates.Add([pscustomobject]@{Name=$name; Path=$path}) }
}

$gameCandidates = @($gameCandidates | Sort-Object Name,Path -Unique)
if ($gameCandidates.Count -eq 0) {
  Log 'No ETS2 or ATS installation was detected. The app will still install.'
  Log "If the game is installed later, run INSTALL-TRUCKTEL.cmd from the app's installation folder."
  exit 0
}

$tempRoot = Join-Path $env:TEMP 'vip-logistics-trucktel'
$zip = Join-Path $tempRoot 'trucktel.zip'
$extract = Join-Path $tempRoot 'extract'
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }

try {
  Log 'Downloading TruckTel v0.1.2...'
  Invoke-WebRequest -Uri $release -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $extract -Force
} catch {
  Log "TruckTel download/extraction failed: $($_.Exception.Message)"
  Log 'The V.I.P delivery app is installed, but TruckTel could not be installed automatically.'
  exit 0
}

foreach ($game in $gameCandidates) {
  try {
    $plugins = Join-Path $game.Path 'bin\win_x64\plugins'
    New-Item -ItemType Directory -Force -Path $plugins | Out-Null
    Log "Installing TruckTel into $($game.Name): $plugins"
    Get-ChildItem -LiteralPath $extract -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $plugins -Recurse -Force
    }
    Log "$($game.Name) TruckTel installation complete."
  } catch {
    Log "$($game.Name) TruckTel installation failed: $($_.Exception.Message)"
  }
}

Log "Completed. Installation log: $log"
exit 0
