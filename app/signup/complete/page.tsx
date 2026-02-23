"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { signIn } from "next-auth/react"
import { SiteHeader } from "@/components/site-header"

export default function CompleteSignupPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [signupData, setSignupData] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem("signupData")
    if (!saved) {
      router.push("/signup/role")
      return
    }
    const data = JSON.parse(saved)
    if (data.role === "head-coach") {
      router.push("/signup/program")
      return
    }
    if (!data.firstName || !data.lastName || !data.email || !data.password || !data.teamId) {
      router.push("/signup")
      return
    }
    setSignupData(data)
  }, [router])

  const handleComplete = async () => {
    if (!signupData) {
      setError("Missing signup data. Please start over.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: `${signupData.firstName} ${signupData.lastName}`,
          email: signupData.email, 
          password: signupData.password,
          role: signupData.role,
          teamId: signupData.teamId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "An error occurred")
        setLoading(false)
        return
      }

      // Auto-login the user
      const result = await signIn("credentials", {
        email: signupData.email,
        password: signupData.password,
        redirect: false,
      })

      if (result?.error) {
        setError("Account created but login failed. Please try logging in manually.")
        setLoading(false)
        return
      }

      // Clear localStorage
      localStorage.removeItem("signupData")

      // Redirect to dashboard
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.push("/signup")
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                Complete Your Account
              </h2>
              <p className="text-center text-[#495057]">
                Review your information and create your account
              </p>
            </div>

            <div className="space-y-6">
              {signupData && (
                <div className="space-y-4">
                  <div className="p-6 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                    <h3 className="text-lg font-athletic font-semibold text-[#212529] mb-4 uppercase tracking-wide">Account Information</h3>
                    <div className="space-y-2 text-[#495057]">
                      <p><strong className="text-[#212529]">Role:</strong> {signupData.role === "assistant-coach" ? "Assistant Coach" : signupData.role === "player" ? "Player" : "Parent"}</p>
                      <p><strong className="text-[#212529]">Name:</strong> {signupData.firstName} {signupData.lastName}</p>
                      <p><strong className="text-[#212529]">Email:</strong> {signupData.email}</p>
                      <p><strong className="text-[#212529]">Team ID:</strong> {signupData.teamId}</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                >
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleComplete}
                  className="flex-1 font-athletic uppercase tracking-wide" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
