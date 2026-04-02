import Link from "next/link"
import { AdminLoginForm } from "@/components/admin/admin-login-form"

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen w-full bg-admin-page flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Back to Braik
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-50">
            Platform owner sign in
          </h1>
          <p className="mt-2 text-zinc-400">
            Use your admin credentials to access the backend console.
          </p>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  )
}
