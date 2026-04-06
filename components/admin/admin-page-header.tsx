import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui"

export function AdminPageHeader({
  title,
  description,
  className,
  action,
}: {
  title: string
  description?: string
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className={adminUi.pageHeader}>
        <h1 className={adminUi.pageTitle}>{title}</h1>
        {description ? <p className={adminUi.pageDescription}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
