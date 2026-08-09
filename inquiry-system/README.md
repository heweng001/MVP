# 询盘管理系统（MVP）

对接 WordPress WPForms Pro：垃圾评分 → 拦截/待审/代发 → 客户邮件标记 → 按月按站统计。

需求文档见：[`../docs/询盘管理系统-需求-v1.1.md`](../docs/询盘管理系统-需求-v1.1.md)

## 快速开始

```bash
cd inquiry-system
cp .env.example .env
# 编辑 .env：SMTP、AUTH_SECRET、CRON_SECRET、APP_URL 等

npm install
npm run db:setup
npm run dev
```

浏览器打开 http://localhost:3001  
默认管理员：`.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`（默认 `admin` / `admin123`）

## 配置要点

1. 后台创建客户 → 站点（得到 `site_key`）→ 按 `form_id` 配置收件人/抄送与产品关键词  
2. 各 WP 站安装插件目录 `wp-inquiry-bridge`，在「设置 → Inquiry Bridge」填写：  
   - API URL：`https://你的域名/api/ingest`  
   - Site Key：后台生成的密钥  
   - 表单 ID 白名单与字段 ID（可选）  
3. 配置 SMTP（服务商域名），否则开发环境会跳过真实发信并在服务端日志打印标记链接  
4. 定时任务（阿里云 crontab，时区 Asia/Shanghai）：

```bash
# 每天 12:00 批量转发全部待审核
curl -X POST "https://你的域名/api/cron?task=review" -H "x-cron-secret: 你的CRON_SECRET"
# 每月 1 日生成上月月报（可选；也可在后台手点生成）
curl -X POST "https://你的域名/api/cron?task=monthly-report" -H "x-cron-secret: 你的CRON_SECRET"
```

## 有效占比与拦截

```
拦截       = auto_spam + review_spam
待标记     = pending（已转发未点有效/无效）
有效占比   = (标记有效 + 待标记) / 已转发 × 100%
```

## GSC 排名同步（新加坡 Worker）

方案 A：新加坡机调用 Google Search Console API，回写本系统。见 [`../docs/GSC新加坡Worker.md`](../docs/GSC新加坡Worker.md) 与 [`../gsc-worker/README.md`](../gsc-worker/README.md)。

## 生产部署

Node + systemd + Nginx（不用 Docker）。线上：https://mvp.maoniux.com  

详见 [`../docs/部署到阿里云.md`](../docs/部署到阿里云.md)。日常更新：

```bash
cd /opt/inquiry/repo && git pull
cd inquiry-system
npm ci && npx prisma db push && npm run build
systemctl restart inquiry-system
```

## 目录

| 路径 | 说明 |
|------|------|
| `src/app/admin` | 管理后台 |
| `src/app/api/ingest` | WP 推送入口 |
| `src/app/m/[token]` | 客户标记确认页 |
| `src/lib/spam.ts` | 外贸英文垃圾评分 |
| `../wp-inquiry-bridge` | WordPress 插件 |
