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
      <HelpCallout title="说明">
        <p>
          收件人/抄送在各网站的「配置表单」里设置；这里只配置<strong>用哪个邮箱发出</strong>。
        </p>
        <p>
          密码请用邮箱<strong>客户端授权码</strong>。端口：587 不勾选 SSL；465 勾选 SSL。保存后务必先「发送测试邮件」。
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
