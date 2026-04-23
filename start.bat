@echo off
chcp 65001 >nul
title Spotify Now Playing - Launcher

echo.
echo  ================================================
echo       SPOTIFY NOW PLAYING - OBS OVERLAY
echo  ================================================
echo.

:: ================================================
:: [1/4] Check Node.js
:: ================================================
echo  [1/4] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 goto :no_node
for /f "delims=" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo   OK - Node.js %NODE_VER%
echo.
goto :check_php

:no_node
echo.
echo  ================================================
echo   [ERROR] Node.js is not installed!
echo  ================================================
echo.
echo   Node.js is required to run this tool.
echo.
echo   1. Go to: https://nodejs.org/
echo   2. Download the "LTS" version (recommended)
echo   3. Install it, RESTART your computer, then run this file again
echo.
echo   Your browser will now open the Node.js download page...
pause
start https://nodejs.org/
exit /b 1

:: ================================================
:: [2/4] Check PHP
:: ================================================
:check_php
echo  [2/4] Checking PHP...
where php >nul 2>nul
if errorlevel 1 goto :no_php
echo   OK - PHP is installed
echo.
goto :check_python

:no_php
echo   WARNING - PHP is not installed.
echo   The Spotify lyrics fetching feature will not work.
echo.
echo   How to install PHP:
echo   1. Go to https://windows.php.net/download/
echo   2. Download the latest "VS17 x64 Non Thread Safe" build
echo   3. Extract it to a folder (e.g. C:\php)
echo   4. Add that folder to your Windows PATH environment variable
echo.
set /p _SKIP_PHP="   Skip PHP and continue anyway? (y/n): "
if /i not "%_SKIP_PHP%"=="y" (
    start https://windows.php.net/download/
    pause
    exit /b 1
)
echo.

:: ================================================
:: [3/4] Check Python
:: ================================================
:check_python
echo  [3/4] Checking Python...
where python >nul 2>nul
if errorlevel 1 (
    echo   WARNING - Python is not installed - YouTube Music lyrics fallback will be disabled.
    echo   ^(Optional - safe to skip^)
) else (
    for /f "delims=" %%v in ('python --version 2^>^&1') do echo   OK - %%v
)
echo.

:: ================================================
:: [4/4] Check and configure .env
:: ================================================
echo  [4/4] Checking configuration...

if not exist ".env" goto :setup_env

findstr /C:"your_client_id_here" .env >nul 2>nul
if not errorlevel 1 goto :setup_env

findstr /C:"your_client_secret_here" .env >nul 2>nul
if not errorlevel 1 goto :setup_env

findstr /C:"your_sp_dc_cookie_value_here" .env >nul 2>nul
if not errorlevel 1 goto :setup_env

echo   OK - .env is configured
echo.
goto :check_npm

:setup_env
echo.
echo  ================================================
echo     FIRST-TIME SETUP - Spotify credentials needed
echo  ================================================
echo.
echo   You need two types of credentials. Please read carefully:
echo.
echo   --- [A] CLIENT ID and CLIENT SECRET ---
echo   1. Go to: https://developer.spotify.com/dashboard
echo   2. Log in with your Spotify account
echo   3. Click "Create App"
echo   4. Give it any name. For "Redirect URI" enter exactly:
echo.
echo        http://127.0.0.1:8888/callback
echo.
echo   5. Click Save, then open Settings to see Client ID and Secret
echo.
echo   --- [B] SP_DC cookie ---
echo   1. Open Chrome and go to: https://open.spotify.com
echo   2. Log in to Spotify (if not already logged in)
echo   3. Press F12, open the "Application" tab
echo   4. Left panel: expand Cookies -^> https://open.spotify.com
echo   5. Find the row named "sp_dc", copy the "Value" column
echo.
echo   Press any key to open the Spotify Developer Dashboard...
pause
start https://developer.spotify.com/dashboard
echo.
echo  ================================================
echo.
set /p _CID="   Enter SPOTIFY_CLIENT_ID     : "
set /p _CS="   Enter SPOTIFY_CLIENT_SECRET : "
set /p _DC="   Enter SP_DC                 : "

if "%_CID%"=="" goto :env_empty
if "%_CS%"=="" goto :env_empty
if "%_DC%"=="" goto :env_empty

> .env echo SPOTIFY_CLIENT_ID=%_CID%
>> .env echo SPOTIFY_CLIENT_SECRET=%_CS%
>> .env echo SP_DC=%_DC%

echo.
echo   .env saved successfully!
echo.
goto :check_npm

:env_empty
echo.
echo   [ERROR] Fields cannot be empty. Please run this file again and fill all fields.
pause
exit /b 1

:: ================================================
:: Install Node.js dependencies if missing
:: ================================================
:check_npm
if exist "node_modules\express" goto :start_server

echo  Installing Node.js dependencies (first run, takes 1-2 minutes)...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed!
    echo  Check your internet connection and try again.
    pause
    exit /b 1
)
echo.
echo  Installation complete!
echo.

:: ================================================
:: Start the server
:: ================================================
:start_server
echo  ================================================
echo   STARTING SERVER...
echo  ================================================
echo.
echo   OBS Browser Source URL:
echo     http://127.0.0.1:8888
echo.
echo   Once the server starts, your browser will open
echo   the Spotify login page. Please authorize the app.
echo.
echo   Add the URL to OBS: Sources ^> Add ^> Browser Source
echo   URL: http://127.0.0.1:8888
echo.
echo   Press Ctrl+C to stop the server when done.
echo  ------------------------------------------------
echo.

node server.js

echo.
echo  Server stopped.
pause
