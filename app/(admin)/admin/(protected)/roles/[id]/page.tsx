import Link from "next/link"
import { PlatformRoleView } from "@/components/admin/platform-roles/platform-role-view"

export default async function AdminRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/roles" className="text-xs text-cyan-300 hover:underline">
          ← Roles & Permissions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Role details</h1>
      </div>
      <PlatformRoleView roleId={id} />
    </div>
  )
}
