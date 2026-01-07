@echo off
cd /d "%~dp0"
npm run scan:file -- urls.txt
node scripts/open-report.js
pause
