"use client"

import { PlayerPortalPrepShell } from "@/components/portal/player-portal/player-portal-prep-shell"

/** Unified Film hub: Study, Film library, and Playbooks share secondary nav under `/prep/film`. */
export default function PlayerPrepFilmHubLayout({ children }: { children: React.ReactNode }) {
  return <PlayerPortalPrepShell>{children}</PlayerPortalPrepShell>
}
