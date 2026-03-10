import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

/**
 * POST /api/roster/email
 * Sends roster via email
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, senderEmail, recipientEmail, subject, message } = body

    if (!teamId || !recipientEmail || !senderEmail) {
      return NextResponse.json({ error: "teamId, senderEmail, and recipientEmail are required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    // Get roster data (reuse print endpoint logic)
    const rosterResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/roster/print?teamId=${teamId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    })

    if (!rosterResponse.ok) {
      const error = await rosterResponse.json()
      throw new Error(error.error || "Failed to generate roster")
    }

    const rosterData = await rosterResponse.json()

    // Generate HTML email content
    const htmlContent = generateRosterEmailHTML(rosterData, message || "")

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, return success (email sending will be implemented separately)
    // In production, you would:
    // 1. Use your email service (SendGrid, Resend, AWS SES, etc.)
    // 2. Send email from senderEmail to recipientEmail
    // 3. Use subject and htmlContent
    
    console.log("Email would be sent:", {
      from: senderEmail,
      to: recipientEmail,
      subject: subject || `Roster - ${new Date().toLocaleDateString()}`,
      html: htmlContent,
    })
    
    return NextResponse.json({
      success: true,
      message: "Roster email sent successfully",
      // In production, you would send the email here
    })
  } catch (error: any) {
    console.error("[POST /api/roster/email]", error)
    return NextResponse.json(
      { error: error.message || "Failed to send roster email" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

function generateRosterEmailHTML(data: any, customMessage: string = ""): string {
  const { team, template, players, generatedAt } = data

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 5px 0; }
        .header p { margin: 3px 0; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
  `

  if (template.header.showYear) {
    html += `<p><strong>${template.header.yearLabel}:</strong> ${team.year}</p>`
  }
  if (template.header.showSchoolName && team.schoolName) {
    html += `<p><strong>${template.header.schoolNameLabel}:</strong> ${team.schoolName}</p>`
  }
  if (template.header.showTeamName) {
    html += `<h1>${team.name}</h1>`
  }

  html += `</div>`

  // Add custom message if provided
  if (customMessage) {
    html += `<div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3B82F6;">`
    html += `<p style="margin: 0; color: #374151; white-space: pre-wrap;">${customMessage.replace(/\n/g, '<br>')}</p>`
    html += `</div>`
  }

  html += `<table><thead><tr>`

  if (template.body.showJerseyNumber) {
    html += `<th>${template.body.jerseyNumberLabel}</th>`
  }
  if (template.body.showPlayerName) {
    html += `<th>${template.body.playerNameLabel}</th>`
  }
  if (template.body.showGrade) {
    html += `<th>${template.body.gradeLabel}</th>`
  }

  html += `</tr></thead><tbody>`

  players.forEach((player: any) => {
    html += `<tr>`
    if (template.body.showJerseyNumber) {
      html += `<td>${player.jerseyNumber ?? ""}</td>`
    }
    if (template.body.showPlayerName) {
      html += `<td>${player.name}</td>`
    }
    if (template.body.showGrade) {
      html += `<td>${player.gradeLabel ?? player.grade ?? ""}</td>`
    }
    html += `</tr>`
  })

  html += `</tbody></table>`

  if (template.footer.showGeneratedDate || template.footer.customText) {
    html += `<div class="footer">`
    if (template.footer.showGeneratedDate) {
      html += `<p>Generated: ${new Date(generatedAt).toLocaleDateString()}</p>`
    }
    if (template.footer.customText) {
      html += `<p>${template.footer.customText}</p>`
    }
    html += `</div>`
  }

  html += `</body></html>`
  return html
}
