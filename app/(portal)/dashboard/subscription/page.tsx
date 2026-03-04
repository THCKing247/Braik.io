import { ComingSoon } from "@/components/portal/coming-soon"
import { Star } from "lucide-react"

export default function SubscriptionPage() {
  return (
    <ComingSoon
      title="Subscription"
      description="View your current plan, manage billing, and upgrade your subscription. Braik Pro features are available for teams of all sizes."
      icon={Star}
    />
  )
}
