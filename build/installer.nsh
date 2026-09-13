!macro customInstall
  File /oname=$PLUGINSDIR\install-trucktel-games.ps1 "${BUILD_RESOURCES_DIR}\install-trucktel-games.ps1"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\install-trucktel-games.ps1"'

  ; Recreate the desktop shortcut explicitly with the embedded V.I.P icon.
  ; This avoids Windows keeping the generic Electron icon on the old .lnk.
  Delete "$DESKTOP\V.I.P LOGISTICS TRANSPORT DELIVERY APP.lnk"
  CreateShortCut "$DESKTOP\V.I.P LOGISTICS TRANSPORT DELIVERY APP.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 SW_SHOWNORMAL
!macroend
