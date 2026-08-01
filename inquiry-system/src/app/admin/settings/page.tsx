import { HelpCallout } from "@/components/HelpCallout";
import { SmtpSettingsForm } from "@/components/SmtpSettingsForm";
import { getSmtpConfigForAdmin } from "@/lib/settings";

export default async function SettingsPage() {
  const smtp = await getSmtpConfigForAdmin();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">发件设置</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          配置系统代发询盘邮件所用的 SMTP 账号与发件人地址。
        </p>
      </div>
      <HelpCallout title="说明" guideHref="/admin/guide">
        <p>
          收件人/抄送在各网站的「表单配置」里设置；这里只配置<strong>用哪个邮箱发出</strong>。
        </p>
        <p>
          建议使用服务商域名邮箱或企业邮 SMTP。常见端口：587（STARTTLS，secure 不勾选）或
          465（SSL，勾选 secure）。
        </p>
      </HelpCallout>
      <SmtpSettingsForm
        initial={{
          host: smtp.form.host,
          port: smtp.form.port,
          secure: smtp.form.secure,
          user: smtp.form.user,
          from: smtp.form.from,
          hasPassword: smtp.hasPassword,
          configured: smtp.configured,
          source: smtp.source,
        }}
      />
    </div>
  );
}
