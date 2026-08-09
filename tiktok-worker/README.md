# TikTok Worker（新加坡）

供阿里云 [FormManager](https://github.com/heweng001/FormManager)（erp.maoniux.com）调用：在新加坡出网抓取 TikTok 页面 HTML，由 ERP 本机解析邮箱。

与 `gsc-worker` 同机部署即可，互不影响。

## 部署

```bash
sudo mkdir -p /opt/tiktok-worker
# 上传本目录文件
cd /opt/tiktok-worker
cp .env.example .env
nano .env   # 设置 TIKTOK_WORKER_SECRET；建议 ALLOWED_IPS=阿里云ECS公网IP

npm ci
# 试跑
node server.mjs

# 或 systemd
sudo cp tiktok-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tiktok-worker
```

防火墙 / 安全组：只对 **阿里云 ECS 公网 IP** 放行 `8788/tcp`（或你改的 PORT）。

## ERP（FormManager）配置

在阿里云 ERP 的环境变量 / systemd 中：

```bash
TIKTOK_WORKER_BASE="http://8.222.219.192:8788"
TIKTOK_WORKER_SECRET="与新加坡 .env 一致"
```

重启 FormManager 后，服务端抓取会优先走新加坡；失败再回退原本地代理逻辑。

## 自测

```bash
curl -sS -X POST "http://127.0.0.1:8788/fetch" \
  -H "content-type: application/json" \
  -H "x-tiktok-worker-secret: 你的密钥" \
  -d '{"username":"某达人id"}' | head -c 200
```
