"use client"

import {
  Camera,
  Clapperboard,
  Landmark,
  Sparkles,
  Tent,
  Trees,
  Users,
} from "lucide-react"
import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { cn } from "@/lib/utils"

const PRESETS: Record<
  NonNullable<PlayerFeedPost["mediaPlaceholder"]>,
  { gradient: string; icon: typeof Sparkles }
> = {
  stadium: { gradient: "from-[#0c1222] via-[#1e1b4b] to-[#4c1d95]", icon: Landmark },
  practice: { gradient: "from-orange-600 via-amber-500 to-yellow-400", icon: Tent },
  film: { gradient: "from-slate-950 via-indigo-950 to-slate-900", icon: Clapperboard },
  locker: { gradient: "from-zinc-800 via-slate-800 to-zinc-950", icon: Trees },
  field: { gradient: "from-emerald-800 via-green-700 to-lime-700", icon: Trees },
  crowd: { gradient: "from-fuchsia-600 via-rose-600 to-orange-500", icon: Users },
}

export function FeedMediaPlaceholder({
  variant,
  className,
}: {
  variant?: PlayerFeedPost["mediaPlaceholder"]
  className?: string
}) {
  const key = variant ?? "practice"
  const { gradient, icon: Icon } = PRESETS[key]
  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br shadow-inner",
        gradient,
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
      <div className="absolute inset-0 flex items-center justify-center opacity-90">
        <div className="rounded-2xl bg-black/25 p-4 backdrop-blur-sm">
          <Icon className="h-10 w-10 text-white/95 drop-shadow-lg" strokeWidth={1.25} />
        </div>
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
        <Camera className="h-3.5 w-3.5 opacity-90" aria-hidden />
        Preview
      </div>
    </div>
  )
}
