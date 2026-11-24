@echo off
title WhatsApp Standalone Connector (Port 5050)
cd /d "%~dp0whatsapp-standalone-connector"
echo ========================================================
echo  Starting WhatsApp Standalone Connector on http://localhost:5050
echo ========================================================
echo.
echo Leave this window open while your restaurant is taking orders.
echo To stop, press Ctrl+C or close this window.
echo.
node server.js
pause
