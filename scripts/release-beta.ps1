$ErrorActionPreference = "Stop"

$version = "1.0.0-1"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $repoRoot ("release\" + $version)
$bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle"
$envExample = Join-Path $repoRoot ".env.example"

Set-Location $repoRoot

if (Test-Path $releaseDir) {
  Remove-Item -Path $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir | Out-Null

Write-Host "Building FORGE $version..."
npm run tauri build
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

if (Test-Path $envExample) {
  Copy-Item -Path $envExample -Destination (Join-Path $releaseDir ".env.example") -Force
}

Write-Host ""
Write-Host "Release artifacts ready:"
Write-Host "  $releaseDir"
Write-Host ""
Write-Host "Files:"
$copiedFiles | Sort-Object Name | ForEach-Object { Write-Host ("  - " + $_.Name) }
Write-Host "  - SHA256SUMS.txt"
if (Test-Path $envExample) {
  Write-Host "  - .env.example"
}
