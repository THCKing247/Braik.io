import { ComingSoon } from "@/components/portal/coming-soon"
import { Megaphone } from "lucide-react"

export const dynamic = "force-dynamic"

export default function AnnouncementsPage() {
  return (
    <ComingSoon
      title="Announcements"
      description="Broadcast important updates, reminders, and news to your entire team instantly. All members stay informed in one place."
      icon={Megaphone}
    />
  )
}
