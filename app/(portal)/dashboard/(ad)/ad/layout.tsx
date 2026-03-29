import { AdPortalShellGate } from "@/components/portal/ad-portal-shell-gate"

/** AD shell loads via GET /api/app/bootstrap?portal=ad on the client — no server session blocking. */
export default function AthleticDirectorLayout({ children }: { children: React.ReactNode }) {
  return <AdPortalShellGate>{children}</AdPortalShellGate>
}
