import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { getRequestClientIp } from "@/lib/http/request-client-ip"

type ADSignupBody = {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  schoolName?: string
  schoolType?: string
  mascot?: string
  city?: string
  state?: string
  estimatedTeamCount?: number
  estimatedAthleteCount?: number
  phone?: string
  website?: string
  conferenceDistrict?: string
  interestedInDemo?: boolean
  smsOptIn?: boolean
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null

  let body: ADSignupBody
  try {
    body = (await request.json()) as ADSignupBody
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    )
  }

  try {
    const firstName = asNonEmptyString(body.firstName)
    const lastName = asNonEmptyString(body.lastName)
    const email = asNonEmptyString(body.email)?.toLowerCase() ?? null
    const password = asNonEmptyString(body.password)
    const schoolName = asNonEmptyString(body.schoolName)
    const schoolType = asNonEmptyString(body.schoolType)
    const mascot = asNonEmptyString(body.mascot)
    const city = asNonEmptyString(body.city)
    const state = asNonEmptyString(body.state)
    const phone = asNonEmptyString(body.phone)
    const website = asNonEmptyString(body.website)
    const conferenceDistrict = asNonEmptyString(body.conferenceDistrict)
    const estimatedTeamCount =
      typeof body.estimatedTeamCount === "number" ? body.estimatedTeamCount : null
    const estimatedAthleteCount =
      typeof body.estimatedAthleteCount === "number" ? body.estimatedAthleteCount : null
    const smsOptIn = body.smsOptIn === true

    if (!firstName || !lastName || !email || !password || !schoolName || !schoolType) {
      return NextResponse.json(
        { error: "Missing required fields: first name, last name, email, password, school name, and school type are required." },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      )
    }

    if (phone && !smsOptIn) {
      return NextResponse.json(
        {
          error:
            "When you add a mobile number, please agree to transactional SMS messages from Braik or leave the phone field blank.",
        },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      )
    }

    const fullName = `${firstName} ${lastName}`.trim()

    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        fullName,
        role: "athletic_director",
        schoolName,
        schoolType,
      },
    })

    if (createAuthError || !authData.user) {
      const msg = (createAuthError?.message ?? "").toLowerCase()
      if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: createAuthError?.message ?? "Failed to create account." },
        { status: 400 }
      )
    }

    createdAuthUserId = authData.user.id

    const baseSlug = slugFromName(schoolName)
    let slug = baseSlug
    let slugSuffix = 0
    for (;;) {
      const { data: existing } = await supabase.from("schools").select("id").eq("slug", slug).maybeSingle()
      if (!existing) break
      slugSuffix += 1
      slug = `${baseSlug}-${slugSuffix}`
    }

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .insert({
        name: schoolName,
        slug,
        city: city ?? null,
        state: state ?? null,
        school_type: schoolType,
        mascot: mascot ?? null,
        website: website ?? null,
        conference_district: conferenceDistrict ?? null,
        created_by: createdAuthUserId,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (schoolError || !school?.id) {
      console.error("[signup-athletic-director] school insert:", schoolError?.message ?? "no id", schoolError)
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      return NextResponse.json(
        { error: schoolError?.message ?? "Failed to create school record." },
        { status: 500 }
      )
    }

    const { error: deptError } = await supabase.from("athletic_departments").insert({
      school_id: school.id,
      athletic_director_user_id: createdAuthUserId,
      department_plan_type: "athletic_department_license",
      estimated_team_count: estimatedTeamCount,
      estimated_athlete_count: estimatedAthleteCount,
      status: "active",
      updated_at: new Date().toISOString(),
    })

    if (deptError) {
      console.error("[signup-athletic-director] athletic_departments insert:", deptError.message, deptError)
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      return NextResponse.json(
        { error: deptError.message ?? "Failed to create athletic department." },
        { status: 500 }
      )
    }

    const smsConsent = Boolean(phone) && smsOptIn
    const consentIp = getRequestClientIp(request)

    const profilePayload: Record<string, unknown> = {
      id: createdAuthUserId,
      email,
      full_name: fullName,
      role: "athletic_director",
      team_id: null,
      phone: phone ?? null,
      sport: null,
      program_name: schoolName,
      sms_opt_in: smsConsent,
      sms_opt_in_at: smsConsent ? new Date().toISOString() : null,
      sms_opt_in_method: smsConsent ? "web_form" : null,
      sms_opt_in_ip: smsConsent ? consentIp : null,
      sms_opt_in_source: smsConsent ? "signup" : null,
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        { ...profilePayload, school_id: school.id },
        { onConflict: "id" }
      )

    if (profileError) {
      const msg = (profileError.message ?? "").toLowerCase()
      const missingColumn = msg.includes("column") && msg.includes("does not exist")
      if (missingColumn && msg.includes("school_id")) {
        const { error: profileRetryError } = await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" })
        if (profileRetryError) {
          console.error("[signup-athletic-director] profiles upsert (no school_id):", profileRetryError.message)
          await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
          return NextResponse.json(
            { error: profileRetryError.message ?? "Failed to create profile." },
            { status: 500 }
          )
        }
      } else {
        console.error("[signup-athletic-director] profiles upsert:", profileError.message, profileError)
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
        return NextResponse.json(
          { error: profileError.message ?? "Failed to create profile." },
          { status: 500 }
        )
      }
    }

    const userRole = profileRoleToUserRole("athletic_director")
    const { error: userError } = await supabase.from("users").upsert(
      {
        id: createdAuthUserId,
        email,
        name: fullName,
        role: userRole,
        status: "active",
      },
      { onConflict: "id" }
    )

    if (userError) {
      console.error("[signup-athletic-director] users upsert:", userError.message, userError)
      return NextResponse.json(
        { error: userError.message ?? "Failed to sync user record." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        role: "athletic_director",
        schoolId: school.id,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[signup-athletic-director] unexpected error:", message, err)
    if (createdAuthUserId) {
      const supabase = getSupabaseAdminClient()
      if (supabase) {
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      }
    }
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    )
  }
}
