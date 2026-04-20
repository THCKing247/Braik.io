import { ParentPortalShellGate } from "@/components/portal/parent-portal-shell-gate"

export default function ParentPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { linkCode: string }
}) {
  return <ParentPortalShellGate urlLinkSegment={params.linkCode}>{children}</ParentPortalShellGate>
}
