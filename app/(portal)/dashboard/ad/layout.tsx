import { redirect } from "next/navigation"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { AdNav } from "@/components/portal/ad/ad-nav"

export const dynamic = "force-dynamic"

export default async function AthleticDirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) {
    redirect("/login")
  }
  const role = session.user.role?.toUpperCase()
  if (role !== "ATHLETIC_DIRECTOR") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <AdNav userEmail={session.user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
