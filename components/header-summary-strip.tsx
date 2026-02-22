"use client"

import { Card, CardContent } from "@/components/ui/card"

interface HeaderSummaryData {
  slogan: string
  overallRecord: {
    wins: number
    losses: number
  }
  conferenceRecord: {
    wins: number
    losses: number
  }
  lastGame?: {
    date: string
    opponent: string
    result: string
    teamScore: number
    opponentScore: number
  }
  nextGame?: {
    date: string
    opponent: string
    homeAway: string
  }
  playoffStatus?: string
}

interface HeaderSummaryStripProps {
  data: HeaderSummaryData
}

export function HeaderSummaryStrip({ data }: HeaderSummaryStripProps) {
  const overallWinPct = data.overallRecord.wins + data.overallRecord.losses > 0
    ? ((data.overallRecord.wins / (data.overallRecord.wins + data.overallRecord.losses)) * 100).toFixed(1)
    : "0.0"

  const conferenceWinPct = data.conferenceRecord.wins + data.conferenceRecord.losses > 0
    ? ((data.conferenceRecord.wins / (data.conferenceRecord.wins + data.conferenceRecord.losses)) * 100).toFixed(1)
    : "0.0"

  return (
    <Card className="border-2 border-[#CBD5E1] bg-[#FFFFFF] mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-6">
          {/* LEFT: Team Slogan */}
          <div className="flex-1 min-w-[200px]">
            <p className="text-lg font-athletic font-semibold uppercase text-[#111827] tracking-wide">
              {data.slogan}
            </p>
          </div>

          {/* CENTER: Records */}
          <div className="flex items-center gap-8 flex-wrap">
            {/* Overall Record */}
            <div className="text-center">
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-1">
                Overall
              </div>
              <div className="text-2xl font-athletic font-bold text-[#111827]">
                {data.overallRecord.wins}-{data.overallRecord.losses}
              </div>
              <div className="text-xs text-[#475569] mt-0.5">
                {overallWinPct}%
              </div>
            </div>

            {/* Conference Record */}
            <div className="text-center">
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-1">
                Conference
              </div>
              <div className="text-2xl font-athletic font-bold text-[#111827]">
                {data.conferenceRecord.wins}-{data.conferenceRecord.losses}
              </div>
              <div className="text-xs text-[#475569] mt-0.5">
                {conferenceWinPct}%
              </div>
            </div>

            {/* Playoff Status */}
            <div className="text-center">
              <div className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-1">
                Playoff Status
              </div>
              <div className="text-lg font-athletic font-semibold text-[#111827]">
                {data.playoffStatus || "TBD"}
              </div>
            </div>
          </div>

          {/* RIGHT: Last/Next Game (optional) */}
          {(data.lastGame || data.nextGame) && (
            <div className="flex-1 min-w-[200px] text-right">
              {data.lastGame && (
                <div className="mb-2">
                  <div className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-1">
                    Last Game
                  </div>
                  <div className="text-sm font-medium text-[#111827]">
                    {data.lastGame.result === "win" ? "W" : "L"} {data.lastGame.teamScore}-{data.lastGame.opponentScore} vs {data.lastGame.opponent}
                  </div>
                </div>
              )}
              {data.nextGame && (
                <div>
                  <div className="text-xs font-medium text-[#475569] uppercase tracking-wide mb-1">
                    Next Game
                  </div>
                  <div className="text-sm font-medium text-[#111827]">
                    {data.nextGame.homeAway === "home" ? "vs" : "@"} {data.nextGame.opponent}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
