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

Set-Location $PSScriptRoot\..
npm run tauri dev @args
