@echo off
title BorderGuard AI — Production Deploy
color 0A

echo.
echo  ██████╗  ██████╗ ██████╗ ██████╗ ███████╗██████╗  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗      █████╗ ██╗
echo  ██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗    ██╔══██╗██║
echo  ██████╔╝██║   ██║██████╔╝██║  ██║█████╗  ██████╔╝██║  ███╗██║   ██║███████║██████╔╝██║  ██║    ███████║██║
echo  ██╔══██╗██║   ██║██╔══██╗██║  ██║██╔══╝  ██╔══██╗██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║    ██╔══██║██║
echo  ██████╔╝╚██████╔╝██║  ██║██████╔╝███████╗██║  ██║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝    ██║  ██║██║
echo  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝     ╚═╝  ╚═╝╚═╝
echo.
echo  Defense-Grade AI Border Surveillance Platform
echo  ================================================

REM ── Step 1: Build React frontend
echo.
echo [1/3] Building React frontend for production...
cd /d "%~dp0frontend"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
echo  Frontend built successfully ^(dist/ folder ready^)

REM ── Step 2: Check .env
echo.
echo [2/3] Checking backend configuration...
cd /d "%~dp0backend"
if not exist ".env" (
    echo   .env not found — copying from .env.example
    copy ".env.example" ".env" >nul
    echo   IMPORTANT: Edit backend\.env and set your passwords!
)

REM ── Step 3: Launch production server
echo.
echo [3/3] Starting BorderGuard AI production server...
echo  Access the platform at: http://localhost:5000
echo  (Both frontend and backend served from port 5000)
echo.
echo  Login: admin / ChangeMe_Admin_123
echo  Press Ctrl+C to stop
echo.
cd /d "%~dp0backend"
.\.venv\Scripts\python serve.py
pause
