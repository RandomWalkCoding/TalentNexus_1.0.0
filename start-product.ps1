$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPort = 3000
$webPort = 5173
$apiUrl = "http://localhost:$apiPort/api/v1/health"
$webUrl = "http://localhost:$webPort"

function Test-CommandAvailable([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Wait-Http([string]$url, [int]$timeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "等待服务超时: $url"
}

function Stop-ProcessTree([System.Diagnostics.Process]$process) {
  if (-not $process -or $process.HasExited) { return }
  $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $process.Id }
  foreach ($child in $children) {
    Stop-ProcessTree (Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue)
  }
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
}

if (-not (Test-CommandAvailable "node")) { throw "Node.js was not found. Install Node.js 20 or later." }
if (-not (Test-CommandAvailable "corepack")) { throw "Corepack was not found. Install a Node.js distribution that includes Corepack." }

Set-Location $root
if (-not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "Installing dependencies for the first run..." -ForegroundColor Yellow
  corepack pnpm install
}

$env:NODE_ENV = if ($env:NODE_ENV) { $env:NODE_ENV } else { "development" }
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@127.0.0.1:5432/hr_console?schema=public" }
Write-Host "Preparing TalentNexus cloud database..." -ForegroundColor DarkCyan
corepack pnpm --filter @hr-console/api db:deploy
if ($LASTEXITCODE -ne 0) { throw "Database migration failed. Check PostgreSQL and DATABASE_URL." }
corepack pnpm --filter @hr-console/api db:seed
if ($LASTEXITCODE -ne 0) { throw "Database seed failed. Check PostgreSQL and DATABASE_URL." }
$apiProcess = Start-Process -FilePath "corepack" -ArgumentList "pnpm --filter @hr-console/api dev" -WorkingDirectory $root -PassThru
$webProcess = Start-Process -FilePath "corepack" -ArgumentList "pnpm --filter @hr-console/web dev -- --host localhost" -WorkingDirectory $root -PassThru

try {
  Wait-Http $apiUrl
  Wait-Http $webUrl
  Start-Process $webUrl
  Write-Host "TalentNexus is running: $webUrl" -ForegroundColor Green
  Write-Host "API health check: $apiUrl" -ForegroundColor Green
  Write-Host "Close this window to stop the services started by this script." -ForegroundColor DarkGray
  while (-not $apiProcess.HasExited -and -not $webProcess.HasExited) {
    Start-Sleep -Seconds 1
  }
  if ($apiProcess.HasExited) { throw "API 服务已退出，退出码: $($apiProcess.ExitCode)" }
  throw "Web 服务已退出，退出码: $($webProcess.ExitCode)"
} finally {
  foreach ($process in @($apiProcess, $webProcess)) {
    Stop-ProcessTree $process
  }
}
