"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { FileText, Image as ImageIcon, File, Lock, Users, User, Trash2, BookOpen } from "lucide-react"

interface Playbook {
  id: string
  title: string
  fileName: string
  category: string
  folder: string | null
  visibility: string
  scopedUnit: string | null
  scopedPositionGroups: any
  assignedPlayerIds: any
  createdAt: Date
  creator: { name: string | null; email: string }
  acknowledgements: Array<{ id: string }>
}

export function PlaybooksManager({ teamId, playbooks: initialPlaybooks, canUpload, userRole }: { 
  teamId: string
  playbooks: Playbook[]
  canUpload: boolean
  userRole?: string
}) {
  const [playbooks, setPlaybooks] = useState(initialPlaybooks)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"all" | "folders">("all")

  const [title, setTitle] = useState("")
  const [folder, setFolder] = useState("")
  const [visibility, setVisibility] = useState("all")
  const [scopedUnit, setScopedUnit] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)

  // Extract unique folders and units
  const folders = useMemo(() => {
    const folderSet = new Set<string>()
    playbooks.forEach(pb => {
      if (pb.folder) {
        folderSet.add(pb.folder)
      }
    })
    return Array.from(folderSet).sort()
  }, [playbooks])

  const units = useMemo(() => {
    const unitSet = new Set<string>()
    playbooks.forEach(pb => {
      if (pb.scopedUnit) {
        unitSet.add(pb.scopedUnit)
      }
    })
    return Array.from(unitSet).sort()
  }, [playbooks])

  // Filter playbooks based on selected folder and unit
  const filteredPlaybooks = useMemo(() => {
    let filtered = playbooks

    if (selectedFolder) {
      filtered = filtered.filter(pb => pb.folder === selectedFolder)
    }

    if (selectedUnit) {
      filtered = filtered.filter(pb => pb.scopedUnit === selectedUnit)
    }

    return filtered
  }, [playbooks, selectedFolder, selectedUnit])

  // Group playbooks by folder for folder view
  const playbooksByFolder = useMemo(() => {
    const grouped: Record<string, Playbook[]> = {}
    const noFolder: Playbook[] = []

    filteredPlaybooks.forEach(pb => {
      if (pb.folder) {
        if (!grouped[pb.folder]) {
          grouped[pb.folder] = []
        }
        grouped[pb.folder].push(pb)
      } else {
        noFolder.push(pb)
      }
    })

    return { grouped, noFolder }
  }, [filteredPlaybooks])

  const handleUpload = async () => {
    if (!title || !file) {
      alert("Title and file are required")
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("teamId", teamId)
      formData.append("title", title)
      formData.append("category", "playbook") // Always playbook
      formData.append("visibility", visibility)
      if (folder.trim()) {
        formData.append("folder", folder.trim())
      }
      if (scopedUnit) {
        formData.append("scopedUnit", scopedUnit)
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload playbook")
      }

      const newPlaybook = await response.json()
      setPlaybooks([newPlaybook, ...playbooks])
      setTitle("")
      setFolder("")
      setScopedUnit("")
      setFile(null)
      setShowUploadForm(false)
    } catch (error: any) {
      alert(error.message || "Error uploading playbook")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (playbookId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this playbook?")) {
      return
    }

    try {
      const response = await fetch(`/api/documents/${playbookId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete playbook")
      }

      setPlaybooks(playbooks.filter(pb => pb.id !== playbookId))
    } catch (error) {
      alert("Error deleting playbook")
    }
  }

  const handleCardClick = (playbookId: string) => {
    window.open(`/api/documents/${playbookId}`, "_blank")
  }

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case "staff":
        return { icon: Lock, label: "Coaches", color: "#0B2A5B" }
      case "players":
        return { icon: Users, label: "Players", color: "#0B2A5B" }
      case "parents":
        return { icon: User, label: "Parents", color: "#0B2A5B" }
      default:
        return { icon: Users, label: "All", color: "#0B2A5B" }
    }
  }

  const getFileType = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return "image"
    }
    if (ext === "pdf") {
      return "pdf"
    }
    if (["doc", "docx"].includes(ext || "")) {
      return "docx"
    }
    return "other"
  }

  const getPreviewUrl = (playbook: Playbook) => {
    const fileType = getFileType(playbook.fileName)
    if (fileType === "image") {
      return `/api/documents/${playbook.id}`
    }
    return null
  }

  return (
    <div>
      {canUpload && (
        <div className="mb-6">
          {!showUploadForm ? (
            <Button onClick={() => setShowUploadForm(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Upload Playbook
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Upload Playbook</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                        className="flex h-10 w-full rounded-md border-2 px-3 py-2 text-sm"
                        style={{ borderColor: "#0B2A5B" }}
                      >
                        <option value="all">All</option>
                        <option value="staff">Staff Only</option>
                        <option value="players">Players</option>
                        <option value="parents">Parents (Explicit Share)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Unit (Optional)</Label>
                      <select
                        value={scopedUnit}
                        onChange={(e) => setScopedUnit(e.target.value)}
                        className="flex h-10 w-full rounded-md border-2 px-3 py-2 text-sm"
                        style={{ borderColor: "#0B2A5B" }}
                      >
                        <option value="">All Units</option>
                        <option value="OFFENSE">Offense</option>
                        <option value="DEFENSE">Defense</option>
                        <option value="SPECIAL_TEAMS">Special Teams</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Folder (optional)</Label>
                    <Input 
                      value={folder} 
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder="e.g., Passing Game, Base Defense"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use forward slashes (/) to create nested folders
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>File *</Label>
                    <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <Button onClick={handleUpload} disabled={loading}>
                    {loading ? "Uploading..." : "Upload"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowUploadForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("all")
              setSelectedFolder(null)
            }}
          >
            All Playbooks
          </Button>
          <Button
            variant={viewMode === "folders" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("folders")}
          >
            Browse by Folder
          </Button>
        </div>

        {viewMode === "all" && (
          <>
            {folders.length > 0 && (
              <select
                value={selectedFolder || ""}
                onChange={(e) => setSelectedFolder(e.target.value || null)}
                className="flex h-10 rounded-md border-2 px-3 py-2 text-sm"
                style={{ borderColor: "#0B2A5B" }}
              >
                <option value="">All Folders</option>
                {folders.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
            {units.length > 0 && (
              <select
                value={selectedUnit || ""}
                onChange={(e) => setSelectedUnit(e.target.value || null)}
                className="flex h-10 rounded-md border-2 px-3 py-2 text-sm"
                style={{ borderColor: "#0B2A5B" }}
              >
                <option value="">All Units</option>
                {units.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {/* Playbooks Display - Card Grid */}
      {viewMode === "folders" ? (
        <div className="space-y-8">
          {Object.entries(playbooksByFolder.grouped).map(([folderName, folderPlaybooks]) => (
            <div key={folderName}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "rgb(var(--text))" }}>
                📁 {folderName}
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))]" style={{ gap: "24px" }}>
                {folderPlaybooks.map((playbook) => (
                  <PlaybookCard
                    key={playbook.id}
                    playbook={playbook}
                    canDelete={canUpload && userRole === "HEAD_COACH"}
                    onDelete={handleDelete}
                    onClick={handleCardClick}
                    getPreviewUrl={getPreviewUrl}
                    getFileType={getFileType}
                    getVisibilityBadge={getVisibilityBadge}
                  />
                ))}
              </div>
            </div>
          ))}
          {playbooksByFolder.noFolder.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "rgb(var(--text))" }}>
                📄 Uncategorized
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))]" style={{ gap: "24px" }}>
                {playbooksByFolder.noFolder.map((playbook) => (
                  <PlaybookCard
                    key={playbook.id}
                    playbook={playbook}
                    canDelete={canUpload && userRole === "HEAD_COACH"}
                    onDelete={handleDelete}
                    onClick={handleCardClick}
                    getPreviewUrl={getPreviewUrl}
                    getFileType={getFileType}
                    getVisibilityBadge={getVisibilityBadge}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))]" style={{ gap: "24px" }}>
          {filteredPlaybooks.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No playbooks found</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredPlaybooks.map((playbook) => (
              <PlaybookCard
                key={playbook.id}
                playbook={playbook}
                canDelete={canUpload && userRole === "HEAD_COACH"}
                onDelete={handleDelete}
                onClick={handleCardClick}
                getPreviewUrl={getPreviewUrl}
                getFileType={getFileType}
                getVisibilityBadge={getVisibilityBadge}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PlaybookCard({ 
  playbook, 
  canDelete, 
  onDelete, 
  onClick,
  getPreviewUrl,
  getFileType,
  getVisibilityBadge
}: { 
  playbook: Playbook
  canDelete: boolean
  onDelete: (id: string, e: React.MouseEvent) => void
  onClick: (id: string) => void
  getPreviewUrl: (playbook: Playbook) => string | null
  getFileType: (fileName: string) => string
  getVisibilityBadge: (visibility: string) => { icon: any, label: string, color: string }
}) {
  const previewUrl = getPreviewUrl(playbook)
  const fileType = getFileType(playbook.fileName)
  const visibilityInfo = getVisibilityBadge(playbook.visibility)
  const VisibilityIcon = visibilityInfo.icon

  return (
    <div
      className="document-card"
      onClick={() => onClick(playbook.id)}
      style={{
        background: "rgba(255, 255, 255, 0.96)",
        borderRadius: "14px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(11,42,91,0.10)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)"
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.06), 0 18px 42px rgba(11,42,91,0.14)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(11,42,91,0.10)"
      }}
    >
      {/* Visibility Badge */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(11,42,91,0.85)",
          color: "white",
          fontSize: "0.65rem",
          padding: "4px 8px",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          zIndex: 10,
        }}
      >
        <VisibilityIcon className="h-3 w-3" />
        <span>{visibilityInfo.label}</span>
      </div>

      {/* Unit Badge */}
      {playbook.scopedUnit && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(59,130,246,0.85)",
            color: "white",
            fontSize: "0.65rem",
            padding: "4px 8px",
            borderRadius: "999px",
            zIndex: 10,
          }}
        >
          {playbook.scopedUnit}
        </div>
      )}

      {/* Delete Button (only visible on hover) */}
      {canDelete && (
        <button
          onClick={(e) => onDelete(playbook.id, e)}
          className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-red-500 text-white opacity-0 transition-opacity hover:opacity-100"
          style={{
            opacity: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0"
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* Preview Area */}
      <div
        className="document-preview"
        style={{
          height: "200px",
          backgroundColor: "#F1F4F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {previewUrl && fileType === "image" ? (
          <img
            src={previewUrl}
            alt={playbook.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none"
              const parent = e.currentTarget.parentElement
              if (parent) {
                parent.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; color: #6B7280;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span style="font-size: 0.75rem;">Image</span>
                  </div>
                `
              }
            }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "#6B7280" }}>
            {fileType === "pdf" ? (
              <>
                <FileText className="h-12 w-12" style={{ color: "#DC2626" }} />
                <span style={{ fontSize: "0.75rem" }}>PDF</span>
              </>
            ) : fileType === "docx" ? (
              <>
                <FileText className="h-12 w-12" style={{ color: "#2563EB" }} />
                <span style={{ fontSize: "0.75rem" }}>Document</span>
              </>
            ) : (
              <>
                <File className="h-12 w-12" />
                <span style={{ fontSize: "0.75rem" }}>{playbook.fileName.split(".").pop()?.toUpperCase() || "File"}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Title + Metadata */}
      <div
        className="document-meta"
        style={{
          padding: "12px 14px",
        }}
      >
        <div
          className="document-title"
          style={{
            fontWeight: 600,
            fontSize: "0.95rem",
            color: "#0B2A5B",
            marginBottom: "4px",
            lineHeight: "1.3",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {playbook.title}
        </div>
        <div
          className="document-sub"
          style={{
            fontSize: "0.75rem",
            color: "#6B7280",
            marginTop: "4px",
          }}
        >
          {format(new Date(playbook.createdAt), "MMM d, yyyy")}
        </div>
      </div>
    </div>
  )
}
