# scripts/build_frontend.ps1 - Build the React frontend and copy output into backend/static/.
# Run from the repo root:  .\scripts\build_frontend.ps1
# Requires Node.js 22+ and npm 10+ (not needed at runtime after the build).

$ErrorActionPreference = "Stop"

$RepoRoot  = (Resolve-Path "$PSScriptRoot\..").Path
$Frontend  = Join-Path $RepoRoot "frontend"
$StaticDir = Join-Path $RepoRoot "backend\static"

Write-Host "=== ForestGuard AI -- Frontend Build ==="
Write-Host "Frontend : $Frontend"
Write-Host "Output   : $StaticDir"
Write-Host ""

# 1. Verify Node/npm availability
try { $nodeVer = node --version 2>&1 } catch { $nodeVer = "" }
if (-not $nodeVer) {
    Write-Error "node not found. Install Node.js 22+ from https://nodejs.org/"
    exit 1
}
try { $npmVer = npm --version 2>&1 } catch { $npmVer = "" }
if (-not $npmVer) {
    Write-Error "npm not found. Install npm 10+ with Node.js."
    exit 1
}
Write-Host "Node $nodeVer  npm $npmVer"

# 2. Install exact locked dependencies
Write-Host ""
Write-Host "--- npm ci (locked install) ---"
Push-Location $Frontend
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

    # 3. Production build - VITE_API_URL intentionally left empty -> same-origin relative URLs
    Write-Host ""
    Write-Host "--- npm run build ---"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
    Pop-Location
}

# 4. Verify dist was produced
$distIndex = Join-Path $Frontend "dist\index.html"
if (-not (Test-Path $distIndex)) {
    Write-Error "frontend/dist/index.html not found after build."
    exit 1
}

# 5. Clear old static files and copy fresh build
if (-not (Test-Path $StaticDir)) {
    New-Item -ItemType Directory -Path $StaticDir | Out-Null
}
# Remove contents but keep the directory
Get-ChildItem -Path $StaticDir -Force | Remove-Item -Recurse -Force

Write-Host ""
Write-Host "--- Copying frontend/dist/ -> backend/static/ ---"
$distDir = Join-Path $Frontend "dist"
Get-ChildItem -Path $distDir | Copy-Item -Destination $StaticDir -Recurse -Force

# 6. Verify
$staticIndex = Join-Path $StaticDir "index.html"
if (-not (Test-Path $staticIndex)) {
    Write-Error "backend/static/index.html missing after copy."
    exit 1
}

$fileCount = (Get-ChildItem -Path $StaticDir -Recurse -File).Count
Write-Host ""
Write-Host "SUCCESS: $fileCount files copied to backend/static/"
Write-Host "Production and Render need no Node.js -- backend/static/ is committed to git."
