import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getProposal } from "@/lib/braik-ai/action-proposal-store"
import { executeStoredProposal } from "@/lib/braik-ai/execute-confirmed-proposal"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/ai/confirm-action?proposalId=
 * Returns proposal details for the confirmation card.
 */
export async function GET(request: Request) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proposalId = new URL(request.url).searchParams.get("proposalId")?.trim()
  if (!proposalId) {
    return NextResponse.json({ error: "proposalId is required" }, { status: 400 })
  }

  const proposal = getProposal(proposalId)
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found or expired" }, { status: 404 })
  }
  if (proposal.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = getSupabaseServer()
  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", proposal.userId)
    .maybeSingle()
  const email = (prof as { email?: string } | null)?.email ?? session.user.email ?? ""
  const name = (prof as { full_name?: string } | null)?.full_name?.trim() ?? null

  return NextResponse.json({
    proposal: {
      id: proposal.id,
      actionType: proposal.actionType,
      payload: proposal.payload,
      preview: proposal.preview,
      status: proposal.status,
      createdAt: proposal.createdAt,
      createdBy: { name, email },
    },
  })
}

/**
 * POST /api/ai/confirm-action
 * Body: { proposalId, idempotencyKey? }
 */
export async function POST(request: Request) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { proposalId?: string; idempotencyKey?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const proposalId = typeof body.proposalId === "string" ? body.proposalId.trim() : ""
  if (!proposalId) {
    return NextResponse.json({ error: "proposalId is required" }, { status: 400 })
  }

  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : null

  console.log("[POST /api/ai/confirm-action]", { proposalId, userId: session.user.id, idempotencyKey })

  const exec = await executeStoredProposal(proposalId, { idempotencyKey, incomingRequest: request })
  if (!exec.success) {
    console.warn("[POST /api/ai/confirm-action] execution failed", { proposalId, message: exec.message })
    return NextResponse.json({ success: false, message: exec.message ?? "Failed" }, { status: 400 })
  }

  console.log("[POST /api/ai/confirm-action] execution success", {
    proposalId,
    message: exec.message,
    executed: exec.executed,
  })

  return NextResponse.json({
    success: true,
    message: exec.message,
    executedItems: exec.executed ? [exec.executed] : [],
  })
}
