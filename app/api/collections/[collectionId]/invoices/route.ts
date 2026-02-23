import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const collectionType = searchParams.get("type")

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    // Verify user is head coach
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId: teamId,
        role: "HEAD_COACH",
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (collectionType === "roster-dues") {
      // Generate invoices for roster dues
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          players: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
              guardianLinks: {
                include: {
                  guardian: {
                    include: {
                      user: {
                        select: {
                          email: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const invoices = team.players.map((player, index) => {
        const amountPaid = team.subscriptionPaid ? team.duesAmount : 0
        const status: "paid" | "partial" | "unpaid" = 
          team.subscriptionPaid ? "paid" : "unpaid"

        return {
          id: `roster-dues-${player.id}`,
          playerName: `${player.firstName} ${player.lastName}`,
          payerName: player.guardianLinks[0]?.guardian?.user?.name || null,
          amountDue: team.duesAmount,
          amountPaid,
          status,
          date: team.duesDueDate?.toISOString() || new Date().toISOString(),
          invoiceId: `INV-${team.id.slice(0, 8)}-${index + 1}`,
        }
      })

      return NextResponse.json({ invoices })
    } else {
      // Get invoices for custom collection
      const collection = await prisma.coachPaymentCollection.findFirst({
        where: {
          id: params.collectionId,
          teamId: teamId,
        },
        include: {
          transactions: {
            include: {
              collection: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      })

      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 })
      }

      // For custom collections, we'll create invoice-like entries from transactions
      // In a real implementation, you'd have a proper Invoice model
      const invoices = await Promise.all(
        collection.transactions.map(async (transaction, index) => {
          let playerName = "Unknown"
          let payerName: string | null = null

          if (transaction.payerPlayerId) {
            const player = await prisma.player.findUnique({
              where: { id: transaction.payerPlayerId },
              include: {
                guardianLinks: {
                  include: {
                    guardian: {
                      include: {
                        user: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
            if (player) {
              playerName = `${player.firstName} ${player.lastName}`
              payerName = player.guardianLinks[0]?.guardian?.user?.name || null
            }
          }

          const status: "paid" | "partial" | "unpaid" =
            transaction.status === "completed"
              ? "paid"
              : transaction.status === "pending"
              ? "partial"
              : "unpaid"

          return {
            id: transaction.id,
            playerName,
            payerName,
            amountDue: collection.amount,
            amountPaid: transaction.amount,
            status,
            date: transaction.createdAt.toISOString(),
            invoiceId: `INV-${collection.id.slice(0, 8)}-${index + 1}`,
          }
        })
      )

      return NextResponse.json({ invoices })
    }
  } catch (error) {
    console.error("Get invoices error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
