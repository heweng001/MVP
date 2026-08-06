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
- **v1.0.15**：浏览路径表头改为「页面 / 北京时间 / 停留秒数」；时间转 Asia/Shanghai；页面列附带 URL 路径
- **v1.0.14**：Smart Tag 为空时，用已抓到的 journey 数据生成 WPForms 风格 HTML（Page/Date/Duration），避免询盘侧空白
- **v1.0.13**：REST 自更新（`/wp-json/inquiry-bridge/v1/self-update`，校验 site_key，仅允许从询盘中心下载 zip）；配合中心「更新插件」
- **v1.0.12**：User Journey 优先 `{entry_user_journey}` Smart Tag；仍无延迟/补推
- **v1.0.11**：修复 Name 猜测误用 Company（不再用泛化 `text` 兜底；优先 Name 类型 / 姓名类标签）
- **v1.0.10**：取消推送前等待 5 秒与 journey 补推；保留多源抓取（独立表 / meta / Cookie/POST）
- **v1.0.9**：User Journey 修复——读独立表/`user_uuid`、Cookie/POST；曾在 `process_complete` 补推（已于 1.0.10 移除）
- **v1.0.8**：曾推送前等待约 5 秒（已于 1.0.10 移除）
- 需站点已安装并启用：
  - WPForms **Geolocation** Addon（Location 板块）
  - WPForms **User Journey** Addon
