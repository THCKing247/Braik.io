"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { GameVideoLibrary } from "@/components/portal/game-video-library"
import { Video } from "lucide-react"

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
          Your program may not have this feature enabled, or your account does not include video access. Contact your
          administrator if you believe this is a mistake.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Video className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Game Video / Clips</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload game film, create clips, and manage storage for your team.
          </p>
        </div>
      </div>

      <GameVideoLibrary
        teamId={teamId}
        entitlement={vc.entitlement}
        canUpload={vc.canUploadVideo}
        canCreateClips={vc.canCreateClips}
        canDeleteVideo={vc.canDeleteVideo}
        aiVideoEnabled={Boolean(vc.entitlement?.aiVideoEnabled)}
        taggingEnabled={Boolean(vc.entitlement?.taggingEnabled)}
      />
    </div>
  )
}
