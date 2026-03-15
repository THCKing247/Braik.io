"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, User, Edit, Mail, Trash2, MoreVertical, ArrowUpDown, Link2, Send, Ban } from "lucide-react"
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
  playerPhone?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invite_created" | "invite_sent" | "email_sent" | "sms_sent" | "claimed" | "invited" | "joined"
  joinLink?: string | null
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
  onCopyJoinLink?: (player: any) => void
  onResendInvite?: (player: any) => void | Promise<void>
  onRevokeInvite?: (player: any) => void | Promise<void>
  onDeletePlayer?: (player: any) => void | Promise<void>
  /** Head coach: promote/move player to another team level (JV, Varsity, etc.). */
  onPromotePlayer?: (player: any) => void
  /** True while this card's photo is uploading; shows spinner and disables upload. */
  isUploading?: boolean
  /** Optional local preview URL (object URL) to show while upload is in progress. */
  previewImageUrl?: string | null
  /** Optional eligibility hint for depth chart (e.g. "Best fit: X, Z"). Rendered as small muted text. */
  eligibilityHint?: string | null
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
  onCopyJoinLink,
  onResendInvite,
  onRevokeInvite,
  onDeletePlayer,
  onPromotePlayer,
  isUploading = false,
  previewImageUrl = null,
  eligibilityHint,
}: PlayerCardProps) {
  const router = useRouter()
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showFormsModal, setShowFormsModal] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (profileHref) {
      router.push(profileHref)
    }
  }

  const handleThreeDotClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowActionsMenu(true)
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
    if (canEdit && onImageUpload && !isUploading) {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/jpeg,image/png,image/gif,image/webp"
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) onImageUpload(player.id, file)
      }
      input.click()
    }
  }

  const displayImageUrl = previewImageUrl ?? (player.imageUrl && !imageError && player.imageUrl.trim() !== "" ? player.imageUrl : null)

  return (
    <Card
      className={`hover:shadow-sm transition-all duration-200 border overflow-hidden relative ${
        draggable ? "cursor-move" : ""
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
    >
      {/* Three Dot Menu - Top Right */}
      {(onSendInvite || onDeletePlayer || onCopyJoinLink || onResendInvite || onRevokeInvite) && (
        <button
          type="button"
          onClick={handleThreeDotClick}
          className="absolute top-2 right-2 p-1.5 rounded hover:bg-gray-100 transition-colors z-10"
          title="More options"
          style={{ color: "rgb(var(--text))" }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
      
      {/* Health Status Indicator - Top Right (if no three dots) */}
      {player.healthStatus && player.healthStatus !== "active" && !(onSendInvite || onDeletePlayer || onCopyJoinLink || onResendInvite || onRevokeInvite) && (
        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getHealthStatusColor()}`} title={player.healthStatus === "injured" ? "Injured" : "Unavailable"} />
      )}
      <CardContent className="p-3 flex flex-col items-center h-full">
        {/* Player Image / Placeholder - stop propagation so upload works without navigating */}
        <div
          className={`w-20 h-28 relative mb-3 rounded border overflow-hidden ${
            canEdit && onImageUpload && !isUploading ? "cursor-pointer" : ""
          }`}
          style={{
            borderColor: "rgb(var(--border))",
            backgroundColor: "rgb(var(--platinum))",
            borderWidth: "1px"
          }}
          onClick={(e) => { e.stopPropagation(); handleImageClick() }}
          title={canEdit && onImageUpload && !isUploading ? "Click to upload image" : ""}
        >
          {displayImageUrl ? (
            <Image
              src={displayImageUrl}
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
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
            </div>
          )}
          {canEdit && onImageUpload && !isUploading && isHovered && !displayImageUrl && (
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
            {eligibilityHint && (
              <div className="text-[10px] opacity-80 truncate" style={{ color: "#64748b" }} title={eligibilityHint}>
                {eligibilityHint}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between w-full mt-2">
            {/* Forms and Profile Icons - Bottom Left */}
            <div className="flex items-center gap-1.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFormsModal(true)
                  }}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors flex items-center justify-center"
                  title="Manage Forms"
                  style={{ minWidth: "24px", minHeight: "24px" }}
                >
                  <FileText className="h-4 w-4" style={{ color: "rgb(var(--text))" }} />
                </button>
              )}
              {profileHref && (
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors flex items-center justify-center text-lg leading-none"
                  title="View Profile"
                  style={{ minWidth: "24px", minHeight: "24px" }}
                >
                  👤
                </button>
              )}
            </div>
            {!canEdit && !profileHref && <div />}
            {/* Status Badge - Bottom Right (health + invite) */}
            <div className="flex flex-col items-end gap-1">
              {(player.inviteStatus === "email_sent") && (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  Email sent
                </span>
              )}
              {(player.inviteStatus === "sms_sent") && (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-sky-100 text-sky-800 border border-sky-200">
                  SMS sent
                </span>
              )}
              {(player.inviteStatus === "invite_created" || player.inviteStatus === "invite_sent" || player.inviteStatus === "invited") && (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Invite created
                </span>
              )}
              {(player.inviteStatus === "claimed" || player.inviteStatus === "joined") && player.user && (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Claimed
                </span>
              )}
              {(!player.inviteStatus || player.inviteStatus === "not_invited") && !player.user && canEdit && (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  Not invited
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-1 rounded font-semibold ${getStatusDisplay().color} ${getStatusDisplay().bgColor} border`}
              >
                {getStatusDisplay().text}
              </span>
            </div>
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

      {/* Actions Menu Modal - Three Dot Menu */}
      <Dialog open={showActionsMenu} onOpenChange={setShowActionsMenu}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>
              {player.firstName} {player.lastName}
              {player.jerseyNumber && ` #${player.jerseyNumber}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {onSendInvite && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  setShowActionsMenu(false)
                  await onSendInvite(player)
                }}
                disabled={!!player.user}
                title={player.user ? "Player already has an account" : "Create invite and open share options"}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Invite
              </Button>
            )}
            {onCopyJoinLink && (player.inviteStatus === "invite_created" || player.inviteStatus === "invite_sent" || player.inviteStatus === "invited" || player.inviteStatus === "email_sent" || player.inviteStatus === "sms_sent") && player.joinLink && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowActionsMenu(false)
                  onCopyJoinLink(player)
                }}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Copy join link
              </Button>
            )}
            {onResendInvite && (player.inviteStatus === "invite_created" || player.inviteStatus === "invite_sent" || player.inviteStatus === "invited" || player.inviteStatus === "email_sent" || player.inviteStatus === "sms_sent") && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  setShowActionsMenu(false)
                  await onResendInvite(player)
                }}
                disabled={!!player.user}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <Send className="h-4 w-4 mr-2" />
                Resend invite
              </Button>
            )}
            {onRevokeInvite && (player.inviteStatus === "invite_created" || player.inviteStatus === "invite_sent" || player.inviteStatus === "invited" || player.inviteStatus === "email_sent" || player.inviteStatus === "sms_sent") && (
              <Button
                variant="outline"
                className="w-full justify-start text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200"
                onClick={async () => {
                  setShowActionsMenu(false)
                  await onRevokeInvite(player)
                }}
                disabled={!!player.user}
              >
                <Ban className="h-4 w-4 mr-2" />
                Revoke invite
              </Button>
            )}
            {onPromotePlayer && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowActionsMenu(false)
                  onPromotePlayer(player)
                }}
                style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Move to…
              </Button>
            )}
            {onDeletePlayer && (
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => {
                  setShowActionsMenu(false)
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
