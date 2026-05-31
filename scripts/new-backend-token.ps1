# Generates a cryptographically random token for BACKEND_CLIENT_TOKEN / FORGE_BACKEND_TOKEN.
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
Write-Host ""
Write-Host "New backend client token (use for BOTH backend and installer build):"
Write-Host ""
Write-Host "  $token"
Write-Host ""
Write-Host "Backend:  BACKEND_CLIENT_TOKEN=$token"
Write-Host "Build:    FORGE_BACKEND_TOKEN=$token"
Write-Host ""
