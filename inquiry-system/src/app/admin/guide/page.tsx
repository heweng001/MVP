import { redirect } from "next/navigation";

/** 接入说明页已移除，统一到网站「配置对接」清单 */
export default function GuideRedirectPage() {
  redirect("/admin/sites");
}
