import { cn } from "@/lib/utils"

/**
 * Braik admin console — dark navy base, orange accent, athletic display headings.
 * Aligns with product chrome (#0F172A / blue) while keeping admin distinct via warm accent CTAs.
 */
export const adminUi = {
  shell: "min-h-screen w-full bg-[#070b14] text-slate-100",
  shellGradient:
    "min-h-screen w-full bg-gradient-to-b from-[#070b14] via-[#0a1020] to-[#070b14] text-slate-100",

  loadingCenter: "flex min-h-screen w-full items-center justify-center bg-[#070b14] text-slate-100",
  errorCenter:
    "flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#070b14] p-6 text-slate-100",

  /** Primary sidebar surface */
  sidebar:
    "sticky top-0 h-screen w-[min(18rem,85vw)] shrink-0 border-r border-white/[0.07] bg-[#0c1222] p-5 shadow-[4px_0_32px_rgba(0,0,0,0.35)] md:w-72 md:p-6",

  brandKicker:
    "text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400/95",

  sidebarTitle: "mt-2 font-athletic text-xl font-bold uppercase tracking-wide text-white",

  /** Default nav item */
  navLink:
    "block rounded-xl px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white",

  /** Current section */
  navLinkActive: "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",

  navSectionLabel: "mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500",

  main: "min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",

  /** Cards / panels */
  panel:
    "rounded-2xl border border-white/[0.08] bg-[#0f172a]/75 shadow-[0_4px_28px_rgba(0,0,0,0.28)] backdrop-blur-sm",

  panelMuted: "rounded-2xl border border-white/[0.06] bg-[#0a1020]/60",

  panelPadding: "p-4 sm:p-5",

  pageHeader: "mb-6 space-y-1",

  pageTitle: "font-athletic text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl",

  pageDescription: "max-w-2xl text-sm leading-relaxed text-slate-400",

  /** Tables */
  tableWrap: "overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0a1020]/50 shadow-inner",

  table: "w-full min-w-[640px] text-left text-sm",

  thead: "bg-[#060a12]/95 text-xs font-semibold uppercase tracking-wider text-slate-400",

  th: "px-4 py-3",

  tbodyRow: "border-b border-white/[0.06] transition-colors last:border-b-0 hover:bg-white/[0.04]",

  td: "px-4 py-3 align-top text-slate-200",

  /** Links */
  link: "font-medium text-orange-400 transition-colors hover:text-orange-300",

  linkSubtle: "text-xs font-medium text-orange-400/90 transition-colors hover:text-orange-300",

  /** Inline table / toolbar control styled as a soft pill */
  actionPill:
    "rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-200 transition-colors hover:bg-orange-500/20",

  /** Forms */
  label: "mb-1.5 block text-xs font-medium text-slate-400",

  input:
    "w-full rounded-xl border border-white/15 bg-[#060a12]/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm transition-colors focus:border-orange-500/45 focus:outline-none focus:ring-2 focus:ring-orange-500/20",

  select:
    "w-full rounded-xl border border-white/15 bg-[#060a12]/90 px-3 py-2 text-sm text-slate-100 shadow-sm transition-colors focus:border-orange-500/45 focus:outline-none focus:ring-2 focus:ring-orange-500/20",

  /** Buttons */
  btnPrimary:
    "inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 disabled:pointer-events-none disabled:opacity-50",

  btnPrimarySm:
    "inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 disabled:opacity-50",

  btnSecondary:
    "inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-50",

  btnSecondarySm:
    "inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.1] disabled:opacity-50",

  btnGhost:
    "inline-flex items-center justify-center rounded-xl bg-white/[0.08] px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.12]",

  /** Search / filter toolbar */
  toolbarInput:
    "min-w-[140px] rounded-xl border border-white/15 bg-[#060a12]/90 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-orange-500/45 focus:outline-none focus:ring-2 focus:ring-orange-500/20",

  /** Badges — semantic */
  badgeNeutral: "rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300",

  /** Empty & notice strips */
  emptyState:
    "flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#0a1020]/40 p-8 text-center",

  noticeInfo:
    "rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-4 py-3 text-sm text-orange-100/95",

  noticeMuted: "rounded-2xl border border-white/[0.08] bg-[#0a1020]/50 px-4 py-3 text-sm text-slate-300",
} as const

export function adminPanel(className?: string) {
  return cn(adminUi.panel, className)
}

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
