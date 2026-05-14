param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $repoRoot "frontend"
$keyProperties = Join-Path $frontend "android\key.properties"

if (-not (Test-Path -LiteralPath $keyProperties)) {
    throw "Missing frontend\android\key.properties. Create it from key.properties.example before building a production APK."
}

Push-Location $frontend
try {
    flutter build apk --release --dart-define=API_BASE_URL=$ApiBaseUrl
}
finally {
    Pop-Location
}
