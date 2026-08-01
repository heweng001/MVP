# 询盘管理系统

WordPress（WPForms Pro）询盘接入、垃圾过滤、客户邮件标记与月度统计。

## 目录

| 路径 | 说明 |
|------|------|
| `inquiry-system/` | Next.js 中心系统（管理后台 + API） |
| `wp-inquiry-bridge/` | WordPress 对接插件 |
| `docs/` | 需求与部署文档 |
| `deploy/` | 服务器部署脚本 |

## 本地开发

```bash
cd inquiry-system
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

打开 http://localhost:3000 ，默认管理员见 `.env`。

## 生产部署

见 [docs/部署到阿里云.md](docs/部署到阿里云.md)。

简要：`inquiry-system` 目录下配置 `.env.production` 后执行：

```bash
docker compose up -d --build
```
