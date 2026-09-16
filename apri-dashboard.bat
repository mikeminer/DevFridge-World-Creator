@echo off
cd /d "%~dp0"
py -3 scripts\dashboard.py
if errorlevel 1 python scripts\dashboard.py
pause
