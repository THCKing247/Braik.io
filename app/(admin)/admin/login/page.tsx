import Link from "next/link"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export default function AdminLoginPage() {
  return (
    <div className={cn(adminUi.shellGradient, "flex min-h-screen flex-col items-center justify-center px-4 py-12")}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-sm text-admin-muted transition-colors hover:text-admin-primary">
            ← Back to Braik
          </Link>
          <h1 className="mt-4 font-sans text-2xl font-semibold tracking-tight text-admin-primary sm:text-3xl">
            Platform owner sign in
          </h1>
          <p className="mt-2 text-sm text-admin-secondary">Use your admin credentials to access the backend console.</p>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  )
}
