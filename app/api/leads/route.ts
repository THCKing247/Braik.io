import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

type LeadPayload = {
  name: string
  email: string
  phone?: string
  school?: string
  role?: string
  message?: string
}

async function sendLeadConfirmationEmail(email: string, name: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || "Braik <noreply@apextsgroup.com>"
  if (!apiKey) return

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Braik Demo Request Received",
      html: `<p>Hi ${name || "there"},</p>
             <p>Thanks for requesting a Braik demo. Our team received your request and will follow up shortly.</p>
             <p>- Braik Team</p>`,
    }),
  })
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LeadPayload
    if (!payload?.name || !payload?.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
    }

    const { error } = await supabase.from("leads").insert({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      school: payload.school?.trim() || null,
      role: payload.role?.trim() || null,
      message: payload.message?.trim() || null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Optional but useful confirmation email.
    await sendLeadConfirmationEmail(payload.email, payload.name).catch((emailError) => {
      console.error("Lead confirmation email error:", emailError)
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Lead capture error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
