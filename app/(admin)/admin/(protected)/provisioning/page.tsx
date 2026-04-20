import { AdminProvisioningConsole } from "@/components/admin/admin-provisioning-console"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminProvisioningPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Onboarding"
        description="Organizations, teams, and user invites (admin-created accounts only)."
      />
      <AdminProvisioningConsole />
    </div>
  )
}
