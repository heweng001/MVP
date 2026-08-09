# GSC 同步（方案 A：新加坡 Worker → 阿里云）

## 架构

```
新加坡 Ubuntu 定时 npm run sync
  → GET  https://mvp.maoniux.com/api/gsc-worker/sites
  → Google Search Console API
  → POST https://mvp.maoniux.com/api/gsc-worker/ingest
阿里云后台网站列表 /admin/sites/[id]/gsc 展示缓存
```

## 阿里云询盘系统

1. 部署含本功能的代码后执行 `npx prisma db push`
2. `.env` 增加（或沿用 CRON_SECRET）：

```bash
GSC_WORKER_SECRET="一串足够长的随机串"
```

3. 网站编辑：勾选「同步 Google Search Console」，填写属性 URL  
   - 域名属性：`sc-domain:example.com`  
   - 网址前缀：`https://www.example.com/`（须与 GSC 完全一致）
4. 目标关键词：在该站关联的「信息核对 → 关键词」中维护（一行一个）。未维护时 worker 拉取点击 Top 查询。

## 新加坡服务器

见仓库根目录 [`gsc-worker/README.md`](../gsc-worker/README.md)。

公网 IP 仅用于 SSH 运维；**不必**对公网开放业务端口。Worker 主动出站访问 Google 与阿里云即可。

## 指标说明

| 字段 | 来源 |
|------|------|
| 关键词平均排名 | Search Analytics `query` + `position`（近 N 天平均，有 2～3 天延迟） |
| 页面数 | 同期有展示的 `page` 行数，**不是**索引库完整收录量 |
