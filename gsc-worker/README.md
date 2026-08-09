# GSC Worker（已弃用：请用 seo-worker）

本目录保留作参考。**请部署仓库根目录 [`seo-worker/`](../seo-worker/)**：一个进程先后同步 GSC + GA4。

文档：[docs/SEO新加坡Worker.md](../docs/SEO新加坡Worker.md)

若新加坡机仍在跑 `/opt/gsc-worker`，建议：

1. 部署 `/opt/seo-worker`（可复用同一 `sa.json` 与密钥）
2. 把 cron 改为 `seo-worker` 的 `npm run sync`
3. GCP 为同一服务账号启用 Analytics Data API，并在各 GA4 属性加查看者
