"use client"

import { PortalPageHeaderSurface } from "@/components/portal/portal-page-header"

interface UnifiedHeaderData {
  teamName: string
  slogan: string
  organizationName: string
  sport: string
  seasonName: string
  logoUrl?: string | null
  logoBackground?: string | null
  logoRemoveBackground?: boolean
  overallRecord: {
    wins: number
    losses: number
  }
  conferenceRecord: {
    wins: number
    losses: number
  }
  division?: string | null
  conference?: string | null
  playoffStatus?: string
}

interface UnifiedTeamHeaderProps {
  data: UnifiedHeaderData
}

export function UnifiedTeamHeader({ data }: UnifiedTeamHeaderProps) {
  const overallWinPct = data.overallRecord.wins + data.overallRecord.losses > 0
    ? ((data.overallRecord.wins / (data.overallRecord.wins + data.overallRecord.losses)) * 100).toFixed(1)
    : "0.0"

  const conferenceWinPct = data.conferenceRecord.wins + data.conferenceRecord.losses > 0
    ? ((data.conferenceRecord.wins / (data.conferenceRecord.wins + data.conferenceRecord.losses)) * 100).toFixed(1)
    : "0.0"

  const hasLogo = data.logoUrl && data.logoUrl.trim().length > 0

  return (
    <PortalPageHeaderSurface className="mb-6" contentClassName="px-5 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
      <div className="flex items-center justify-between flex-wrap gap-6">
        {/* LEFT: Team Name and Slogan */}
        <div className="flex-1 min-w-[250px]">
          <h1 className="text-5xl md:text-6xl font-athletic font-bold mb-3 tracking-wide text-foreground">
            {data.teamName.toUpperCase()}
          </h1>
          <p className="text-2xl md:text-3xl font-athletic font-medium mb-2 text-foreground">
            {data.slogan}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4 text-sm md:text-base text-muted-foreground">
            <span className="font-medium">{data.organizationName}</span>
            <span>•</span>
            <span className="uppercase font-semibold">{data.sport}</span>
            <span>•</span>
            <span>{data.seasonName}</span>
            {data.division && (
              <>
                <span>•</span>
                <span className="font-semibold">{data.division}</span>
              </>
            )}
            {data.conference && (
              <>
                <span>•</span>
                <span>{data.conference}</span>
              </>
            )}
          </div>
        </div>

        {/* CENTER: Records */}
        <div className="flex items-center gap-8 flex-wrap">
          {/* Overall Record */}
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-wide mb-1 text-muted-foreground">
              Overall
            </div>
            <div className="text-3xl font-athletic font-bold text-foreground">
              {data.overallRecord.wins}-{data.overallRecord.losses}
            </div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              {overallWinPct}%
            </div>
          </div>

          {/* Conference Record */}
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-wide mb-1 text-muted-foreground">
              Conference
            </div>
            <div className="text-3xl font-athletic font-bold text-foreground">
              {data.conferenceRecord.wins}-{data.conferenceRecord.losses}
            </div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              {conferenceWinPct}%
            </div>
          </div>

          {/* Division/Standing */}
          {(data.division || data.conference) && (
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wide mb-1 text-muted-foreground">
                {data.division ? "Division" : "Conference"}
              </div>
              <div className="text-xl font-athletic font-semibold text-foreground">
                {data.division || data.conference || "—"}
              </div>
            </div>
          )}

          {/* Playoff Status */}
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-wide mb-1 text-muted-foreground">
              Playoff Status
            </div>
            <div className="text-xl font-athletic font-semibold text-foreground">
              {data.playoffStatus || "TBD"}
            </div>
          </div>
        </div>

        {/* RIGHT: Logo */}
        <div className="flex-1 min-w-[150px] flex justify-end">
          {hasLogo ? (
            <div
              className={`w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden ${data.logoRemoveBackground ? "bg-transparent" : "bg-muted/30"}`}
            >
              <img
                src={data.logoUrl!}
                alt={`${data.teamName} logo`}
                className="max-w-full max-h-full object-contain"
                style={{
                  mixBlendMode: data.logoRemoveBackground ? "multiply" : "normal",
                }}
              />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/20">
              <span className="text-sm text-muted-foreground">No Logo</span>
            </div>
          )}
        </div>
      </div>
    </PortalPageHeaderSurface>
  )
}
