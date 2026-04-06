import { cn } from "@/lib/utils"

/**
 * Braik admin — internal ops dashboard: slate-950 canvas, solid contrast,
 * orange-500 accent for primary / active only.
 */
export const adminUi = {
  /** Deepest canvas (main content column) */
  shell: "min-h-screen w-full bg-slate-950 text-slate-50",

  shellGradient: "min-h-screen w-full bg-slate-950 text-slate-50",

  loadingCenter: "flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-50",

  errorCenter:
    "flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-50",

  /** Sidebar rail */
  sidebar:
    "sticky top-0 h-screen w-[min(18rem,85vw)] shrink-0 border-r border-slate-800 bg-slate-950 md:w-72",

  brandKicker: "text-[11px] font-bold uppercase tracking-[0.2em] text-orange-500",

  sidebarTitle: "mt-2 font-athletic text-xl font-bold uppercase tracking-wide text-white",

  sidebarTagline: "mt-1 text-xs font-medium leading-snug text-slate-300",

  /** Nav section labels (sidebar groups) */
  navSectionLabel: "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400",

  main: "min-h-screen min-w-0 flex-1 bg-slate-950 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",

  /** Surfaces */
  panel:
    "rounded-xl border border-slate-800 bg-slate-900 shadow-sm shadow-black/40 ring-1 ring-slate-800/90",

  panelMuted: "rounded-xl border border-slate-800 bg-slate-950 shadow-sm shadow-black/30",

  panelInteractive:
    "transition-colors duration-150 hover:border-slate-700 hover:shadow-md hover:shadow-black/50",

  panelPadding: "p-4 sm:p-5",

  pageHeader: "mb-6 space-y-2",

  pageTitle: "font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl",

  pageDescription: "max-w-2xl text-sm font-medium leading-relaxed text-slate-300",

  /** Section titles inside pages */
  sectionTitle: "text-sm font-semibold text-white",

  sectionSubtitle: "text-xs font-medium text-slate-300",

  /** Tables */
  tableWrap: "overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-inner shadow-black/40",

  table: "w-full min-w-[640px] border-collapse text-left text-sm",

  thead: "border-b border-slate-800 bg-slate-900 text-xs font-semibold uppercase tracking-wide text-slate-200",

  th: "px-4 py-3 text-left first:pl-4",

  tbodyRow:
    "border-b border-slate-800/90 bg-slate-950 transition-colors last:border-b-0 hover:bg-slate-900/90 data-[state=selected]:bg-slate-900",

  td: "px-4 py-3 align-middle text-slate-200",

  /** Text scale — avoid sub-slate-400 for body; use 300 for secondary */
  textPrimary: "text-white",
  textSecondary: "text-slate-300",
  textMuted: "text-slate-400",

  link: "font-medium text-orange-400 underline-offset-2 transition-colors hover:text-orange-300",

  linkSubtle: "text-xs font-medium text-orange-400 underline-offset-2 transition-colors hover:text-orange-300",

  actionPill:
    "rounded-lg border border-orange-600/80 bg-orange-950 px-2 py-1 text-xs font-semibold text-orange-50 transition-colors hover:border-orange-500 hover:bg-orange-900 hover:text-white",

  /** Forms */
  label: "mb-1.5 block text-xs font-semibold text-slate-300",

  input:
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/35",

  select:
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/35",

  /** Buttons */
  btnPrimary:
    "inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50",

  btnPrimarySm:
    "inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-50",

  btnSecondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50",

  btnSecondarySm:
    "inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50",

  btnDanger:
    "inline-flex items-center justify-center rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-red-500 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50",

  btnDangerSm:
    "inline-flex items-center justify-center rounded-lg border border-red-700 bg-red-950 px-2.5 py-1 text-xs font-semibold text-red-100 transition-colors hover:border-red-600 hover:bg-red-900 disabled:opacity-50",

  btnWarningSm:
    "inline-flex items-center justify-center rounded-lg border border-amber-700 bg-amber-950 px-2.5 py-1 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-600 hover:bg-amber-900 disabled:opacity-50",

  tableActionBtn:
    "inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-100 transition-colors hover:border-orange-500/70 hover:bg-slate-800 hover:text-white",

  btnGhost:
    "inline-flex items-center justify-center rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700",

  /** Timeframe / filters — segmented control */
  pillGroup: "inline-flex flex-wrap gap-0 rounded-lg border border-slate-700 bg-slate-950 p-0.5 shadow-sm",

  pill:
    "rounded-md px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-900 hover:text-white",

  pillActive: "bg-orange-500 text-white shadow-sm hover:bg-orange-500 hover:text-white",

  toolbarInput:
    "min-w-[140px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/35",

  badgeNeutral: "rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-200",

  emptyState:
    "flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/80 p-8 text-center text-sm font-medium text-slate-300",

  noticeInfo:
    "rounded-xl border border-orange-700/80 bg-orange-950 px-4 py-3 text-sm text-orange-50 shadow-sm",

  noticeMuted: "rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200 shadow-sm",

  /** Nested rows / list items inside panels */
  nestedRow: "rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5",

  /** Checkbox / toggle row inside forms */
  formCheckRow: "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5",

  /** Modal chrome */
  modalHeader: "border-b border-slate-800 bg-slate-900/90 px-5 py-4",

  /** Skeleton */
  skeleton: "admin-skeleton-shimmer rounded-md bg-slate-800",

  skeletonLine: "h-4 w-full rounded bg-slate-800",
} as const

/** Solid status chips — readable on slate-950 (no low-opacity washes) */
export const adminChip = {
  success: "rounded-md border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-100",
  danger: "rounded-md border border-red-700 bg-red-950 px-2 py-0.5 text-xs font-medium text-red-100",
  warning: "rounded-md border border-amber-700 bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-100",
  orange: "rounded-md border border-orange-700 bg-orange-950 px-2 py-0.5 text-xs font-medium text-orange-100",
  neutral: "rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-200",
  sky: "rounded-md border border-sky-700 bg-sky-950 px-2 py-0.5 text-xs font-medium text-sky-100",
  violet: "rounded-md border border-violet-700 bg-violet-950 px-2 py-0.5 text-xs font-medium text-violet-100",
  purple: "rounded-md border border-purple-700 bg-purple-950 px-2 py-0.5 text-xs font-medium text-purple-100",
} as const

/** Team subscription_status or team_status display */
export function adminOpsTeamStateChip(value: string): string {
  const n = value.toLowerCase()
  if (n === "active") return adminChip.success
  if (n === "suspended" || n === "terminated") return adminChip.danger
  if (n === "grace_period" || n === "past_due") return adminChip.orange
  if (n === "cancelled") return adminChip.neutral
  return adminChip.neutral
}

/** Account / user status */
export function adminOpsUserStatusChip(status: string): string {
  const v = status.toLowerCase()
  if (v.includes("active")) return adminChip.success
  if (v.includes("suspend")) return adminChip.danger
  if (v.includes("deactiv")) return adminChip.neutral
  return adminChip.neutral
}

/** AD / org status */
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
  slate: "border-l-slate-500",
} as const

/** KPI stat box: neutral surface + left accent (Stripe-style) */
export function adminKpiStatCard(accent: keyof typeof kpiAccent, interactive?: boolean) {
  return cn(
    "rounded-xl border border-slate-800 border-l-4 bg-slate-900 pl-4 pr-3 py-3 shadow-sm",
    kpiAccent[accent],
    interactive &&
      "cursor-pointer text-left transition-colors hover:border-slate-700 hover:bg-slate-800/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-500/50"
  )
}

export function adminKpiLabel() {
  return "text-xs font-medium text-slate-300"
}

export function adminKpiValue() {
  return "mt-1 text-2xl font-semibold tabular-nums tracking-tight text-white"
}

/** Left accent bar for metric / alert cards */
export const adminAccent = {
  orange: "border-l-orange-500",
  red: "border-l-red-500",
  emerald: "border-l-emerald-500",
  sky: "border-l-sky-500",
  violet: "border-l-violet-500",
  slate: "border-l-slate-500",
} as const

export function adminMetricCard(accent: keyof typeof adminAccent) {
  return cn(
    "relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 pl-4 shadow-sm transition-colors duration-150",
    "border-l-4",
    adminAccent[accent],
    adminUi.panelInteractive
  )
}

export function adminNavLinkClass(active: boolean) {
  return cn(
    "block rounded-md border-l-2 py-2 pl-3 pr-2 text-sm font-medium transition-colors duration-150",
    active
      ? "border-orange-500 bg-slate-900 text-white shadow-sm"
      : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
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
