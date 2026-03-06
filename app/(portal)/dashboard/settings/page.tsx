import { ComingSoon } from "@/components/portal/coming-soon"
import { Settings } from "lucide-react"

export const dynamic = "force-dynamic"

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Team Settings"
      description="Configure your team profile, branding, season details, notification preferences, and integration settings."
      icon={Settings}
    />
  )
}
