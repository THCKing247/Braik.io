import { cn } from "@/lib/utils"

/**
 * Braik admin — internal ops console: light canvas, high-contrast type,
 * orange accent for primary actions / active nav only (Stripe-style data UI).
 */
export const adminUi = {
  shell: "min-h-screen w-full bg-admin-canvas text-admin-primary",

  shellGradient: "min-h-screen w-full bg-admin-canvas text-admin-primary",

  loadingCenter:
    "flex min-h-screen w-full items-center justify-center bg-admin-canvas text-admin-primary",

  errorCenter:
    "flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-admin-canvas p-6 text-admin-primary",

  sidebar:
    "flex h-full min-h-0 w-[min(17rem,82vw)] shrink-0 flex-col overflow-hidden border-r border-admin-border bg-admin-surface md:w-[17.5rem]",

  sidebarBrandBlock: "shrink-0 px-5 pb-3 pt-7",

  sidebarNav:
    "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-8 pt-2",

  /** Hide scrollbars visually while keeping wheel/touch scroll (Chromium / Firefox / WebKit). */
  scrollRegionHidden:
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",

  brandKicker: "text-[11px] font-bold uppercase tracking-[0.22em] text-orange-600",

  sidebarTitle: "mt-1.5 font-sans text-[1.05rem] font-semibold tracking-tight text-admin-primary",

  sidebarTagline: "mt-1 max-w-[13rem] text-[11px] font-medium leading-snug text-admin-muted",

  navSectionLabel:
    "mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-admin-muted",

  /** Main column (scrollable); padding applied by AdminMain */
  main: "relative flex min-h-0 min-w-0 flex-1 flex-col bg-admin-canvas",

  /** Atomic panel — tables, filters, dense logs */
  panel: "rounded-lg border border-admin-border bg-admin-surface",

  panelMuted: "rounded-lg border border-admin-border bg-admin-stripe",

  panelInteractive:
    "transition-colors duration-150 hover:border-neutral-300 hover:bg-admin-hover/80",

  panelPadding: "p-3 sm:p-4",

  pageHeader: "space-y-1",

  pageTitle: "font-sans text-xl font-semibold tracking-tight text-admin-primary sm:text-2xl",

  pageDescription: "max-w-2xl text-sm font-medium leading-relaxed text-admin-secondary",

  sectionTitle: "text-sm font-semibold text-admin-primary",

  sectionSubtitle: "text-xs font-medium text-admin-secondary",

  /** Dense tables — zebra rows, sticky header inside scroll wrapper */
  tableWrap:
    "max-h-[min(72vh,800px)] overflow-auto rounded-lg border border-admin-border bg-admin-surface [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",

  table: "w-full min-w-[640px] border-collapse text-left text-[13px]",

  thead:
    "sticky top-0 z-10 border-b border-admin-border bg-admin-surface text-[11px] font-semibold uppercase tracking-wide text-admin-secondary shadow-[inset_0_-1px_0_0_theme(colors.admin.border)]",

  th: "px-2 py-1.5 text-left first:pl-3",

  tbodyRow:
    "border-b border-admin-border bg-admin-surface transition-colors even:bg-admin-stripe hover:bg-admin-hover last:border-b-0 data-[state=selected]:bg-orange-50",

  td: "px-2 py-1.5 align-middle text-admin-primary",

  textPrimary: "text-admin-primary",
  textSecondary: "text-admin-secondary",
  textMuted: "text-admin-muted",

  link: "font-medium text-orange-600 underline-offset-2 transition-colors hover:text-orange-700",

  linkSubtle:
    "text-xs font-medium text-orange-600 underline-offset-2 transition-colors hover:text-orange-700",

  actionPill:
    "rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-900 transition-colors hover:border-orange-300 hover:bg-orange-100",

  label: "mb-1 block text-xs font-semibold text-admin-secondary",

  input:
    "w-full rounded-md border border-admin-border bg-admin-surface px-2.5 py-1.5 text-sm font-medium text-admin-primary placeholder:text-admin-muted shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25",

  select:
    "w-full rounded-md border border-admin-border bg-admin-surface px-2.5 py-1.5 text-sm font-medium text-admin-primary shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25",

  btnPrimary:
    "inline-flex items-center justify-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",

  btnPrimarySm:
    "inline-flex items-center justify-center rounded-md bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50",

  btnSecondary:
    "inline-flex items-center justify-center rounded-md border border-admin-border bg-admin-surface px-3 py-1.5 text-sm font-medium text-admin-primary shadow-sm transition-colors hover:bg-admin-stripe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50",

  btnSecondarySm:
    "inline-flex items-center justify-center rounded-md border border-admin-border bg-admin-surface px-2 py-1 text-xs font-medium text-admin-primary transition-colors hover:bg-admin-stripe disabled:opacity-50",

  btnDanger:
    "inline-flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50",

  btnDangerSm:
    "inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-50",

  btnWarningSm:
    "inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50",

  tableActionBtn:
    "inline-flex items-center justify-center rounded-md border border-admin-border bg-admin-surface px-2 py-1 text-xs font-medium text-admin-primary transition-colors hover:border-orange-300 hover:bg-orange-50",

  btnGhost:
    "inline-flex items-center justify-center rounded-md bg-admin-stripe px-3 py-2 text-sm font-medium text-admin-primary transition-colors hover:bg-admin-hover",

  pillGroup:
    "inline-flex flex-wrap gap-0 rounded-md border border-admin-border bg-admin-stripe p-0.5",

  pill:
    "rounded px-2.5 py-1 text-xs font-semibold text-admin-secondary transition-colors hover:bg-white hover:text-admin-primary",

  pillActive: "bg-orange-50 text-admin-primary ring-1 ring-orange-200",

  toolbarInput:
    "min-w-[140px] rounded-md border border-admin-border bg-admin-surface px-2.5 py-1.5 text-xs font-medium text-admin-primary placeholder:text-admin-muted focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25",

  badgeNeutral:
    "rounded border border-admin-border bg-admin-stripe px-1.5 py-0.5 text-xs font-medium text-admin-secondary",

  emptyState:
    "flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-admin-border bg-admin-stripe p-6 text-center text-sm font-medium text-admin-secondary",

  noticeInfo:
    "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm",

  noticeMuted:
    "rounded-lg border border-admin-border bg-admin-stripe px-3 py-2 text-sm font-medium text-admin-secondary shadow-sm",

  nestedRow:
    "rounded-md border border-admin-border bg-admin-surface px-2.5 py-2",

  formCheckRow:
    "flex items-center gap-2 rounded-md border border-admin-border bg-admin-stripe px-2.5 py-2",

  modalHeader: "flex shrink-0 items-start justify-between gap-4 border-b border-admin-border bg-admin-surface px-4 py-3",

  skeleton: "admin-skeleton-shimmer rounded bg-neutral-200",

  skeletonLine: "h-4 w-full rounded bg-neutral-200",
} as const

/** Status chips — readable on light surfaces */
export const adminChip = {
  success:
    "rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-900",
  danger: "rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-900",
  warning:
    "rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900",
  orange:
    "rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-950",
  neutral:
    "rounded border border-admin-border bg-admin-stripe px-1.5 py-0.5 text-xs font-medium text-admin-secondary",
  sky: "rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-950",
  violet:
    "rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-950",
  purple:
    "rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-950",
} as const

export function adminOpsTeamStateChip(value: string): string {
  const n = value.toLowerCase()
  if (n === "active") return adminChip.success
  if (n === "suspended" || n === "terminated") return adminChip.danger
  if (n === "grace_period" || n === "past_due") return adminChip.orange
  if (n === "cancelled") return adminChip.neutral
  return adminChip.neutral
}

export function adminOpsUserStatusChip(status: string): string {
  const v = status.toLowerCase()
  if (v.includes("active")) return adminChip.success
  if (v.includes("suspend")) return adminChip.danger
  if (v.includes("deactiv")) return adminChip.neutral
  return adminChip.neutral
}

export function adminOpsAdStatusChip(status: string): string {
  const n = status.toLowerCase()
  if (n === "active") return adminChip.success
  if (n.includes("suspend")) return adminChip.danger
  return adminChip.neutral
}

const kpiAccent = {
  emerald: "border-l-emerald-500",
  red: "border-l-red-500",
  orange: "border-l-orange-500",
  sky: "border-l-sky-500",
  violet: "border-l-violet-500",
  purple: "border-l-purple-500",
  slate: "border-l-neutral-400",
} as const

export function adminKpiStatCard(accent: keyof typeof kpiAccent, interactive?: boolean) {
  return cn(
    "rounded-lg border border-admin-border border-l-4 bg-admin-surface px-3 py-2 shadow-sm",
    kpiAccent[accent],
    interactive &&
      "cursor-pointer text-left transition-colors hover:border-neutral-300 hover:bg-admin-hover focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-500/40"
  )
}

export function adminKpiLabel() {
  return "text-[11px] font-medium uppercase tracking-wide text-admin-muted"
}

export function adminKpiValue() {
  return "mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-admin-primary"
}

export const adminAccent = {
  orange: "border-l-orange-500",
  red: "border-l-red-500",
  emerald: "border-l-emerald-500",
  sky: "border-l-sky-500",
  violet: "border-l-violet-500",
  slate: "border-l-neutral-400",
} as const

export function adminMetricCard(accent: keyof typeof adminAccent) {
  return cn(
    "relative overflow-hidden rounded-lg border border-admin-border bg-admin-surface pl-3 shadow-sm transition-colors duration-150",
    "border-l-4",
    adminAccent[accent],
    adminUi.panelInteractive
  )
}

export function adminNavLinkClass(active: boolean) {
  return cn(
    "block rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium leading-snug tracking-tight transition-colors duration-150",
    active
      ? "border-orange-200/90 bg-orange-50/95 text-admin-primary shadow-[inset_3px_0_0_0_theme(colors.orange.500)]"
      : "text-admin-secondary hover:border-admin-border hover:bg-admin-stripe hover:text-admin-primary"
  )
}

export function adminPanel(className?: string) {
  return cn(adminUi.panel, className)
}

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/admin/") {
    return pathname === "/admin" || pathname === "/admin/"
  }
  if (href === "/admin/overview") {
    return (
      pathname === "/admin/overview" ||
      pathname === "/admin/overview/" ||
      pathname === "/admin/dashboard" ||
      pathname === "/admin/dashboard/"
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
