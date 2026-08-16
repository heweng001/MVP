import { PageHeader } from "@/components/PageHeader";
import { SmtpSettingsForm } from "@/components/SmtpSettingsForm";
import { getSmtpConfigForAdmin } from "@/lib/settings";

export default async function SettingsPage() {
  const smtp = await getSmtpConfigForAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="发件设置"
        hint={
          <div className="space-y-1.5">
            <p>配置系统代发询盘邮件所用的 SMTP 账号与发件人地址。</p>
            <p>
              询盘是否发给客户由 <strong>DeepSeek</strong> 自动判定；收件人/抄送在各网站「询盘配置」里设置。
            </p>
            <p>
              密码请用<strong>客户端授权码</strong>。端口：587 不勾选 SSL；465 勾选 SSL。保存后请先发测试邮件。
            </p>
          </div>
        }
      />
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
