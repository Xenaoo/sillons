@echo off
setlocal
title Sillons - Serveur local

pushd "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable.
  echo Installe Node.js 22.5 ou une version plus recente, puis relance ce fichier.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo Le serveur Sillons est deja lance sur http://127.0.0.1:3000
  if /I not "%~1"=="--no-browser" start "" "http://127.0.0.1:3000"
  popd
  exit /b 0
)

echo Demarrage de Sillons depuis %CD%
echo Adresse : http://127.0.0.1:3000
echo Ferme cette fenetre pour arreter le serveur.
echo.

if /I not "%~1"=="--no-browser" start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:3000'"

node server.js
set "SILLONS_EXIT_CODE=%ERRORLEVEL%"

if not "%SILLONS_EXIT_CODE%"=="0" (
  echo.
  echo [ERREUR] Le serveur s'est arrete avec le code %SILLONS_EXIT_CODE%.
  pause
)

popd
exit /b %SILLONS_EXIT_CODE%
