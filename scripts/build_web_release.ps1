param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $repoRoot "frontend"

Push-Location $frontend
try {
    flutter build web --release --dart-define=API_BASE_URL=$ApiBaseUrl
}
finally {
    Pop-Location
}
