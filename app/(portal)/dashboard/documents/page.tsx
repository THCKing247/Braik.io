import { ComingSoon } from "@/components/portal/coming-soon"
import { FileText } from "lucide-react"

export const dynamic = "force-dynamic"

export default function DocumentsPage() {
  return (
    <ComingSoon
      title="Documents"
      description="Upload and manage waivers, permission slips, eligibility forms, and any other team paperwork — all digitally signed and stored securely."
      icon={FileText}
    />
  )
}
