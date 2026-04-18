"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { GameVideoLibrary } from "@/components/portal/game-video-library"
import { FilmRoomModalShell } from "@/components/portal/game-video/film-room-modal-shell"

export default function GameVideoPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => <GameVideoBody teamId={teamId} />}
    </DashboardPageShell>
  )
}

function GameVideoBody({ teamId }: { teamId: string }) {
  const vc = useAppBootstrapOptional()?.payload?.videoClips

  if (!vc?.navVisible) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-foreground">Game Video / Clips is not available</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {vc?.disableHint ??
            "Your program may not have this feature enabled, or your account does not include video access."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Head coaches can enable video for the team in Braik admin (school / organization / team toggles). Developers:
          set <span className="font-mono">BRAIK_VIDEO_DEV_DEFAULTS=true</span> in{" "}
          <span className="font-mono">.env.local</span> with <span className="font-mono">NODE_ENV=development</span> to
          bypass DB flags locally.
        </p>
      </div>
    )
  }

  return (
    <FilmRoomModalShell teamId={teamId}>
      <GameVideoLibrary
        teamId={teamId}
        entitlement={vc.entitlement}
        canUpload={vc.canUploadVideo}
        canCreateClips={vc.canCreateClips}
        canDeleteVideo={vc.canDeleteVideo}
        aiVideoEnabled={Boolean(vc.entitlement?.aiVideoEnabled)}
        taggingEnabled={Boolean(vc.entitlement?.taggingEnabled)}
        embeddedInModal
      />
    </FilmRoomModalShell>
  )
}
