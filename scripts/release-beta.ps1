param(
  [switch]$AllowLocalKeys
)

$ErrorActionPreference = "Stop"

$version = "1.0.0-2"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $repoRoot ("release\" + $version)
$bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle"
$envExample = Join-Path $repoRoot ".env.example"
$betaInstallTemplate = Join-Path $PSScriptRoot "templates\BETA_INSTALL.txt"

$managed = -not $AllowLocalKeys

if ($managed) {
  $backendUrl = $env:FORGE_BACKEND_URL
  $backendToken = $env:FORGE_BACKEND_TOKEN
  if ([string]::IsNullOrWhiteSpace($backendUrl)) {
    throw @"
Beta release requires FORGE_BACKEND_URL (your Render URL, e.g. https://forge-api.onrender.com).
Set it and FORGE_BACKEND_TOKEN, then run: npm run release:beta
Generate a token with: npm run backend:token
"@
  }
  if ([string]::IsNullOrWhiteSpace($backendToken)) {
    throw "Beta release requires FORGE_BACKEND_TOKEN (must match Render BACKEND_CLIENT_TOKEN)."
  }
  $env:FORGE_BACKEND_URL = $backendUrl.Trim()
  $env:FORGE_BACKEND_TOKEN = $backendToken.Trim()
  try {
    $uri = [Uri]$env:FORGE_BACKEND_URL
    if (-not $uri.Scheme.StartsWith("http")) {
      throw "URL must start with https://"
    }
    if ($uri.Host -notmatch '\.') {
      throw @"
FORGE_BACKEND_URL must be the full public Render URL, e.g. https://forge-api.onrender.com
You entered a host without a domain: $($uri.Host)
Copy the URL from Render Dashboard -> your web service -> URL (ends with .onrender.com)
"@
    }
  } catch {
    if ($_.Exception.Message -match 'FORGE_BACKEND_URL must be') {
      throw
    }
    throw "FORGE_BACKEND_URL is not a valid URL: $($env:FORGE_BACKEND_URL)"
  }
  Write-Host "Zero-setup beta build - embedding backend URL: $($env:FORGE_BACKEND_URL)"
}

Set-Location $repoRoot

if (Test-Path $releaseDir) {
  Remove-Item -Path $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir | Out-Null

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:Path = "$cargoBin;$env:Path"
}

$distIndex = Join-Path $repoRoot "dist\index.html"
$releaseTauriConfig = Join-Path $repoRoot "src-tauri\tauri.release.conf.json"

Write-Host "Building FORGE $version frontend..."
npm run build
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) {
  # Windows Node can exit with -1073740791 after a successful Vite build (libuv UV_HANDLE_CLOSING).
  if (Test-Path $distIndex) {
    Write-Warning "npm run build exited with $buildExit but dist/ exists; continuing."
  } else {
    throw "Frontend build failed with exit code $buildExit"
  }
}

Write-Host "Building FORGE $version installer..."
npm run tauri build -- -c $releaseTauriConfig
if ($LASTEXITCODE -ne 0) {
  throw "Tauri build failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $bundleRoot)) {
  throw "Bundle output not found at: $bundleRoot"
}

$allowedExtensions = @(".msi", ".exe", ".zip", ".dmg", ".deb", ".rpm", ".AppImage")
$artifacts = Get-ChildItem -Path $bundleRoot -File -Recurse | Where-Object {
  $allowedExtensions -contains $_.Extension -or $_.Name -like "*.AppImage"
}

if ($artifacts.Count -eq 0) {
  throw "No installer artifacts found in: $bundleRoot"
}

$copiedFiles = @()
foreach ($artifact in $artifacts) {
  $targetPath = Join-Path $releaseDir $artifact.Name
  Copy-Item -Path $artifact.FullName -Destination $targetPath -Force
  $copiedFiles += Get-Item $targetPath
}

$checksums = foreach ($file in $copiedFiles) {
  $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash.ToLower()
  "$hash  $($file.Name)"
}

Set-Content -Path (Join-Path $releaseDir "SHA256SUMS.txt") -Value $checksums

if ($managed -and (Test-Path $betaInstallTemplate)) {
  Copy-Item -Path $betaInstallTemplate -Destination (Join-Path $releaseDir "BETA_INSTALL.txt") -Force
  $hostOnly = ([Uri]$env:FORGE_BACKEND_URL).Host
  @(
    "FORGE beta build - zero-setup for testers"
    "Managed backend host: $hostOnly"
    "Embedded at compile time: FORGE_BACKEND_URL, FORGE_BACKEND_TOKEN"
    "Testers do not need .env or API keys."
  ) | Set-Content -Path (Join-Path $releaseDir "BUILD_INFO.txt")
} elseif (Test-Path $envExample) {
  Copy-Item -Path $envExample -Destination (Join-Path $releaseDir ".env.example") -Force
}

Write-Host ""
Write-Host "Release artifacts ready:"
Write-Host "  $releaseDir"
Write-Host ""
Write-Host "Files:"
$copiedFiles | Sort-Object Name | ForEach-Object { Write-Host ("  - " + $_.Name) }
Write-Host "  - SHA256SUMS.txt"
if ($managed) {
  Write-Host "  - BETA_INSTALL.txt"
  Write-Host "  - BUILD_INFO.txt"
} elseif (Test-Path $envExample) {
  Write-Host "  - .env.example (local-keys build - not for beta testers)"
}
