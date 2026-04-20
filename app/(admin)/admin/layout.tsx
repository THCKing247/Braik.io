import { AdminConsoleRoot } from "@/components/admin/admin-layout"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminConsoleRoot>{children}</AdminConsoleRoot>
}
