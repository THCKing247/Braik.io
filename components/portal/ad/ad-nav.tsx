"use client"

import Link from "next/link"
import Image from "next/image"
import { signOut } from "@/lib/auth/client-auth"
import { Button } from "@/components/ui/button"

const adNavItems = [
  { href: "/dashboard/ad", label: "Overview" },
  { href: "/dashboard/ad/teams", label: "Teams" },
  { href: "/dashboard/ad/coaches", label: "Coaches" },
  { href: "/dashboard/ad/settings", label: "Settings" },
]

export function AdNav({ userEmail }: { userEmail?: string | null }) {
  return (
    <nav
      className="sticky top-0 z-50 border-b bg-white"
      style={{ borderColor: "rgb(var(--border))" }}
    >
      <div className="mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard/ad" className="flex items-center gap-2">
              <Image src="/braik-logo.png" alt="Braik" width={120} height={32} className="h-8 w-auto" />
              <span className="text-sm font-semibold text-[#6B7280] hidden sm:inline">Athletic Director</span>
            </Link>
            <div className="hidden md:flex gap-1">
              {adNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#495057] hover:bg-[#F3F4F6] hover:text-[#212529]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="text-sm text-[#6B7280] truncate max-w-[180px]">{userEmail}</span>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
