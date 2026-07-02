"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ChevronLeft, Send, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

// ── shared types ──────────────────────────────────────────────────────────────

export type ReactionCount = {
  emoji: string
  total_count: number
  player_count: number
  parent_count: number
  staff_count: number
}

export type Reactor = {
  user_id: string
  full_name: string | null
  role: string
  emoji: string
  created_at: string
}

export type Comment = {
  id: string
  parent_id: string | null
  user_id: string
  author_name: string | null
  author_role: string
  body: string
  created_at: string
  replies: Comment[]
}

export type Viewer = {
  user_id: string
  full_name: string | null
  role: string
  viewed_at: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

const EMOJI_LIST = ["🔥", "💪", "❤️", "👍", "👀"]

const AVATAR_GRADIENTS = [
  "linear-gradient(140deg,#2C4E9E,#152B63)",
  "linear-gradient(140deg,#B24A17,#6E2508)",
  "linear-gradient(140deg,#1E6FD9,#0E3E8C)",
  "linear-gradient(140deg,#178C56,#0B4A2C)",
  "linear-gradient(140deg,#7A4AE0,#3A1E86)",
]
function avatarGrad(label: string) {
  return AVATAR_GRADIENTS[Math.abs((label.charCodeAt(0) || 0)) % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0]
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  const s = Math.floor(ms / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function roleLabel(role: string): string {
  const r = role.toLowerCase().replace(/_/g, " ")
  if (r === "head_coach" || r === "head coach") return "HC"
  if (r.includes("coach")) return "Coach"
  if (r === "parent") return "Parent"
  return "Player"
}

function MiniAvatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase()
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
      style={{ background: avatarGrad(name) }}
    >
      {initial}
    </div>
  )
}

// ── reaction pills ────────────────────────────────────────────────────────────

function ReactionPills({
  counts,
  mine,
  onToggle,
}: {
  counts: ReactionCount[]
  mine: string[]
  onToggle: (emoji: string) => void
}) {
  const countMap = Object.fromEntries(counts.map((c) => [c.emoji, c.total_count]))

  return (
    <div className="flex flex-wrap gap-[8px]">
      {EMOJI_LIST.map((emoji) => {
        const count = countMap[emoji] ?? 0
        const active = mine.includes(emoji)
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={cn(
              "inline-flex h-10 items-center gap-[6px] rounded-full border px-[12px] text-[13px] font-bold text-[#EEF3FF] transition-transform active:scale-[0.92]",
              active
                ? "border-[rgba(255,122,51,0.5)] bg-[rgba(255,122,51,0.18)]"
                : "border-[rgba(125,155,255,0.14)] bg-white/[0.035]"
            )}
          >
            {emoji}
            {count > 0 && <span className="text-[12px]">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── who liked section ─────────────────────────────────────────────────────────

function WhoLiked({ reactors }: { reactors: Reactor[] }) {
  if (reactors.length === 0) return null
  return (
    <div>
      <p className="mb-[10px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
        Who liked this
      </p>
      <div className="space-y-[8px]">
        {reactors.map((r, i) => (
          <div key={`${r.user_id}-${r.emoji}-${i}`} className="flex items-center gap-[10px]">
            <MiniAvatar name={r.full_name ?? "?"} />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-semibold text-[#EEF3FF]">{r.full_name ?? "Unknown"}</span>
              <span className="ml-[6px] rounded-[5px] bg-white/[0.08] px-[5px] py-[2px] text-[9px] font-bold uppercase tracking-wide text-[#92A5CC]">
                {roleLabel(r.role)}
              </span>
            </div>
            <span className="text-[16px]">{r.emoji}</span>
            <span className="text-[10.5px] text-[#92A5CC]">{relativeTime(r.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── comments section ──────────────────────────────────────────────────────────

function CommentBubble({
  comment,
  depth,
  onReply,
}: {
  comment: Comment
  depth: number
  onReply: (comment: Comment) => void
}) {
  const isCoach = comment.author_role.toLowerCase().includes("coach")
  const ringStyle = isCoach
    ? { boxShadow: "0 0 0 2px #060D22, 0 0 0 3px #FF7A33" }
    : {}

  return (
    <div className={cn("flex gap-[10px]", depth > 0 && "ml-[38px]")}>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
        style={{ background: avatarGrad(comment.author_name ?? "?"), ...ringStyle }}
      >
        {(comment.author_name ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-[6px]">
          <span className="text-[12.5px] font-bold text-[#EEF3FF]">{comment.author_name ?? "Unknown"}</span>
          <span className="text-[10px] font-semibold text-[#92A5CC]">{relativeTime(comment.created_at)}</span>
        </div>
        <p className="mt-[2px] text-[13px] leading-[1.5] text-[#DDE6FA]">{comment.body}</p>
        {depth === 0 && (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="mt-[4px] text-[11px] font-semibold text-[#92A5CC] transition hover:text-[#EEF3FF]"
          >
            Reply
          </button>
        )}
        {comment.replies?.map((reply) => (
          <div key={reply.id} className="mt-[10px]">
            <CommentBubble comment={reply} depth={1} onReply={onReply} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── seen by section ───────────────────────────────────────────────────────────

function SeenBy({ count, viewers }: { count: number; viewers: Viewer[] }) {
  const [expanded, setExpanded] = useState(false)

  if (count === 0) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-[6px] text-[11px] font-semibold text-[#92A5CC] transition hover:text-[#EEF3FF]"
      >
        <Eye className="h-3.5 w-3.5" />
        Seen by {count}
        {viewers.length > 0 && (
          <span className="text-[10px] text-[#92A5CC]">{expanded ? "▲" : "▼"}</span>
        )}
      </button>
      {expanded && viewers.length > 0 && (
        <div className="mt-[10px] space-y-[8px]">
          {viewers.map((v) => (
            <div key={v.user_id} className="flex items-center gap-[8px]">
              <MiniAvatar name={v.full_name ?? "?"} />
              <span className="flex-1 text-[12px] font-medium text-[#EEF3FF]">{v.full_name ?? "Unknown"}</span>
              <span className="text-[10px] text-[#92A5CC]">{relativeTime(v.viewed_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── main sheet ────────────────────────────────────────────────────────────────

export type AnnouncementDetailSheetProps = {
  announcementId: string
  teamId: string
  authorLabel: string
  authorRole?: "coach" | "team" | "player"
  authorSubtitle?: string
  title?: string
  body?: string
  /** Scroll directly to comments section on open */
  scrollToComments?: boolean
  onClose: () => void
}

type ReactionsData = {
  counts: ReactionCount[]
  mine: string[]
  reactors: Reactor[]
}

type CommentsData = {
  comments: Comment[]
  total: number
}

type ViewsData = {
  count: number
  viewers: Viewer[]
}

export function AnnouncementDetailSheet({
  announcementId,
  teamId,
  authorLabel,
  authorRole,
  authorSubtitle,
  title,
  body,
  scrollToComments = false,
  onClose,
}: AnnouncementDetailSheetProps) {
  const [reactions, setReactions] = useState<ReactionsData>({ counts: [], mine: [], reactors: [] })
  const [commentsData, setCommentsData] = useState<CommentsData>({ comments: [], total: 0 })
  const [views, setViews] = useState<ViewsData>({ count: 0, viewers: [] })
  const [loadingComments, setLoadingComments] = useState(true)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [commentInput, setCommentInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const commentsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const baseUrl = `/api/teams/${encodeURIComponent(teamId)}/team-announcements/${encodeURIComponent(announcementId)}`

  // Load all data in parallel
  useEffect(() => {
    void Promise.all([
      fetch(`${baseUrl}/reactions`).then((r) => r.ok ? r.json() : null),
      fetch(`${baseUrl}/comments`).then((r) => r.ok ? r.json() : null),
      fetch(`${baseUrl}/views`).then((r) => r.ok ? r.json() : null),
    ]).then(([rxData, cmData, vwData]) => {
      if (rxData) setReactions(rxData as ReactionsData)
      if (cmData) setCommentsData(cmData as CommentsData)
      if (vwData) setViews(vwData as ViewsData)
      setLoadingComments(false)
    })
  }, [baseUrl])

  // Scroll to comments section if requested
  useEffect(() => {
    if (scrollToComments && commentsRef.current) {
      setTimeout(() => {
        commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        inputRef.current?.focus()
      }, 300)
    }
  }, [scrollToComments, loadingComments])

  // Prevent body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const toggleReaction = useCallback(async (emoji: string) => {
    const isActive = reactions.mine.includes(emoji)
    const action = isActive ? "remove" : "add"

    // Optimistic update
    setReactions((prev) => ({
      ...prev,
      mine: isActive ? prev.mine.filter((e) => e !== emoji) : [...prev.mine, emoji],
      counts: prev.counts.map((c) =>
        c.emoji === emoji
          ? { ...c, total_count: c.total_count + (isActive ? -1 : 1) }
          : c
      ).concat(
        !isActive && !prev.counts.find((c) => c.emoji === emoji)
          ? [{ emoji, total_count: 1, player_count: 1, parent_count: 0, staff_count: 0 }]
          : []
      ),
    }))

    try {
      const res = await fetch(`${baseUrl}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, action }),
      })
      if (res.ok) {
        const data = await res.json() as { counts: ReactionCount[]; mine: string[] }
        setReactions((prev) => ({ ...prev, counts: data.counts, mine: data.mine }))
      }
    } catch {
      // revert on error
      setReactions((prev) => ({
        ...prev,
        mine: isActive ? [...prev.mine, emoji] : prev.mine.filter((e) => e !== emoji),
      }))
    }
  }, [reactions.mine, baseUrl])

  const handleReply = (comment: Comment) => {
    setReplyTo(comment)
    setCommentInput(`@${comment.author_name ?? "User"} `)
    inputRef.current?.focus()
  }

  const submitComment = async () => {
    const text = commentInput.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`${baseUrl}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, parent_id: replyTo?.id ?? null }),
      })
      if (res.ok) {
        const data = await res.json() as { comment: Comment }
        setCommentsData((prev) => {
          if (data.comment.parent_id) {
            return {
              ...prev,
              total: prev.total + 1,
              comments: prev.comments.map((c) =>
                c.id === data.comment.parent_id
                  ? { ...c, replies: [...c.replies, data.comment] }
                  : c
              ),
            }
          }
          return { total: prev.total + 1, comments: [...prev.comments, { ...data.comment, replies: [] }] }
        })
        setCommentInput("")
        setReplyTo(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const authorRingStyle =
    authorRole === "coach"
      ? { boxShadow: "0 0 0 2px #060D22, 0 0 0 4px #FF7A33" }
      : authorRole === "team"
        ? { boxShadow: "0 0 0 2px #060D22, 0 0 0 4px #4D9BFF" }
        : {}

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-[rgba(125,155,255,0.2)]"
        style={{ background: "linear-gradient(180deg,#13234E,#0A1638)" }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-[4px] w-[40px] rounded-full bg-white/20" />
        </div>

        {/* header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[rgba(125,155,255,0.14)] px-4 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.04] text-[#92A5CC] transition hover:text-[#EEF3FF]"
            aria-label="Close"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-[14px] text-[#EEF3FF]">{title ?? authorLabel}</p>
            <p className="text-[10.5px] text-[#92A5CC]">{authorSubtitle}</p>
          </div>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-[20px]">

          {/* post content */}
          <div className="flex gap-[10px]">
            <div
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-black text-white"
              style={{ background: avatarGrad(authorLabel), ...authorRingStyle }}
            >
              {authorLabel.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-[13.5px] text-[#EEF3FF]">{authorLabel}</p>
              <p className="text-[10.5px] text-[#92A5CC]">{authorSubtitle}</p>
              {body ? (
                <p className="mt-[8px] text-[14px] leading-[1.6] text-[#DDE6FA]">{body}</p>
              ) : null}
            </div>
          </div>

          {/* reactions */}
          <div>
            <p className="mb-[10px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
              Reactions
            </p>
            <ReactionPills
              counts={reactions.counts}
              mine={reactions.mine}
              onToggle={toggleReaction}
            />
          </div>

          {/* who liked */}
          {reactions.reactors.length > 0 && (
            <WhoLiked reactors={reactions.reactors} />
          )}

          {/* who liked summary (when no detailed reactor list) */}
          {reactions.reactors.length === 0 && reactions.counts.length > 0 && (
            <div className="flex flex-wrap gap-[6px]">
              {reactions.counts.filter((c) => c.total_count > 0).map((c) => (
                <span
                  key={c.emoji}
                  className="rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.04] px-[10px] py-[4px] text-[12px] font-semibold text-[#92A5CC]"
                >
                  {c.emoji} {c.total_count}
                </span>
              ))}
            </div>
          )}

          {/* seen by */}
          <SeenBy count={views.count} viewers={views.viewers} />

          {/* comments */}
          <div ref={commentsRef}>
            <p className="mb-[12px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
              Comments {commentsData.total > 0 ? `· ${commentsData.total}` : ""}
            </p>
            {loadingComments ? (
              <div className="space-y-[12px]">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-[10px]">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                    <div className="flex-1 space-y-[6px]">
                      <div className="h-[10px] w-[30%] animate-pulse rounded bg-white/10" />
                      <div className="h-[12px] w-[80%] animate-pulse rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : commentsData.comments.length === 0 ? (
              <p className="text-[13px] text-[#92A5CC]">
                No comments yet — be the first to reply.
              </p>
            ) : (
              <div className="space-y-[16px]">
                {commentsData.comments.map((c) => (
                  <CommentBubble
                    key={c.id}
                    comment={c}
                    depth={0}
                    onReply={handleReply}
                  />
                ))}
              </div>
            )}
          </div>

          {/* bottom padding so last comment isn't hidden behind input */}
          <div className="h-4" />
        </div>

        {/* fixed comment input */}
        <div className="shrink-0 border-t border-[rgba(125,155,255,0.14)] bg-[rgba(6,13,34,0.95)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] text-[#92A5CC]">
              <span>Replying to <span className="font-semibold text-[#EEF3FF]">{replyTo.author_name}</span></span>
              <button type="button" onClick={() => { setReplyTo(null); setCommentInput("") }} className="ml-2 text-[#92A5CC] hover:text-[#EEF3FF]">✕</button>
            </div>
          )}
          <div className="flex items-center gap-[10px]">
            <input
              ref={inputRef}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitComment() } }}
              placeholder="Add a comment…"
              maxLength={2000}
              className="flex-1 rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.06] px-[16px] py-[10px] text-[13px] text-[#EEF3FF] placeholder:text-[#92A5CC] outline-none focus:border-[rgba(255,122,51,0.5)]"
            />
            <button
              type="button"
              disabled={!commentInput.trim() || submitting}
              onClick={() => void submitComment()}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition",
                commentInput.trim()
                  ? "bg-gradient-to-br from-[#FF7A33] to-[#FF3D1F] text-[#160A02] shadow-[0_6px_14px_-4px_rgba(255,90,30,0.6)]"
                  : "bg-white/[0.06] text-[#92A5CC]"
              )}
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
