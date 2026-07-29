# Logos Deploy Script
# Usage: .\deploy.ps1

param(
  [switch]$NoBuild,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$port = $Port

Write-Host "=== Deploying Logos ===" -ForegroundColor Cyan

# 1. Build
if (-not $NoBuild) {
  Write-Host "[1/3] Building..." -ForegroundColor Yellow
  Set-Location $projectRoot
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
  }
}

# 2. Stop existing process
Write-Host "[2/3] Stopping existing process on port $port..." -ForegroundColor Yellow
$existing = netstat -ano | Select-String ":$port" | ForEach-Object { ($_ -split "\s+")[-1] }
if ($existing) {
  foreach ($pid_ in $existing | Sort-Object -Unique) {
    Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
    Write-Host "  Killed PID $pid_"
  }
  Start-Sleep -Seconds 1
}

# 3. Start
Write-Host "[3/3] Starting on port $port..." -ForegroundColor Yellow
$env:PORT = $port
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "start" `
  -RedirectStandardOutput "$projectRoot\logs\stdout.log" `
  -RedirectStandardError "$projectRoot\logs\stderr.log"

Start-Sleep -Seconds 3

# Verify
try {
  $response = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 3
  if ($response.StatusCode -eq 200) {
    Write-Host "=== Deploy success! http://localhost:$port ===" -ForegroundColor Green
  }
} catch {
  Write-Host "Server started but may need more time..." -ForegroundColor Yellow
}
