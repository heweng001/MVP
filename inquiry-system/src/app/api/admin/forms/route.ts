import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const form = await prisma.formMailConfig.upsert({
    where: {
      siteId_formId: {
        siteId: String(body.siteId),
        formId: String(body.formId),
      },
    },
    create: {
      siteId: String(body.siteId),
      formId: String(body.formId),
      label: String(body.label || ""),
      toEmails: String(body.toEmails || ""),
      ccEmails: String(body.ccEmails || ""),
      enabled: body.enabled !== false,
    },
    update: {
      label: String(body.label || ""),
      toEmails: String(body.toEmails || ""),
      ccEmails: String(body.ccEmails || ""),
      enabled: body.enabled !== false,
    },
  });
  return NextResponse.json({ form });
}
