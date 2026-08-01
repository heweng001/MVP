import { redirect } from "next/navigation";

export default function ReviewRedirectPage() {
  redirect("/admin/inquiries?tab=review");
}
