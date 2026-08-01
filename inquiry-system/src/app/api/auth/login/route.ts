import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username || "");
  const password = String(body.password || "");
  const user = await verifyPassword(username, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "用户名或密码错误" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
