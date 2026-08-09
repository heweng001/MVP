# SEO Worker（新加坡：GSC + GA4）

一个进程先后同步 Google Search Console 与 Google Analytics 4，回写阿里云询盘系统。

## 架构

```
新加坡 cron → npm run sync
  → GET  /api/seo-worker/sites
  → GSC/GA 滚动近 N 天 → /api/gsc-worker/ingest + /api/ga-worker/ingest
  → GSC/GA 自然月（当月 MTD；月初再补上月）→ /api/seo-worker/month-ingest
```

补历史月：`npm run sync:month -- 2026-07`

## 前置

1. GCP 启用 **Search Console API**、**Google Analytics Data API**
2. 同一服务账号：
   - 每个 GSC 属性添加为用户（完整/可读）
   - 每个 GA4 媒体资源添加为「查看者」
3. 询盘后台站点编辑：
   - GSC：勾选同步 + 属性 URL
   - GA：勾选同步 + **数字** Property ID（非 `G-XXXX`）

## 部署

```bash
sudo mkdir -p /opt/seo-worker/secrets
# 上传本目录与 sa.json
sudo chmod 600 /opt/seo-worker/secrets/sa.json

cd /opt/seo-worker
cp .env.example .env
# 编辑 INQUIRY_API_BASE / SEO_WORKER_SECRET / GOOGLE_APPLICATION_CREDENTIALS

npm install
set -a && . ./.env && set +a && npm run sync
```

若机器上仍有旧的 `/opt/gsc-worker`，可迁到本目录后改 cron；密钥可继续用原 `CRON_SECRET`。

## 定时（每天一次）

```bash
# 每天 06:30（服务器本地时区）
30 6 * * * cd /opt/seo-worker && set -a && . ./.env && set +a && /usr/bin/npm run sync >> /var/log/seo-worker.log 2>&1
```

## 指标说明

| 来源 | 含义 |
|------|------|
| GSC 关键词/页面 | 搜索展示与点击；页面数为有展示 URL，非完整收录 |
| GA 会话/用户/转化 | 站内行为；转化为 GA4 关键事件次数 |
| GA 落地页 / 渠道 | 按会话排序的 Top N |
