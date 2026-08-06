<?php
/**
 * Plugin Name: Inquiry Bridge for WPForms
 * Description: 将 WPForms 询盘推送到询盘管理系统；推送成功则阻止 WPForms 原生通知，失败则降级由 WPForms 发信。
 * Version: 1.0.15
 * Author: Inquiry System
 * Requires Plugins: wpforms
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Inquiry_Bridge_Plugin
{
    const OPTION = 'inquiry_bridge_settings';
    const VERSION = '1.0.15';

    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'admin_menu']);
        add_action('admin_init', [__CLASS__, 'register_settings']);
        add_action('rest_api_init', [__CLASS__, 'register_rest_routes']);

        // Ensure notifications run in the same request so we can suppress after ingest.
        add_filter('wpforms_tasks_entry_emails_trigger_send_same_process', '__return_true');

        // 晚于各 Addon 写入 Location / User Journey
        add_action('wpforms_process_entry_saved', [__CLASS__, 'on_entry_saved'], 999, 4);

        add_filter('wpforms_disable_all_emails', [__CLASS__, 'maybe_disable_emails']);
    }

    public static function register_rest_routes()
    {
        register_rest_route('inquiry-bridge/v1', '/version', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'rest_version'],
            'permission_callback' => [__CLASS__, 'rest_check_site_key'],
        ]);
        register_rest_route('inquiry-bridge/v1', '/self-update', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'rest_self_update'],
            'permission_callback' => [__CLASS__, 'rest_check_site_key'],
        ]);
    }

    /** @param WP_REST_Request $request */
    public static function rest_check_site_key($request)
    {
        $settings = self::settings();
        $expected = isset($settings['site_key']) ? (string) $settings['site_key'] : '';
        if ($expected === '') {
            return new WP_Error('misconfigured', 'Site key not configured', ['status' => 503]);
        }
        $got = (string) $request->get_header('X-Inquiry-Site-Key');
        if ($got === '') {
            $got = (string) $request->get_param('site_key');
        }
        if ($got === '' || !hash_equals($expected, $got)) {
            return new WP_Error('forbidden', 'Invalid site key', ['status' => 403]);
        }
        return true;
    }

    public static function rest_version()
    {
        return rest_ensure_response([
            'ok' => true,
            'version' => self::VERSION,
            'plugin' => 'wp-inquiry-bridge/inquiry-bridge.php',
        ]);
    }

    /** @param WP_REST_Request $request */
    public static function rest_self_update($request)
    {
        if (!function_exists('download_url')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/plugin.php';

        $settings = self::settings();
        $body_url = (string) $request->get_param('download_url');
        $zip_url = self::resolve_update_zip_url($settings, $body_url);
        if (is_wp_error($zip_url)) {
            return $zip_url;
        }

        // 临时允许本请求内覆盖同名插件
        add_filter('upgrader_package_options', [__CLASS__, 'force_overwrite_package']);

        $skin = new Automatic_Upgrader_Skin();
        $upgrader = new Plugin_Upgrader($skin);
        $result = $upgrader->install($zip_url, ['overwrite_package' => true, 'clear_destination' => true]);

        remove_filter('upgrader_package_options', [__CLASS__, 'force_overwrite_package']);

        if (is_wp_error($result)) {
            return $result;
        }
        if ($result !== true) {
            $messages = method_exists($skin, 'get_upgrade_messages') ? $skin->get_upgrade_messages() : [];
            return new WP_Error(
                'update_failed',
                'Plugin update failed',
                ['status' => 500, 'messages' => $messages]
            );
        }

        $plugin_file = 'wp-inquiry-bridge/inquiry-bridge.php';
        if (!is_plugin_active($plugin_file)) {
            activate_plugin($plugin_file, '', false, false);
        }

        // 重新读文件头版本（覆盖后常量可能仍是旧进程值；读文件更准）
        $ver = self::VERSION;
        $main = WP_PLUGIN_DIR . '/' . $plugin_file;
        if (is_readable($main)) {
            $head = (string) file_get_contents($main, false, null, 0, 4096);
            if (preg_match('/^\s*\*\s*Version:\s*([0-9][^\r\n]*)/m', $head, $m)) {
                $ver = trim($m[1]);
            }
        }

        return rest_ensure_response([
            'ok' => true,
            'version' => $ver,
            'message' => 'updated',
        ]);
    }

    public static function force_overwrite_package($options)
    {
        if (is_array($options)) {
            $options['clear_destination'] = true;
            $options['abort_if_destination_exists'] = false;
        }
        return $options;
    }

    /**
     * 仅允许下载中心域名（来自已配置 api_url）上的 zip
     * @param array $settings
     * @param string $body_url
     * @return string|WP_Error
     */
    private static function resolve_update_zip_url($settings, $body_url)
    {
        $api_url = isset($settings['api_url']) ? trim((string) $settings['api_url']) : '';
        if ($api_url === '') {
            return new WP_Error('misconfigured', 'API URL not configured', ['status' => 503]);
        }
        $base = preg_replace('#/api/ingest/?$#i', '', $api_url);
        $base = rtrim((string) $base, '/');
        $fallback = $base . '/api/plugin/latest/zip?site_key=' . rawurlencode((string) $settings['site_key']);

        $candidate = trim($body_url) !== '' ? trim($body_url) : $fallback;
        $allowed_host = wp_parse_url($base, PHP_URL_HOST);
        $cand_host = wp_parse_url($candidate, PHP_URL_HOST);
        if (!$allowed_host || !$cand_host || strtolower($allowed_host) !== strtolower((string) $cand_host)) {
            return new WP_Error('bad_download', 'download_url host mismatch', ['status' => 400]);
        }
        $path = (string) wp_parse_url($candidate, PHP_URL_PATH);
        if (strpos($path, '/api/plugin/latest/zip') === false) {
            return new WP_Error('bad_download', 'download_url path not allowed', ['status' => 400]);
        }
        return $candidate;
    }

    public static function defaults()
    {
        return [
            'api_url' => '',
            'site_key' => '',
            'form_ids' => '',
            'name_field' => '',
            'email_field' => '',
            'phone_field' => '',
            'message_field' => '',
        ];
    }

    public static function settings()
    {
        return wp_parse_args(get_option(self::OPTION, []), self::defaults());
    }

    public static function admin_menu()
    {
        add_options_page(
            '询盘对接 Inquiry Bridge',
            '询盘对接',
            'manage_options',
            'inquiry-bridge',
            [__CLASS__, 'render_settings']
        );
    }

    public static function register_settings()
    {
        register_setting('inquiry_bridge', self::OPTION);
    }

    public static function render_settings()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $s = self::settings();
        ?>
        <div class="wrap">
            <h1>Inquiry Bridge（询盘对接）</h1>
            <div class="notice notice-info inline" style="padding:12px 16px;max-width:860px;">
                <p><strong>配置从哪里来？</strong>在询盘管理系统后台 →「网站列表」→ 右侧「配置表单」，可复制：</p>
                <ul style="list-style:disc;margin-left:1.4em;">
                    <li><strong>API URL</strong>：形如 <code>https://你的系统域名/api/ingest</code>（各站相同）</li>
                    <li><strong>Site Key</strong>：该站专用密钥（每站不同，勿共用）</li>
                </ul>
                <p>请<strong>保留</strong> WPForms 表单「通知」作为降级备用：推送成功时本插件会阻止本次原生发信；推送失败时仍由 WPForms 发信，避免丢单。</p>
                <p>地理位置与用户路径从 WPForms <strong>Location / User Journey</strong> 板块读取（不依赖 Hidden）。需安装 Geolocation、User Journey 插件。</p>
            </div>
            <form method="post" action="options.php">
                <?php settings_fields('inquiry_bridge'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th>API URL</th>
                        <td>
                            <input class="regular-text" name="<?php echo esc_attr(self::OPTION); ?>[api_url]" value="<?php echo esc_attr($s['api_url']); ?>" placeholder="https://your-system.com/api/ingest" />
                            <p class="description">询盘管理系统的接收接口，必须以 <code>/api/ingest</code> 结尾。</p>
                        </td>
                    </tr>
                    <tr>
                        <th>Site Key</th>
                        <td>
                            <input class="regular-text" name="<?php echo esc_attr(self::OPTION); ?>[site_key]" value="<?php echo esc_attr($s['site_key']); ?>" />
                            <p class="description">该 WordPress 站点在询盘系统中的身份密钥。在系统后台「网站列表」→「配置表单」中复制。</p>
                        </td>
                    </tr>
                    <tr>
                        <th>表单 ID 白名单</th>
                        <td>
                            <input class="regular-text" name="<?php echo esc_attr(self::OPTION); ?>[form_ids]" value="<?php echo esc_attr($s['form_ids']); ?>" placeholder="如 12,34 留空=全部表单" />
                            <p class="description">WPForms 的 form_id（表单列表/编辑地址中的数字）。多个用逗号分隔。建议只填询盘表，避免登录等其它表单被统计。</p>
                        </td>
                    </tr>
                    <tr>
                        <th>字段 ID（可选）</th>
                        <td>
                            <p>姓名 <input name="<?php echo esc_attr(self::OPTION); ?>[name_field]" value="<?php echo esc_attr($s['name_field']); ?>" size="4" /></p>
                            <p>邮箱 <input name="<?php echo esc_attr(self::OPTION); ?>[email_field]" value="<?php echo esc_attr($s['email_field']); ?>" size="4" /></p>
                            <p>phone/whatsapp <input name="<?php echo esc_attr(self::OPTION); ?>[phone_field]" value="<?php echo esc_attr($s['phone_field']); ?>" size="4" /></p>
                            <p>留言 <input name="<?php echo esc_attr(self::OPTION); ?>[message_field]" value="<?php echo esc_attr($s['message_field']); ?>" size="4" /></p>
                            <p class="description">在 WPForms 编辑表单时点开字段可见 Field ID。留空则按字段类型自动猜测（姓名/邮箱/phone/whatsapp/留言）。WhatsApp 若是普通文本字段，请填写其 Field ID。</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    private static function allowed_form($form_id, $settings)
    {
        $raw = trim((string) $settings['form_ids']);
        if ($raw === '') {
            return true;
        }
        $ids = array_filter(array_map('trim', explode(',', $raw)));
        return in_array((string) $form_id, $ids, true);
    }

    private static function field_value($fields, $id)
    {
        if ($id === '' || $id === null) {
            return '';
        }
        $id = (string) $id;
        if (!isset($fields[$id])) {
            return '';
        }
        return isset($fields[$id]['value']) ? (string) $fields[$id]['value'] : '';
    }

    private static function guess_field($fields, $types)
    {
        foreach ($fields as $field) {
            $type = isset($field['type']) ? $field['type'] : '';
            if (in_array($type, $types, true)) {
                return isset($field['value']) ? (string) $field['value'] : '';
            }
        }
        return '';
    }

    /** 字段标签规范化，便于匹配 */
    private static function field_label_key($field)
    {
        $label = '';
        if (isset($field['name']) && (string) $field['name'] !== '') {
            $label = (string) $field['name'];
        } elseif (isset($field['label']) && (string) $field['label'] !== '') {
            $label = (string) $field['label'];
        }
        $label = strtolower($label);
        return preg_replace('/[\s_\-.:：()（）\[\]{}]+/u', '', $label);
    }

    private static function label_is_company($key)
    {
        if ($key === '') {
            return false;
        }
        return (bool) preg_match('/company|organization|organisation|business|corp|firm|公司|企业|单位|机构/', $key);
    }

    private static function label_is_name($key)
    {
        if ($key === '') {
            return false;
        }
        if (self::label_is_company($key)) {
            return false;
        }
        // fullname / yourname / contactname / 姓名 等；避免单独匹配过宽的 "na"
        return (bool) preg_match('/^(name|fullname|fullname|yourname|contactname|firstname|lastname|姓名|名字|联系人)$|(^|[^a-z])name([^a-z]|$)|姓名|名字|联系人/', $key);
    }

    /**
     * 猜测姓名：优先 WPForms Name 类型；勿把 Company 等 text 字段当成 Name
     * （旧逻辑 guess(['name','text']) 会命中排在前面的 Company）
     */
    private static function guess_name($fields)
    {
        if (!is_array($fields)) {
            return '';
        }
        foreach ($fields as $field) {
            $type = isset($field['type']) ? $field['type'] : '';
            if ($type === 'name') {
                $v = isset($field['value']) ? trim((string) $field['value']) : '';
                if ($v !== '') {
                    return $v;
                }
            }
        }
        foreach ($fields as $field) {
            $type = isset($field['type']) ? $field['type'] : '';
            if ($type !== 'text' && $type !== '') {
                continue;
            }
            $key = self::field_label_key($field);
            if (!self::label_is_name($key)) {
                continue;
            }
            $v = isset($field['value']) ? trim((string) $field['value']) : '';
            if ($v !== '') {
                return $v;
            }
        }
        return '';
    }

    /** @return object|null */
    private static function entry_meta_handler()
    {
        if (!function_exists('wpforms')) {
            return null;
        }
        $wpforms = wpforms();
        if (is_object($wpforms) && method_exists($wpforms, 'obj')) {
            $h = $wpforms->obj('entry_meta');
            if ($h) {
                return $h;
            }
        }
        if (!empty($wpforms->entry_meta)) {
            return $wpforms->entry_meta;
        }
        return null;
    }

    private static function decode_meta_data($data)
    {
        if ($data === null || $data === '') {
            return null;
        }
        if (is_array($data) || is_object($data)) {
            return $data;
        }
        if (!is_string($data)) {
            return $data;
        }
        $json = json_decode($data, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $json;
        }
        $un = maybe_unserialize($data);
        return $un;
    }

    /**
     * 按 type 列表读取 entry meta；兼容 get_meta 返回对象/数组，并回退直查数据表
     */
    private static function get_entry_meta_data($entry_id, array $types)
    {
        $entry_id = absint($entry_id);
        if (!$entry_id) {
            return null;
        }

        $handler = self::entry_meta_handler();
        if ($handler && method_exists($handler, 'get_meta')) {
            foreach ($types as $type) {
                $meta = $handler->get_meta(
                    [
                        'entry_id' => $entry_id,
                        'type' => $type,
                        'number' => 1,
                    ]
                );
                $data = self::meta_row_data($meta);
                if ($data !== null && $data !== '' && $data !== []) {
                    return self::decode_meta_data($data);
                }
                $meta = $handler->get_meta(
                    [
                        'entry_id' => $entry_id,
                        'type' => $type,
                    ]
                );
                $data = self::meta_row_data($meta);
                if ($data !== null && $data !== '' && $data !== []) {
                    return self::decode_meta_data($data);
                }
            }
        }

        // 直查 wpforms_entry_meta，避免 API 类型名不一致或尚未缓存
        $from_db = self::get_entry_meta_from_db($entry_id, $types);
        if ($from_db !== null) {
            return $from_db;
        }
        return null;
    }

    /** @param mixed $meta */
    private static function meta_row_data($meta)
    {
        if (empty($meta)) {
            return null;
        }
        if (is_object($meta) && isset($meta->data)) {
            return $meta->data;
        }
        if (is_array($meta)) {
            if (isset($meta[0]) && is_object($meta[0]) && isset($meta[0]->data)) {
                return $meta[0]->data;
            }
            if (isset($meta['data'])) {
                return $meta['data'];
            }
        }
        return null;
    }

    private static function get_entry_meta_from_db($entry_id, array $types)
    {
        global $wpdb;
        $table = $wpdb->prefix . 'wpforms_entry_meta';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
        if (!$exists) {
            return null;
        }
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare("SELECT type, data FROM `{$table}` WHERE entry_id = %d", $entry_id),
            ARRAY_A
        );
        if (empty($rows)) {
            return null;
        }

        $wanted = array_map('strtolower', $types);
        foreach ($rows as $row) {
            $type = strtolower((string) ($row['type'] ?? ''));
            if (!in_array($type, $wanted, true)) {
                // 模糊匹配：含 location / journey / geo
                $hit = false;
                foreach ($wanted as $w) {
                    if ($w !== '' && strpos($type, $w) !== false) {
                        $hit = true;
                        break;
                    }
                }
                if (!$hit) {
                    continue;
                }
            }
            $decoded = self::decode_meta_data($row['data'] ?? null);
            if ($decoded !== null && $decoded !== '' && $decoded !== []) {
                return $decoded;
            }
        }
        return null;
    }

    /** 用 WPForms Smart Tag 生成与后台条目页一致的展示内容 */
    private static function collect_via_smart_tags($form_data, $fields, $entry_id)
    {
        $out = ['geo' => '', 'journey' => ''];
        if (!function_exists('wpforms_process_smart_tags')) {
            return $out;
        }
        $geo = (string) wpforms_process_smart_tags('{entry_geolocation}', $form_data, $fields, $entry_id);
        $journey = (string) wpforms_process_smart_tags('{entry_user_journey}', $form_data, $fields, $entry_id);
        if (strpos($geo, '{entry_geolocation}') === false) {
            $out['geo'] = trim($geo);
        }
        if (strpos($journey, '{entry_user_journey}') === false) {
            $j = trim($journey);
            // 空表格 / 仅空白不算成功
            $text = trim(wp_strip_all_tags($j));
            if ($j !== '' && $text !== '' && $text !== '—' && strtolower($text) !== 'n/a') {
                $out['journey'] = $j;
            }
        }
        return $out;
    }

    /** 从 WPForms Location / Geolocation 板块读取 */
    private static function collect_location($entry_id)
    {
        return self::get_entry_meta_data($entry_id, [
            'location',
            'geolocation',
            'geo_location',
            'entry_geolocation',
            'geo',
        ]);
    }

    /**
     * User Journey：独立表 / entry_meta / Cookie / POST / Addon API
     * （Location 在 entry_meta；Journey 通常在 wpforms_user_journey 表）
     */
    private static function collect_user_journey($entry_id, $entry = null)
    {
        $entry_id = absint($entry_id);

        $from_table = self::collect_user_journey_from_table($entry_id);
        if ($from_table !== null) {
            return $from_table;
        }

        $from_meta = self::get_entry_meta_data($entry_id, [
            'user_journey',
            'user-journey',
            'journey',
            'entry_user_journey',
            'user_journeys',
        ]);
        if ($from_meta !== null) {
            return $from_meta;
        }

        $from_scan = self::scan_entry_meta_for_journey($entry_id);
        if ($from_scan !== null) {
            return $from_scan;
        }

        $from_api = self::collect_user_journey_via_addon_api($entry_id);
        if ($from_api !== null) {
            return $from_api;
        }

        $from_request = self::collect_user_journey_from_request($entry);
        if ($from_request !== null) {
            return $from_request;
        }

        return null;
    }

    /** 直查可能的 user journey 数据表 */
    private static function collect_user_journey_from_table($entry_id)
    {
        global $wpdb;
        $entry_id = absint($entry_id);
        if (!$entry_id) {
            return null;
        }

        $candidates = [
            $wpdb->prefix . 'wpforms_user_journey',
            $wpdb->prefix . 'wpforms_user_journeys',
            $wpdb->prefix . 'wpforms_entry_user_journey',
        ];
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $like = $wpdb->esc_like($wpdb->prefix . 'wpforms') . '%journey%';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $found = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $like));
        if (is_array($found)) {
            foreach ($found as $t) {
                if ($t && !in_array($t, $candidates, true)) {
                    $candidates[] = $t;
                }
            }
        }

        // 部分版本用 user_uuid 关联，顺带取 entry 的 uuid
        $user_uuid = '';
        $entries_table = $wpdb->prefix . 'wpforms_entries';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $entries_table))) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $user_uuid = (string) $wpdb->get_var(
                $wpdb->prepare("SELECT user_uuid FROM `{$entries_table}` WHERE id = %d", $entry_id)
            );
        }

        foreach ($candidates as $table) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
            if (!$exists) {
                continue;
            }
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $cols = $wpdb->get_col("DESCRIBE `{$table}`", 0);
            if (!is_array($cols)) {
                continue;
            }

            $order = in_array('timestamp', $cols, true)
                ? 'timestamp ASC'
                : (in_array('date', $cols, true) ? 'date ASC' : (in_array('id', $cols, true) ? 'id ASC' : ''));
            $order_sql = $order !== '' ? " ORDER BY {$order}" : '';

            $rows = null;
            if (in_array('entry_id', $cols, true)) {
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $rows = $wpdb->get_results(
                    $wpdb->prepare("SELECT * FROM `{$table}` WHERE entry_id = %d{$order_sql}", $entry_id),
                    ARRAY_A
                );
            }
            if (empty($rows) && $user_uuid !== '' && in_array('user_uuid', $cols, true)) {
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $rows = $wpdb->get_results(
                    $wpdb->prepare("SELECT * FROM `{$table}` WHERE user_uuid = %s{$order_sql}", $user_uuid),
                    ARRAY_A
                );
            }
            if (empty($rows) && in_array('form_id', $cols, true) && in_array('entry_id', $cols, true)) {
                // already tried entry_id
            }
            if (!empty($rows)) {
                return $rows;
            }
        }
        return null;
    }

    /** 扫描该 entry 全部 meta，找出像 journey 的结构 */
    private static function scan_entry_meta_for_journey($entry_id)
    {
        global $wpdb;
        $table = $wpdb->prefix . 'wpforms_entry_meta';
        $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
        if (!$exists) {
            return null;
        }
        $rows = $wpdb->get_results(
            $wpdb->prepare("SELECT type, data FROM `{$table}` WHERE entry_id = %d", $entry_id),
            ARRAY_A
        );
        if (empty($rows)) {
            return null;
        }
        foreach ($rows as $row) {
            $type = strtolower((string) ($row['type'] ?? ''));
            if (strpos($type, 'location') !== false || strpos($type, 'geo') !== false) {
                continue;
            }
            $decoded = self::decode_meta_data($row['data'] ?? null);
            if (self::looks_like_journey($decoded)) {
                return $decoded;
            }
            if (strpos($type, 'journey') !== false && $decoded !== null && $decoded !== '' && $decoded !== []) {
                return $decoded;
            }
        }
        return null;
    }

    /** @param mixed $data */
    private static function looks_like_journey($data)
    {
        if (!is_array($data) || $data === []) {
            return false;
        }
        $steps = $data;
        if (isset($data['steps']) && is_array($data['steps'])) {
            $steps = $data['steps'];
        } elseif (isset($data['pages']) && is_array($data['pages'])) {
            $steps = $data['pages'];
        }
        if (!is_array($steps) || $steps === []) {
            return false;
        }
        $first = reset($steps);
        if (is_object($first)) {
            $first = (array) $first;
        }
        if (!is_array($first)) {
            return false;
        }
        return isset($first['url']) || isset($first['title']) || isset($first['pageUrl']) || isset($first['page_url']) || isset($first['path']);
    }

    /** 尝试调用 User Journey Addon 公开 API */
    private static function collect_user_journey_via_addon_api($entry_id)
    {
        $entry_id = absint($entry_id);
        // 常见类名 / 容器
        $callables = [];
        if (class_exists('\WPFormsUserJourney\DB\Repository') && method_exists('\WPFormsUserJourney\DB\Repository', 'get_by_entry_id')) {
            $callables[] = ['\WPFormsUserJourney\DB\Repository', 'get_by_entry_id'];
        }
        if (function_exists('wpforms_user_journey')) {
            $uj = wpforms_user_journey();
            if (is_object($uj) && method_exists($uj, 'get_entry_user_journey')) {
                $res = $uj->get_entry_user_journey($entry_id);
                if (!empty($res)) {
                    return $res;
                }
            }
            if (is_object($uj) && method_exists($uj, 'get')) {
                $repo = $uj->get('repository');
                if (is_object($repo) && method_exists($repo, 'get_by_entry_id')) {
                    $res = $repo->get_by_entry_id($entry_id);
                    if (!empty($res)) {
                        return $res;
                    }
                }
            }
        }
        foreach ($callables as $cb) {
            if (is_callable($cb)) {
                $res = call_user_func($cb, $entry_id);
                if (!empty($res)) {
                    return $res;
                }
            }
        }
        return null;
    }

    /** 从表单提交请求 / Cookie 读取（Addon 写库前或写库失败时的兜底） */
    private static function collect_user_journey_from_request($entry = null)
    {
        $candidates = [];
        if (is_array($entry)) {
            $deep = self::deep_find_journey($entry);
            if ($deep !== null) {
                return $deep;
            }
            foreach (['user_journey', 'entry_user_journey', 'wpforms_user_journey'] as $k) {
                if (!empty($entry[$k])) {
                    $candidates[] = $entry[$k];
                }
            }
        }
        if (!empty($_POST['wpforms']) && is_array($_POST['wpforms'])) {
            $wpf = wp_unslash($_POST['wpforms']);
            $deep = self::deep_find_journey($wpf);
            if ($deep !== null) {
                return $deep;
            }
            foreach (['user_journey', 'entry_user_journey', 'journey'] as $k) {
                if (!empty($wpf[$k])) {
                    $candidates[] = $wpf[$k];
                }
            }
        }
        // 有的版本用独立 POST 键 / JSON body
        foreach ($_POST as $key => $val) {
            $kl = strtolower((string) $key);
            if (strpos($kl, 'journey') === false && strpos($kl, 'wpforms_uj') === false) {
                continue;
            }
            $candidates[] = wp_unslash($val);
        }
        if (!empty($_COOKIE) && is_array($_COOKIE)) {
            foreach ($_COOKIE as $name => $val) {
                $n = strtolower((string) $name);
                if (strpos($n, 'user_journey') !== false || strpos($n, 'wpforms_uj') !== false || strpos($n, 'wpfuj') !== false) {
                    $candidates[] = wp_unslash($val);
                }
            }
        }

        foreach ($candidates as $raw) {
            if (is_array($raw) || is_object($raw)) {
                $arr = is_object($raw) ? (array) $raw : $raw;
                if (self::looks_like_journey($arr) || (is_array($arr) && $arr !== [])) {
                    return $arr;
                }
                continue;
            }
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $decoded = self::decode_meta_data($raw);
            if ($decoded !== null && self::looks_like_journey($decoded)) {
                return $decoded;
            }
            $decoded2 = self::decode_meta_data(urldecode($raw));
            if ($decoded2 !== null && self::looks_like_journey($decoded2)) {
                return $decoded2;
            }
        }
        return null;
    }

    /** 递归在 POST/entry 中找 journey 结构 */
    private static function deep_find_journey($data, $depth = 0)
    {
        if ($depth > 8 || $data === null) {
            return null;
        }
        if (is_object($data)) {
            $data = (array) $data;
        }
        if (!is_array($data)) {
            if (is_string($data) && $data !== '') {
                $decoded = self::decode_meta_data($data);
                if (self::looks_like_journey($decoded)) {
                    return $decoded;
                }
            }
            return null;
        }
        if (self::looks_like_journey($data)) {
            return $data;
        }
        foreach ($data as $k => $v) {
            $kl = strtolower((string) $k);
            if (strpos($kl, 'journey') !== false) {
                if (is_string($v)) {
                    $decoded = self::decode_meta_data($v);
                    if (self::looks_like_journey($decoded)) {
                        return $decoded;
                    }
                    $decoded2 = self::decode_meta_data(urldecode($v));
                    if (self::looks_like_journey($decoded2)) {
                        return $decoded2;
                    }
                } elseif (is_array($v) || is_object($v)) {
                    $arr = is_object($v) ? (array) $v : $v;
                    if (self::looks_like_journey($arr) || $arr !== []) {
                        return $arr;
                    }
                }
            }
            $found = self::deep_find_journey($v, $depth + 1);
            if ($found !== null) {
                return $found;
            }
        }
        return null;
    }

    /**
     * 组装 location + journey。
     * 优先 WPForms 原生 Smart Tag HTML；为空时用已抓到的 journey 数据生成同款表格（无延迟/补推）。
     * @param mixed $journey_from_request 请求侧 journey 兜底
     */
    private static function build_location_journey($entry_id, $form_data, $fields, $entry = null, $journey_from_request = null)
    {
        $tags = self::collect_via_smart_tags($form_data, $fields, $entry_id);
        $location_raw = self::collect_location($entry_id);
        $journey_raw = self::collect_user_journey($entry_id, $entry);
        if ($journey_raw === null && $journey_from_request !== null) {
            $journey_raw = $journey_from_request;
        }

        $entry_geolocation = $tags['geo'] !== ''
            ? $tags['geo']
            : self::format_location_text($location_raw);

        $entry_user_journey = $tags['journey'];
        if ($entry_user_journey === '') {
            $entry_user_journey = self::render_user_journey_html($entry_id, $form_data, $fields, $journey_raw);
        }

        if ($entry_user_journey === '') {
            error_log('[Inquiry Bridge] user_journey still empty for entry ' . absint($entry_id));
        }

        return [
            'location_raw' => $location_raw,
            'journey_raw' => $journey_raw,
            'entry_geolocation' => $entry_geolocation,
            'entry_user_journey' => $entry_user_journey,
        ];
    }

    /**
     * 尽量产出与 WPForms 后台/邮件一致的 User Journey HTML。
     * @param mixed $journey_raw
     */
    private static function render_user_journey_html($entry_id, $form_data, $fields, $journey_raw)
    {
        // 1) Addon 公开渲染 / 再次 Smart Tag（部分版本需 entry 已写库）
        $from_addon = self::render_journey_via_addon($entry_id, $form_data, $fields);
        if ($from_addon !== '') {
            return $from_addon;
        }

        if ($journey_raw === null || $journey_raw === '') {
            return '';
        }

        if (is_string($journey_raw)) {
            $trim = trim($journey_raw);
            if ($trim === '' || strpos($trim, '{entry_user_journey}') !== false) {
                return '';
            }
            if (stripos($trim, '<table') !== false || stripos($trim, '<tr') !== false) {
                return $trim;
            }
            $decoded = json_decode($trim, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $journey_raw = $decoded;
            } else {
                return '';
            }
        }

        return self::format_journey_steps_html($journey_raw);
    }

    /** @param mixed $form_data @param mixed $fields */
    private static function render_journey_via_addon($entry_id, $form_data, $fields)
    {
        $entry_id = absint($entry_id);

        // 常见：Smart Tag 类 process
        $classes = [
            '\\WPFormsUserJourney\\SmartTags\\EntryUserJourney',
            '\\WPFormsUserJourney\\SmartTags\\Entry_User_Journey',
            '\\WPForms\\UserJourney\\SmartTags\\EntryUserJourney',
        ];
        foreach ($classes as $cls) {
            if (!class_exists($cls)) {
                continue;
            }
            try {
                if (method_exists($cls, 'get_value')) {
                    $obj = new $cls();
                    $val = $obj->get_value($form_data, $fields, $entry_id);
                    $html = self::normalize_journey_html($val);
                    if ($html !== '') {
                        return $html;
                    }
                }
            } catch (Exception $e) {
                // ignore
            }
        }

        if (function_exists('wpforms_user_journey')) {
            $uj = wpforms_user_journey();
            foreach (['get_entry_user_journey_html', 'get_entry_html', 'render_entry'] as $method) {
                if (is_object($uj) && method_exists($uj, $method)) {
                    try {
                        $val = $uj->{$method}($entry_id);
                        $html = self::normalize_journey_html($val);
                        if ($html !== '') {
                            return $html;
                        }
                    } catch (Exception $e) {
                        // ignore
                    }
                }
            }
        }

        return '';
    }

    /** @param mixed $val */
    private static function normalize_journey_html($val)
    {
        if (!is_string($val)) {
            return '';
        }
        $j = trim($val);
        if ($j === '' || strpos($j, '{entry_user_journey}') !== false) {
            return '';
        }
        $text = trim(wp_strip_all_tags($j));
        if ($text === '' || $text === '—' || strtolower($text) === 'n/a') {
            return '';
        }
        return $j;
    }

    /** 将 steps/DB 行格式化为浏览路径表（北京时间 / 中文表头 / 路径后缀） */
    private static function format_journey_steps_html($journey)
    {
        if (is_object($journey)) {
            $journey = (array) $journey;
        }
        if (!is_array($journey) || $journey === []) {
            return '';
        }

        if (isset($journey['steps']) && is_array($journey['steps'])) {
            $steps = $journey['steps'];
        } elseif (isset($journey['pages']) && is_array($journey['pages'])) {
            $steps = $journey['pages'];
        } elseif (isset($journey['journey']) && is_array($journey['journey'])) {
            $steps = $journey['journey'];
        } else {
            $steps = $journey;
        }

        if ($steps && !isset($steps[0]) && (isset($steps['url']) || isset($steps['title']))) {
            $steps = [$steps];
        }

        $rows = '';
        foreach ($steps as $step) {
            if (is_object($step)) {
                $step = (array) $step;
            }
            if (!is_array($step)) {
                continue;
            }
            $title = self::pick_step_str($step, ['title', 'pageTitle', 'page_title', 'name', 'page', 'post_title']);
            $url = self::pick_step_str($step, ['url', 'pageUrl', 'page_url', 'href', 'path', 'permalink']);
            $when_raw = self::pick_step_str($step, ['date', 'datetime', 'timestamp', 'time', 'when', 'created', 'date_created', 'visited_at']);
            $duration_raw = self::pick_step_str($step, ['duration', 'timeOnPage', 'time_on_page', 'time_spent', 'spend']);
            if ($title === '' && $url === '') {
                continue;
            }
            $when = $when_raw !== '' ? self::to_beijing_datetime($when_raw) : '—';
            $duration = self::format_duration_seconds($duration_raw);
            $page_html = self::journey_page_cell_html($title, $url);
            $rows .= '<tr>'
                . '<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;">' . $page_html . '</td>'
                . '<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">' . esc_html($when) . '</td>'
                . '<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">' . esc_html($duration) . '</td>'
                . '</tr>';
        }

        if ($rows === '') {
            return '';
        }

        return '<table style="border-collapse:collapse;width:100%;font-size:13px;">'
            . '<thead><tr style="background:#f8fafc;text-align:left;color:#666;">'
            . '<th style="padding:6px 8px;border:1px solid #e2e8f0;">页面</th>'
            . '<th style="padding:6px 8px;border:1px solid #e2e8f0;">北京时间</th>'
            . '<th style="padding:6px 8px;border:1px solid #e2e8f0;">停留秒数</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody></table>';
    }

    private static function journey_url_path($url)
    {
        $url = trim((string) $url);
        if ($url === '') {
            return '';
        }
        if (strpos($url, '/') === 0 && !preg_match('#^https?://#i', $url)) {
            return $url;
        }
        $parts = wp_parse_url($url);
        if (!is_array($parts)) {
            return '';
        }
        $path = isset($parts['path']) && $parts['path'] !== '' ? $parts['path'] : '/';
        if (!empty($parts['query'])) {
            $path .= '?' . $parts['query'];
        }
        if (!empty($parts['fragment'])) {
            $path .= '#' . $parts['fragment'];
        }
        return $path;
    }

    private static function journey_page_cell_html($title, $url)
    {
        $path = $url !== '' ? self::journey_url_path($url) : '';
        if ($title !== '' && $path !== '') {
            $body = esc_html($title)
                . '<div style="color:#64748b;font-size:12px;margin-top:2px;word-break:break-all;">'
                . esc_html($path)
                . '</div>';
        } elseif ($title !== '') {
            $body = esc_html($title);
        } elseif ($path !== '') {
            $body = esc_html($path);
        } else {
            $body = esc_html($url);
        }
        if ($url !== '') {
            return '<a href="' . esc_url($url) . '" style="color:inherit;text-decoration:none;">' . $body . '</a>';
        }
        return $body;
    }

    /** UTC/时间戳 → 北京时间 Y-m-d H:i:s */
    private static function to_beijing_datetime($raw)
    {
        $t = trim((string) $raw);
        if ($t === '') {
            return '—';
        }
        $tz = new DateTimeZone('Asia/Shanghai');
        try {
            if (preg_match('/^\d{10}$/', $t)) {
                $dt = new DateTime('@' . $t);
            } elseif (preg_match('/^\d{13}$/', $t)) {
                $dt = new DateTime('@' . (int) floor(((int) $t) / 1000));
            } elseif (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/', $t)) {
                $has_tz = (bool) preg_match('/[zZ]|[+-]\d{2}:?\d{2}$/', $t);
                $normalized = str_replace(' ', 'T', $t);
                $dt = $has_tz
                    ? new DateTime($normalized)
                    : new DateTime($normalized, new DateTimeZone('UTC'));
            } else {
                $dt = new DateTime($t);
            }
            $dt->setTimezone($tz);
            return $dt->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            return $t;
        }
    }

    private static function format_duration_seconds($raw)
    {
        $t = trim((string) $raw);
        if ($t === '') {
            return '—';
        }
        if (preg_match('/^(\d+(?:\.\d+)?)\s*s$/i', $t, $m)) {
            return (string) (int) round((float) $m[1]);
        }
        if (preg_match('/^(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds)$/i', $t, $m)) {
            return (string) (int) round((float) $m[1]);
        }
        if (preg_match('/^(\d+(?:\.\d+)?)\s*(ms|msec|milliseconds)$/i', $t, $m)) {
            return (string) (int) round(((float) $m[1]) / 1000);
        }
        if (preg_match('/^(\d+):(\d{2}):(\d{2})$/', $t, $m)) {
            return (string) ((int) $m[1] * 3600 + (int) $m[2] * 60 + (int) $m[3]);
        }
        if (preg_match('/^(\d+):(\d{2})$/', $t, $m)) {
            return (string) ((int) $m[1] * 60 + (int) $m[2]);
        }
        if (preg_match('/^\d+(?:\.\d+)?$/', $t)) {
            $n = (float) $t;
            if ($n >= 10000) {
                return (string) (int) round($n / 1000);
            }
            return (string) (int) round($n);
        }
        return $t;
    }

    /** 将 Location 板块数据格式化为可读文本（供中心系统展示） */
    private static function format_location_text($location)
    {
        if ($location === null || $location === '') {
            return '';
        }
        if (is_string($location)) {
            $trim = trim($location);
            if ($trim === '' || strpos($trim, '{entry_geolocation}') !== false) {
                return '';
            }
            $decoded = json_decode($trim, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $location = $decoded;
            } else {
                return $trim;
            }
        }
        if (is_object($location)) {
            $location = (array) $location;
        }
        if (!is_array($location)) {
            return '';
        }

        $city = self::pick_step_str($location, ['city', 'city_name', 'town']);
        $region = self::pick_step_str($location, ['region', 'region_name', 'state', 'province']);
        $country = self::pick_step_str($location, ['country', 'country_name']);
        $country_code = self::pick_step_str($location, ['country_code', 'countryCode', 'iso']);
        $postal = self::pick_step_str($location, ['postal', 'zip', 'zipcode', 'postcode']);
        $lat = self::pick_step_str($location, ['latitude', 'lat']);
        $lng = self::pick_step_str($location, ['longitude', 'lng', 'lon']);
        $ip = self::pick_step_str($location, ['ip', 'ip_address', 'user_ip']);

        if ($country === '' && $country_code !== '') {
            $country = $country_code;
        }

        $parts = [];
        if ($city !== '') {
            $parts[] = $city;
        }
        if ($region !== '') {
            $parts[] = $region;
        }
        if ($country !== '') {
            $parts[] = $country;
        }
        if ($postal !== '') {
            $parts[] = $postal;
        }

        $line = implode(', ', $parts);
        if ($lat !== '' && $lng !== '') {
            $line = trim($line . ($line !== '' ? ' ' : '') . "({$lat}, {$lng})");
        }
        if ($line === '' && $ip !== '') {
            $line = 'IP: ' . $ip;
        }
        if ($line === '' && $ip === '') {
            // 兜底：扁平化关键字段
            $flat = [];
            foreach ($location as $k => $v) {
                if (is_scalar($v) && (string) $v !== '') {
                    $flat[] = $k . '=' . $v;
                }
            }
            $line = implode('; ', $flat);
        }
        return $line;
    }

    private static function pick_step_str($row, $keys)
    {
        foreach ($keys as $k) {
            if (isset($row[$k]) && (string) $row[$k] !== '') {
                return (string) $row[$k];
            }
        }
        return '';
    }

    public static function on_entry_saved($fields, $entry, $form_data, $entry_id)
    {
        $settings = self::settings();
        $form_id = isset($form_data['id']) ? $form_data['id'] : 0;

        $GLOBALS['inquiry_bridge_suppress_email'] = false;

        if (empty($settings['api_url']) || empty($settings['site_key'])) {
            return;
        }
        if (!self::allowed_form($form_id, $settings)) {
            return;
        }

        $name = self::field_value($fields, $settings['name_field']);
        $email = self::field_value($fields, $settings['email_field']);
        $phone = self::field_value($fields, $settings['phone_field']);
        $message = self::field_value($fields, $settings['message_field']);

        if ($name === '') {
            $name = self::guess_name($fields);
        }
        if ($email === '') {
            $email = self::guess_field($fields, ['email']);
        }
        if ($phone === '') {
            $phone = self::guess_field($fields, ['phone']);
        }
        if ($message === '') {
            $message = self::guess_field($fields, ['textarea']);
        }

        $page_url = '';
        if (!empty($_POST['page_url'])) {
            $page_url = esc_url_raw(wp_unslash($_POST['page_url']));
        } elseif (!empty($_SERVER['HTTP_REFERER'])) {
            $page_url = esc_url_raw(wp_unslash($_SERVER['HTTP_REFERER']));
        } else {
            $page_url = home_url('/');
        }

        // Location / User Journey：表 + meta + Smart Tag + Cookie/POST；不读 Hidden
        $lj = self::build_location_journey(
            $entry_id,
            $form_data,
            $fields,
            $entry,
            self::collect_user_journey_from_request($entry)
        );

        $payload = [
            'site_key' => $settings['site_key'],
            'form_id' => (string) $form_id,
            'entry_id' => (string) $entry_id,
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'subject' => '',
            'message' => $message,
            'page_url' => $page_url,
            'fields' => $fields,
            'entry_geolocation' => $lj['entry_geolocation'],
            'location' => $lj['location_raw'],
            'entry_user_journey' => $lj['entry_user_journey'],
            'user_journey' => $lj['journey_raw'],
        ];

        $ok = self::post_to_api($settings['api_url'], $payload);
        $GLOBALS['inquiry_bridge_suppress_email'] = $ok;

        if (!$ok) {
            error_log('[Inquiry Bridge] ingest failed, fallback to WPForms email');
        } elseif ($lj['entry_geolocation'] === '' && $lj['entry_user_journey'] === '') {
            error_log('[Inquiry Bridge] location/journey empty for entry ' . absint($entry_id));
        }
    }

    private static function post_to_api($api_url, array $payload)
    {
        $response = wp_remote_post($api_url, [
            'timeout' => 20,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => wp_json_encode($payload),
        ]);
        if (is_wp_error($response)) {
            return false;
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        return ($code >= 200 && $code < 300 && !empty($body['ok']));
    }

    public static function maybe_disable_emails($disable)
    {
        if (!empty($GLOBALS['inquiry_bridge_suppress_email'])) {
            return true;
        }
        return $disable;
    }
}

Inquiry_Bridge_Plugin::init();
