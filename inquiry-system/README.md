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

浏览器打开 http://localhost:3000  
默认管理员：`.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`（默认 `admin` / `admin123`）

## 配置要点

1. 后台创建客户 → 站点（得到 `site_key`）→ 按 `form_id` 配置收件人/抄送与产品关键词  
2. 各 WP 站安装插件目录 `wp-inquiry-bridge`，在「设置 → Inquiry Bridge」填写：  
   - API URL：`https://你的域名/api/ingest`  
   - Site Key：后台生成的密钥  
   - 表单 ID 白名单与字段 ID（可选）  
3. 配置 SMTP（服务商域名），否则开发环境会跳过真实发信并在服务端日志打印标记链接  
4. 定时任务（建议每 5～15 分钟）：

```bash
curl -X POST "https://你的域名/api/cron" -H "x-cron-secret: 你的CRON_SECRET"
```

用于：待审超过 6 小时自动发信；发信超过 72 小时未标记 → `timeout_unmarked`。

## 有效占比与拦截

```
拦截       = auto_spam + review_spam
待标记     = pending（窗口内未点）
超时未标记 = timeout_unmarked
有效占比   = (标记有效 + 待标记 + 超时未标记) / 已转发 × 100%
```

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
