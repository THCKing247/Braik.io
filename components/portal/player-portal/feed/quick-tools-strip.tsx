"use client"

import Link from "next/link"
import { Bell, Calendar, Megaphone, MessageSquare, UserRound, Video } from "lucide-react"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"
import { cn } from "@/lib/utils"
import { playerFilmHubRootFromPortalBase } from "@/lib/player-portal/player-development-routes"

type Tool = { href: string; label: string; icon: typeof UserRound }

export function QuickToolsStrip({ basePath, className }: { basePath: string; className?: string }) {
  const tools: Tool[] = [
    { href: `${basePath}/profile`, label: "Profile", icon: UserRound },
    { href: `${basePath}/calendar`, label: "Schedule", icon: Calendar },
    { href: `${basePath}/messages`, label: "Messages", icon: MessageSquare },
    { href: playerFilmHubRootFromPortalBase(basePath), label: "Film", icon: Video },
    { href: `${basePath}/announcements`, label: "News", icon: Megaphone },
    { href: `${basePath}/reminders`, label: "Alerts", icon: Bell },
  ]

  return (
    <div className={cn("space-y-2", className)}>
      <p className={cn("px-1 text-[11px] font-bold uppercase tracking-[0.2em]", braikPlayerTheme.textSecondary)}>Tools</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className="flex shrink-0 items-center gap-2 rounded-full border border-[#2a3152] bg-gradient-to-r from-[#10265f] to-[#0c1739] px-4 py-2.5 text-[13px] font-bold text-[#F8F8F8] shadow-md backdrop-blur-md transition hover:border-[#F85808]/50 hover:bg-[#0f2768] active:scale-[0.97]"
          >
            <t.icon className="h-4 w-4 text-[#F85808]" aria-hidden />
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
