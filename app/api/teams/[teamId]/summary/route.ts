import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teamId = params.teamId

    // Get team info
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: true,
        seasons: {
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
          take: 1, // Get most recent season
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Get current season (most recent)
    const currentSeason = team.seasons[0]

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
        const last = completedGames[0] // Already sorted by date desc
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

    // Get team slogan (default to "Go {Team Name}")
    const slogan = team.slogan || `Go ${team.name}`

    // Playoff status placeholder
    const playoffStatus = "TBD" // Will be calculated later

    return NextResponse.json({
      slogan,
      overallRecord: {
        wins: overallWins,
        losses: overallLosses,
      },
      conferenceRecord: {
        wins: conferenceWins,
        losses: conferenceLosses,
      },
      lastGame,
      nextGame,
      playoffStatus,
    })
  } catch (error: any) {
    console.error("Error fetching team summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch team summary" },
      { status: 500 }
    )
  }
}
