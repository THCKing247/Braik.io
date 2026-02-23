import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { requireBillingPermission } from "@/lib/billing-state"

// POST /api/ai/upload
// Handles file uploads for AI parsing (Excel, CSV, PDF, images)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const teamId = formData.get("teamId") as string

    if (!file || !teamId) {
      return NextResponse.json(
        { error: "File and teamId are required" },
        { status: 400 }
      )
    }

    // Verify user has access to team
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only coaches can upload files for AI parsing
    if (membership.role !== "HEAD_COACH" && membership.role !== "ASSISTANT_COACH") {
      return NextResponse.json(
        { error: "Only coaches can upload files for AI parsing" },
        { status: 403 }
      )
    }

    // Check billing state - AI is always premium
    await requireBillingPermission(teamId, "useAI", prisma)

    // Get team to check AI flags
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { aiEnabled: true, aiDisabledByPlatform: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    if (!team.aiEnabled) {
      return NextResponse.json(
        { error: "AI premium feature is not enabled for this season. Please purchase AI access." },
        { status: 403 }
      )
    }

    if (team.aiDisabledByPlatform) {
      return NextResponse.json(
        { error: "AI access has been disabled by Platform Owner. Please contact support." },
        { status: 403 }
      )
    }

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
      "application/pdf", // .pdf
      "image/png", // .png
      "image/jpeg", // .jpg, .jpeg
      "image/jpg", // .jpg
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Please upload Excel, CSV, PDF, or image files." },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      )
    }

    // In production, you would:
    // 1. Save the file to S3 or local storage
    // 2. Extract text using OCR (for images/PDFs) or parse (for Excel/CSV)
    // 3. Use AI to analyze and extract structured data
    // For now, we'll create a placeholder attachment record

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save file (in production, use proper file storage)
    const fileName = `${Date.now()}_${file.name}`
    const fileUrl = `/uploads/${fileName}` // Placeholder

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        teamId,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id,
        purpose: "ai_upload",
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      },
    })

    // In production, this would:
    // - Parse Excel/CSV to extract schedule data
    // - Use OCR for images/PDFs
    // - Use AI to identify event types, dates, times, locations
    // For now, return a placeholder response

    const extractedText = `File uploaded: ${file.name}\nType: ${file.type}\nSize: ${(file.size / 1024).toFixed(2)} KB\n\n[AI parsing will be available when OpenAI is configured]`

    return NextResponse.json({
      attachmentId: attachment.id,
      fileName: file.name,
      fileType: file.type,
      extractedText,
      preview: {
        message: "File uploaded successfully. AI parsing will be available when OpenAI is configured.",
        suggestedActions: [],
      },
    })
  } catch (error: any) {
    console.error("AI upload error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
