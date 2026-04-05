"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { FolderOpen } from "lucide-react"

export default function CollectionsPage() {
  return (
    <ComingSoon
      title="Collections"
      description="Organize and manage your team's curated content, resources, and media libraries — all in one accessible place."
      icon={FolderOpen}
    />
  )
}
