"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Layers,
  LayoutGrid,
  Menu,
  Sparkles,
  X,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { BeforeAfterComparison } from "@/components/apex-showroom/before-after-comparison"
import { useDemoFeedback } from "@/components/apex-showroom/demo-feedback"
import { Button } from "@/components/ui/button"
import {
  compareAfter,
  compareBefore,
  industryCards,
  layoutMockA,
  layoutMockB,
  showroomHero,
  showroomWorkspace,
} from "@/lib/apex-showroom/demo-assets"
import { cn } from "@/lib/utils"

const NAV = [
  { id: "launch", label: "Launch" },
  { id: "aesthetics", label: "Aesthetics" },
  { id: "sectors", label: "Sectors" },
  { id: "transformation", label: "Transformation" },
  { id: "systems", label: "Systems" },
  { id: "concierge", label: "Concierge" },
] as const

type StyleId = "radiance" | "prism" | "monochrome"

const STYLE_PRESETS: { id: StyleId; name: string; hint: string }[] = [
  {
    id: "radiance",
    name: "Radiance",
    hint: "Warm metallics · hospitality-grade polish",
  },
  {
    id: "prism",
    name: "Prism",
    hint: "Cool gradients · SaaS clarity",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    hint: "Editorial restraint · Fortune 500 calm",
  },
]

const MODULES = [
  {
    id: "observe",
    title: "Observe",
    body: "Unified telemetry with anomaly surfacing — operators see drift before users feel it.",
  },
  {
    id: "orchestrate",
    title: "Orchestrate",
    body: "Policy-aware workflows connect teams without forcing a single toolchain.",
  },
  {
    id: "express",
    title: "Express",
    body: "Brand systems ship as tokens — surfaces stay coherent while squads move independently.",
  },
  {
    id: "assure",
    title: "Assure",
    body: "Evidence packs for stakeholders: accessibility, performance, and security posture in one narrative.",
  },
  {
    id: "scale",
    title: "Scale",
    body: "Edge-ready delivery patterns so experiences stay crisp from first launch to global footprint.",
  },
] as const

export default function ApexShowroomPage() {
  const { notify } = useDemoFeedback()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [styleId, setStyleId] = useState<StyleId>("prism")
  const [sectorId, setSectorId] = useState<string>(industryCards[0]!.id)
  const [moduleId, setModuleId] = useState<string>(MODULES[0]!.id)
  const [faqOpen, setFaqOpen] = useState<string | null>("trust")

  const selectedSector = useMemo(
    () => industryCards.find((c) => c.id === sectorId) ?? industryCards[0]!,
    [sectorId],
  )

  const selectedModule = useMemo(
    () => MODULES.find((m) => m.id === moduleId) ?? MODULES[0]!,
    [moduleId],
  )

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setMobileNavOpen(false)
  }, [])

  const stylePreviewClass = useMemo(() => {
    if (styleId === "radiance") {
      return "border-amber-500/35 bg-gradient-to-br from-amber-950/50 via-slate-950 to-slate-950 ring-1 ring-amber-400/20"
    }
    if (styleId === "monochrome") {
      return "border-slate-600/60 bg-gradient-to-br from-slate-900 via-slate-950 to-black ring-1 ring-white/10"
    }
    return "border-sky-500/35 bg-gradient-to-br from-sky-950/60 via-slate-950 to-slate-950 ring-1 ring-sky-400/25"
  }, [styleId])

  const accentSample = useMemo(() => {
    if (styleId === "radiance") return "text-amber-200"
    if (styleId === "monochrome") return "text-slate-200"
    return "text-sky-300"
  }, [styleId])

  return (
    <>
      {/* Sticky nav */}
      <header className="sticky top-0 z-[90] border-b border-white/[0.08] bg-[#030712]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => scrollTo("launch")}
            className="flex items-center gap-2 rounded-lg text-left outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-black text-white shadow-lg shadow-sky-900/40">
              A
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Apex</span>
              <span className="block text-sm font-bold text-white">Showroom</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Showroom stations">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  scrollTo(item.id)
                  notify(`Station — ${item.label}`)
                }}
                className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden border-white/15 bg-white/5 text-xs font-semibold text-white hover:bg-white/10 sm:inline-flex"
              asChild
            >
              <Link href="/">Back to Braik</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="hidden font-semibold sm:inline-flex"
              asChild
            >
              <Link href="/request-access">Request access</Link>
            </Button>
            <button
              type="button"
              className="inline-flex rounded-lg border border-white/10 p-2 text-white lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-showroom-nav"
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <div
            id="mobile-showroom-nav"
            className="border-t border-white/[0.08] bg-[#030712]/98 px-4 py-3 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    scrollTo(item.id)
                    notify(`Station — ${item.label}`)
                  }}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {item.label}
                </button>
              ))}
              <Link
                href="/"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-sky-300 hover:bg-white/10"
                onClick={() => setMobileNavOpen(false)}
              >
                Back to Braik
              </Link>
              <Link
                href="/request-access"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => setMobileNavOpen(false)}
              >
                Request access
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        {/* Launch */}
        <section id="launch" className="relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={showroomHero.src}
              alt={showroomHero.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-[0.55]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/80 via-[#030712]/92 to-[#030712]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(56,189,248,0.14),transparent_55%)]" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:pt-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/90 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Interactive demo environment
            </div>
            <h1 className="mt-6 max-w-3xl font-athletic text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              A guided showroom for decisive client conversations.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Every control here is wired for feedback — explore aesthetics, vertical narratives, transformation framing,
              and systems thinking without touching production backends.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                className="gap-2 font-semibold shadow-lg shadow-sky-950/40"
                onClick={() => {
                  scrollTo("aesthetics")
                  notify("Starting tour — Aesthetics station")
                }}
              >
                Start guided tour
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 font-semibold text-white hover:bg-white/10"
                onClick={() => {
                  scrollTo("transformation")
                  notify("Jumped to Transformation — drag the comparison")
                }}
              >
                View transformation demo
              </Button>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-3">
              {[
                { k: "01", t: "Visual systems", d: "Switch palettes — cards update instantly." },
                { k: "02", t: "Sector stories", d: "Select an industry — copy & imagery align." },
                { k: "03", t: "Proof of polish", d: "Comparison slider stays smooth on touch." },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-2xl border border-white/[0.09] bg-black/35 p-4 backdrop-blur-md transition hover:border-sky-500/25 hover:bg-black/45"
                >
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-sky-400">{x.k}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{x.t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{x.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Aesthetics */}
        <section id="aesthetics" className="border-t border-white/[0.06] bg-gradient-to-b from-[#030712] to-[#0a1628] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">Aesthetics lab</p>
                <h2 className="mt-2 font-athletic text-3xl font-bold text-white sm:text-4xl">Three directions, one system spine.</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-400">
                  Toggle a lane — typography rhythm, chroma, and surface tokens shift together so stakeholders see a real
                  decision, not a placeholder theme switcher.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 font-semibold"
                onClick={() => notify(`Active lane — ${STYLE_PRESETS.find((s) => s.id === styleId)?.name ?? ""}`)}
              >
                Confirm selection
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              {STYLE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStyleId(s.id)
                    notify(`Style — ${s.name} (${s.hint})`)
                  }}
                  className={cn(
                    "rounded-full border px-4 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                    styleId === s.id
                      ? "border-sky-400/60 bg-sky-500/15 text-white shadow-lg shadow-sky-950/30"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.07]",
                  )}
                >
                  <span className="block">{s.name}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{s.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div
                className={cn(
                  "rounded-3xl border p-6 shadow-2xl transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5",
                  stylePreviewClass,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={cn("text-xs font-bold uppercase tracking-wide", accentSample)}>Executive overview</p>
                    <p className="mt-1 text-lg font-semibold text-white">Northwind rollout</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                    Live preview
                  </span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <Image
                      src={layoutMockA.src}
                      alt={layoutMockA.alt}
                      width={800}
                      height={520}
                      className="h-36 w-full object-cover opacity-95 sm:h-44"
                    />
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-semibold text-slate-300">Velocity</p>
                    <p className={cn("mt-2 text-3xl font-black tabular-nums", accentSample)}>94</p>
                    <p className="mt-1 text-[11px] text-slate-500">Composite confidence index · demo data</p>
                  </div>
                </div>
                <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                      styleId === "radiance" && "from-amber-400 to-orange-500",
                      styleId === "monochrome" && "from-slate-300 to-slate-500",
                      styleId === "prism" && "from-sky-400 to-indigo-500",
                    )}
                    style={{ width: styleId === "monochrome" ? "62%" : styleId === "radiance" ? "78%" : "71%" }}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#071018]/80 p-6 ring-1 ring-white/[0.04]">
                <div className="flex items-start gap-3">
                  <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden />
                  <div>
                    <p className="font-semibold text-white">Layout rhythm</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      Cards preserve grid integrity across breakpoints — this station demonstrates paired imagery + metric
                      tiles with shared gutter logic.
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={layoutMockB.src}
                    alt={layoutMockB.alt}
                    width={900}
                    height={520}
                    className="h-48 w-full object-cover sm:h-56"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sectors */}
        <section id="sectors" className="border-t border-white/[0.06] bg-[#0a1628] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">Sector lenses</p>
              <h2 className="mt-2 font-athletic text-3xl font-bold text-white sm:text-4xl">Pick a vertical — narrative follows.</h2>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                Cards drive both imagery and copy. Selection state stays obvious for room-scale presentations.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {industryCards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSectorId(c.id)
                      notify(`Sector — ${c.title}`)
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                      sectorId === c.id
                        ? "border-sky-400/70 ring-2 ring-sky-400/35"
                        : "border-white/10 hover:border-white/25",
                    )}
                  >
                    <div className="relative aspect-[4/3]">
                      <Image src={c.src} alt={c.alt} fill sizes="(max-width: 1024px) 50vw, 400px" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300">{c.tagline}</p>
                        <p className="mt-1 text-sm font-bold text-white sm:text-base">{c.title}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-col rounded-3xl border border-white/[0.08] bg-black/25 p-6 ring-1 ring-white/[0.05] sm:p-8">
                <div className="mb-4 inline-flex items-center gap-2 text-sky-300">
                  <Building2 className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]">Selected narrative</span>
                </div>
                <h3 className="font-athletic text-2xl font-bold text-white">{selectedSector.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">{selectedSector.detail}</p>
                <div className="mt-8 mt-auto overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={showroomWorkspace.src}
                    alt={showroomWorkspace.alt}
                    width={900}
                    height={600}
                    className="h-48 w-full object-cover sm:h-56"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Transformation */}
        <section id="transformation" className="border-t border-white/[0.06] bg-gradient-to-b from-[#0a1628] to-[#030712] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">Transformation</p>
              <h2 className="mt-2 font-athletic text-3xl font-bold text-white sm:text-4xl">Before / after — built for stage lights.</h2>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                Drag the handle, swipe on a tablet, or use arrow keys once the slider is focused — the clip stays aligned
                with no layout drift.
              </p>
            </div>
            <div className="mx-auto mt-12 max-w-5xl">
              <BeforeAfterComparison
                beforeSrc={compareBefore.src}
                afterSrc={compareAfter.src}
                beforeAlt={compareBefore.alt}
                afterAlt={compareAfter.alt}
                beforeLabel="Baseline"
                afterLabel="Elevated"
              />
            </div>
          </div>
        </section>

        {/* Systems */}
        <section id="systems" className="border-t border-white/[0.06] bg-[#030712] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">Systems map</p>
                <h2 className="mt-2 font-athletic text-3xl font-bold text-white sm:text-4xl">Modular pillars — swap the story, not the deck.</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-400">
                  Select a pillar to rewrite the narrative block. Useful for aligning different stakeholders in the same
                  session.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/15 bg-transparent font-semibold text-white hover:bg-white/10"
                onClick={() => {
                  const ix = MODULES.findIndex((m) => m.id === moduleId)
                  const next = MODULES[(ix + 1) % MODULES.length]!
                  setModuleId(next.id)
                  notify(`Advanced to — ${next.title}`)
                }}
              >
                Cycle next pillar
              </Button>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                {MODULES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setModuleId(m.id)
                      notify(`Pillar — ${m.title}`)
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                      moduleId === m.id
                        ? "border-sky-500/50 bg-sky-500/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <Layers className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    {m.title}
                  </button>
                ))}
              </div>
              <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-950 to-[#071018] p-8 ring-1 ring-white/[0.05]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">Active pillar</p>
                <h3 className="mt-3 font-athletic text-2xl font-bold text-white">{selectedModule.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-slate-300">{selectedModule.body}</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Outcome</p>
                    <p className="mt-2 text-sm text-slate-200">Stakeholder-ready clarity without sacrificing technical depth.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Demo note</p>
                    <p className="mt-2 text-sm text-slate-200">
                      Swap pillars live — ideal for CIO vs CMO audiences in back-to-back blocks.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 border-t border-white/[0.06] pt-12">
              <h3 className="text-center font-athletic text-xl font-bold text-white sm:text-2xl">Questions clients actually ask</h3>
              <div className="mx-auto mt-8 max-w-3xl divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-black/25">
                {[
                  {
                    id: "trust",
                    q: "How do we trust this won’t crumble after launch?",
                    a: "Playbooks bundle observability, rollback paths, and executive summaries — demo-only narrative here, production patterns match your governance tier.",
                  },
                  {
                    id: "speed",
                    q: "Can we move quickly without wrecking brand?",
                    a: "Token-driven surfaces mean velocity in components without drift in look-and-feel — designers and engineers share one language.",
                  },
                  {
                    id: "proof",
                    q: "What proof do we show the board?",
                    a: "Outcome tiles pull from agreed KPIs — this showroom shows how evidence could layer into a single credible storyline.",
                  },
                ].map((row) => (
                  <div key={row.id} className="px-4 py-2 sm:px-6">
                    <button
                      type="button"
                      onClick={() => {
                        setFaqOpen((cur) => {
                          const next = cur === row.id ? null : row.id
                          notify(next ? `FAQ — ${row.q}` : "FAQ collapsed")
                          return next
                        })
                      }}
                      className="flex w-full items-center justify-between gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:py-5"
                    >
                      <span className="text-sm font-semibold text-white sm:text-base">{row.q}</span>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 shrink-0 text-slate-400 transition-transform",
                          faqOpen === row.id && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                    {faqOpen === row.id ? (
                      <p className="border-t border-white/[0.06] pb-5 pt-2 text-sm leading-relaxed text-slate-400">{row.a}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Concierge */}
        <section id="concierge" className="border-t border-white/[0.06] bg-gradient-to-b from-[#030712] to-black py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">Concierge</p>
                <h2 className="mt-2 font-athletic text-3xl font-bold text-white sm:text-4xl">Close the loop — capture intent.</h2>
                <p className="mt-4 text-base leading-relaxed text-slate-400">
                  This form is intentionally front-end only: it proves a crisp handoff moment in the showroom. Wire it to
                  CRM or email when you promote the experience.
                </p>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    Immediate on-screen acknowledgement — confidence for executive viewers.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    Validation prevents empty submits during live demos.
                  </li>
                </ul>
              </div>

              <ConciergeForm notify={notify} />
            </div>

            <footer className="mt-20 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-10 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
              <p>
                Apex Showroom · Presentation environment · © {new Date().getFullYear()} Apex Technical Solutions Group LLC
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href="/privacy" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">
                  Privacy
                </Link>
                <Link href="/terms" className="text-slate-400 underline-offset-4 hover:text-white hover:underline">
                  Terms
                </Link>
                <Link href="/" className="font-semibold text-sky-400 hover:text-sky-300">
                  braik.io
                </Link>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </>
  )
}

function ConciergeForm({ notify }: { notify: (s: string) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [note, setNote] = useState("")
  const [sent, setSent] = useState(false)

  return (
    <div className="rounded-3xl border border-white/[0.1] bg-[#071018]/90 p-6 shadow-2xl ring-1 ring-white/[0.05] sm:p-8">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!email.trim() || !name.trim()) {
            notify("Please enter name and email — demo validation")
            return
          }
          setSent(true)
          notify(`Thanks ${name.trim()} — we’ll follow up at ${email.trim()}`)
          setNote("")
        }}
      >
        <div>
          <label htmlFor="showroom-name" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Name
          </label>
          <input
            id="showroom-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-offset-2 ring-offset-[#071018] placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/40"
            placeholder="Jordan Lee"
          />
        </div>
        <div>
          <label htmlFor="showroom-email" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Work email
          </label>
          <input
            id="showroom-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-offset-2 ring-offset-[#071018] placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/40"
            placeholder="you@organization.com"
          />
        </div>
        <div>
          <label htmlFor="showroom-note" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Context (optional)
          </label>
          <textarea
            id="showroom-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-offset-2 ring-offset-[#071018] placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/40"
            placeholder="What should we prepare for your team?"
          />
        </div>
        <Button type="submit" className="w-full font-semibold sm:w-auto">
          {sent ? "Demo acknowledgement sent" : "Submit intent"}
        </Button>
      </form>
    </div>
  )
}
