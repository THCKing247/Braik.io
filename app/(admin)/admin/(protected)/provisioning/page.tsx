import { AdminProvisioningConsole } from "@/components/admin/admin-provisioning-console"

export default function AdminProvisioningPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-0 pb-10 pt-2">
      <header className="mb-10 border-b border-white/10 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Provisioning</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          Organizations, teams, and user invites (admin-created accounts only).
        </p>
      </header>
      <AdminProvisioningConsole />
    </div>
  )
}
