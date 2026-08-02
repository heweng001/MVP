@echo off
REM 从仓库根目录一键重启本地开发服务
cd /d "%~dp0inquiry-system"
call restart-dev.cmd
