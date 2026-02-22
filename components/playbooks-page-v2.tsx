"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Edit3 } from "lucide-react"
import { PlaybookLibrary } from "@/components/playbook-library"
import { PlaybookBuilderV2 } from "@/components/playbook-builder-v2"
import type { Tab, SideOfBall, DraftTemplateSession, BuilderMode } from "@/types/playbook"

interface PlaybooksPageV2Props {
  teamId: string
  canEditAll: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
  userRole: string
}

export function PlaybooksPageV2({
  teamId,
  canEditAll,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
  userRole,
}: PlaybooksPageV2Props) {
  const [activeTab, setActiveTab] = useState<Tab>("LIBRARY")
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [builderMode, setBuilderMode] = useState<BuilderMode>("VIEW_ONLY")
  const [draftTemplate, setDraftTemplate] = useState<DraftTemplateSession>({
    isActive: false,
    kind: "FORMATION",
    side: "offense",
    name: "",
    shapes: [],
  })

  const canEdit = canEditAll || canEditOffense || canEditDefense || canEditSpecialTeams

  const handleCreatePlaybook = () => {
    // TODO: Create new playbook and switch to builder
    setActiveTab("BUILDER")
  }

  const handleOpenPlaybookInViewer = (playbookId: string) => {
    setSelectedPlaybookId(playbookId)
    setBuilderMode("VIEW_ONLY")
    // Stay in LIBRARY tab for view-only
  }

  const handleOpenPlaybookInBuilder = (playbookId: string) => {
    setSelectedPlaybookId(playbookId)
    setBuilderMode("PLAY_EDIT")
    setActiveTab("BUILDER")
  }

  const handleStartDraftFormation = (side: SideOfBall) => {
    setDraftTemplate({
      isActive: true,
      kind: "FORMATION",
      side,
      name: "",
      shapes: [],
    })
    setBuilderMode("TEMPLATE_EDIT")
    setActiveTab("BUILDER")
  }

  const handleStartDraftSubFormation = (parentFormationId: string, side: SideOfBall) => {
    setDraftTemplate({
      isActive: true,
      kind: "SUBFORMATION",
      side,
      parentFormationId,
      name: "",
      shapes: [],
    })
    setBuilderMode("TEMPLATE_EDIT")
    setActiveTab("BUILDER")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between p-4 border-b-2 flex-shrink-0" style={{ borderBottomColor: "#0B2A5B" }}>
        <h1 className="text-2xl font-bold" style={{ color: "#0B2A5B" }}>
          Playbooks
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "LIBRARY" ? "default" : "outline"}
            onClick={() => setActiveTab("LIBRARY")}
            className="flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Library
          </Button>
          <Button
            variant={activeTab === "BUILDER" ? "default" : "outline"}
            onClick={() => setActiveTab("BUILDER")}
            className="flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Builder
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "LIBRARY" ? (
          <PlaybookLibrary
            teamId={teamId}
            onOpenPlaybook={handleOpenPlaybookInViewer}
            onEditPlaybook={handleOpenPlaybookInBuilder}
            onCreatePlaybook={handleCreatePlaybook}
            canEdit={canEdit}
            canEditAll={canEditAll}
            canEditOffense={canEditOffense}
            canEditDefense={canEditDefense}
            canEditSpecialTeams={canEditSpecialTeams}
            userRole={userRole}
          />
        ) : (
          <PlaybookBuilderV2
            teamId={teamId}
            playbookId={selectedPlaybookId}
            selectedNodeId={selectedNodeId}
            builderMode={builderMode}
            draftTemplate={draftTemplate}
            onStartDraftFormation={handleStartDraftFormation}
            onStartDraftSubFormation={handleStartDraftSubFormation}
            onUpdateDraftName={(name) => setDraftTemplate({ ...draftTemplate, name })}
            onClearDraft={() => setDraftTemplate({ isActive: false, kind: "FORMATION", side: "offense", name: "", shapes: [] })}
            canEdit={canEdit}
            canEditAll={canEditAll}
            canEditOffense={canEditOffense}
            canEditDefense={canEditDefense}
            canEditSpecialTeams={canEditSpecialTeams}
          />
        )}
      </div>
    </div>
  )
}
