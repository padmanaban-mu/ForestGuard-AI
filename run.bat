@echo off
:: run.bat — One-command launcher for ForestGuard AI (Windows).
:: Creates .venv if missing, installs runtime requirements, and starts the server.
:: Press Ctrl+C to stop.

setlocal enabledelayedexpansion

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%

set VENV=%REPO_ROOT%\.venv
set REQ=%REPO_ROOT%\requirements-serve.txt
set ENV_EXAMPLE=%REPO_ROOT%\backend\.env.example
set ENV_FILE=%REPO_ROOT%\backend\.env
set URL=http://127.0.0.1:8000

echo.
echo  ============================================================
echo   ForestGuard AI — single-server launcher
echo  ============================================================
echo.

:: ---------------------------------------------------------------
:: 1. Verify Python 3.13 via the Windows py launcher
:: ---------------------------------------------------------------
where py >nul 2>&1
if errorlevel 1 (
    echo  ERROR: The Python Launcher ^(py.exe^) was not found.
    echo         Install Python 3.13 from https://python.org/downloads/
    echo         and make sure "Add Python to PATH" and the launcher are selected.
    echo.
    pause
    exit /b 1
)

py -3.13 --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python 3.13 is not installed.
    echo         'py -3.13' returned a non-zero exit code.
    echo         Install Python 3.13 from https://python.org/downloads/
    echo         Other Python versions are NOT accepted — the model was trained
    echo         and pinned for Python 3.13.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%V in ('py -3.13 --version 2^>^&1') do set PY_VER=%%V
echo  Python : %PY_VER%

:: ---------------------------------------------------------------
:: 2. Create virtual environment if missing
:: ---------------------------------------------------------------
if not exist "%VENV%\Scripts\python.exe" (
    echo  Creating virtual environment at .venv ...
    py -3.13 -m venv "%VENV%"
    if errorlevel 1 (
        echo  ERROR: Could not create virtual environment.
        pause
        exit /b 1
    )
)

:: ---------------------------------------------------------------
:: 3. Install / upgrade runtime requirements
:: ---------------------------------------------------------------
echo  Installing requirements-serve.txt ...
"%VENV%\Scripts\python.exe" -m pip install --quiet --upgrade pip
"%VENV%\Scripts\python.exe" -m pip install --quiet -r "%REQ%"
if errorlevel 1 (
    echo  ERROR: pip install failed. Check requirements-serve.txt and your internet connection.
    pause
    exit /b 1
)

:: ---------------------------------------------------------------
:: 4. Copy .env.example to backend/.env if .env is missing
:: ---------------------------------------------------------------
if not exist "%ENV_FILE%" (
    if exist "%ENV_EXAMPLE%" (
        echo  Copying backend\.env.example → backend\.env (no key values; add FIRMS_MAP_KEY later)
        copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    )
)

:: ---------------------------------------------------------------
:: 5. Open browser in background (after a short delay)
:: ---------------------------------------------------------------
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start %URL%"

:: ---------------------------------------------------------------
:: 6. Start uvicorn in the FOREGROUND (Ctrl+C stops it)
:: ---------------------------------------------------------------
echo.
echo  Starting server at %URL% — press Ctrl+C to stop.
echo.
"%VENV%\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
