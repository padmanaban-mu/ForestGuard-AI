# scripts/make_zip.ps1 — Package ForestGuard AI for teammates.
#
# Creates ../ForestGuard-AI-share.zip in the repo parent directory.
# Then extracts it, runs check_setup.py, starts the server, fetches /health
# and /, verifies no .env and no FIRMS key text, and reports the result.
#
# Run from the repo root:
#   .\scripts\make_zip.ps1

$ErrorActionPreference = "Stop"

# ── Paths ────────────────────────────────────────────────────────────────────
$RepoRoot  = (Resolve-Path "$PSScriptRoot\..").Path
$RepoName  = Split-Path $RepoRoot -Leaf
$ParentDir = Split-Path $RepoRoot -Parent
$ZipPath   = Join-Path $ParentDir "ForestGuard-AI-share.zip"
$TempDir   = Join-Path ([System.IO.Path]::GetTempPath()) "forestguard-zip-verify-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"

Write-Host ""
Write-Host "=== ForestGuard AI — make_zip ==="
Write-Host "Repo root : $RepoRoot"
Write-Host "Output    : $ZipPath"
Write-Host ""

# ── Security check: backend/.env must not have real key values ───────────────
$envFile = Join-Path $RepoRoot "backend\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "FIRMS_MAP_KEY=.+") {
        # Extract the actual key value without printing it
        $keyLine = ($envContent -split "`n") | Where-Object { $_ -match "^FIRMS_MAP_KEY=.+" }
        if ($keyLine) {
            $firmsKey = ($keyLine -split "=", 2)[1].Trim()
        } else {
            $firmsKey = ""
        }
    } else {
        $firmsKey = ""
    }
} else {
    $firmsKey = ""
}

# ── Exclusion patterns ───────────────────────────────────────────────────────
# Items that must never appear in the zip.
$ExcludeRelPatterns = @(
    ".env"              # all .env files (but .env.example is allowed)
    ".git"
    ".agent"
    "node_modules"
    "frontend\dist"
    ".venv"
    "__pycache__"
    ".pytest_cache"
    "ml\data\raw"
)

function ShouldExclude($relativePath) {
    $rp = $relativePath.Replace("/", "\")
    foreach ($pat in $ExcludeRelPatterns) {
        # Match component-wise to avoid partial matches (e.g. .env inside .env.example)
        $segments = $rp -split "\\"
        # .env: only exclude files/dirs named exactly ".env" or "*.env" but NOT ".env.example"
        if ($pat -eq ".env") {
            foreach ($seg in $segments) {
                if ($seg -match "^\.env$" -or ($seg -match "^\.env\." -and $seg -notmatch "example")) {
                    return $true
                }
            }
        } else {
            $patSeg = $pat.Replace("/", "\")
            if ($rp -eq $patSeg -or $rp.StartsWith("$patSeg\") -or $rp.Contains("\$patSeg\") -or $rp.EndsWith("\$patSeg")) {
                return $true
            }
        }
    }
    return $false
}

# ── Collect files ─────────────────────────────────────────────────────────────
Write-Host "Collecting files ..."
$MaxFileSizeBytes = 20MB

$allFiles = Get-ChildItem -Path $RepoRoot -Recurse -File
$included = @()
$excludedCount = 0

foreach ($file in $allFiles) {
    $rel = $file.FullName.Substring($RepoRoot.Length + 1)

    if (ShouldExclude $rel) {
        $excludedCount++
        continue
    }
    if ($file.Length -gt $MaxFileSizeBytes) {
        Write-Host "  SKIP (>20 MB): $rel  ($([Math]::Round($file.Length/1MB,1)) MB)"
        $excludedCount++
        continue
    }
    $included += $file
}

Write-Host "  Included : $($included.Count) files"
Write-Host "  Excluded : $excludedCount items"

# ── Build the zip ─────────────────────────────────────────────────────────────
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Write-Host ""
Write-Host "Building zip ..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($ZipPath, 'Create')
try {
    foreach ($file in $included) {
        $entryName = "$RepoName\" + $file.FullName.Substring($RepoRoot.Length + 1)
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $file.FullName, $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $zip.Dispose()
}

$zipSizeMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host "Zip created: $ZipPath ($zipSizeMB MB)"

# ── Top-level entries ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Top-level entries in zip:"
$zipRead = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    $topLevel = $zipRead.Entries |
        ForEach-Object { ($_.FullName -replace "\\", "/").Split("/")[1] } |
        Sort-Object -Unique
    $topLevel | ForEach-Object { Write-Host "  $_" }
} finally {
    $zipRead.Dispose()
}

# ── Security scan: no .env, no FIRMS key ──────────────────────────────────────
Write-Host ""
Write-Host "Security scan ..."
$zipScan = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
$envLeaks = @()
$keyLeaks  = @()
try {
    foreach ($entry in $zipScan.Entries) {
        $name = $entry.FullName -replace "\\", "/"
        # Check entry name for .env files (excluding .env.example)
        $leaf = Split-Path $name -Leaf
        if ($leaf -match "^\.env$" -or ($leaf -match "^\.env\." -and $leaf -notmatch "example")) {
            $envLeaks += $name
        }
        # Scan text file contents for FIRMS key (if key is non-empty)
        if ($firmsKey -and $entry.Length -lt 2MB -and $entry.Length -gt 0) {
            $ext = [System.IO.Path]::GetExtension($name).ToLower()
            $textExts = @(".txt",".py",".js",".ts",".json",".md",".env",".cfg",".ini",".toml",".yaml",".yml",".sh",".bat",".ps1",".html",".css",".jsx",".tsx",".csv")
            if ($textExts -contains $ext -or $ext -eq "") {
                try {
                    $stream = $entry.Open()
                    $reader = New-Object System.IO.StreamReader($stream)
                    $content = $reader.ReadToEnd()
                    $reader.Dispose()
                    $stream.Dispose()
                    if ($content.Contains($firmsKey)) {
                        $keyLeaks += $name
                    }
                } catch { }
            }
        }
    }
} finally {
    $zipScan.Dispose()
}

if ($envLeaks.Count -eq 0) {
    Write-Host "  [OK]  No .env files in zip"
} else {
    Write-Host "  [FAIL] .env files found in zip:"
    $envLeaks | ForEach-Object { Write-Host "         $_" }
}

if ($firmsKey) {
    if ($keyLeaks.Count -eq 0) {
        Write-Host "  [OK]  No FIRMS key text found in any zip entry"
    } else {
        Write-Host "  [FAIL] FIRMS key text found in:"
        $keyLeaks | ForEach-Object { Write-Host "         $_" }
    }
} else {
    Write-Host "  [INFO] FIRMS key is empty — skipping content scan"
}

# ── Extract and smoke-test ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Smoke-testing extracted zip in temp folder ..."
Write-Host "  Temp : $TempDir"
New-Item -ItemType Directory -Path $TempDir | Out-Null

$serverProc = $null
try {
    # Extract
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $TempDir)
    $extractedRepo = Join-Path $TempDir $RepoName

    # run check_setup.py
    Write-Host ""
    Write-Host "  Running check_setup.py ..."
    $checkOut = py -3.13 "$extractedRepo\scripts\check_setup.py" 2>&1
    Write-Host ($checkOut | Out-String)

    # Start server in background
    Write-Host "  Starting server ..."
    $env:PYTHONPATH = $extractedRepo
    $serverProc = Start-Process -FilePath "py" `
        -ArgumentList "-3.13", "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8001" `
        -WorkingDirectory $extractedRepo `
        -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 6

    # Fetch /health
    Write-Host "  GET http://127.0.0.1:8001/health ..."
    try {
        $healthResp = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -TimeoutSec 10 -UseBasicParsing
        $healthJson = $healthResp.Content | ConvertFrom-Json
        Write-Host "  [OK]  /health → status=$($healthJson.status)  HTTP $($healthResp.StatusCode)"
    } catch {
        Write-Host "  [FAIL] /health failed: $_"
    }

    # Fetch /
    Write-Host "  GET http://127.0.0.1:8001/ ..."
    try {
        $rootResp = Invoke-WebRequest -Uri "http://127.0.0.1:8001/" -TimeoutSec 10 -UseBasicParsing
        if ($rootResp.Content -match "<html") {
            Write-Host "  [OK]  / → HTML  HTTP $($rootResp.StatusCode)"
        } else {
            Write-Host "  [FAIL] / did not return HTML"
        }
    } catch {
        Write-Host "  [FAIL] / failed: $_"
    }
} finally {
    # Stop server
    if ($serverProc -and -not $serverProc.HasExited) {
        Write-Host "  Stopping server (PID $($serverProc.Id)) ..."
        Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    # Clean up temp dir
    Write-Host "  Cleaning up temp folder ..."
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ── Final summary ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Summary ==="
Write-Host "  Zip size    : $zipSizeMB MB"
Write-Host "  Files in zip: $($included.Count)"
Write-Host "  Location    : $ZipPath"
Write-Host ""
