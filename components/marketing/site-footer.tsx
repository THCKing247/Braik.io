"use client"

import Link from "next/link"
import Image from "next/image"
import { type FormEvent, useEffect, useState } from "react"
import { useSession } from "@/lib/auth/client-auth"
import {
  getPlayerSignupHref,
  getProgramOrCoachAccessHref,
} from "@/lib/marketing/join-cta"
import { braikLogo } from "@/lib/marketing/landing-images"

export function SiteFooter() {
  const { data: session } = useSession()
  const [isSupportOpen, setIsSupportOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [issue, setIssue] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState("")

  const isAccountHolder = Boolean(session?.user?.id)

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email)
    }
  }, [session?.user?.email])

  useEffect(() => {
    if (!isSupportOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSupportOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isSupportOpen])

  const resetSupportForm = () => {
    setIssue("")
    setDescription("")
    setFormError("")
    if (!session?.user?.email) {
      setEmail("")
    }
  }

  const handleCloseSupport = () => {
    setIsSupportOpen(false)
    setFormError("")
  }

  const handleOpenSupport = () => {
    setIsSupportOpen(true)
  }

  const handleSubmitSupport = (event: FormEvent) => {
    event.preventDefault()
    setFormError("")

    if (!email.trim()) {
      setFormError("Email is required so we can reply to your support request.")
      return
    }
    if (!issue.trim()) {
      setFormError("Please enter the complaint/issue title.")
      return
    }
    if (!description.trim()) {
      setFormError("Please provide a brief description of the issue.")
      return
    }

    const subject = `Braik Support: ${issue.trim()}`
    const bodyLines = [
      `Support Request`,
      ``,
      `Account Holder: ${isAccountHolder ? "Yes" : "No"}`,
      `Name: ${session?.user?.name || "Not provided"}`,
      `Email: ${email.trim()}`,
      `Role: ${session?.user?.role || "Not provided"}`,
      `Team: ${session?.user?.teamName || "Not provided"}`,
      ``,
      `Complaint / Issue:`,
      issue.trim(),
      ``,
      `Brief Description:`,
      description.trim(),
    ]

    const mailto = `mailto:info@apextsgroup.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyLines.join("\n")
    )}`

    window.location.href = mailto
    handleCloseSupport()
    resetSupportForm()
  }

  return (
    <>
      <footer className="border-t border-[#E5E7EB] bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="mb-4 flex items-center">
              <Image
                src={braikLogo.webp}
                alt="Braik Logo"
                width={braikLogo.width}
                height={braikLogo.height}
                sizes="(max-width: 768px) 200px, 240px"
                quality={90}
                className="h-[4.5rem] w-auto cursor-default object-contain object-left"
              />
            </div>
            <p className="mb-4 text-sm text-slate-700">
              Break the Huddle. Break the Norm.
            </p>
            <p className="text-sm text-slate-700">
              The sports team operating system for roster, dues, comms, schedule, docs, and AI admin assistant.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="mb-4 text-lg font-athletic font-semibold uppercase tracking-wide text-slate-900">
              Navigation
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/features" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  About
                </Link>
              </li>
              <li>
                <Link href="/why-braik" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  Why Braik?
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://apextsgroup.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm"
                >
                  Apex TSG
                </a>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="mb-4 text-lg font-athletic font-semibold uppercase tracking-wide text-slate-900">
              Account
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  Login
                </Link>
              </li>
              <li>
                <Link href={getPlayerSignupHref()} className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  Player sign up
                </Link>
              </li>
              <li>
                <Link
                  href={getProgramOrCoachAccessHref()}
                  className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm"
                >
                  Coach or school access
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

            {/* Support & Legal */}
            <div>
              <h4 className="mb-4 text-lg font-athletic font-semibold uppercase tracking-wide text-slate-900">
                Support & Legal
              </h4>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={handleOpenSupport}
                    className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm"
                  >
                    Contact Support
                  </button>
                </li>
                <li>
                  <Link href="/privacy" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/acceptable-use" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                    Acceptable Use Policy
                  </Link>
                </li>
                <li>
                  <Link href="/ai-transparency" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                    AI Transparency
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-slate-900 hover:text-[#3B82F6] transition-colors text-sm">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-[#E5E7EB] pt-8 text-center">
            <p className="text-sm text-slate-700">
              &copy; {new Date().getFullYear()} Braik. All rights reserved.
            </p>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-600">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[#CBD5E1] bg-[#F8FAFC] text-slate-900 text-xs font-bold" title="Apex">
                A
              </span>
              <span>Powered by Apex TSG</span>
            </p>
          </div>
        </div>
      </footer>

      {isSupportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            onClick={handleCloseSupport}
            className="absolute inset-0 bg-black/60"
            aria-label="Close support modal"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-2xl font-athletic font-semibold uppercase tracking-wide text-slate-900">
                Contact Support
              </h3>
              <p className="mt-2 text-sm text-slate-700">
                Send your issue directly to info@apextsgroup.com.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Account holder detected: {isAccountHolder ? "Yes" : "No"}
              </p>
            </div>

            <form onSubmit={handleSubmitSupport} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="support-email" className="text-sm font-medium text-slate-900">
                  Email
                </label>
                <input
                  id="support-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="support-issue" className="text-sm font-medium text-slate-900">
                  Complaint / Issue
                </label>
                <input
                  id="support-issue"
                  type="text"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  placeholder="Example: Cannot submit roster updates"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="support-description" className="text-sm font-medium text-slate-900">
                  Brief Description
                </label>
                <textarea
                  id="support-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[120px] w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  placeholder="Describe what happened, when it happened, and what you expected."
                  required
                />
              </div>

              {formError && (
                <div className="rounded-md border border-[#EF4444] bg-[#FEE2E2] px-3 py-2 text-sm text-[#991B1B]" role="alert">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseSupport}
                  className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-slate-50 hover:bg-[#2563EB]"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
