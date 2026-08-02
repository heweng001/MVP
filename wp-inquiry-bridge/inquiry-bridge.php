<?php
/**
 * Plugin Name: Inquiry Bridge for WPForms
 * Description: 将 WPForms 询盘推送到询盘管理系统；推送成功则阻止 WPForms 原生通知，失败则降级由 WPForms 发信。
 * Version: 1.0.4
 * Author: Inquiry System
 * Requires Plugins: wpforms
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Inquiry_Bridge_Plugin
{
    const OPTION = 'inquiry_bridge_settings';

    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'admin_menu']);
        add_action('admin_init', [__CLASS__, 'register_settings']);

        // Ensure notifications run in the same request so we can suppress after ingest.
        add_filter('wpforms_tasks_entry_emails_trigger_send_same_process', '__return_true');

        // 稍晚执行，便于 User Journey Addon 先写入 entry meta
        add_action('wpforms_process_entry_saved', [__CLASS__, 'on_entry_saved'], 25, 4);

        add_filter('wpforms_disable_all_emails', [__CLASS__, 'maybe_disable_emails']);
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
            'subject_field' => '',
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
                <p>用户路径从 WPForms <strong>User Journey</strong> 板块（entry meta）读取，无需在 Hidden 中写 <code>{entry_user_journey}</code>。</p>
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
                            <p>电话 <input name="<?php echo esc_attr(self::OPTION); ?>[phone_field]" value="<?php echo esc_attr($s['phone_field']); ?>" size="4" /></p>
                            <p>主题 <input name="<?php echo esc_attr(self::OPTION); ?>[subject_field]" value="<?php echo esc_attr($s['subject_field']); ?>" size="4" /></p>
                            <p>留言 <input name="<?php echo esc_attr(self::OPTION); ?>[message_field]" value="<?php echo esc_attr($s['message_field']); ?>" size="4" /></p>
                            <p class="description">在 WPForms 编辑表单时点开字段可见 Field ID。留空则按字段类型自动猜测。</p>
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
     * 从 WPForms User Journey 板块（entry meta）读取路径数据
     */
    private static function collect_user_journey($entry_id)
    {
        $handler = self::entry_meta_handler();
        if (!$handler || !method_exists($handler, 'get_meta')) {
            return null;
        }
        $entry_id = absint($entry_id);
        if (!$entry_id) {
            return null;
        }

        foreach (['user_journey', 'user-journey', 'journey'] as $type) {
            $meta = $handler->get_meta(
                [
                    'entry_id' => $entry_id,
                    'type' => $type,
                    'number' => 1,
                ]
            );
            if (empty($meta[0]->data)) {
                $meta = $handler->get_meta(
                    [
                        'entry_id' => $entry_id,
                        'type' => $type,
                    ]
                );
            }
            if (!empty($meta[0]->data)) {
                return self::decode_meta_data($meta[0]->data);
            }
        }
        return null;
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

    /** 将 User Journey 原始数据格式化为邮件可用的 HTML 表格 */
    private static function format_user_journey_html($journey)
    {
        if ($journey === null || $journey === '') {
            return '';
        }
        if (is_string($journey)) {
            $trim = trim($journey);
            if ($trim === '' || strpos($trim, '{entry_user_journey}') !== false) {
                return '';
            }
            // 已是 HTML
            if (stripos($trim, '<table') !== false || stripos($trim, '<tr') !== false) {
                return $trim;
            }
            $decoded = json_decode($trim, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $journey = $decoded;
            } else {
                return esc_html($trim);
            }
        }

        if (is_object($journey)) {
            $journey = (array) $journey;
        }
        if (!is_array($journey)) {
            return '';
        }

        // 可能包在 steps / pages / journey 键下
        if (isset($journey['steps']) && is_array($journey['steps'])) {
            $steps = $journey['steps'];
        } elseif (isset($journey['pages']) && is_array($journey['pages'])) {
            $steps = $journey['pages'];
        } elseif (isset($journey['journey']) && is_array($journey['journey'])) {
            $steps = $journey['journey'];
        } else {
            $steps = $journey;
        }

        // 关联数组单条 → 包成列表
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
            $title = self::pick_step_str($step, ['title', 'pageTitle', 'page_title', 'name', 'page']);
            $url = self::pick_step_str($step, ['url', 'pageUrl', 'page_url', 'href', 'path']);
            $when = self::pick_step_str($step, ['date', 'datetime', 'timestamp', 'time', 'when', 'created', 'date_created']);
            $duration = self::pick_step_str($step, ['duration', 'timeOnPage', 'time_on_page', 'time_spent']);
            $referrer = self::pick_step_str($step, ['referrer', 'referer', 'ref']);
            if ($title === '' && $url === '') {
                continue;
            }
            if ($title === '') {
                $title = $url;
            }
            $page_html = $url !== ''
                ? '<a href="' . esc_url($url) . '">' . esc_html($title) . '</a>'
                : esc_html($title);
            if ($referrer !== '') {
                $page_html .= '<div style="color:#94a3b8;font-size:12px;margin-top:2px;">来源：' . esc_html($referrer) . '</div>';
            }
            $rows .= '<tr>'
                . '<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;">' . $page_html . '</td>'
                . '<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">' . esc_html($when !== '' ? $when : '—') . '</td>'
                . '<td style="padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">' . esc_html($duration !== '' ? $duration : '—') . '</td>'
                . '</tr>';
        }

        if ($rows === '') {
            return '';
        }

        return '<table style="border-collapse:collapse;width:100%;font-size:13px;">'
            . '<thead><tr style="background:#f8fafc;text-align:left;color:#666;">'
            . '<th style="padding:6px 8px;border:1px solid #e2e8f0;">页面</th>'
            . '<th style="padding:6px 8px;border:1px solid #e2e8f0;">时间</th>'
            . '<th style="padding:6px 8px;border:1px solid #e2e8f0;">停留</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody></table>';
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
        $subject = self::field_value($fields, $settings['subject_field']);
        $message = self::field_value($fields, $settings['message_field']);

        if ($name === '') {
            $name = self::guess_field($fields, ['name', 'text']);
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

        // 直接从 User Journey 板块（entry meta）抓取，不依赖 Hidden 中的 Smart Tag
        $journey_raw = self::collect_user_journey($entry_id);
        $entry_user_journey = self::format_user_journey_html($journey_raw);

        $payload = [
            'site_key' => $settings['site_key'],
            'form_id' => (string) $form_id,
            'entry_id' => (string) $entry_id,
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'subject' => $subject,
            'message' => $message,
            'page_url' => $page_url,
            'fields' => $fields,
            'entry_user_journey' => $entry_user_journey,
            'user_journey' => $journey_raw,
        ];

        $response = wp_remote_post($settings['api_url'], [
            'timeout' => 15,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => wp_json_encode($payload),
        ]);

        $ok = false;
        if (!is_wp_error($response)) {
            $code = (int) wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);
            $ok = ($code >= 200 && $code < 300 && !empty($body['ok']));
        }

        $GLOBALS['inquiry_bridge_suppress_email'] = $ok;
        if (!$ok) {
            error_log('[Inquiry Bridge] ingest failed, fallback to WPForms email');
        }
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
