"use client"

import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/about"
              className="text-sm text-[#495057] hover:text-[#3B82F6]"
            >
              About
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-[#495057] hover:text-[#3B82F6]"
            >
              Pricing
            </Link>
            <Link
              href="/why-braik"
              className="text-sm text-[#495057] hover:text-[#3B82F6]"
            >
              Why Braik
            </Link>
            <Link
              href="/login"
              className="text-sm text-[#495057] hover:text-[#3B82F6]"
            >
              Sign in
            </Link>
          </div>
          <p className="text-sm text-[#6c757d]">
            © {new Date().getFullYear()} Braik. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
