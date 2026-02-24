"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export default function RoleSelectionPage() {
  const router = useRouter()

  const handleRoleSelect = (roleValue: string) => {
    // Save role to localStorage
    const signupData = { role: roleValue }
    localStorage.setItem("signupData", JSON.stringify(signupData))

    // Navigate to personal info page immediately
    router.push("/signup")
  }

  const roles = [
    {
      value: "head-coach",
      label: "Head Coach",
      description: "Create and manage your team. Full access to all features and billing.",
    },
    {
      value: "assistant-coach",
      label: "Assistant Coach",
      description: "Join an existing team. Access to coaching features (requires Team Code).",
    },
    {
      value: "player",
      label: "Player",
      description: "Join your team. Access to schedule, messages, and team updates (requires Team Code).",
    },
    {
      value: "parent",
      label: "Parent",
      description: "Join your child's team. Access to payments, schedule, and updates (requires Team Code).",
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-3xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                Choose Your Role
              </h2>
              <p className="text-center text-[#495057]">
                Select your role to get started
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => handleRoleSelect(role.value)}
                  className="w-full p-6 rounded-lg border-2 border-[#E5E7EB] bg-white hover:border-[#3B82F6] hover:bg-[#F9FAFB] text-left transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-athletic font-semibold text-[#212529] mb-2 uppercase tracking-wide">{role.label}</h3>
                      <p className="text-[#495057]">{role.description}</p>
                    </div>
                    <div className="ml-4">
                      <svg className="w-6 h-6 text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-center">
              <Link href="/">
                <Button
                  variant="outline"
                  className="bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                >
                  Back to Home
                </Button>
              </Link>
            </div>

            <div className="mt-6 text-center text-sm">
              <span className="text-[#6c757d]">Already have an account? </span>
              <Link href="/login" className="text-[#3B82F6] hover:underline font-medium">
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
