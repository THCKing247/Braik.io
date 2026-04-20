import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Root wrapper for all /admin routes — locks light console palette and type scale.
 * Scoped to this subtree only; does not affect the rest of the app.
 */
export function AdminConsoleRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "admin-console min-h-screen bg-admin-canvas text-admin-primary antialiased [--admin-header:3rem]",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Consistent horizontal rhythm and max width for admin main column */
export function AdminMain({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5", className)}>{children}</div>
  )
}
