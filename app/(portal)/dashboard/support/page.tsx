import { ComingSoon } from "@/components/portal/coming-soon"
import { LifeBuoy } from "lucide-react"

export default function SupportPage() {
  return (
    <ComingSoon
      title="Support"
      description="Access help articles, submit a support ticket, or chat with the Braik team. We're here to help you get the most out of the platform."
      icon={LifeBuoy}
    />
  )
}
