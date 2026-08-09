# TikTok 抓取（新加坡 Worker → ERP FormManager）

与 GSC 方案 A 相同：阿里云业务、新加坡出网。

## 架构

```
erp.maoniux.com (FormManager)
  → POST http://新加坡:8788/fetch  (密钥 + 可选 IP 白名单)
  → 新加坡 curl 访问 tiktok.com
  → 返回 HTML
  → ERP 用 tiktokEmailExtract 解析邮箱并入库
```

代码：

- Worker：本仓库 `tiktok-worker/`
- ERP：https://github.com/heweng001/FormManager `tiktokFetch.js`

## 新加坡

见 [`../tiktok-worker/README.md`](../tiktok-worker/README.md)。

## 阿里云 ERP

在 `/opt/form-manager/.env` 或 PM2 环境中配置：

```bash
TIKTOK_WORKER_BASE="http://8.222.219.192:8788"
TIKTOK_WORKER_SECRET="长随机串"
```

`pm2 restart form-manager --update-env`

安全组：新加坡 `8788` 仅对阿里云 ECS 公网 IP 开放。
