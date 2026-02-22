import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { OnboardingWizard } from "@/components/onboarding-wizard"

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  return (
    <div className="max-w-4xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Set Up Your Team</h1>
      <OnboardingWizard />
    </div>
  )
}

