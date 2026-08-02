import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getSpamRoutingConfig,
  saveSpamRoutingConfig,
  validateSpamRouting,
} from "@/lib/settings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const spamRouting = await getSpamRoutingConfig();
  return NextResponse.json({ spamRouting });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const autoSpamMin = Number(body.autoSpamMin);
  const reviewMin = Number(body.reviewMin);
  const err = validateSpamRouting({ autoSpamMin, reviewMin });
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  try {
    const spamRouting = await saveSpamRoutingConfig({ autoSpamMin, reviewMin });
    return NextResponse.json({ ok: true, spamRouting });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 400 },
    );
  }
}
