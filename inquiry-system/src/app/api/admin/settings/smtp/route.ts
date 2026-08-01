import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSmtpConfigForAdmin, saveSmtpConfig } from "@/lib/settings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const smtp = await getSmtpConfigForAdmin();
  return NextResponse.json({ smtp });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const host = String(body.host || "").trim();
  const from = String(body.from || "").trim();
  if (!host) {
    return NextResponse.json({ error: "请填写 SMTP 主机" }, { status: 400 });
  }
  if (!from) {
    return NextResponse.json({ error: "请填写发件人（From）" }, { status: 400 });
  }

  const smtp = await saveSmtpConfig({
    host,
    port: Number(body.port || 587) || 587,
    secure: Boolean(body.secure),
    user: String(body.user || "").trim(),
    from,
    pass: typeof body.pass === "string" ? body.pass : undefined,
    clearPassword: Boolean(body.clearPassword),
  });

  return NextResponse.json({
    ok: true,
    smtp: {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      from: smtp.from,
      hasPassword: Boolean(smtp.pass),
      configured: Boolean(smtp.host),
      source: "database" as const,
    },
  });
}
