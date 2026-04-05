"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { Video } from "lucide-react"

export default function FilmPage() {
  return (
    <ComingSoon
      title="Film Room"
      description="Upload, review, and annotate game film. Share key clips, draw plays directly on video, and accelerate learning for every player."
      icon={Video}
    />
  )
}
