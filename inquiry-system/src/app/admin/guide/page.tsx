import { HelpCallout } from "@/components/HelpCallout";
import { CopyField } from "@/components/CopyField";
import { appUrl } from "@/lib/constants";
import Link from "next/link";

export default function GuidePage() {
  const base = appUrl();
  const ingestUrl = `${base}/api/ingest`;
  const cronUrl = `${base}/api/cron`;

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
            <Link className="text-[var(--brand)] underline" href="/admin/settings">
              发件设置
            </Link>
            ，配置系统代发询盘所用的 SMTP（发件邮箱）。未配置时询盘无法发出，详见第 6 节。
          </li>
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
            在网站列表右侧点<strong>配置表单</strong>：复制 site_key、配置表单<strong>收件人/抄送</strong>与词表。没有收件配置时，系统无法代发询盘（收件人与发件邮箱是两回事）。
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
              在「网站列表」点「配置表单」可复制；填到 WordPress 后台{" "}
              <strong>设置 → Inquiry Bridge → Site Key</strong>。
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
        <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
          <li>
            将项目里的文件夹 <code className="bg-black/5 px-1 rounded">wp-inquiry-bridge</code>{" "}
            复制到网站的 <code className="bg-black/5 px-1 rounded">wp-content/plugins/</code>。
          </li>
          <li>在 WordPress 后台启用插件 <strong>Inquiry Bridge for WPForms</strong>。</li>
          <li>
            打开 <strong>设置 → Inquiry Bridge</strong>，填写：
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

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">5. 日常怎么用后台</h2>
        <ul className="list-disc pl-5 text-sm space-y-2 leading-relaxed">
          <li>
            <strong>询盘列表</strong>：用页签查看全部 / 待判定 / 自动垃圾 / 待标记 / 有效 / 无效。「待判定」中可直接通过发送或驳回；超过 6
            小时未处理会自动发给客户。
          </li>
          <li>
            <strong>统计概览</strong>：按月、按站看有效询盘。有效 = 客户点有效 + 超时未标记；占比分母是已转发数。
          </li>
          <li>
            <strong>黑名单</strong>：仅手动添加。客户点「无效」不会自动拉黑。
          </li>
        </ul>
      </section>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">6. 发件设置（SMTP，上线必做）</h2>
        <p className="text-sm leading-relaxed">
          询盘邮件由本系统代发。请在{" "}
          <Link className="text-[var(--brand)] underline" href="/admin/settings">
            发件设置
          </Link>{" "}
          填写 SMTP，并用页面上的「发送测试邮件」确认能收到。
        </p>
        <ul className="list-disc pl-5 text-sm space-y-2 leading-relaxed">
          <li>
            <strong>SMTP 主机</strong>：只填主机名，如{" "}
            <code className="bg-black/5 px-1 rounded">smtp.qq.com</code>、{" "}
            <code className="bg-black/5 px-1 rounded">smtp.exmail.qq.com</code>、{" "}
            <code className="bg-black/5 px-1 rounded">smtp.ym.163.com</code>
            。不要粘贴整段环境变量，也不要在主机里带端口。
          </li>
          <li>
            <strong>端口与 SSL</strong>：常用两种组合（混用会报{" "}
            <code className="bg-black/5 px-1 rounded">wrong version number</code>）：
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>
                端口 <strong>587</strong>：<strong>不要</strong>勾选 SSL/TLS（走 STARTTLS）
              </li>
              <li>
                端口 <strong>465</strong>：勾选 SSL/TLS
              </li>
            </ul>
          </li>
          <li>
            <strong>账号 / 密码</strong>：账号一般为完整邮箱；密码请填邮箱服务商的{" "}
            <strong>客户端授权码</strong>（QQ / 网易 / 企业邮等），不要填网页登录密码。
          </li>
          <li>
            <strong>发件人 From</strong>：客户看到的发件方，如{" "}
            <code className="bg-black/5 px-1 rounded">询盘系统 &lt;your@domain.com&gt;</code>
            ，地址需与 SMTP 账号所属域名一致、且服务商允许代发。
          </li>
          <li>
            <strong>收件人</strong>仍在各网站「配置表单」里设置（To/CC）；发件设置只决定「用哪个邮箱发出」。
          </li>
          <li>
            标记链接依赖公网 <code className="bg-black/5 px-1 rounded">APP_URL</code>
            （服务器环境变量）。当前站点地址不对时，客户邮件里的有效/无效链接会打不开。
          </li>
        </ul>
      </section>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">7. 定时任务（上线必做）</h2>
        <p className="text-sm leading-relaxed">
          建议每 5～15 分钟调用一次，用于：待审超过 6 小时自动发信；发信超过 72 小时未标记 →「超时未标记」。
        </p>
        <CopyField
          label="定时任务 URL（需带密钥）"
          value={`${cronUrl}?secret=你的CRON_SECRET`}
          hint="也可用请求头 x-cron-secret。密钥与服务器 .env 中 CRON_SECRET 一致。"
        />
      </section>

      <section className="bg-white border border-[var(--line)] rounded-xl p-5 space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">8. 自测清单</h2>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            在{" "}
            <Link className="text-[var(--brand)] underline" href="/admin/settings">
              发件设置
            </Link>{" "}
            保存 SMTP 后，用「发送测试邮件」确认能收到。
          </li>
          <li>在站点前台提交一封正常询盘（含产品词/quote）。</li>
          <li>本系统「询盘列表」应出现记录；表单配置的收件邮箱应收到带「有效/无效」按钮的邮件。</li>
          <li>点标记链接，确认页二次确认后，状态变为有效或无效。</li>
          <li>再提交一封明显 SEO 垃圾信，应进入「自动垃圾」且不发给客户。</li>
        </ol>
      </section>
    </div>
  );
}
