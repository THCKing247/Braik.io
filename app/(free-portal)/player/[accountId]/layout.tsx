import { PlayerPortalShellGate } from "@/components/portal/player-portal-shell-gate"

export default function PlayerPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { accountId: string }
}) {
  return <PlayerPortalShellGate urlAccountSegment={params.accountId}>{children}</PlayerPortalShellGate>
}
