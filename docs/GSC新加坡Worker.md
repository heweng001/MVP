# GSC 同步（已并入 SEO Worker）

GSC 与 GA4 已合并为同一进程，请改看：

- [SEO新加坡Worker.md](./SEO新加坡Worker.md)
- 仓库 [`seo-worker/`](../seo-worker/)

兼容说明：

- 入库接口仍为 `POST /api/gsc-worker/ingest`
- 旧路径 `GET /api/gsc-worker/sites` 仍可用（仅 GSC 站点）
- 新 worker 使用 `GET /api/seo-worker/sites`（GSC + GA）
