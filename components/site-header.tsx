"use client"

import Link from "next/link"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E7EB] bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="font-athletic text-xl font-bold uppercase tracking-tight text-[#212529] hover:text-[#3B82F6]"
        >
          Braik.io
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-sm font-medium text-[#495057] hover:text-[#3B82F6]"
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-[#495057] hover:text-[#3B82F6]"
          >
            About
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[#495057] hover:text-[#3B82F6]"
          >
            Sign in
          </Link>
          <Link
            href="/signup/role"
            className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
