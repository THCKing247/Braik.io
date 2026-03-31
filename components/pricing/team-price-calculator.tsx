"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  SPORT_OPTIONS,
  SPORT_MIN_ROSTERS,
  getSportMinRoster,
} from "@/lib/pricing-sports"

type SportKey = keyof typeof SPORT_MIN_ROSTERS
import {
  computeHeadCoachBilling,
  getFreeAssistantCoaches,
  getAthleticDirectorAnnual,
  HEAD_COACH_PRICING,
} from "@/lib/billing"
import { getPricingCalculatorCta } from "@/lib/marketing/join-cta"

const MAX_ROSTER = 200
const MAX_COACHES = 20

type PlanChoice = "head_coach" | "athletic_director"

const PRESETS = [
  { name: "Basketball", sport: "Basketball" as SportKey, varsity: 15, jv: 0, freshman: 0, coaches: 3 },
  { name: "Football", sport: "Football" as SportKey, varsity: 60, jv: 35, freshman: 30, coaches: 6 },
  { name: "Soccer", sport: "Soccer" as SportKey, varsity: 24, jv: 20, freshman: 0, coaches: 4 },
  { name: "Baseball", sport: "Baseball" as SportKey, varsity: 18, jv: 15, freshman: 0, coaches: 4 },
  { name: "Volleyball", sport: "Volleyball" as SportKey, varsity: 14, jv: 12, freshman: 0, coaches: 3 },
] as const

function useAnimatedValue(target: number, duration = 280): number {
  const [display, setDisplay] = useState(target)

  useEffect(() => {
    if (display === target) return
    const start = display
    const startTime = performance.now()
    let cancelled = false

    const tick = (now: number) => {
      if (cancelled) return
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplay(Math.round(start + (target - start) * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => {
      cancelled = true
    }
  }, [target, duration])

  return display
}

export function TeamPriceCalculator() {
  const [planChoice, setPlanChoice] = useState<PlanChoice>("head_coach")
  const [sport, setSport] = useState<SportKey>("Football")
  const [varsityRoster, setVarsityRoster] = useState(40)
  const [hasJv, setHasJv] = useState(false)
  const [jvRoster, setJvRoster] = useState(25)
  const [hasFreshman, setHasFreshman] = useState(false)
  const [freshmanRoster, setFreshmanRoster] = useState(25)
  const [assistantCoaches, setAssistantCoaches] = useState(3)

  const minRoster = useMemo(() => getSportMinRoster(sport), [sport])

  const clampedVarsity = useMemo(
    () => Math.min(MAX_ROSTER, Math.max(minRoster, varsityRoster)),
    [varsityRoster, minRoster]
  )
  const clampedJv = useMemo(
    () => Math.min(MAX_ROSTER, Math.max(0, jvRoster)),
    [jvRoster]
  )
  const clampedFreshman = useMemo(
    () => Math.min(MAX_ROSTER, Math.max(0, freshmanRoster)),
    [freshmanRoster]
  )
  const clampedCoaches = useMemo(
    () => Math.min(MAX_COACHES, Math.max(0, Math.floor(assistantCoaches))),
    [assistantCoaches]
  )

  const headCoachBreakdown = useMemo(
    () =>
      computeHeadCoachBilling({
        varsityRosterSpots: clampedVarsity,
        hasJv,
        jvRosterSpots: clampedJv,
        hasFreshman,
        freshmanRosterSpots: clampedFreshman,
        assistantCoachCount: clampedCoaches,
      }),
    [clampedVarsity, hasJv, clampedJv, hasFreshman, clampedFreshman, clampedCoaches]
  )

  const freeAssistants = useMemo(
    () => getFreeAssistantCoaches({ hasJv, hasFreshman }),
    [hasJv, hasFreshman]
  )

  const displayTotal = useAnimatedValue(
    planChoice === "athletic_director" ? getAthleticDirectorAnnual() : headCoachBreakdown.total
  )

  const applyPreset = useCallback((preset: (typeof PRESETS)[number]) => {
    setSport(preset.sport)
    setVarsityRoster(preset.varsity)
    setJvRoster(preset.jv)
    setFreshmanRoster(preset.freshman)
    setHasJv(preset.jv > 0)
    setHasFreshman(preset.freshman > 0)
    setAssistantCoaches(preset.coaches)
  }, [])

  useEffect(() => {
    if (varsityRoster < minRoster) setVarsityRoster(minRoster)
  }, [minRoster])

  const sportForSignup =
    sport === "Track & Field" ? "track" : sport === "Cross Country" ? "other" : sport.toLowerCase()
  const headCoachSignupHref = "/request-access"
  const calculatorCta = getPricingCalculatorCta({
    planChoice,
    headCoachHref: headCoachSignupHref,
  })

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white shadow-xl shadow-[#0f172a]/5 overflow-hidden">
      <div className="p-6 sm:p-8 space-y-8">
        {/* Plan type: Head Coach vs Athletic Director */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-3">
            Plan type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlanChoice("head_coach")}
              className={cn(
                "py-3 px-4 rounded-xl text-sm font-medium transition-all border-2",
                planChoice === "head_coach"
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#1d4ed8]"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
              )}
            >
              Head Coach Plan
            </button>
            <button
              type="button"
              onClick={() => setPlanChoice("athletic_director")}
              className={cn(
                "py-3 px-4 rounded-xl text-sm font-medium transition-all border-2",
                planChoice === "athletic_director"
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#1d4ed8]"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
              )}
            >
              Athletic Director
            </button>
          </div>
        </div>

        {planChoice === "athletic_director" ? (
          <>
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 p-6 space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Annual cost (program / athletic department pays)
              </h4>
              <p className="text-4xl sm:text-5xl font-bold text-[#0f172a] tabular-nums tracking-tight">
                ${displayTotal.toLocaleString()}
                <span className="text-xl font-normal text-slate-500 ml-1">/year</span>
              </p>
              <p className="text-sm text-slate-600 pt-2">
                Unlimited teams, roster spots, and assistant coaches. Best for multi-team athletic departments.
              </p>
            </div>
            <Link
              href={calculatorCta.href}
              className={cn(
                "block w-full text-center rounded-xl py-4 text-base font-semibold transition-all",
                "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-lg shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/30"
              )}
            >
              {calculatorCta.label}
            </Link>
          </>
        ) : (
          <>
            {/* Sport presets */}
            <div>
              <p className="text-sm font-medium text-slate-500 mb-3">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      "bg-slate-100 text-slate-700 hover:bg-[#3B82F6] hover:text-white"
                    )}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sport selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">Sport</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as SportKey)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-800 font-medium focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none transition-all"
              >
                {SPORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-sm text-slate-500">
                Minimum varsity roster for {sport}: {minRoster} athletes
              </p>
            </div>

            {/* Varsity roster */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-semibold text-slate-800">Varsity roster spots</label>
                <span className="text-lg font-bold text-[#0f172a] tabular-nums">
                  {clampedVarsity} athletes
                </span>
              </div>
              <input
                type="range"
                min={minRoster}
                max={MAX_ROSTER}
                value={clampedVarsity}
                onChange={(e) => setVarsityRoster(Number(e.target.value))}
                className="w-full h-3 rounded-full appearance-none bg-slate-200 accent-[#3B82F6] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3B82F6] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* JV */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={hasJv}
                  onChange={(e) => setHasJv(e.target.checked)}
                  className="rounded border-[#E5E7EB]"
                />
                <span className="text-sm font-semibold text-slate-800">Include JV team</span>
              </label>
              {hasJv && (
                <div className="pl-6">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm text-slate-600">JV roster spots</span>
                    <span className="font-medium tabular-nums">{clampedJv}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={MAX_ROSTER}
                    value={clampedJv}
                    onChange={(e) => setJvRoster(Number(e.target.value))}
                    className="w-full h-3 rounded-full appearance-none bg-slate-200 accent-[#3B82F6]"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    $50 base + $10 per roster spot · +1 free assistant coach included
                  </p>
                </div>
              )}
            </div>

            {/* Freshman */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={hasFreshman}
                  onChange={(e) => setHasFreshman(e.target.checked)}
                  className="rounded border-[#E5E7EB]"
                />
                <span className="text-sm font-semibold text-slate-800">Include Freshman team</span>
              </label>
              {hasFreshman && (
                <div className="pl-6">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm text-slate-600">Freshman roster spots</span>
                    <span className="font-medium tabular-nums">{clampedFreshman}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={MAX_ROSTER}
                    value={clampedFreshman}
                    onChange={(e) => setFreshmanRoster(Number(e.target.value))}
                    className="w-full h-3 rounded-full appearance-none bg-slate-200 accent-[#3B82F6]"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    $50 base + $10 per roster spot · +1 free assistant coach included
                  </p>
                </div>
              )}
            </div>

            {/* Assistant coaches */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-semibold text-slate-800">
                  Assistant coaches
                </label>
                <span className="text-lg font-bold text-[#0f172a] tabular-nums">
                  {clampedCoaches}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    ({freeAssistants} free included)
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={MAX_COACHES}
                value={clampedCoaches}
                onChange={(e) => setAssistantCoaches(Number(e.target.value))}
                className="w-full h-3 rounded-full appearance-none bg-slate-200 accent-[#3B82F6] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3B82F6] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              />
              {headCoachBreakdown.assistantOverage > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  ${HEAD_COACH_PRICING.perAssistantOverage} per assistant over {freeAssistants}
                </p>
              )}
            </div>

            {/* Cost display */}
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 p-6 space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Estimated annual cost (program / coach pays)
              </h4>
              <p className="text-4xl sm:text-5xl font-bold text-[#0f172a] tabular-nums tracking-tight">
                ${displayTotal.toLocaleString()}
                <span className="text-xl font-normal text-slate-500 ml-1">/year</span>
              </p>
              <p className="text-sm text-slate-600">
                This is the cost to the head coach or program. Player accounts are included—players do not pay for their own accounts.
              </p>

              <div className="pt-3 border-t border-slate-200/80">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Cost breakdown
                </p>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>Varsity base: ${headCoachBreakdown.varsityBase}</li>
                  {headCoachBreakdown.jvBase > 0 && (
                    <li>JV base: ${headCoachBreakdown.jvBase}</li>
                  )}
                  {headCoachBreakdown.freshmanBase > 0 && (
                    <li>Freshman base: ${headCoachBreakdown.freshmanBase}</li>
                  )}
                  <li>
                    Varsity roster: {clampedVarsity} × ${HEAD_COACH_PRICING.perRosterSpot} = $
                    {headCoachBreakdown.varsityRosterCost}
                  </li>
                  {hasJv && (
                    <li>
                      JV roster: {clampedJv} × ${HEAD_COACH_PRICING.perRosterSpot} = $
                      {headCoachBreakdown.jvRosterCost}
                    </li>
                  )}
                  {hasFreshman && (
                    <li>
                      Freshman roster: {clampedFreshman} × ${HEAD_COACH_PRICING.perRosterSpot} = $
                      {headCoachBreakdown.freshmanRosterCost}
                    </li>
                  )}
                  {headCoachBreakdown.assistantOverageCost > 0 && (
                    <li>
                      Assistant overage: {headCoachBreakdown.assistantOverage} × $
                      {HEAD_COACH_PRICING.perAssistantOverage} = $
                      {headCoachBreakdown.assistantOverageCost}
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <Link
              href={calculatorCta.href}
              className={cn(
                "block w-full text-center rounded-xl py-4 text-base font-semibold transition-all",
                "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-lg shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/30"
              )}
            >
              {calculatorCta.label}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
