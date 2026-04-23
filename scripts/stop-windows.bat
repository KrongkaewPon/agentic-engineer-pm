@echo off
setlocal

set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

cd /d "%ROOT_DIR%"
docker compose down
echo App stopped.
