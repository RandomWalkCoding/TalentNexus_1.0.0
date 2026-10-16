[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "",
  [switch]$RequireProduction
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Report-Check([string]$Name, [bool]$Passed) {
  if ($Passed) { Write-Host "[PASS] $Name" }
  else { Write-Host "[FAIL] $Name"; $failures.Add($Name) }
}

Push-Location -LiteralPath $repositoryRoot
try {
  Report-Check "API build exists" (Test-Path -LiteralPath "apps/api/dist/server.js")
  Report-Check "Generated Prisma client exists" (Test-Path -LiteralPath "apps/api/dist/generated/client/index.js")
  Report-Check "Web build exists" (Test-Path -LiteralPath "apps/web/dist/index.html")
  Report-Check "DATABASE_URL configured" (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL))

  if ($RequireProduction) {
    Report-Check "NODE_ENV=production" ($env:NODE_ENV -eq "production")
    $gitState = & git status --porcelain 2>&1
    Report-Check "Versioned checkout is clean" (($LASTEXITCODE -eq 0) -and -not $gitState)
  }

  if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    # Capture Prisma output: connection strings and datasource metadata stay out of the report.
    $capturePath = [System.IO.Path]::GetTempFileName()
    try {
      # Run through cmd so Prisma's informational stderr does not become a
      # terminating PowerShell ErrorRecord on Windows.
      cmd.exe /d /c "corepack pnpm --filter @hr-console/api db:status > `"$capturePath`" 2>&1"
      $migrationExitCode = $LASTEXITCODE
    } finally {
      Remove-Item -LiteralPath $capturePath -Force -ErrorAction SilentlyContinue
    }
    Report-Check "Database migration status is current" ($migrationExitCode -eq 0)
    if ($migrationExitCode -ne 0) { Write-Host "Inspect db:status in a trusted terminal for pending/failed migrations or connection errors." }
  }

  if ($ApiBaseUrl) {
    $endpoint = $null
    $validUrl = [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref]$endpoint) -and $endpoint.Scheme -in @("http", "https") -and -not $endpoint.UserInfo -and -not $endpoint.Query -and -not $endpoint.Fragment
    Report-Check "API base URL is an HTTP origin" ($validUrl -and $endpoint.AbsolutePath -eq "/")
    if ($validUrl -and $endpoint.AbsolutePath -eq "/") {
      Report-Check "Production endpoint uses HTTPS" ((-not $RequireProduction) -or $endpoint.Scheme -eq "https")
      foreach ($probe in @("health", "ready")) {
        try {
          $response = Invoke-RestMethod -Uri "$($ApiBaseUrl.TrimEnd('/'))/api/v1/$probe" -TimeoutSec 8
          $expectedStatus = if ($probe -eq "health") { "ok" } else { "ready" }
          $passed = $response.service -eq "api" -and $response.status -eq $expectedStatus -and -not [string]::IsNullOrWhiteSpace($response.requestId)
          if ($probe -eq "ready") { $passed = $passed -and $response.database -eq "up" }
          Report-Check "API $probe probe" $passed
        } catch { Report-Check "API $probe probe" $false }
      }
    }
  } else { Write-Host "[SKIP] Runtime probes: supply -ApiBaseUrl to check health and database connectivity." }

  Write-Host "This read-only check does not run migrations, seed data, restore backups, or certify PRD acceptance."
  if ($failures.Count) { Write-Host "$($failures.Count) check(s) failed."; exit 1 }
  Write-Host "Operational prerequisites passed; see docs/STAGE12_PROGRESS.md for release blockers."
} finally { Pop-Location }
