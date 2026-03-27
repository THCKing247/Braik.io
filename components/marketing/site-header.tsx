"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { getPublicJoinHref } from "@/lib/marketing/join-cta"

const navLinks = [
  { href: "/features", label: "Features", desktopOnly: false },
  { href: "/about", label: "About", desktopOnly: false },
  { href: "/why-braik", label: "Why Braik", desktopOnly: false },
  { href: "/pricing", label: "Pricing", desktopOnly: false },
  { href: "/faq", label: "FAQ", desktopOnly: false },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  const isActive = (href: string) => pathname === href

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]/50">
        <div className="w-full px-6 md:px-8 lg:px-12 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 rounded transition-all"
            aria-label="Braik - Return to home page"
          >
            <div className="h-12 w-[200px] flex items-center overflow-hidden">
              <img
                src="/braik-logo.png"
                alt="Braik"
                className="w-full h-auto block object-contain object-left"
              />
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3 md:gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors font-medium text-sm relative pb-0.5 ${
                  isActive(link.href)
                    ? "text-[#3B82F6] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#3B82F6]"
                    : "text-[#212529] hover:text-[#3B82F6]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login">
              <Button variant="signIn" size="sm" className="font-athletic uppercase tracking-wide px-5">
                Sign in
              </Button>
            </Link>
          </div>

          {/* Mobile: sign-in + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link href="/login">
              <Button variant="signIn" size="sm" className="font-athletic uppercase tracking-wide px-4 text-xs">
                Sign in
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="p-2 rounded-md text-[#212529] hover:bg-[#F9FAFB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <span className="font-athletic font-bold text-[#212529] uppercase tracking-wide text-lg">Menu</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md text-[#6c757d] hover:bg-[#F9FAFB] transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-4 py-3 rounded-lg font-medium text-base transition-colors ${
                isActive(link.href)
                  ? "bg-[#EFF6FF] text-[#3B82F6]"
                  : "text-[#212529] hover:bg-[#F9FAFB] hover:text-[#3B82F6]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Drawer footer CTAs */}
        <div className="px-4 py-6 border-t border-[#E5E7EB] space-y-3">
          <Link href={getPublicJoinHref()} className="block">
            <Button className="w-full font-athletic uppercase tracking-wide" size="lg">
              {isWaitlistMode() ? "Join the Waitlist" : "Get Started"}
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button variant="outline" className="w-full border-slate-300 text-slate-800 hover:bg-slate-50" size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
