@echo off
setlocal enabledelayedexpansion
title SingSharp Vocal Trainer - Dev Server

cd /d "%~dp0"

echo ========================================================
echo   SingSharp - Vocal Trainer Dev Server Launcher
echo ========================================================
echo.

if not exist "node_modules\" (
    echo [1/2] Installing npm packages...
    call npm.cmd install
    echo.
)

set "PORT=5173"

:FIND_FREE_PORT
netstat -ano | findstr "LISTENING" | findstr /R /C:":!PORT! " > nul
if !errorlevel!==0 (
    echo [Port Check] Port !PORT! is already in use. Trying next port...
    set /a PORT+=1
    goto FIND_FREE_PORT
)

echo [Start] Starting Vite dev server on free port !PORT!...
echo Press Ctrl + C or close this window to stop the server.
echo.

call npm.cmd run dev -- --port !PORT! --open

pause