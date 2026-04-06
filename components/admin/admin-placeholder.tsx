import type { ReactNode } from "react"
import { Construction } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminUi, adminPanel } from "@/lib/admin/admin-ui"

export function AdminFeaturePlaceholder({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <div
      className={cn(
        adminPanel("flex min-h-[min(50vh,28rem)] flex-col items-center justify-center gap-3 p-8 text-center"),
        className
      )}
    >
      <Construction className="h-10 w-10 text-orange-400/80" aria-hidden />
      <p className="max-w-md text-sm leading-relaxed text-slate-300">{message}</p>
    </div>
  )
}

export function AdminMutedNotice({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(adminUi.noticeMuted, className)}>{children}</div>
}
