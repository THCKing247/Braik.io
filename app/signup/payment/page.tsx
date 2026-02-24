"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"

type SignupApiError = {
  error?: string
  code?: string
  details?: string
  teamIdCode?: string
}

export default function PaymentPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [signupData, setSignupData] = useState<Record<string, unknown> | null>(null)

  const getApiErrorMessage = (status: number, data?: SignupApiError) => {
    const code = data?.code || `HTTP-${status}`
    const base = data?.error || "Signup request failed."
    const details = data?.details ? ` Details: ${data.details}` : ""
    return `[SIGNUP-API-${code}] ${base}${details}`
  }

  useEffect(() => {
    const saved = localStorage.getItem("signupData")
    if (!saved) {
      router.push("/signup")
      return
    }
    setSignupData(JSON.parse(saved))
  }, [router])

  const handleComplete = async () => {
    if (!signupData) {
      setError("[SIGNUP-FLOW-001] Missing signup data in local storage. Please restart signup from Step 1.")
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
          sportType: signupData.sportType,
          programType: signupData.programType,
          schoolName: signupData.programType !== "youth" ? signupData.schoolName : null,
          city: signupData.programType === "youth" ? signupData.city : null,
          teamName: signupData.teamName,
          primaryColor: signupData.primaryColor,
          secondaryColor: signupData.secondaryColor
        }),
      })

      const data = (await response.json()) as SignupApiError

      if (!response.ok) {
        setError(getApiErrorMessage(response.status, data))
        setLoading(false)
        return
      }

      // If Head Coach, show team code before redirecting
      if (signupData.role === "head-coach" && "teamIdCode" in data && typeof data.teamIdCode === "string") {
        // Store team code to show in success message
        const updatedData = { ...signupData, teamIdCode: data.teamIdCode }
        localStorage.setItem("signupData", JSON.stringify(updatedData))
        
        // Show team code in a modal or alert, then proceed
        alert(`Your Team Code: ${data.teamIdCode}\n\nShare this team code with Assistant Coaches, Players, and Parents so they can join your team.`)
      }

      // Auto-login the user
      const { signIn } = await import("next-auth/react")
      const result = await signIn("credentials", {
        email: signupData.email,
        password: signupData.password,
        redirect: false,
      })

      if (result?.error) {
        setError(`[SIGNUP-AUTH-${result.error}] Account was created, but auto-login failed. Please sign in manually on the login page.`)
        setLoading(false)
        return
      }

      // Clear localStorage
      localStorage.removeItem("signupData")

      // Redirect to dashboard
      router.push("/dashboard")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown client exception"
      setError(`[SIGNUP-CLIENT-500] Signup could not complete due to a client/runtime exception. Details: ${message}`)
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.push("/signup/program")
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                Payment Setup
              </h2>
              <p className="text-center text-[#495057]">
                Step 3 of 3 - Payment Setup
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-[#495057]">
                  Payment integration with Stripe will be available soon. For now, you can complete your account setup and configure payment later.
                </p>
                <div className="p-6 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                  <p className="text-sm text-[#495057] mb-2">
                    <strong className="text-[#212529]">Coming Soon:</strong> Secure payment processing through Stripe
                  </p>
                  <ul className="text-sm text-[#495057] space-y-1 list-disc list-inside ml-2">
                    <li>Credit card processing</li>
                    <li>Automatic billing</li>
                    <li>Payment history tracking</li>
                    <li>Invoice generation</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium" role="alert" aria-live="polite">
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
                  {loading ? "Creating account..." : "Complete Signup"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
