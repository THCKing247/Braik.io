import { ComingSoon } from "@/components/portal/coming-soon"
import { DollarSign } from "lucide-react"

export default function InvoicePage() {
  return (
    <ComingSoon
      title="Invoices & Payments"
      description="View and manage dues, fees, and payment history. Send invoices to players and parents and track payment status across your entire team."
      icon={DollarSign}
    />
  )
}
