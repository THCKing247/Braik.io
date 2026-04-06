import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

/** Full-viewport loading state for admin shell — dark shimmer, no gray flash */
export function AdminLoadingShell({ message = "Loading admin…" }: { message?: string }) {
  return (
    <div className={adminUi.loadingCenter}>
      <div className="flex w-full max-w-md flex-col gap-4 px-6">
        <div className={cn(adminUi.skeleton, "h-3 w-48")} aria-hidden />
        <div className={cn(adminUi.skeleton, "h-3 w-full")} aria-hidden />
        <div className={cn(adminUi.skeleton, "h-3 w-5/6")} aria-hidden />
        <p className="text-center text-sm font-medium text-slate-300">{message}</p>
      </div>
    </div>
  )
}
