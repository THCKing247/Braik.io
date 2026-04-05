import { redirect } from "next/navigation"
import { AdPortalShellGate } from "@/components/portal/ad-portal-shell-gate"
import { loadAdPortalBootstrapForAdLayout } from "@/lib/app/load-ad-portal-bootstrap-for-ad-layout"

/**
 * Resolves the AD shell on the server (same payload as GET `/api/app/bootstrap?portal=ad`) and passes it
 * into the client gate so navigation + context are not blocked on a duplicate client fetch.
 */
export default async function AthleticDirectorLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadAdPortalBootstrapForAdLayout()
  if (!shell.ok) {
    if (shell.kind === "unauthorized") {
      redirect("/login?callbackUrl=/dashboard/ad")
    }
    redirect("/dashboard")
  }
  return <AdPortalShellGate initialBootstrapPayload={shell.payload}>{children}</AdPortalShellGate>
}
