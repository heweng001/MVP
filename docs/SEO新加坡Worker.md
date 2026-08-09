# SEO 同步（新加坡 Worker：GSC + GA4）

## 架构

```
新加坡 Ubuntu 定时 npm run sync（seo-worker）
  → GET  https://mvp.maoniux.com/api/seo-worker/sites
  → Google Search Console API  → POST /api/gsc-worker/ingest
  → Google Analytics Data API  → POST /api/ga-worker/ingest
阿里云后台网站列表 /admin/sites/[id]/gsc 与 /ga 展示缓存
```

旧文档 [GSC新加坡Worker.md](./GSC新加坡Worker.md) 仍有效；部署请改用仓库根目录 [`seo-worker/`](../seo-worker/)。

## 阿里云询盘系统

1. 部署代码后执行 `npx prisma db push`
2. `.env` 密钥（任选其一即可，seo-worker 会按优先级读取）：

```bash
SEO_WORKER_SECRET="一串足够长的随机串"
# 或沿用
# CRON_SECRET=...
```

3. 网站编辑：
   - **GSC**：勾选同步，填写属性 URL（`sc-domain:example.com` 或网址前缀）
   - **GA4**：勾选同步，填写 **数字** Property ID（管理 → 媒体资源设置，不是 `G-XXXX`）
4. 目标关键词（可选）：信息核对 → 关键词。同步时仍会分页拉全量 query 做漏斗统计；目标词优先保留在详情里，全量触顶时才对缺失词精确补查。

## 新加坡服务器

见 [`seo-worker/README.md`](../seo-worker/README.md)。

同一服务账号需：

- GSC 各属性可读权限
- GA4 各媒体资源「查看者」
- GCP 启用 Search Console API + Analytics Data API

公网 IP 仅用于 SSH；不必对公网开放业务端口。

## 指标说明

| 字段 | 来源 |
|------|------|
| 关键词平均排名 / 展示 / 点击 | GSC Search Analytics（延迟 2～3 天） |
| GSC「页面数」 | 同期有展示的 page 行数，**不是**完整收录量 |
| 会话 / 用户 / 浏览量 / 互动会话 / 互动率 / 转化 | GA4 Data API（延迟约 1～2 天） |
| 落地页 / 渠道 | GA4，按会话 Top N |
| 自然搜索关键词 | **只看 GSC**，GA 通常拿不到 |

## 自然月同步（月报）

日常 `npm run sync` 除滚动近 N 天外，还会写入：

- **当月 MTD** 自然月快照 → `POST /api/seo-worker/month-ingest`
- 每月 **1～3 日**额外同步 **上个月**完整窗

补历史月：

```bash
npm run sync:month -- 2026-07
```

月报生成依赖该自然月快照；与询盘自然月同口径。
