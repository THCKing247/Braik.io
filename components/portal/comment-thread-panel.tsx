"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { MessageSquare, Send, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePlaybookToast } from "@/components/portal/playbook-toast"

export type CommentRecord = {
  id: string
  authorId: string
  authorName: string
  text: string
  resolved: boolean
  createdAt: string
  updatedAt: string
}

type ParentType = "playbook" | "formation" | "sub_formation" | "play"

export interface CommentThreadPanelProps {
  parentType: ParentType
  parentId: string
  /** When set, called with comment count for badge display */
  onCountChange?: (count: number) => void
  className?: string
  /** Collapsed by default when true */
  defaultCollapsed?: boolean
}

export function CommentThreadPanel({
  parentType,
  parentId,
  onCountChange,
  className = "",
  defaultCollapsed = false,
}: CommentThreadPanelProps) {
  const { showToast } = usePlaybookToast()
  const onCountChangeRef = useRef(onCountChange)
  onCountChangeRef.current = onCountChange

  const [comments, setComments] = useState<CommentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newText, setNewText] = useState("")
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // Fetch comments only when parent identity changes. No retry on failure; no dependency on
  // showToast/onCountChange to avoid infinite loops when toast or parent re-renders change refs.
  useEffect(() => {
    if (parentId == null || parentId === "" || parentType == null) {
      setComments([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/comments?parentType=${encodeURIComponent(parentType)}&parentId=${encodeURIComponent(parentId)}`)
      .then((res) => {
        if (cancelled) return null
        if (!res.ok) {
          console.warn("[CommentThreadPanel] Comments fetch failed:", res.status, res.statusText)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setComments(list)
        onCountChangeRef.current?.(list.length)
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[CommentThreadPanel] Comments fetch error:", err)
          setComments([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [parentType, parentId])

  const handlePost = useCallback(async () => {
    const text = newText.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentType, parentId, text }),
      })
      if (res.ok) {
        const created = await res.json()
        setComments((prev) => [...prev, created])
        setNewText("")
        onCountChange?.(comments.length + 1)
        showToast("Comment added", "success")
      } else {
        showToast("Failed to add comment", "error")
      }
    } catch {
      showToast("Failed to add comment", "error")
    } finally {
      setPosting(false)
    }
  }, [parentType, parentId, newText, posting, comments.length, onCountChange, showToast])

  const handleResolve = useCallback(
    async (commentId: string, resolved: boolean) => {
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved }),
        })
        if (res.ok) {
          setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)))
        }
      } catch {
        showToast("Failed to update comment", "error")
      }
    },
    [showToast]
  )

  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" })
        if (res.ok) {
          setComments((prev) => prev.filter((c) => c.id !== commentId))
          onCountChange?.(comments.length - 1)
          showToast("Comment removed", "success")
        } else {
          showToast("Failed to remove comment", "error")
        }
      } catch {
        showToast("Failed to remove comment", "error")
      }
    },
    [comments.length, onCountChange, showToast]
  )

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      return sameDay ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    } catch {
      return ""
    }
  }

  if (collapsed) {
    return (
      <div className={`border border-slate-200 rounded-lg bg-slate-50/50 ${className}`}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100/80 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            Comments
            {comments.length > 0 && (
              <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-xs">
                {comments.length}
              </span>
            )}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={`border border-slate-200 rounded-lg bg-white flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/80">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          Comments
          {comments.length > 0 && (
            <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-xs">
              {comments.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Collapse
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 max-h-48">
        {loading ? (
          <p className="text-xs text-slate-500 py-2">Loading...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No comments yet. Add one below.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-md p-2 text-sm ${c.resolved ? "bg-slate-50 opacity-80" : "bg-slate-50/80"}`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-xs">
                    {c.authorName}
                    <span className="ml-1 font-normal text-slate-500">{formatTime(c.createdAt)}</span>
                  </p>
                  <p className="text-slate-700 mt-0.5 whitespace-pre-wrap break-words">{c.text}</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResolve(c.id, !c.resolved)}
                    className={`p-1 rounded ${c.resolved ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:text-emerald-600"}`}
                    title={c.resolved ? "Mark unresolved" : "Resolve"}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-2 border-t border-slate-200 flex gap-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handlePost()}
          placeholder="Add a comment..."
          className="flex-1 min-w-0 h-8 text-sm"
          disabled={posting}
        />
        <Button size="sm" onClick={handlePost} disabled={posting || !newText.trim()} className="h-8 px-3">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
