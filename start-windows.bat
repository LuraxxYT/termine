@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Installiere benoetigte Pakete beim ersten Start ...
  call npm install
  if errorlevel 1 (
    echo Installation fehlgeschlagen. Bitte Internetverbindung und Node.js pruefen.
    pause
    exit /b 1
  )
)
set ADMIN_PASSWORD=bitte-aendern
set SESSION_SECRET=BITTE-DIESEN_WERT-DURCH-EINE-LANGE-ZUFAELLIGE-ZEICHENFOLGE-ERSETZEN
node server.js
pause
