import { redirect } from "next/navigation"

export default async function AdminLoginPage() {
  redirect("/login?callbackUrl=%2Fadmin%2Fdashboard")
}

