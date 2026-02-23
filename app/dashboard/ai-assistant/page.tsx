import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AIAssistant } from "@/components/ai-assistant"

export default async function AIAssistantPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Assistant</h1>
        <p className="text-[#E5E7EB]">Get help with team operations</p>
      </div>
      <AIAssistant teamId={membership.teamId} />
    </div>
  )
}

