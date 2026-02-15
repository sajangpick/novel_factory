@echo off
chcp 65001 >nul 2>&1
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   노벨 팩토리 반자동 집필 도구 실행
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0"
python backend\novel_writer.py

echo.
pause
