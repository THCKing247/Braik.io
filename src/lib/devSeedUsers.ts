import type { SupabaseClient } from "@supabase/supabase-js"

export type SeedRole = "head_coach" | "assistant_coach" | "player" | "parent" | "admin"

export type SeedUser = {
  email: string
  password: string
  role: SeedRole
  fullName: string
}

export const DEMO_TEAM_NAME = "Braik Demo Team"
export const DEMO_TEAM_INVITE_CODE = "DEMO123"

export const SEED_USERS: SeedUser[] = [
  { email: "coach@example.com", password: "password123", role: "head_coach", fullName: "Demo Coach" },
  { email: "assistant@example.com", password: "password123", role: "assistant_coach", fullName: "Demo Assistant Coach" },
  { email: "player1@example.com", password: "password123", role: "player", fullName: "Demo Player 1" },
  { email: "parent1@example.com", password: "password123", role: "parent", fullName: "Demo Parent 1" },
  { email: "admin@braik.com", password: "admin123", role: "admin", fullName: "Braik Admin" },
  { email: "master@braik.com", password: "admin123", role: "admin", fullName: "Braik Master Admin" },
  { email: "michael.mcclellan@apextsgroup.com", password: "admin@081197", role: "admin", fullName: "Michael McClellan" },
  { email: "kenneth.mceachin@apextsgroup.com", password: "admin@012796", role: "admin", fullName: "Kenneth McEachin" },
]

export type SeedSummary = {
  createdAuthUsers: number
  profilesUpserted: number
  demoTeamId: string
  users: Array<{ email: string; role: SeedRole }>
}

async function listUsersByEmail(
  supabaseAdmin: SupabaseClient,
  emails: Set<string>
): Promise<Map<string, { id: string; email: string }>> {
  const usersByEmail = new Map<string, { id: string; email: string }>()
  const perPage = 100
  const maxPages = 100

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list Supabase auth users`)
    }

    for (const user of data.users) {
      const email = user.email?.toLowerCase()
      if (email && emails.has(email)) {
        usersByEmail.set(email, { id: user.id, email })
      }
    }

    if (data.users.length < perPage) {
      break
    }
  }

  return usersByEmail
}

export async function runDevSeedUsers(supabaseAdmin: SupabaseClient): Promise<SeedSummary> {
  const seedEmailSet = new Set(SEED_USERS.map((user) => user.email.toLowerCase()))

  const existingAuthUsers = await listUsersByEmail(supabaseAdmin, seedEmailSet)
  for (const [, existingUser] of existingAuthUsers) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
    if (error) {
      throw new Error("Failed to delete existing auth user before reseed")
    }
  }

  const { error: deleteProfilesError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .in(
      "email",
      SEED_USERS.map((user) => user.email)
    )

  if (deleteProfilesError) {
    throw new Error("Failed to remove existing seed profiles")
  }

  const createdAuthUsersByEmail = new Map<string, string>()
  for (const seedUser of SEED_USERS) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: seedUser.email,
      password: seedUser.password,
      email_confirm: true,
    })

    if (error || !data.user) {
      throw new Error(`Failed to create auth user for ${seedUser.email}`)
    }

    createdAuthUsersByEmail.set(seedUser.email.toLowerCase(), data.user.id)
  }

  const coachUserId = createdAuthUsersByEmail.get("coach@example.com")
  if (!coachUserId) {
    throw new Error("Head coach user ID not found after auth seeding")
  }

  const { data: existingTeam, error: selectTeamError } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("invite_code", DEMO_TEAM_INVITE_CODE)
    .maybeSingle()

  if (selectTeamError) {
    throw new Error("Failed to fetch demo team")
  }

  let demoTeamId: string
  if (existingTeam?.id) {
    demoTeamId = existingTeam.id as string
  } else {
    const { data: insertedTeam, error: insertTeamError } = await supabaseAdmin
      .from("teams")
      .insert({
        name: DEMO_TEAM_NAME,
        invite_code: DEMO_TEAM_INVITE_CODE,
        created_by: coachUserId,
      })
      .select("id")
      .single()

    if (insertTeamError || !insertedTeam?.id) {
      throw new Error("Failed to create demo team")
    }

    demoTeamId = insertedTeam.id as string
  }

  let profilesUpserted = 0
  for (const seedUser of SEED_USERS) {
    const authUserId = createdAuthUsersByEmail.get(seedUser.email.toLowerCase())
    if (!authUserId) {
      throw new Error(`Auth user ID missing for ${seedUser.email}`)
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: authUserId,
      email: seedUser.email,
      role: seedUser.role,
      team_id: seedUser.role === "admin" ? null : demoTeamId,
      full_name: seedUser.fullName,
      phone: "",
      sport: "Football",
      program_name: DEMO_TEAM_NAME,
    })

    if (profileError) {
      throw new Error(`Failed to upsert profile for ${seedUser.email}`)
    }

    profilesUpserted += 1
  }

  const verifyAuthUsers = await listUsersByEmail(supabaseAdmin, seedEmailSet)

  return {
    createdAuthUsers: verifyAuthUsers.size,
    profilesUpserted,
    demoTeamId,
    users: SEED_USERS.map((user) => ({ email: user.email, role: user.role })),
  }
}

