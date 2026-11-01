@echo off
setlocal
cd /d "%~dp0"
title InstinctGo - Frontend and Backend
echo Starting InstinctGo frontend and backend...
echo Website:  http://127.0.0.1:3000
echo API docs: http://127.0.0.1:8000/docs
echo Keep this window open while using the site.
echo.
call npm.cmd run dev
set "DEV_EXIT_CODE=%ERRORLEVEL%"
echo.
echo Development servers stopped. Exit code: %DEV_EXIT_CODE%
echo If startup failed, the error is shown above.
pause
exit /b %DEV_EXIT_CODE%
