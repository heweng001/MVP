# GSC Worker（新加坡）

方案 A：在新加坡服务器调用 Google Search Console API，再把结果回写阿里云询盘系统。

## 前置

1. GCP 启用 **Google Search Console API**，创建服务账号并下载 JSON  
2. 每个网站的 GSC 属性中添加该服务账号邮箱（完整/可读权限）  
3. 阿里云询盘系统已部署含 `/api/gsc-worker/*` 的版本，并配置 `GSC_WORKER_SECRET`  
4. 后台网站编辑中勾选「同步 GSC」，并填写正确的 `gscPropertyUrl`（如 `sc-domain:example.com`）

## 部署到新加坡机

```bash
sudo mkdir -p /opt/gsc-worker/secrets
# 上传本目录与 sa.json
sudo chmod 600 /opt/gsc-worker/secrets/sa.json

cd /opt/gsc-worker
cp .env.example .env
# 编辑 .env：INQUIRY_API_BASE / GSC_WORKER_SECRET / GOOGLE_APPLICATION_CREDENTIALS

npm ci
npm run sync
```

## 定时（每天一次即可）

```bash
crontab -e
# 每天 06:30（新加坡时间）同步
30 6 * * * cd /opt/gsc-worker && set -a && . ./.env && set +a && /usr/bin/npm run sync >> /var/log/gsc-worker.log 2>&1
```

## 安全

- 不要把服务账号 JSON 和 `GSC_WORKER_SECRET` 提交到 Git  
- 本机只需出站访问 Google 与阿里云 HTTPS，**不必**对公网开放业务端口  
- 阿里云侧用 `x-gsc-worker-secret` 校验请求

## 数据说明

| 展示 | 含义 |
|------|------|
| 关键词排名 | Search Analytics 近 N 天平均 `position`（有 2～3 天延迟） |
| 页面数 | 同期有展示的 `page` 行数，**不是**完整索引库总量 |
