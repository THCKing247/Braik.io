"use client"

interface CalendarSettings {
  id: string
  defaultView: string
  assistantsCanAddMeetings: boolean
  assistantsCanAddPractices: boolean
  assistantsCanEditNonlocked: boolean
  compactView: boolean
}

export function CalendarSettingsSection({
  teamId,
  initialSettings,
}: {
  teamId: string
  initialSettings: CalendarSettings | null
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Calendar</h2>
      <p className="text-sm text-white/80">Team: {teamId}</p>
      {initialSettings && (
        <p className="text-sm text-white/80 mt-2">View: {initialSettings.defaultView}</p>
      )}
    </div>
  )
}
