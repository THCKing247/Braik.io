"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const BASE_FEE = 250
const PER_ATHLETE = 10
const MIN_ANNUAL = 350
const INCLUDED_COACHES = 3
const PER_COACH = 10
const MAX_ROSTER = 200
const MIN_ROSTER = 1

type PaymentModel = "coach" | "players"

export function TeamPriceCalculator() {
  const [rosterSize, setRosterSize] = useState(40)
  const [assistantCoaches, setAssistantCoaches] = useState(3)
  const [paymentModel, setPaymentModel] = useState<PaymentModel>("coach")

  const clampedRoster = useMemo(
    () => Math.min(MAX_ROSTER, Math.max(MIN_ROSTER, rosterSize)),
    [rosterSize]
  )
  const clampedCoaches = useMemo(
    () => Math.max(0, Math.floor(assistantCoaches)),
    [assistantCoaches]
  )

  const { total, breakdown } = useMemo(() => {
    const extraCoaches = Math.max(0, clampedCoaches - INCLUDED_COACHES)
    const coachCost = extraCoaches * PER_COACH

    if (paymentModel === "coach") {
      const playerCostCalc = clampedRoster * PER_ATHLETE
      const teamTotalCalc = Math.max(
        MIN_ANNUAL,
        BASE_FEE + playerCostCalc
      )
      const totalCalc = teamTotalCalc + coachCost
      return {
        total: totalCalc,
        breakdown: {
          baseFee: BASE_FEE,
          players: playerCostCalc,
          playerCount: clampedRoster,
          extraCoaches,
          coachCost,
        },
      }
    }

    return {
      total: BASE_FEE + coachCost,
      breakdown: {
        baseFee: BASE_FEE,
        players: 0,
        playerCount: clampedRoster,
        extraCoaches,
        coachCost,
      },
    }
  }, [paymentModel, clampedRoster, clampedCoaches])

  const signupHref = `/signup?roster=${clampedRoster}&payment=${paymentModel}`

  return (
    <div
      className="p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF] space-y-8"
      style={{
        backgroundColor: "rgba(28, 28, 28, 0.9)",
        backdropFilter: "blur(6px)",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="roster-size" className="text-[#FFFFFF]">
            Roster Size
          </Label>
          <Input
            id="roster-size"
            type="number"
            min={MIN_ROSTER}
            max={MAX_ROSTER}
            value={rosterSize}
            onChange={(e) => {
              const v = e.target.value === "" ? MIN_ROSTER : parseInt(e.target.value, 10)
              if (!Number.isNaN(v)) setRosterSize(Math.min(MAX_ROSTER, Math.max(MIN_ROSTER, v)))
            }}
            className="bg-[#1a1a1a] border-[#3B82F6]/50 text-[#FFFFFF]"
          />
          <p className="text-sm text-[#FFFFFF]/70">
            {MIN_ROSTER}–{MAX_ROSTER} athletes
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistant-coaches" className="text-[#FFFFFF]">
            Assistant Coaches
          </Label>
          <Input
            id="assistant-coaches"
            type="number"
            min={0}
            value={assistantCoaches}
            onChange={(e) => {
              const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10)
              if (!Number.isNaN(v) && v >= 0) setAssistantCoaches(v)
            }}
            className="bg-[#1a1a1a] border-[#3B82F6]/50 text-[#FFFFFF]"
          />
          <p className="text-sm text-[#FFFFFF]/70">
            3 included, $10 each additional
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-[#FFFFFF]">Payment Model</Label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="payment-model"
                checked={paymentModel === "coach"}
                onChange={() => setPaymentModel("coach")}
                className="w-4 h-4 accent-[#3B82F6]"
              />
              <span className="text-[#FFFFFF]">Coach pays for players</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="payment-model"
                checked={paymentModel === "players"}
                onChange={() => setPaymentModel("players")}
                className="w-4 h-4 accent-[#3B82F6]"
              />
              <span className="text-[#FFFFFF]">Players pay individually</span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-[#1a1a1a]/80 p-6 space-y-4 border border-[#3B82F6]/20">
        <h4 className="text-lg font-semibold text-[#FFFFFF]">
          Estimated Annual Cost
        </h4>

        {paymentModel === "coach" ? (
          <>
            <p className="text-2xl font-semibold text-[#3B82F6]">
              Team Cost Today: ${total.toLocaleString()} per year
            </p>
            <ul className="text-[#FFFFFF]/90 space-y-1 text-sm">
              <li>Base Program Fee: ${breakdown.baseFee}</li>
              <li>
                Players: {breakdown.playerCount} × ${PER_ATHLETE} = $
                {breakdown.players}
              </li>
              {breakdown.extraCoaches > 0 && (
                <li>
                  Assistant Coaches: {breakdown.extraCoaches} × ${PER_COACH} = $
                  {breakdown.coachCost}
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-[#3B82F6]">
              Team Cost Today: ${total.toLocaleString()} per year
            </p>
            <p className="text-[#FFFFFF]/90">
              Players will pay $10 each when they create their accounts.
            </p>
            {breakdown.extraCoaches > 0 && (
              <p className="text-sm text-[#FFFFFF]/80">
                Additional assistant coaches: {breakdown.extraCoaches} × $
                {PER_COACH} = ${breakdown.coachCost}
              </p>
            )}
          </>
        )}
      </div>

      <Link
        href={signupHref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold",
          "bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors"
        )}
      >
        Start Your Program
      </Link>
    </div>
  )
}
