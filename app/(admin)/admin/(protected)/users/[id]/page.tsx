import { notFound } from "next/navigation"
import { AdminUserDetailView } from "@/components/admin/admin-user-detail-view"
import { loadAdminUserProfile } from "@/lib/admin/load-admin-user-profile"

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await loadAdminUserProfile(id)
  if (!profile) notFound()
  return <AdminUserDetailView initial={profile} />
}
