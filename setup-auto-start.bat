@echo off
set "RESTAURANT_DIR=%~dp0"
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\WhatsApp-Connector-AutoStart.vbs"

(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%RESTAURANT_DIR%whatsapp-standalone-connector"
echo WshShell.Run "node server.js", 0, False
) > "%STARTUP_VBS%"

echo.
echo ======================================================================
echo  [SUCCESS] WhatsApp Connector added to Windows Auto-Startup!
echo ======================================================================
echo  Whenever this computer is turned on or restarted, the WhatsApp 
echo  background connector will automatically start in the background.
echo.
echo  Startup script created at:
echo  %STARTUP_VBS%
echo ======================================================================
echo.
pause
