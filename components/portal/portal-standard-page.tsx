"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const portalStandardPageHeaderContainerClassName =
  "flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 md:flex-row md:items-start md:justify-between"

/** Default width inside team dashboard main: full available width; horizontal gutters come from `DashboardLayoutClient` main (`md:p-6`, `xl:p-8`). Mobile keeps `px-4` here. */
export const PORTAL_STANDARD_PAGE_WIDTH_CLASS = "w-full min-w-0 max-w-none"

export function PortalStandardPageRoot({
  children,
  className,
  maxWidthClassName = PORTAL_STANDARD_PAGE_WIDTH_CLASS,
}: {
  children: ReactNode
  className?: string
  /** Override default full width when a page should stay narrow (e.g. support form, player reading view). */
  maxWidthClassName?: string
}) {
  return (
    <div className={cn("space-y-4 px-4 pb-8 md:px-0", maxWidthClassName, className)}>{children}</div>
  )
}

export function PortalStandardPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn(portalStandardPageHeaderContainerClassName, className)}>
      <div className="min-w-0">
        {typeof title === "string" ? (
          <h1 className="text-2xl font-bold text-[#0F172A]">{title}</h1>
        ) : (
          title
        )}
        {description ? (
          typeof description === "string" ? (
            <p className="mt-1 text-sm text-[#64748B]">{description}</p>
          ) : (
            <div className="mt-1 text-sm text-[#64748B]">{description}</div>
          )
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
    </div>
  )
}

export function PortalStandardPageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0", className)}>{children}</div>
}

/**
 * Opinionated portal page frame: max-width container + bordered header row + optional body wrapper.
 * Prefer composing `PortalStandardPageRoot` + `PortalStandardPageHeader` directly when you need to
 * insert tabs/nav between the header and `<main>`.
 */
export function PortalStandardPage({
  title,
  description,
  headerActions,
  headerClassName,
  bodyClassName,
  maxWidthClassName,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  headerClassName?: string
  bodyClassName?: string
  maxWidthClassName?: string
  children: ReactNode
  className?: string
}) {
  return (
    <PortalStandardPageRoot className={className} maxWidthClassName={maxWidthClassName}>
      <PortalStandardPageHeader
        title={title}
        description={description}
        actions={headerActions}
        className={headerClassName}
      />
      <PortalStandardPageBody className={bodyClassName}>
        <main className="min-w-0">{children}</main>
      </PortalStandardPageBody>
    </PortalStandardPageRoot>
  )
}
