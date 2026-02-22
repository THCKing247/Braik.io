"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, BookOpen } from "lucide-react"
import { PlaybookViewer } from "@/components/playbook-viewer"
import type { SideOfBall } from "@/types/playbook"

interface PlaybookLibraryProps {
  teamId: string
  onOpenPlaybook: (playbookId: string) => void
  onEditPlaybook: (playbookId: string) => void
  onCreatePlaybook: () => void
  canEdit: boolean
  canEditAll: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
  userRole: string
}

interface Playbook {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  visibility: {
    offense: boolean
    defense: boolean
    specialTeams: boolean
  }
}

export function PlaybookLibrary({
  teamId,
  onOpenPlaybook,
  onEditPlaybook,
  onCreatePlaybook,
  canEdit,
  canEditAll,
  canEditOffense,
  canEditDefense,
  canEditDefense: canEditSpecialTeams,
  userRole,
}: PlaybookLibraryProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch playbooks from API
    // For now, using existing plays structure
    fetchPlaybooks()
  }, [teamId])

  const fetchPlaybooks = async () => {
    try {
      // TODO: Replace with actual playbook API
      // For now, we'll create a virtual playbook from existing plays
      const response = await fetch(`/api/plays?teamId=${teamId}`)
      if (response.ok) {
        const plays = await response.json()
        // Create a default playbook
        const defaultPlaybook: Playbook = {
          id: "default",
          name: "Team Playbook",
          createdAt: new Date(),
          updatedAt: new Date(),
          visibility: {
            offense: true,
            defense: true,
            specialTeams: true,
          },
        }
        setPlaybooks([defaultPlaybook])
      }
    } catch (error) {
      console.error("Error fetching playbooks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlaybookClick = (playbookId: string) => {
    setSelectedPlaybookId(playbookId)
    onOpenPlaybook(playbookId)
  }

  if (selectedPlaybookId) {
    return (
      <PlaybookViewer
        teamId={teamId}
        playbookId={selectedPlaybookId}
        onEdit={() => onEditPlaybook(selectedPlaybookId)}
        onBack={() => setSelectedPlaybookId(null)}
        canEdit={canEdit}
        canEditAll={canEditAll}
        canEditOffense={canEditOffense}
        canEditDefense={canEditDefense}
        canEditSpecialTeams={canEditSpecialTeams}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading playbooks...</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: "#0B2A5B" }}>
          Playbook Library
        </h2>
        {canEdit && (
          <Button onClick={onCreatePlaybook} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New Playbook
          </Button>
        )}
      </div>

      {playbooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <BookOpen className="h-16 w-16 mb-4" style={{ color: "#9CA3AF" }} />
          <p className="text-gray-500 mb-4">No playbooks yet</p>
          {canEdit && (
            <Button onClick={onCreatePlaybook} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Playbook
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {playbooks.map((playbook) => (
            <Card
              key={playbook.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handlePlaybookClick(playbook.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" style={{ color: "#3B82F6" }} />
                  {playbook.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500">
                  <p>Updated: {new Date(playbook.updatedAt).toLocaleDateString()}</p>
                  <div className="mt-2 flex gap-2">
                    {playbook.visibility.offense && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Offense</span>
                    )}
                    {playbook.visibility.defense && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Defense</span>
                    )}
                    {playbook.visibility.specialTeams && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Special Teams</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
