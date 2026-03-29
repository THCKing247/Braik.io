import { AdminProtectedShell } from "@/components/admin/admin-protected-shell"

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AdminProtectedShell>{children}</AdminProtectedShell>
}
