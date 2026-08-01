# Inquiry Bridge for WPForms

将 WPForms Pro 提交推送到询盘管理系统。

## 安装

1. 将整个 `wp-inquiry-bridge` 目录复制到 WordPress 的 `wp-content/plugins/`（不是询盘系统服务器）
2. 在该站后台启用插件 **Inquiry Bridge for WPForms**（需已有 WPForms Pro）
3. 打开 **设置 → 询盘对接**，填写：
   - API URL：`https://你的系统域名/api/ingest`
   - Site Key：在询盘系统后台「站点/表单」中生成
   - 表单 ID 白名单（建议填写询盘表 form_id）
   - 字段 ID（可选，便于准确映射）

## 行为说明

- 推送成功：阻止本次 WPForms 原生通知（由中心系统过滤后发信）
- 推送失败：不拦截 WPForms 通知（降级放行，避免丢单）
- 请保留 WPForms 通知收件人配置作为降级备用
