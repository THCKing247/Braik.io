"use client"

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

  return (
    <div 
      className="rounded-xl p-8 shadow-sm border mb-6"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "rgb(var(--border))",
        borderWidth: "1px",
        borderRadius: "12px",
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-6">
        {/* LEFT: Team Name and Slogan */}
        <div className="flex-1 min-w-[250px]">
          <h1 className="text-5xl md:text-6xl font-athletic font-bold mb-3 tracking-wide" style={{ color: "rgb(var(--text))" }}>
            {data.teamName.toUpperCase()}
          </h1>
          <p className="text-2xl md:text-3xl font-athletic font-medium mb-2" style={{ color: "rgb(var(--text))" }}>
            {data.slogan}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4 text-sm md:text-base" style={{ color: "rgb(var(--text2))" }}>
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
            <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "rgb(var(--muted))" }}>
              Overall
            </div>
            <div className="text-3xl font-athletic font-bold" style={{ color: "rgb(var(--text))" }}>
              {data.overallRecord.wins}-{data.overallRecord.losses}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgb(var(--muted))" }}>
              {overallWinPct}%
            </div>
          </div>

          {/* Conference Record */}
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "rgb(var(--muted))" }}>
              Conference
            </div>
            <div className="text-3xl font-athletic font-bold" style={{ color: "rgb(var(--text))" }}>
              {data.conferenceRecord.wins}-{data.conferenceRecord.losses}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgb(var(--muted))" }}>
              {conferenceWinPct}%
            </div>
          </div>

          {/* Division/Standing */}
          {(data.division || data.conference) && (
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "rgb(var(--muted))" }}>
                {data.division ? "Division" : "Conference"}
              </div>
              <div className="text-xl font-athletic font-semibold" style={{ color: "rgb(var(--text))" }}>
                {data.division || data.conference || "—"}
              </div>
            </div>
          )}

          {/* Playoff Status */}
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "rgb(var(--muted))" }}>
              Playoff Status
            </div>
            <div className="text-xl font-athletic font-semibold" style={{ color: "rgb(var(--text))" }}>
              {data.playoffStatus || "TBD"}
            </div>
          </div>
        </div>

        {/* RIGHT: Logo */}
        <div className="flex-1 min-w-[150px] flex justify-end">
          {data.logoUrl ? (
            <div
              className="w-32 h-32 rounded-lg flex items-center justify-center overflow-hidden"
              style={{
                backgroundColor: data.logoRemoveBackground ? "transparent" : "#FFFFFF",
              }}
            >
              <img
                src={data.logoUrl}
                alt={`${data.teamName} logo`}
                className="max-w-full max-h-full object-contain"
                style={{
                  mixBlendMode: data.logoRemoveBackground ? "multiply" : "normal",
                }}
              />
            </div>
          ) : (
            <div 
              className="w-32 h-32 rounded-lg border border-dashed flex items-center justify-center"
              style={{ borderColor: "rgb(var(--focus))", color: "rgb(var(--muted))" }}
            >
              <span className="text-sm">No Logo</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
