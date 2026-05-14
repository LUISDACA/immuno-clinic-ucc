@echo off
setlocal

if "%~1"=="" (
  echo Usage: scripts\build_web_release.cmd https://TU-SERVICIO.onrender.com/api/v1
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_web_release.ps1" -ApiBaseUrl "%~1"
exit /b %ERRORLEVEL%
