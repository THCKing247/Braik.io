"use client"

import { StudyGuidesCoachView } from "./study-guides-coach-view"
import { StudyGuidesPlayerView } from "./study-guides-player-view"

export function StudyGuidesModule({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  if (!canEdit) {
    return <StudyGuidesPlayerView teamId={teamId} />
  }
  return <StudyGuidesCoachView teamId={teamId} />
}
