"use client"

import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HeroLoginForm } from "@/components/hero-login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      <section className="flex-1 flex items-center justify-center px-4 py-16 md:py-24 bg-gradient-to-b from-[#F8FAFC] to-white">
        <div className="w-full max-w-md space-y-6">
          {/* Page heading */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight">
              Welcome back
            </h1>
            <p className="text-[#495057] text-base">
              Sign in to your Braik account
            </p>
          </div>

          {/* Login form — no extra max-w wrapper needed here, parent controls width */}
          <HeroLoginForm />

          {/* Forgot password */}
          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-[#6c757d] hover:text-[#3B82F6] transition-colors"
            >
              Forgot your password?
            </Link>
          </div>

          {/* Sign up prompt */}
          <div className="text-center border-t border-[#E5E7EB] pt-5">
            <p className="text-sm text-[#6c757d]">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup/role"
                className="text-[#3B82F6] hover:underline font-medium"
              >
                Get started free
              </Link>
            </p>
            <div className="mt-4 pt-3 border-t border-[#E5E7EB]">
              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#495057] hover:bg-[#E9ECEF] hover:border-[#DEE2E6] transition-colors"
              >
                Admin login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
