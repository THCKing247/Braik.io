import { adminUi } from "@/lib/admin/admin-ui"
import { AppLoader } from "@/components/ui/app-loader"

/** Full-viewport loading state for admin shell — dark shimmer, no gray flash */
export function AdminLoadingShell({ message = "Loading admin…" }: { message?: string }) {
  return (
    <div className={adminUi.loadingCenter}>
      <div className="flex w-full max-w-md flex-col gap-4 px-6">
        <div className="flex justify-center">
          <AppLoader label={message} size="lg" className="text-slate-200" />
        </div>
        <p className="text-center text-sm font-medium text-slate-300">{message}</p>
      </div>
    </div>
  )
}
