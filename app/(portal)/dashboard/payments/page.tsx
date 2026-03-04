import { ComingSoon } from "@/components/portal/coming-soon"
import { CreditCard } from "lucide-react"

export default function PaymentsPage() {
  return (
    <ComingSoon
      title="Payments"
      description="Manage your payment methods, view transaction history, and handle payout settings for team collections and dues."
      icon={CreditCard}
    />
  )
}
