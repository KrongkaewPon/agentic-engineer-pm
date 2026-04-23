@echo off
setlocal

set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

cd /d "%ROOT_DIR%"
docker compose up --build -d
echo App started at http://localhost:8000
