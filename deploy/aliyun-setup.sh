#!/usr/bin/env bash
# 在阿里云服务器上执行（Ubuntu 22.04+ 示例）
# 用法：
#   chmod +x aliyun-setup.sh
#   ./aliyun-setup.sh /opt/inquiry-system
set -euo pipefail

APP_DIR="${1:-/opt/inquiry-system}"

echo "==> 安装 Docker（若未安装）"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

echo "==> 准备目录 ${APP_DIR}"
mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

if [ ! -f docker-compose.yml ]; then
  echo "请先把 inquiry-system 代码放到 ${APP_DIR}（含 Dockerfile / docker-compose.yml）"
  echo "例如：git clone <你的仓库> ${APP_DIR} 后进入 inquiry-system 子目录"
  exit 1
fi

if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  echo "已生成 .env.production，请先编辑：APP_URL / AUTH_SECRET / CRON_SECRET / 管理员密码 / SMTP"
  echo "  nano ${APP_DIR}/.env.production"
  exit 1
fi

echo "==> 构建并启动"
docker compose up -d --build

echo "==> 完成"
docker compose ps
echo "访问：浏览器打开 APP_URL（并在安全组放行 ${HOST_PORT:-3000} 或用 Nginx 反代 443）"
