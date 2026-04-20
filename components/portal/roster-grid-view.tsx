"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PlayerCard } from "./player-card"
import { PlayerPhotoCropModal } from "./player-photo-crop-modal"
import { RosterPaginationControls, ROSTER_CARDS_PAGE_SIZE } from "@/components/portal/roster-pagination-controls"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Invalid file type. Use JPEG, PNG, GIF, or WebP."
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "File is too large. Maximum size is 5MB."
  }
  return null
}

export interface Player {
  id: string
  playerAccountId?: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  notes: string | null
  imageUrl?: string | null
  email?: string | null
  playerPhone?: string | null
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invite_created" | "invite_sent" | "email_sent" | "sms_sent" | "claimed" | "invited" | "joined"
  joinLink?: string | null
  healthStatus?: "active" | "injured" | "unavailable"
  missingForms?: string[]
  user?: { email: string } | null
  guardianLinks?: Array<{ guardian: { user: { email: string } } }>
}

interface RosterGridViewProps {
  players: Player[]
  /** Used for roster image API resolution. */
  teamId?: string
  canEdit: boolean
  onEditPlayer?: (player: Player) => void
  onSendInvite?: (player: Player) => void | Promise<void>
  onCopyJoinLink?: (player: Player) => void
  onResendInvite?: (player: Player) => void | Promise<void>
  onRevokeInvite?: (player: Player) => void | Promise<void>
  onDeletePlayer?: (player: Player) => void | Promise<void>
  onPromotePlayer?: (player: Player) => void
  onImageUploadSuccess?: (playerId: string, imageUrl: string) => void
  /** If provided, each player card gets a "View Profile" link to this URL (e.g. /dashboard/roster/[playerId]?teamId=xxx). */
  getProfileHref?: (player: Player) => string
  /** When search/filters change, parent bumps this so pagination resets to page 1. */
  filterKey: string
}

export function RosterGridView({
  players,
  teamId,
  canEdit,
  onEditPlayer,
  onSendInvite,
  onCopyJoinLink,
  onResendInvite,
  onRevokeInvite,
  onDeletePlayer,
  onPromotePlayer,
  onImageUploadSuccess,
  getProfileHref,
  filterKey,
}: RosterGridViewProps) {
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [cropPlayerId, setCropPlayerId] = useState<string | null>(null)
  const [cropFileName, setCropFileName] = useState<string>("photo.jpg")
  const [playersState, setPlayersState] = useState<Player[]>(players)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPlayersState(players)
  }, [players])

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(players.length / ROSTER_CARDS_PAGE_SIZE))
    setPage((p) => Math.min(p, maxPage))
  }, [players.length])

  const pagedPlayers = useMemo(() => {
    const start = (page - 1) * ROSTER_CARDS_PAGE_SIZE
    return playersState.slice(start, start + ROSTER_CARDS_PAGE_SIZE)
  }, [playersState, page])

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    }
  }, [uploadPreviewUrl])

  const uploadFileForPlayer = useCallback(
    async (playerId: string, file: File) => {
      setUploadError(null)
      const previewUrl = URL.createObjectURL(file)
      setUploadPreviewUrl(previewUrl)
      setUploadingPlayerId(playerId)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
        const response = await fetch(`/api/roster/${playerId}/image${q}`, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err?.error ?? "Failed to upload image")
        }

        const data = await response.json()
        onImageUploadSuccess?.(playerId, data.imageUrl)
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.")
      } finally {
        setUploadingPlayerId(null)
        setUploadPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }
    },
    [onImageUploadSuccess, teamId]
  )

  const handleImageUpload = useCallback(
    (playerId: string, file: File) => {
      setUploadError(null)
      const validationError = validateImageFile(file)
      if (validationError) {
        setUploadError(validationError)
        return
      }
      const url = URL.createObjectURL(file)
      setCropImageUrl(url)
      setCropPlayerId(playerId)
      setCropFileName(file.name)
      setCropOpen(true)
    },
    []
  )

  const handleCropConfirm = useCallback(
    (blob: Blob) => {
      const pid = cropPlayerId
      const name = cropFileName.replace(/\.[^.]+$/, "") + ".jpg"
      setCropOpen(false)
      if (cropImageUrl) {
        URL.revokeObjectURL(cropImageUrl)
        setCropImageUrl(null)
      }
      setCropPlayerId(null)
      if (pid) {
        const file = new File([blob], name, { type: "image/jpeg" })
        uploadFileForPlayer(pid, file)
      }
    },
    [cropPlayerId, cropFileName, cropImageUrl, uploadFileForPlayer]
  )

  const handleCropCancel = useCallback(() => {
    setCropOpen(false)
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl)
      setCropImageUrl(null)
    }
    setCropPlayerId(null)
  }, [cropImageUrl])

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white/50 [scrollbar-gutter:stable]"
      aria-label="Roster cards grid"
    >
      {cropOpen && cropImageUrl && (
        <PlayerPhotoCropModal
          open={cropOpen}
          imageUrl={cropImageUrl}
          fileName={cropFileName}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      {uploadError && (
        <div className="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {uploadError}
        </div>
      )}
      <div
        className="grid min-h-0 auto-rows-auto grid-cols-2 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ maxHeight: "min(800px, calc(100vh - 12rem))" }}
      >
      {pagedPlayers.map((player) => (
        <div key={player.id} className="flex flex-col gap-2">
          <PlayerCard
            player={player}
            canEdit={canEdit}
            draggable={canEdit}
            onDragStart={(e) => {
              e.dataTransfer.setData("playerId", player.id)
              e.dataTransfer.effectAllowed = "move"
            }}
            onImageUpload={canEdit ? handleImageUpload : undefined}
            profileHref={getProfileHref?.(player)}
            onEditPlayer={onEditPlayer}
            onSendInvite={onSendInvite}
            onCopyJoinLink={onCopyJoinLink}
            onResendInvite={onResendInvite}
            onRevokeInvite={onRevokeInvite}
            onDeletePlayer={onDeletePlayer}
            onPromotePlayer={onPromotePlayer}
            isUploading={uploadingPlayerId === player.id}
            previewImageUrl={uploadingPlayerId === player.id ? uploadPreviewUrl : null}
          />
        </div>
      ))}
      {playersState.length === 0 && (
        <div className="col-span-full text-center py-12" style={{ color: "#000000" }}>
          No players in roster
        </div>
      )}
      </div>
      <RosterPaginationControls
        page={page}
        totalItems={playersState.length}
        pageSize={ROSTER_CARDS_PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
