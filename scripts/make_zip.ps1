# scripts/make_zip.ps1 - Package ForestGuard AI for teammates.
#
# Creates ../ForestGuard-AI-share.zip in the repo parent directory.
# Then extracts it, runs check_setup.py, starts the server, fetches /health
# and /, verifies no .env and no FIRMS key text, reports the result.
#
# Run from the repo root:
#   .\scripts\make_zip.ps1

$ErrorActionPreference = "Stop"

# ---- Paths ------------------------------------------------------------------
$RepoRoot  = (Resolve-Path "$PSScriptRoot\..").Path
$RepoName  = Split-Path $RepoRoot -Leaf
$ParentDir = Split-Path $RepoRoot -Parent
$ZipPath   = Join-Path $ParentDir "ForestGuard-AI-share.zip"
$TempDir   = Join-Path ([System.IO.Path]::GetTempPath()) ("forestguard-zip-verify-" + [System.Guid]::NewGuid().ToString("N").Substring(0,8))

Write-Host ""
Write-Host "=== ForestGuard AI make_zip ==="
Write-Host "Repo root : $RepoRoot"
Write-Host "Output    : $ZipPath"
Write-Host ""

# ---- Read FIRMS key from backend/.env (for security scan) -------------------
$firmsKey = ""
$envFile = Join-Path $RepoRoot "backend\.env"
if (Test-Path $envFile) {
    foreach ($line in (Get-Content $envFile)) {
        if ($line -match "^FIRMS_MAP_KEY=(.+)$") {
            $firmsKey = $Matches[1].Trim()
            break
        }
    }
}

# ---- Exclusion patterns -----------------------------------------------------
$ExcludePatterns = @(
    ".git",
    ".agent",
    "node_modules",
    "frontend\dist",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "ml\data\raw"
)

function ShouldExclude($relativePath) {
    $rp = $relativePath.Replace("/", "\")
    $segments = $rp -split "\\"

    # .env files: exclude segments named exactly ".env" or ".env.*" but NOT ".env.example"
    foreach ($seg in $segments) {
        if ($seg -eq ".env") { return $true }
        if ($seg -match "^\.env\." -and $seg -ne ".env.example") { return $true }
    }

    foreach ($pat in $ExcludePatterns) {
        $p = $pat.Replace("/", "\")
        if ($rp -eq $p) { return $true }
        if ($rp.StartsWith($p + "\")) { return $true }
        foreach ($seg in $segments) {
            if ($seg -eq $p) { return $true }
        }
    }
    return $false
}

# ---- Collect files ----------------------------------------------------------
Write-Host "Collecting files ..."
$MaxFileSizeBytes = 20 * 1024 * 1024  # 20 MB

$allFiles = Get-ChildItem -Path $RepoRoot -Recurse -File
$included = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$excludedCount = 0

foreach ($file in $allFiles) {
    $rel = $file.FullName.Substring($RepoRoot.Length + 1)

    if (ShouldExclude $rel) {
        $excludedCount++
        continue
    }
    if ($file.Length -gt $MaxFileSizeBytes) {
        Write-Host ("  SKIP (>20 MB): " + $rel + "  (" + [Math]::Round($file.Length/1MB,1) + " MB)")
        $excludedCount++
        continue
    }
    $included.Add($file)
}

Write-Host ("  Included : " + $included.Count + " files")
Write-Host ("  Excluded : $excludedCount items")

# ---- Build the zip ----------------------------------------------------------
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Write-Host ""
Write-Host "Building zip ..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($ZipPath, "Create")
try {
    foreach ($file in $included) {
        $entryName = $RepoName + "\" + $file.FullName.Substring($RepoRoot.Length + 1)
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $file.FullName, $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $zip.Dispose()
}

$zipSizeMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ("Zip created: " + $ZipPath + " (" + $zipSizeMB + " MB)")

# ---- Top-level entries ------------------------------------------------------
Write-Host ""
Write-Host "Top-level entries in zip:"
$zipRead = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    $topLevel = $zipRead.Entries |
        ForEach-Object { ($_.FullName -replace "\\", "/").Split("/")[1] } |
        Sort-Object -Unique
    foreach ($t in $topLevel) { Write-Host "  $t" }
} finally {
    $zipRead.Dispose()
}

# ---- Security scan: no .env, no FIRMS key -----------------------------------
Write-Host ""
Write-Host "Security scan ..."
$zipScan = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
$envLeaks = [System.Collections.Generic.List[string]]::new()
$keyLeaks  = [System.Collections.Generic.List[string]]::new()
$textExts = @(".txt",".py",".js",".ts",".json",".md",".env",".cfg",".ini",".toml",".yaml",".yml",".sh",".bat",".ps1",".html",".css",".jsx",".tsx",".csv")

try {
    foreach ($entry in $zipScan.Entries) {
        $ename = $entry.FullName -replace "\\","/"
        $leaf  = Split-Path $ename -Leaf

        if ($leaf -eq ".env" -or ($leaf -match "^\.env\." -and $leaf -ne ".env.example")) {
            $envLeaks.Add($ename)
        }

        if ($firmsKey -and $entry.Length -gt 0 -and $entry.Length -lt (2 * 1024 * 1024)) {
            $ext = [System.IO.Path]::GetExtension($ename).ToLower()
            if ($textExts -contains $ext -or $ext -eq "") {
                try {
                    $stream  = $entry.Open()
                    $reader  = New-Object System.IO.StreamReader($stream)
                    $content = $reader.ReadToEnd()
                    $reader.Dispose()
                    $stream.Dispose()
                    if ($content.Contains($firmsKey)) { $keyLeaks.Add($ename) }
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
    foreach ($e in $envLeaks) { Write-Host "         $e" }
}

if ($firmsKey) {
    if ($keyLeaks.Count -eq 0) {
        Write-Host "  [OK]  No FIRMS key text found in any zip entry"
    } else {
        Write-Host "  [FAIL] FIRMS key text found in:"
        foreach ($k in $keyLeaks) { Write-Host "         $k" }
    }
} else {
    Write-Host "  [INFO] FIRMS key is empty - skipping content scan"
}

# ---- Extract and smoke-test -------------------------------------------------
Write-Host ""
Write-Host "Smoke-testing extracted zip in temp folder ..."
Write-Host "  Temp : $TempDir"
New-Item -ItemType Directory -Path $TempDir | Out-Null

$serverProc = $null
try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $TempDir)
    $extractedRepo = Join-Path $TempDir $RepoName

    Write-Host ""
    Write-Host "  Running check_setup.py ..."
    $checkOut = & py -3.13 "$extractedRepo\scripts\check_setup.py" 2>&1
    foreach ($line in $checkOut) { Write-Host "  $line" }

    Write-Host ""
    Write-Host "  Starting server (port 8001) ..."
    $savedPYTHONPATH = $env:PYTHONPATH
    $env:PYTHONPATH  = $extractedRepo
    $pythonExe = (& py -3.13 -c "import sys; print(sys.executable)").Trim()
    $serverProc = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m","uvicorn","backend.main:app","--host","127.0.0.1","--port","8001" `
        -WorkingDirectory $extractedRepo `
        -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 7

    try {
        $h = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -TimeoutSec 10 -UseBasicParsing
        $hj = $h.Content | ConvertFrom-Json
        Write-Host ("  [OK]  /health HTTP " + $h.StatusCode + "  status=" + $hj.status)
    } catch { Write-Host "  [FAIL] /health: $_" }

    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8001/" -TimeoutSec 10 -UseBasicParsing
        $isHtml = $r.Content -match "<html"
        Write-Host ("  [OK]  / HTTP " + $r.StatusCode + "  HTML=" + $isHtml)
    } catch { Write-Host "  [FAIL] /: $_" }

    $env:PYTHONPATH = $savedPYTHONPATH
} finally {
    if ($serverProc -and -not $serverProc.HasExited) {
        Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
        Write-Host ("  Server stopped (PID " + $serverProc.Id + ")")
    }
    $portProcs = Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($portProcs) {
        foreach ($p in $portProcs) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Temp folder removed."
}

# ---- Final summary ----------------------------------------------------------
Write-Host ""
Write-Host "=== Summary ==="
Write-Host ("  Zip size    : " + $zipSizeMB + " MB")
Write-Host ("  Files in zip: " + $included.Count)
Write-Host ("  Location    : " + $ZipPath)
Write-Host ""
