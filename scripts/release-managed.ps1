$ErrorActionPreference = "Stop"

param(
  [string]$BackendUrl = $env:FORGE_BACKEND_URL,
  [string]$BackendToken = $env:FORGE_BACKEND_TOKEN
)

if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
  throw "FORGE_BACKEND_URL is required. Pass -BackendUrl or set env:FORGE_BACKEND_URL."
}

if ([string]::IsNullOrWhiteSpace($BackendToken)) {
  throw "FORGE_BACKEND_TOKEN is required. Pass -BackendToken or set env:FORGE_BACKEND_TOKEN."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

# Embed managed backend config at compile time for zero-setup installed users.
$env:FORGE_BACKEND_URL = $BackendUrl
$env:FORGE_BACKEND_TOKEN = $BackendToken

Write-Host "Building managed installer with backend URL: $BackendUrl"
npm run release:beta
if ($LASTEXITCODE -ne 0) {
  throw "Managed release failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Managed installer build complete."
Write-Host "Embedded FORGE_BACKEND_URL and FORGE_BACKEND_TOKEN in the desktop binary."
