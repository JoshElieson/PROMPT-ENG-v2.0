param(
  [switch]$AllowLocalKeys
)

# Ensures Rust/Cargo is on PATH (common after rustup install without restarting the terminal)
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:Path = "$cargoBin;$env:Path"
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "Rust/Cargo not found on PATH." -ForegroundColor Red
  Write-Host "Install: winget install Rustlang.Rustup" -ForegroundColor Yellow
  Write-Host "Then close this terminal, open a new one, and run again." -ForegroundColor Yellow
  Write-Host "Or add to your user PATH: $cargoBin" -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

if (-not $AllowLocalKeys) {
  $backendUrl = $env:FORGE_BACKEND_URL
  $backendToken = $env:FORGE_BACKEND_TOKEN
  if ([string]::IsNullOrWhiteSpace($backendUrl) -or [string]::IsNullOrWhiteSpace($backendToken)) {
    Write-Host ""
    Write-Host "Managed backend required for dev (no .env file needed)." -ForegroundColor Red
    Write-Host "Set user or session environment variables:" -ForegroundColor Yellow
    Write-Host '  $env:FORGE_BACKEND_URL="https://your-service.onrender.com"' -ForegroundColor Yellow
    Write-Host '  $env:FORGE_BACKEND_TOKEN="same-as-Render-BACKEND_CLIENT_TOKEN"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run with local provider keys: npm run tauri:dev -- -AllowLocalKeys" -ForegroundColor Yellow
    Write-Host "(requires OPENAI_API_KEY etc. in the environment or a .env file)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
  }
  $env:FORGE_BACKEND_URL = $backendUrl.Trim()
  $env:FORGE_BACKEND_TOKEN = $backendToken.Trim()
}

Set-Location $PSScriptRoot\..
npm run tauri dev @args
