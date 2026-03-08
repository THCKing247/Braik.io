"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  SPORT_OPTIONS,
  SPORT_MIN_ROSTERS,
  getSportMinRoster,
} from "@/lib/pricing-sports"

const BASE_FEE = 250
const PER_ATHLETE = 10
const INCLUDED_COACHES = 3
const PER_COACH = 10
const MAX_ROSTER = 200
const MAX_COACHES = 15

type PaymentModel = "coach" | "players"

type SportKey = keyof typeof SPORT_MIN_ROSTERS

const PRESETS = [
  { name: "Basketball", sport: "Basketball" as SportKey, roster: 15, coaches: 3 },
  { name: "Football", sport: "Football" as SportKey, roster: 60, coaches: 6 },
  { name: "Soccer", sport: "Soccer" as SportKey, roster: 24, coaches: 4 },
  { name: "Baseball", sport: "Baseball" as SportKey, roster: 18, coaches: 4 },
  { name: "Volleyball", sport: "Volleyball" as SportKey, roster: 14, coaches: 3 },
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
  const [sport, setSport] = useState<SportKey>("Football")
  const [rosterSize, setRosterSize] = useState(40)
  const [assistantCoaches, setAssistantCoaches] = useState(3)
  const [paymentModel, setPaymentModel] = useState<PaymentModel>("coach")

  const minRoster = useMemo(() => getSportMinRoster(sport), [sport])

  const clampedRoster = useMemo(
    () => Math.min(MAX_ROSTER, Math.max(minRoster, rosterSize)),
    [rosterSize, minRoster]
  )
  const clampedCoaches = useMemo(
    () => Math.min(MAX_COACHES, Math.max(0, Math.floor(assistantCoaches))),
    [assistantCoaches]
  )

  const { total, teamTotal, breakdown } = useMemo(() => {
    const extraCoaches = Math.max(0, clampedCoaches - INCLUDED_COACHES)
    const coachCost = extraCoaches * PER_COACH

    if (paymentModel === "coach") {
      const teamTotalCalc = BASE_FEE + clampedRoster * PER_ATHLETE
      return {
        total: teamTotalCalc + coachCost,
        teamTotal: teamTotalCalc,
        breakdown: {
          baseFee: BASE_FEE,
          players: clampedRoster * PER_ATHLETE,
          playerCount: clampedRoster,
          extraCoaches,
          coachCost,
        },
      }
    }
    return {
      total: BASE_FEE + coachCost,
      teamTotal: BASE_FEE,
      breakdown: {
        baseFee: BASE_FEE,
        players: 0,
        playerCount: clampedRoster,
        extraCoaches,
        coachCost,
      },
    }
  }, [paymentModel, clampedRoster, clampedCoaches])

  const displayTotal = useAnimatedValue(total)

  const applyPreset = useCallback(
    (preset: (typeof PRESETS)[number]) => {
      setSport(preset.sport)
      setRosterSize(preset.roster)
      setAssistantCoaches(preset.coaches)
    },
    []
  )

  useEffect(() => {
    if (rosterSize < minRoster) setRosterSize(minRoster)
  }, [minRoster])

  const sportForSignup =
    sport === "Track & Field" ? "track" : sport === "Cross Country" ? "other" : sport.toLowerCase()
  const signupHref = `/signup/role?role=head-coach&sport=${encodeURIComponent(sportForSignup)}&roster=${clampedRoster}&payment=${paymentModel}`

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white shadow-xl shadow-[#0f172a]/5 overflow-hidden">
      <div className="p-6 sm:p-8 space-y-8">
        {/* Sport presets */}
        <div>
          <p className="text-sm font-medium text-slate-500 mb-3">
            Quick presets
          </p>
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
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Sport
          </label>
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
            Minimum roster for {sport} is {minRoster} athletes
          </p>
        </div>

        {/* Roster slider */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-sm font-semibold text-slate-800">
              Roster size
            </label>
            <span className="text-lg font-bold text-[#0f172a] tabular-nums">
              {clampedRoster} athletes
            </span>
          </div>
          <input
            type="range"
            min={minRoster}
            max={MAX_ROSTER}
            value={clampedRoster}
            onChange={(e) => setRosterSize(Number(e.target.value))}
            className="w-full h-3 rounded-full appearance-none bg-slate-200 accent-[#3B82F6] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3B82F6] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <p className="mt-1 text-xs text-slate-500">
            Min roster for {sport}: {minRoster} · Max: {MAX_ROSTER}
          </p>
        </div>

        {/* Assistant coaches slider */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-sm font-semibold text-slate-800">
              Assistant coaches
            </label>
            <span className="text-lg font-bold text-[#0f172a] tabular-nums">
              {clampedCoaches} <span className="text-sm font-normal text-slate-500">(3 included)</span>
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
        </div>

        {/* Payment model toggle */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-3">
            Who pays
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentModel("coach")}
              className={cn(
                "py-3 px-4 rounded-xl text-sm font-medium transition-all border-2",
                paymentModel === "coach"
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#1d4ed8]"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
              )}
            >
              Coach pays for players
            </button>
            <button
              type="button"
              onClick={() => setPaymentModel("players")}
              className={cn(
                "py-3 px-4 rounded-xl text-sm font-medium transition-all border-2",
                paymentModel === "players"
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#1d4ed8]"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
              )}
            >
              Players pay individually
            </button>
          </div>
        </div>

        {/* Cost display */}
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 p-6 space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Estimated annual cost
          </h4>
          <p className="text-4xl sm:text-5xl font-bold text-[#0f172a] tabular-nums tracking-tight">
            ${displayTotal.toLocaleString()}
            <span className="text-xl font-normal text-slate-500 ml-1">/year</span>
          </p>

          <div className="pt-3 border-t border-slate-200/80 space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Team cost today: ${paymentModel === "coach" ? displayTotal.toLocaleString() : "250"} per year
            </p>
            {paymentModel === "players" && (
              <p className="text-sm text-slate-600">
                Players will each pay $10 when they create their accounts.
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Cost breakdown
            </p>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>Base program fee: ${breakdown.baseFee}</li>
              {paymentModel === "coach" && (
                <li>
                  Athletes: {breakdown.playerCount} × ${PER_ATHLETE} = $
                  {breakdown.players}
                </li>
              )}
              {breakdown.extraCoaches > 0 && (
                <li>
                  Extra coaches: {breakdown.extraCoaches} × ${PER_COACH} = $
                  {breakdown.coachCost}
                </li>
              )}
            </ul>
          </div>
        </div>

        <Link
          href={signupHref}
          className={cn(
            "block w-full text-center rounded-xl py-4 text-base font-semibold transition-all",
            "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-lg shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/30"
          )}
        >
          Start your program
        </Link>
      </div>
    </div>
  )
}
