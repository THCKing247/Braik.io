import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CalendarWidget } from "@/components/calendar-widget"
import { UpdatesFeed } from "@/components/updates-feed"
import { RemindersFeed } from "@/components/reminders-feed"
import { AnnouncementsFeed } from "@/components/announcements-feed"
import { AIAssistantCard } from "@/components/ai-assistant-card"
import { UnifiedTeamHeader } from "@/components/unified-team-header"
import { TeamIdDisplay } from "@/components/team-id-display"
import { getUnitForPositionGroup, getCoordinatorType, getCoordinatorUnit } from "@/lib/calendar-hierarchy"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session?.user?.role || !session?.user?.teamId) {
    redirect("/login")
  }

  const userRole = session.user.role
  const teamId = session.user.teamId

  // Get the team and membership info
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: session.user.id,
        teamId: teamId,
      },
    },
    include: {
      team: {
        include: {
          organization: true,
          calendarSettings: true,
          players: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jerseyNumber: true,
            },
            orderBy: [
              { lastName: "asc" },
              { firstName: "asc" },
            ],
          },
        },
      },
    },
  })

  if (!membership) {
    redirect("/login")
  }

  const primaryTeam = membership.team

  // Get calendar events (next 30 days) with proper role-scoped filtering
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 30)

  // Base query with visibility filter
  const baseWhere: any = {
    teamId: teamId,
    start: {
      gte: startDate,
      lte: endDate,
    },
  }

  // Apply visibility filter based on role
  if (userRole === "PLAYER" || userRole === "PARENT") {
    baseWhere.visibility = {
      in: ["TEAM", "PARENTS_AND_TEAM"],
    }
  } else if (userRole === "ASSISTANT_COACH") {
    baseWhere.visibility = {
      in: ["COACHES_ONLY", "TEAM", "PARENTS_AND_TEAM"],
    }
  }
  // HEAD_COACH sees all visibility levels (no filter)

  // Fetch all potentially relevant events
  let events = await prisma.event.findMany({
    where: baseWhere,
    select: {
      id: true,
      eventType: true,
      title: true,
      start: true,
      end: true,
      location: true,
      color: true,
      highlight: true,
      visibility: true,
      scopedPlayerIds: true,
      scopedPositionGroups: true,
      scopedUnit: true,
      coordinatorType: true,
      createdBy: true,
    },
    orderBy: { start: "asc" },
  })

  // Apply hierarchical scoping filters in memory (per BRAIK_MASTER_INTENT.md)
  if (userRole === "HEAD_COACH") {
    // Head Coach sees all events (no filtering needed)
  } else if (userRole === "PARENT") {
    // Parents can only view Head Coach events (no scoping)
    const headCoachUsers = await prisma.membership.findMany({
      where: {
        teamId,
        role: "HEAD_COACH",
      },
      select: { userId: true },
    })
    const headCoachUserIds = new Set(headCoachUsers.map((m) => m.userId))
    
    events = events.filter((event) => {
      // Must be created by Head Coach
      if (!headCoachUserIds.has(event.createdBy)) return false
      // Must have no scoping (entire program events)
      return (
        !event.scopedUnit &&
        !event.scopedPositionGroups &&
        !event.scopedPlayerIds
      )
    })
  } else if (userRole === "PLAYER") {
    // Players see events scoped to them
    const player = await prisma.player.findFirst({
      where: {
        teamId,
        userId: session.user.id,
      },
      select: {
        id: true,
        positionGroup: true,
      },
    })
    
    if (!player) {
      events = []
    } else {
      const playerUnit = getUnitForPositionGroup(player.positionGroup)
      
      events = events.filter((event) => {
        // Events with no scoping (Head Coach events for entire program)
        if (
          !event.scopedUnit &&
          !event.scopedPositionGroups &&
          !event.scopedPlayerIds
        ) {
          return true
        }
        
        // Events scoped to player's unit
        if (playerUnit && event.scopedUnit === playerUnit) {
          return true
        }
        
        // Events scoped to player's position group
        if (player.positionGroup && event.scopedPositionGroups) {
          const scopedGroups = event.scopedPositionGroups as string[]
          if (Array.isArray(scopedGroups) && scopedGroups.includes(player.positionGroup)) {
            return true
          }
        }
        
        // Events specifically scoped to this player
        if (event.scopedPlayerIds) {
          const scopedIds = event.scopedPlayerIds as string[]
          if (Array.isArray(scopedIds) && scopedIds.includes(player.id)) {
            return true
          }
        }
        
        return false
      })
    }
  } else if (userRole === "ASSISTANT_COACH") {
    // Assistant coaches see events based on their scope
    const coordinatorType = getCoordinatorType({ permissions: membership.permissions })
    const positionGroups = membership.positionGroups as string[] | null
    
    if (coordinatorType) {
      // Coordinator sees events for their unit
      const coordinatorUnit = getCoordinatorUnit(coordinatorType)
      
      events = events.filter((event) => {
        // Events with no scoping (Head Coach events)
        if (
          !event.scopedUnit &&
          !event.scopedPositionGroups &&
          !event.scopedPlayerIds
        ) {
          return true
        }
        // Events scoped to their unit
        return event.scopedUnit === coordinatorUnit
      })
    } else if (positionGroups && positionGroups.length > 0) {
      // Position coach sees events for their position groups
      const positionGroupSet = new Set(positionGroups)
      
      events = events.filter((event) => {
        // Events with no scoping (Head Coach events)
        if (
          !event.scopedUnit &&
          !event.scopedPositionGroups &&
          !event.scopedPlayerIds
        ) {
          return true
        }
        // Events scoped to their position groups
        if (event.scopedPositionGroups) {
          const scopedGroups = event.scopedPositionGroups as string[]
          if (Array.isArray(scopedGroups)) {
            return scopedGroups.some((pg) => positionGroupSet.has(pg))
          }
        }
        return false
      })
    }
    // Assistant coach with no position groups - see all (shouldn't happen)
  }

  // Get updates feed
  const updates = await prisma.updatesFeed.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  // Get announcements filtered by audience
  let announcementsWhere: any = { teamId }
  
  // Filter announcements by audience field
  if (userRole === "PLAYER") {
    announcementsWhere.audience = {
      in: ["all", "players"],
    }
  } else if (userRole === "PARENT") {
    announcementsWhere.audience = {
      in: ["all", "parents"],
    }
  } else if (userRole === "HEAD_COACH" || userRole === "ASSISTANT_COACH") {
    announcementsWhere.audience = {
      in: ["all", "staff"],
    }
  }
  // Platform owners and other roles see "all" only (handled by default)

  const announcements = await prisma.announcement.findMany({
    where: announcementsWhere,
    include: {
      creator: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  // Calculate team summary data directly from database
  // Handle case where Season model might not exist or no seasons yet
  let currentSeason = null
  try {
    currentSeason = await prisma.season.findFirst({
      where: { teamId },
      include: {
        games: {
          where: {
            confirmedByCoach: true,
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: {
        year: "desc",
      },
    })
  } catch (error) {
    // Season model might not be available yet, use empty data
    console.log("Season model not available or no seasons found")
  }

  // Calculate records from confirmed games only
  let overallWins = 0
  let overallLosses = 0
  let conferenceWins = 0
  let conferenceLosses = 0
  let lastGame = null
  let nextGame = null

  if (currentSeason) {
    const confirmedGames = currentSeason.games.filter(
      (game) => game.confirmedByCoach && game.result !== null
    )

    // Calculate overall record
    confirmedGames.forEach((game) => {
      if (game.result === "win") {
        overallWins++
        if (game.conferenceGame) {
          conferenceWins++
        }
      } else if (game.result === "loss") {
        overallLosses++
        if (game.conferenceGame) {
          conferenceLosses++
        }
      }
    })

    // Get last completed game
    const completedGames = confirmedGames.filter(
      (game) => game.result !== null && game.teamScore !== null && game.opponentScore !== null
    )
    if (completedGames.length > 0) {
      const last = completedGames[0]
      lastGame = {
        date: last.date.toISOString(),
        opponent: last.opponent,
        result: last.result || "",
        teamScore: last.teamScore || 0,
        opponentScore: last.opponentScore || 0,
      }
    }

    // Get next upcoming game
    const upcomingGames = currentSeason.games.filter(
      (game) => game.confirmedByCoach && game.result === null && new Date(game.date) > new Date()
    )
    if (upcomingGames.length > 0) {
      const next = upcomingGames.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0]
      nextGame = {
        date: next.date.toISOString(),
        opponent: next.opponent,
        homeAway: next.homeAway,
      }
    }
  }

  // Get calendar settings
  const calendarSettings = primaryTeam.calendarSettings || {
    defaultView: "week",
  }

  // Dashboard calendar is read-only per section 15.3 (Dashboard Model)
  // Editing must be done from the Schedule page
  const canEdit = false

  // Prepare unified header data
  const unifiedHeaderData = {
    teamName: primaryTeam.name,
    slogan: primaryTeam.slogan || `Go ${primaryTeam.name}`,
    organizationName: primaryTeam.organization.name,
    sport: primaryTeam.sport,
    seasonName: primaryTeam.seasonName,
    logoUrl: primaryTeam.logoUrl,
    logoBackground: null, // Logos don't affect UI colors
    logoRemoveBackground: false, // Will be added to schema later
    overallRecord: {
      wins: overallWins,
      losses: overallLosses,
    },
    conferenceRecord: {
      wins: conferenceWins,
      losses: conferenceLosses,
    },
    division: currentSeason?.division || null, // Division/standing from season
    conference: currentSeason?.conference || null, // Conference from season
    playoffStatus: "TBD",
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Unified Team Header */}
      <UnifiedTeamHeader data={unifiedHeaderData} />

      {/* Team ID Display - Head Coach Only */}
      {userRole === "HEAD_COACH" && "teamIdCode" in primaryTeam && (primaryTeam as any).teamIdCode && (
        <TeamIdDisplay
          teamIdCode={(primaryTeam as any).teamIdCode || ""}
          players={(primaryTeam.players || []).map((p: any) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            jerseyNumber: p.jerseyNumber,
            uniqueCode: p.uniqueCode || null,
          }))}
          teamId={teamId}
        />
      )}

      {/* Main Content */}
      <div className="space-y-6">
        {/* Calendar - Full Width */}
        {/* Dashboard calendar is read-only per section 15.3 (Dashboard Model) - no editing from dashboard */}
        {/* Navigation to Schedule page for editing is handled by CalendarWidget component */}
        <CalendarWidget
          teamId={teamId}
          events={events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            title: e.title,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
            location: e.location || undefined,
            color: e.color || undefined,
            highlight: e.highlight,
          }))}
          canEdit={false}
          defaultView={calendarSettings.defaultView as "day" | "week" | "month"}
        />

        {/* Recent Updates and Announcements - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UpdatesFeed
            updates={updates.map((u) => ({
              id: u.id,
              type: u.type,
              title: u.title,
              description: u.description || undefined,
              linkUrl: u.linkUrl || undefined,
              linkType: u.linkType || undefined,
              linkId: u.linkId || undefined,
              urgency: u.urgency,
              createdAt: u.createdAt.toISOString(),
            }))}
          />

          <AnnouncementsFeed
            announcements={announcements.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              audience: a.audience,
              createdAt: a.createdAt.toISOString(),
              creator: {
                name: a.creator.name,
                email: a.creator.email,
              },
            }))}
          />
        </div>
      </div>
    </div>
  )
}
