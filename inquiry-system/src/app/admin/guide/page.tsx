import { HelpCallout } from "@/components/HelpCallout";
import { CopyField } from "@/components/CopyField";
import { appUrl } from "@/lib/constants";
import Link from "next/link";

export default function GuidePage() {
  const base = appUrl();
  const ingestUrl = `${base}/api/ingest`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">接入与使用说明</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          按下面顺序配置，即可把 WordPress（WPForms Pro）询盘接入本系统。
        </p>
      </div>

      <HelpCallout title="一句话理解系统在做什么" guideHref={null}>
        <p>
          访客在网站提交表单 → WordPress 插件把数据推到本系统 → 本系统先判垃圾 →
          明显垃圾不发给客户；其余代发邮件，并让客户在邮件里点「有效/无效」→
          后台按月统计每个站点的有效询盘。
        </p>
      </HelpCallout>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">1. 在本系统完成基础配置</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
          <li>
            打开{" "}
            <Link className="text-[var(--brand)] underline" href="/admin/clients">
              客户列表
            </Link>
            ，填写客户名称、分层、联系人等档案信息。
          </li>
          <li>
            打开{" "}
            <Link className="text-[var(--brand)] underline" href="/admin/sites">
              网站列表
            </Link>
            ，为客户添加网站（域名、SEO型/展示型、起止日期）。一个客户可有多个网站；客户的服务起止会按网站日期自动汇总。
          </li>
          <li>
            在网站列表右侧点<strong>配置表单</strong>：复制 site_key、配置表单<strong>收件人/抄送</strong>与词表。没有收件配置时，系统无法代发询盘。
          </li>
        </ol>
      </section>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">2. site_key 是什么？怎么用？</h2>
        <div className="text-sm leading-relaxed space-y-2">
          <p>
            <strong>site_key</strong>{" "}
            是每个 WordPress 站点在本系统中的「身份密钥」。插件推送询盘时必须带上它，系统才能知道这笔询盘属于哪个站点、该发给谁。
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[var(--muted)]">
            <li>每个站点一把 key，不要多站共用。</li>
            <li>相当于密码，不要发到公开网页或发给不相干的人。</li>
            <li>
              在「网站列表」点「配置表单」可复制；填到该站 WordPress 后台{" "}
              <strong>设置 → 询盘对接 → Site Key</strong>。
            </li>
          </ul>
        </div>
        <CopyField
          label="本系统接收地址（API URL）"
          value={ingestUrl}
          hint="填到 WordPress 插件的「API URL」字段。若你部署域名不是这个，请改 .env 里的 APP_URL 后重启。"
        />
      </section>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">3. 安装 WordPress 插件</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          注意：插件装在<strong>各客户 WordPress 网站</strong>上，不在本询盘系统（mvp.maoniux.com）里。未安装/未启用时，WP 后台不会出现「询盘对接」菜单。
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
          <li>
            将项目里的文件夹 <code className="bg-black/5 px-1 rounded">wp-inquiry-bridge</code>{" "}
            整夹复制到该网站的{" "}
            <code className="bg-black/5 px-1 rounded">wp-content/plugins/wp-inquiry-bridge/</code>
            （需含 <code className="bg-black/5 px-1 rounded">inquiry-bridge.php</code>）。
          </li>
          <li>
            登录该站 WordPress 后台 → <strong>插件</strong>，启用{" "}
            <strong>Inquiry Bridge for WPForms</strong>（需已安装 WPForms Pro）。
          </li>
          <li>
            打开左侧 <strong>设置 → 询盘对接</strong>（英文界面为 Settings → Inquiry Bridge），填写：
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>API URL</strong>：上面的接收地址（以 <code>/api/ingest</code> 结尾）
              </li>
              <li>
                <strong>Site Key</strong>：该站在本系统生成的 site_key
              </li>
              <li>
                <strong>表单 ID 白名单</strong>：询盘表的 WPForms form_id（可在表单编辑页 URL 或表单列表看到，如{" "}
                <code>34</code>）。建议填写，避免登录表等其它表单也被统计。
              </li>
              <li>
                <strong>字段 ID</strong>（可选）：姓名/邮箱/电话/留言对应的字段编号；不填则插件会按字段类型自动猜测。
              </li>
            </ul>
          </li>
          <li>
            <strong>保留</strong> WPForms 里该表单的「通知」收件人配置，作为系统故障时的降级备用。插件推送成功时会阻止本次原生发信；推送失败时仍由 WPForms 发信，避免丢单。
          </li>
        </ol>
      </section>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">4. 如何找到 WPForms 的 form_id / 字段 ID</h2>
        <ul className="list-disc pl-5 text-sm space-y-2 leading-relaxed">
          <li>
            <strong>form_id</strong>：WP 后台 → WPForms → All Forms，列表或编辑页地址里通常有{" "}
            <code className="bg-black/5 px-1 rounded">form_id=数字</code>。
          </li>
          <li>
            <strong>字段 ID</strong>：编辑表单时点开某个字段，左侧/字段设置里会显示 Field ID（如 1、3、5）。
          </li>
        </ul>
      </section>
    </div>
  );
}
