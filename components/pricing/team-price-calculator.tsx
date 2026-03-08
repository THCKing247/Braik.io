"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const BASE_FEE = 250
const PER_ATHLETE = 10
const MIN_ANNUAL = 350
const INCLUDED_COACHES = 3
const PER_EXTRA_COACH = 10

type PaymentModel = "coach" | "players"

export function TeamPriceCalculator() {
  const [rosterSize, setRosterSize] = useState(40)
  const [assistantCoaches, setAssistantCoaches] = useState(3)
  const [paymentModel, setPaymentModel] = useState<PaymentModel>("coach")

  const rosterClamped = Math.min(200, Math.max(1, rosterSize))
  const coachesClamped = Math.max(0, assistantCoaches)

  const result = useMemo(() => {
    const roster = rosterClamped
    const coaches = coachesClamped
    const extraCoaches = Math.max(0, coaches - INCLUDED_COACHES)

    if (paymentModel === "coach") {
      const playerCost = roster * PER_ATHLETE
      let teamTotal = BASE_FEE + playerCost
      if (teamTotal < MIN_ANNUAL) teamTotal = MIN_ANNUAL
      const coachCost = extraCoaches * PER_EXTRA_COACH
      const total = teamTotal + coachCost
      return {
        paymentModel: "coach" as const,
        teamTotal,
        coachCost,
        total,
        breakdown: {
          baseFee: BASE_FEE,
          playerCost,
          playerCount: roster,
          extraCoaches,
          coachCost,
        },
      }
    } else {
      const coachCost = extraCoaches * PER_EXTRA_COACH
      const total = BASE_FEE + coachCost
      return {
        paymentModel: "players" as const,
        total,
        baseFee: BASE_FEE,
        extraCoaches,
        coachCost,
        playerCount: roster,
      }
    }
  }, [rosterClamped, coachesClamped, paymentModel])

  const handleRosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value === "" ? 1 : parseInt(e.target.value, 10)
    if (Number.isNaN(raw)) setRosterSize(1)
    else setRosterSize(Math.min(200, Math.max(1, raw)))
  }

  const handleCoachesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value === "" ? 0 : parseInt(e.target.value, 10)
    if (Number.isNaN(raw)) setAssistantCoaches(0)
    else setAssistantCoaches(Math.max(0, raw))
  }

  const signupHref = `/signup?roster=${rosterClamped}&coaches=${coachesClamped}&payment=${paymentModel}`

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

      <div className="space-y-6">
        <div>
          <Label htmlFor="roster-size" className="text-[#FFFFFF] font-medium">
            Roster Size
          </Label>
          <Input
            id="roster-size"
            type="number"
            min={1}
            max={200}
            value={rosterSize}
            onChange={handleRosterChange}
            onBlur={() => setRosterSize((v) => Math.min(200, Math.max(1, v)))}
            className="mt-2 max-w-[8rem] bg-white/10 border-white/30 text-white placeholder:text-white/60"
          />
        </div>

        <div>
          <Label htmlFor="assistant-coaches" className="text-[#FFFFFF] font-medium">
            Assistant Coaches
          </Label>
          <Input
            id="assistant-coaches"
            type="number"
            min={0}
            value={assistantCoaches}
            onChange={handleCoachesChange}
            onBlur={() => setAssistantCoaches((v) => Math.max(0, v))}
            className="mt-2 max-w-[8rem] bg-white/10 border-white/30 text-white placeholder:text-white/60"
          />
          <p className="text-sm text-white/70 mt-1">3 included; extra at $10 each</p>
        </div>

        <div>
          <Label className="text-[#FFFFFF] font-medium block mb-3">Payment Model</Label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="payment-model"
                checked={paymentModel === "coach"}
                onChange={() => setPaymentModel("coach")}
                className="w-4 h-4 accent-[#3B82F6]"
              />
              <span className="text-[#FFFFFF]">Coach pays for players</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
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

      <div className="pt-4 border-t border-white/20">
        <h4 className="text-lg font-semibold text-[#FFFFFF] mb-2">Estimated Annual Cost</h4>
        {result.paymentModel === "coach" ? (
          <>
            <p className="text-2xl font-semibold text-[#FFFFFF] mb-4">
              Team Cost Today: ${result.total.toLocaleString()} per year
            </p>
            <ul className="text-[#FFFFFF] space-y-1 text-sm">
              <li>Base Program Fee: ${result.breakdown.baseFee}</li>
              <li>
                Players: {result.breakdown.playerCount} × $10 = $
                {result.breakdown.playerCost}
              </li>
              {result.breakdown.extraCoaches > 0 && (
                <li>
                  Assistant Coaches: {result.breakdown.extraCoaches} × $10 = $
                  {result.breakdown.coachCost}
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-[#FFFFFF] mb-2">
              Team Cost Today: ${result.total.toLocaleString()}
            </p>
            <p className="text-[#FFFFFF]/90 text-sm">
              Players will pay $10 each when they create their accounts. ({result.playerCount}{" "}
              players × $10 = ${(result.playerCount * 10).toLocaleString()} total)
            </p>
            {result.extraCoaches > 0 && (
              <p className="text-[#FFFFFF]/90 text-sm mt-1">
                Extra assistant coaches: {result.extraCoaches} × $10 = ${result.coachCost}
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <Button asChild variant="default" size="lg" className="w-full sm:w-auto">
          <Link href={signupHref}>Start Your Program</Link>
        </Button>
      </div>
    </div>
  )
}
