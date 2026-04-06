"use client"

import { signOut } from "@/lib/auth/client-auth"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function AdminSignOutButton() {
  return (
    <button
      type="button"
      className={cn(adminUi.btnSecondarySm, "w-full justify-center")}
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
    >
      Sign out
    </button>
  )
}
