"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, User, Edit, Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerFormsModal } from "./player-forms-modal"

interface PlayerCardPlayer {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  imageUrl?: string | null
  healthStatus?: "active" | "injured" | "unavailable"
  missingForms?: string[]
  user?: { email: string } | null
  grade?: number | null
  notes?: string | null
  email?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invited" | "joined"
  guardianLinks?: Array<{ guardian: { user: { email: string } } }>
}

interface PlayerCardProps {
  player: PlayerCardPlayer
  canEdit?: boolean
  size?: "small" | "medium" | "large"
  primaryColor?: string
  secondaryColor?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onImageUpload?: (playerId: string, file: File) => void
  onFormsUpdate?: (playerId: string, formsComplete: boolean, missingForms: string[]) => void | Promise<void>
  /** When set, clicking the card (excluding forms/image upload) opens the player profile. */
  profileHref?: string
  /** Callbacks for player actions - accepts any player-like object */
  onEditPlayer?: (player: any) => void
  onSendInvite?: (player: any) => void | Promise<void>
  onDeletePlayer?: (player: any) => void | Promise<void>
}

export function PlayerCard({
  player,
  canEdit = false,
  size = "medium",
  draggable = false,
  onDragStart,
  onImageUpload,
  onFormsUpdate,
  profileHref,
  onEditPlayer,
  onSendInvite,
  onDeletePlayer,
}: PlayerCardProps) {
  const router = useRouter()
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [showPlayerModal, setShowPlayerModal] = useState(false)

  const handleCardClick = () => {
    if (draggable) return // Don't open modal if dragging
    setShowPlayerModal(true)
  }

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (profileHref) {
      router.push(profileHref)
    }
  }

  const getInitials = () => {
    const first = (player.firstName || "")[0] || ""
    const last = (player.lastName || "")[0] || ""
    return `${first}${last}`.toUpperCase() || "?"
  }

  const getHealthStatusColor = () => {
    const status = player.healthStatus || "active"
    switch (status) {
      case "active":
        return "bg-green-500"
      case "injured":
        return "bg-red-500"
      case "unavailable":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusDisplay = () => {
    const status = player.healthStatus || (player.status === "active" ? "active" : "inactive")
    switch (status) {
      case "active":
        return { text: "Active", color: "text-green-600", bgColor: "bg-green-100" }
      case "injured":
        return { text: "Injured", color: "text-red-600", bgColor: "bg-red-100" }
      case "unavailable":
        return { text: "Inactive", color: "text-orange-600", bgColor: "bg-orange-100" }
      default:
        return { text: "Inactive", color: "text-orange-600", bgColor: "bg-orange-100" }
    }
  }

  const handleImageClick = () => {
    if (canEdit && onImageUpload) {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          onImageUpload(player.id, file)
        }
      }
      input.click()
    }
  }

  return (
    <Card
      className={`hover:shadow-sm transition-all duration-200 border overflow-hidden relative ${
        !draggable ? "cursor-pointer" : "cursor-move"
      }`}
      style={{
        borderColor: player.healthStatus === "injured" ? "#EF4444" : player.healthStatus === "unavailable" ? "#F97316" : "rgb(var(--border))",
        borderWidth: player.healthStatus && player.healthStatus !== "active" ? "2px" : "1px",
        backgroundColor: "#FFFFFF",
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      role={!draggable ? "button" : undefined}
      tabIndex={!draggable ? 0 : undefined}
      onKeyDown={!draggable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick() } } : undefined}
    >
      {/* Health Status Indicator */}
      {player.healthStatus && player.healthStatus !== "active" && (
        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getHealthStatusColor()}`} title={player.healthStatus === "injured" ? "Injured" : "Unavailable"} />
      )}
      <CardContent className="p-3 flex flex-col items-center h-full">
        {/* Player Image / Placeholder - stop propagation so upload works without navigating */}
        <div
          className={`w-20 h-28 relative mb-3 rounded border overflow-hidden ${
            canEdit && onImageUpload ? "cursor-pointer" : ""
          }`}
          style={{
            borderColor: "rgb(var(--border))",
            backgroundColor: "rgb(var(--platinum))",
            borderWidth: "1px"
          }}
          onClick={(e) => { e.stopPropagation(); handleImageClick() }}
          title={canEdit && onImageUpload ? "Click to upload image" : ""}
        >
          {player.imageUrl && !imageError && player.imageUrl.trim() !== "" ? (
            <Image
              src={player.imageUrl}
              alt={`${player.firstName} ${player.lastName}`}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              unoptimized
              sizes="80px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "rgb(var(--muted))" }}>
              {getInitials()}
            </div>
          )}
          {canEdit && onImageUpload && isHovered && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
              <span className="text-white text-xs font-semibold">Upload</span>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="w-full text-center flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold truncate mb-1" style={{ color: "#000000" }}>
              {player.firstName} {player.lastName}
            </h3>
            <div className="text-xs mb-2" style={{ color: "#000000" }}>
              {player.jerseyNumber && (
                <span className="font-bold">#{player.jerseyNumber}</span>
              )}
              {player.jerseyNumber && player.positionGroup && " • "}
              {player.positionGroup && <span>{player.positionGroup}</span>}
            </div>
          </div>
          <div className="flex items-center justify-between w-full mt-2">
            {/* Forms and Profile Icons - Bottom Left */}
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFormsModal(true)
                  }}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  title="Manage Forms"
                >
                  <FileText className="h-4 w-4 text-gray-600" />
                </button>
              )}
              {profileHref && (
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors text-lg"
                  title="View Profile"
                >
                  👤
                </button>
              )}
            </div>
            {!canEdit && !profileHref && <div />}
            {/* Status Badge - Bottom Right */}
            <span
              className={`text-[10px] px-2 py-1 rounded font-semibold ${getStatusDisplay().color} ${getStatusDisplay().bgColor} border`}
            >
              {getStatusDisplay().text}
            </span>
          </div>
        </div>
      </CardContent>
      {showFormsModal && (
        <PlayerFormsModal
          player={player}
          isOpen={showFormsModal}
          onClose={() => setShowFormsModal(false)}
          onFormsUpdate={onFormsUpdate}
        />
      )}

      {/* Player Actions Modal */}
      <Dialog open={showPlayerModal} onOpenChange={setShowPlayerModal}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>
              {player.firstName} {player.lastName}
              {player.jerseyNumber && ` #${player.jerseyNumber}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {profileHref && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowPlayerModal(false)
                  router.push(profileHref)
                }}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <User className="h-4 w-4 mr-2" />
                View Profile
              </Button>
            )}
            {canEdit && onEditPlayer && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowPlayerModal(false)
                  onEditPlayer(player)
                }}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Player
              </Button>
            )}
            {onSendInvite && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  setShowPlayerModal(false)
                  await onSendInvite(player)
                }}
                disabled={!!player.user}
                title={player.user ? "Player already has an account" : "Generate invite code to share"}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            )}
            {onDeletePlayer && (
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => {
                  setShowPlayerModal(false)
                  onDeletePlayer(player)
                }}
                style={{ borderColor: "#EF4444", color: "#DC2626" }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Player
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
