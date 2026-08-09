import { redirect } from "next/navigation";

/** 接入说明页已移除，统一到网站「询盘配置」清单 */
export default function GuideRedirectPage() {
  redirect("/admin/sites");
}
