"use client"

import Link from "next/link"
import {
  Bell,
  BookOpen,
  Calendar,
  Clapperboard,
  GraduationCap,
  Megaphone,
  MessageSquare,
  UserRound,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Tool = { href: string; label: string; icon: typeof UserRound }

export function QuickToolsStrip({ basePath, className }: { basePath: string; className?: string }) {
  const tools: Tool[] = [
    { href: `${basePath}/profile`, label: "Profile", icon: UserRound },
    { href: `${basePath}/calendar`, label: "Schedule", icon: Calendar },
    { href: `${basePath}/messages`, label: "Messages", icon: MessageSquare },
    { href: `${basePath}/film-room`, label: "Film", icon: Clapperboard },
    { href: `${basePath}/playbooks`, label: "Playbooks", icon: BookOpen },
    { href: `${basePath}/study-guides`, label: "Study", icon: GraduationCap },
    { href: `${basePath}/announcements`, label: "News", icon: Megaphone },
    { href: `${basePath}/reminders`, label: "Alerts", icon: Bell },
  ]

  return (
    <div className={cn("space-y-2", className)}>
      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300/70">Tools</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className="flex shrink-0 items-center gap-2 rounded-full border border-sky-400/25 bg-gradient-to-r from-white/12 to-orange-500/10 px-4 py-2.5 text-[13px] font-bold text-white shadow-md backdrop-blur-md transition active:scale-[0.97]"
          >
            <t.icon className="h-4 w-4 text-amber-300" aria-hidden />
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
