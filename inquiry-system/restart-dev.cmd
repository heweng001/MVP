@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  询盘系统 · 重启本地开发服务
echo  目录: %CD%
echo ========================================
echo.

echo [1/2] 停止占用 3000 端口的进程...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue;" ^
  "if (-not $conns) { Write-Host '  端口 3000 空闲'; exit 0 }" ^
  "foreach ($c in $conns) {" ^
  "  $procId = $c.OwningProcess;" ^
  "  if ($procId) {" ^
  "    try {" ^
  "      $p = Get-Process -Id $procId -ErrorAction Stop;" ^
  "      Write-Host ('  结束 PID ' + $procId + ' (' + $p.ProcessName + ')');" ^
  "      Stop-Process -Id $procId -Force -ErrorAction Stop;" ^
  "    } catch { Write-Host ('  无法结束 PID ' + $procId + ': ' + $_.Exception.Message) }" ^
  "  }" ^
  "}"

timeout /t 1 /nobreak >nul
echo.

echo [2/2] 启动开发服务 (http://localhost:3000) ...
echo 按 Ctrl+C 可停止服务
echo.
npm.cmd run dev

echo.
echo 开发服务已退出。
pause
