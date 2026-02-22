import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 })
    }

    const { teamId, intent, input } = await request.json()

    // Get team context for reminders
    let context = ""
    if (intent === "reminders") {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          players: {
            include: {
              payments: {
                where: { status: { not: "completed" } },
              },
            },
          },
        },
      })

      if (team) {
        const unpaidCount = team.players.filter((p) => !p.payments.some((pay) => pay.status === "completed")).length
        context = `Team: ${team.name}. Unpaid players: ${unpaidCount}. Dues amount: $${team.duesAmount}. Due date: ${team.duesDueDate ? new Date(team.duesDueDate).toLocaleDateString() : "Not set"}.`
      }
    }

    let systemPrompt = ""
    let userPrompt = ""

    switch (intent) {
      case "draft":
        systemPrompt = "You are a helpful assistant for sports team coaches. Draft clear, professional messages for team communications."
        userPrompt = `Draft a message about: ${input}`
        break
      case "summarize":
        systemPrompt = "You are a helpful assistant. Summarize the following content into clear bullet points."
        userPrompt = input
        break
      case "reminders":
        systemPrompt = "You are a helpful assistant for sports team coaches. Generate reminders based on team data. Be specific and actionable."
        userPrompt = `${context}\n\nGenerate reminders for: ${input}`
        break
      default:
        return NextResponse.json({ error: "Invalid intent" }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
    })

    const output = completion.choices[0]?.message?.content || "No response generated"

    return NextResponse.json({ output })
  } catch (error: any) {
    console.error("AI Assistant error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

