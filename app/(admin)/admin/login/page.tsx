import Link from "next/link"
import { AdminLoginForm } from "@/components/admin/admin-login-form"

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen w-full bg-[#09090B] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ← Back to Braik
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Platform owner sign in
          </h1>
          <p className="mt-2 text-white/60">
            Use your admin credentials to access the backend console.
          </p>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  )
}
