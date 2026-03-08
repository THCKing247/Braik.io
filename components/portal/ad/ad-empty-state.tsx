"use client"

import Link from "next/link"

interface AdEmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function AdEmptyState({
  title,
  description,
  actionLabel = "Get started",
  actionHref,
}: AdEmptyStateProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] border-dashed bg-[#F9FAFB] p-12 text-center">
      <p className="text-lg font-semibold text-[#212529]">{title}</p>
      <p className="mt-2 text-sm text-[#6B7280] max-w-md mx-auto">{description}</p>
      {actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
