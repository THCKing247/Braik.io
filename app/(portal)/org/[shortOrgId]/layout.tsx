import { redirect } from "next/navigation"
import { AdPortalShellGate } from "@/components/portal/ad-portal-shell-gate"
import { loadAdPortalBootstrapForAdLayout } from "@/lib/app/load-ad-portal-bootstrap-for-ad-layout"

export default async function OrganizationPortalLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadAdPortalBootstrapForAdLayout()
  if (!shell.ok) {
    if (shell.kind === "unauthorized") {
      redirect("/login?callbackUrl=/dashboard")
    }
    redirect("/dashboard")
  }
  return <AdPortalShellGate initialBootstrapPayload={shell.payload}>{children}</AdPortalShellGate>
}
