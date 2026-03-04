"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { CheckCircle } from "lucide-react"

export default function RoleSelectionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showCard, setShowCard] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  useEffect(() => {
    const fromHero = searchParams.get("fromHero") === "1"
    if (!fromHero) {
      setShowCard(true)
      return
    }
    const id = requestAnimationFrame(() => setShowCard(true))
    return () => cancelAnimationFrame(id)
  }, [searchParams])

  const handleRoleSelect = (roleValue: string) => {
    setSelectedRole(roleValue)
    // Short delay so user sees selected state before navigating
    setTimeout(() => {
      const signupData = { role: roleValue }
      localStorage.setItem("signupData", JSON.stringify(signupData))
      router.push("/signup")
    }, 300)
  }

  const roles = [
    {
      value: "head-coach",
      label: "Head Coach",
      description: "Create and manage your team. Full access to all features and billing.",
      icon: "🏈",
    },
    {
      value: "assistant-coach",
      label: "Assistant Coach",
      description: "Join an existing team. Access to coaching features (requires Team Code).",
      icon: "📋",
    },
    {
      value: "player",
      label: "Player",
      description: "Join your team. Access to schedule, messages, and team updates (requires Team Code).",
      icon: "🏃",
    },
    {
      value: "parent",
      label: "Parent / Guardian",
      description: "Join your child's team. Access to payments, schedule, and updates (requires Team Code).",
      icon: "👪",
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div
            className={`w-full max-w-3xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition-all duration-500 ease-out ${
              showCard ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="mb-8 text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight">
                Choose Your Role
              </h2>
              <p className="text-[#495057]">
                Select your role to get started — you can&apos;t change this later.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {roles.map((role) => {
                const isSelected = selectedRole === role.value
                return (
                  <button
                    key={role.value}
                    onClick={() => handleRoleSelect(role.value)}
                    disabled={selectedRole !== null}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer flex items-start gap-4 group ${
                      isSelected
                        ? "border-[#3B82F6] bg-[#EFF6FF] shadow-md"
                        : selectedRole
                        ? "border-[#E5E7EB] bg-white opacity-50 cursor-not-allowed"
                        : "border-[#E5E7EB] bg-white hover:border-[#3B82F6] hover:bg-[#F9FAFB] hover:shadow-sm"
                    }`}
                  >
                    <span className="text-2xl mt-0.5 shrink-0">{role.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-1">
                        {role.label}
                      </h3>
                      <p className="text-[#495057] text-sm leading-relaxed">{role.description}</p>
                    </div>
                    <div className="ml-2 shrink-0 self-center">
                      {isSelected ? (
                        <CheckCircle className="w-6 h-6 text-[#3B82F6]" />
                      ) : (
                        <svg
                          className="w-5 h-5 text-[#D1D5DB] group-hover:text-[#3B82F6] transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col items-center gap-4">
              <Link href="/">
                <Button
                  variant="outline"
                  className="bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                  disabled={selectedRole !== null}
                >
                  Back to Home
                </Button>
              </Link>

              <p className="text-sm text-[#6c757d]">
                Already have an account?{" "}
                <Link href="/login" className="text-[#3B82F6] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
