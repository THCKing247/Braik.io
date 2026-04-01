"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { Video } from "lucide-react"

/**
 * Game Video / Clips — scaffold only.
 * TODO: Integrate upload pipeline (Supabase Storage), transcoding, video player, and clip editor.
 */
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
    const productOff = vc != null && !vc.productEnabled
    const permissionsOff = vc != null && vc.productEnabled && !vc.canViewVideo
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-foreground">Game Video / Clips is not available</p>
        {productOff && (
          <p className="mt-2 text-sm text-muted-foreground">
            This feature is off for your team until school (athletic department), organization (when your team is linked to
            a program), and team-level video settings all allow it. An administrator can enable organization video or
            adjust program links if school and team are already on.
          </p>
        )}
        {permissionsOff && (
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have video viewing permission. Contact your administrator if you need access.
          </p>
        )}
        {!productOff && !permissionsOff && (
          <p className="mt-2 text-sm text-muted-foreground">
            This page could not be loaded yet, or access is restricted. Try refreshing; contact your administrator if the
            problem continues.
          </p>
        )}
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
            Team: <span className="font-mono text-xs">{teamId}</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6">
        <p className="text-sm font-medium text-foreground">Coming next</p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>TODO: Upload full game video to secure storage (coach / delegated uploader).</li>
          <li>TODO: In-browser player with keyboard shortcuts and timeline.</li>
          <li>TODO: Clip editor — mark in/out, label plays, share to position groups.</li>
          <li>TODO: Use GET /api/teams/[teamId]/game-videos for listing once uploads exist.</li>
        </ul>
      </div>

      <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        Permissions: view={String(vc.canViewVideo)} upload={String(vc.canUploadVideo)} clips={String(vc.canCreateClips)}{" "}
        share={String(vc.canShareClips)} delete={String(vc.canDeleteVideo)}
      </div>
    </div>
  )
}
