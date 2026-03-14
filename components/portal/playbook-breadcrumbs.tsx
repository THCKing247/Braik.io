"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

export type BreadcrumbItem = {
  label: string
  href?: string
}

interface PlaybookBreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function PlaybookBreadcrumbs({ items, className = "" }: PlaybookBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 flex-wrap text-sm ${className}`}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />}
          {item.href ? (
            <Link
              href={item.href}
              className="font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
