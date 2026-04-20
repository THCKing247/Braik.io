"use client"

import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { GameVideoLibrary } from "@/components/portal/game-video-library"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

export function PlayerPortalFilmRoom() {
  const { teamId } = usePlayerPortal()
  const vc = useAppBootstrapOptional()?.payload?.videoClips

  if (!vc?.navVisible) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/95 p-8 text-center shadow-xl">
        <p className="text-lg font-bold text-slate-900">Film Room isn&apos;t available</p>
        <p className="mt-2 text-sm text-slate-600">
          {vc?.disableHint ??
            "Your program may not have video enabled yet, or your account doesn’t include film access."}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[560px] overflow-hidden rounded-2xl border border-white/40 bg-white shadow-xl">
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
