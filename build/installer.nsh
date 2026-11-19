; 安装前自动关闭正在运行的 WorkRecord（包括隐藏在托盘里的实例），
; 避免出现「WorkRecord 正在运行」的提示阻断安装。
!macro customCheckAppRunning
  !insertmacro nsProcess::FindProcess "${APP_EXECUTABLE_FILENAME}" $R0
  StrCmp $R0 0 0 done
    DetailPrint "Closing running ${PRODUCT_NAME}..."
    !insertmacro nsProcess::KillProcess "${APP_EXECUTABLE_FILENAME}" $R0
    Sleep 800

    !insertmacro nsProcess::FindProcess "${APP_EXECUTABLE_FILENAME}" $R0
    StrCmp $R0 0 0 done
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(appCannotBeClosed)"
      Quit

  done:
!macroend
