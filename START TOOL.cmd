@echo off
cd /d "%~dp0"
echo Blackstone Carry Review
echo Keep this window open while using the tool.
echo When the server is ready, open http://localhost:3000 in your browser.
echo Your saved settings are loaded automatically.
call npm.cmd run dev
pause
