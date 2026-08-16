import { redirect } from "next/navigation";

/** 黑名单功能已下线，分流改由 DeepSeek 判定 */
export default function BlacklistPage() {
  redirect("/admin/inquiries");
}
