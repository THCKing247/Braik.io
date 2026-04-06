import { redirect } from "next/navigation"

/** Legacy URL — canonical overview lives at `/admin/overview`. */
export default function AdminDashboardRedirectPage() {
  redirect("/admin/overview")
}
