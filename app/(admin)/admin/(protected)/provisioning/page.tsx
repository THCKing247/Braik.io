import { AdminProvisioningConsole } from "@/components/admin/admin-provisioning-console"

export default function AdminProvisioningPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Provisioning</h1>
        <p className="text-sm text-white/60">Organizations, teams, and user invites (admin-created accounts only).</p>
      </div>
      <AdminProvisioningConsole />
    </div>
  )
}
