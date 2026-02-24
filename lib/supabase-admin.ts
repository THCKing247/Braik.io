import { createClient, type User } from "@supabase/supabase-js"

type SyncSupabaseUserParams = {
  email: string
  password: string
  name?: string | null
  appUserId: string
  role: string
  teamId?: string | null
  isPlatformOwner?: boolean
}

type SyncSupabaseUserResult = {
  synced: boolean
  skipped?: boolean
  supabaseUserId?: string
  reason?: string
}

type UpdateSupabaseUserByAppUserIdParams = {
  appUserId: string
  email?: string
  name?: string | null
  role?: string
  teamId?: string | null
  isPlatformOwner?: boolean
  password?: string
  banned?: boolean
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function findSupabaseUserByEmail(email: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient()

  if (!supabase) {
    return null
  }

  const perPage = 100
  const maxPages = 100
  const normalizedEmail = email.toLowerCase()

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw error
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)
    if (found) {
      return found
    }

    if (data.users.length < perPage) {
      break
    }
  }

  return null
}

async function findSupabaseUserByAppUserId(appUserId: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient()

  if (!supabase) {
    return null
  }

  const perPage = 100
  const maxPages = 100

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw error
    }

    const found = data.users.find((user) => {
      const metadata = (user.user_metadata || {}) as Record<string, unknown>
      return metadata.appUserId === appUserId
    })

    if (found) {
      return found
    }

    if (data.users.length < perPage) {
      break
    }
  }

  return null
}

export async function syncUserToSupabaseAuth(
  params: SyncSupabaseUserParams
): Promise<SyncSupabaseUserResult> {
  const supabase = getSupabaseAdminClient()

  if (!supabase) {
    return {
      synced: false,
      skipped: true,
      reason: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured",
    }
  }

  const metadata = {
    appUserId: params.appUserId,
    role: params.role,
    teamId: params.teamId || null,
    isPlatformOwner: !!params.isPlatformOwner,
    displayName: params.name || null,
  }

  const existingUser = await findSupabaseUserByEmail(params.email)

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: params.password,
      email: params.email,
      user_metadata: metadata,
    })

    if (error) {
      throw error
    }

    return {
      synced: true,
      supabaseUserId: data.user.id,
    }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error) {
    throw error
  }

  return {
    synced: true,
    supabaseUserId: data.user.id,
  }
}

export async function listSupabaseAuthUsers(limit = 100) {
  const supabase = getSupabaseAdminClient()

  if (!supabase) {
    return {
      synced: false,
      users: [],
      reason: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured",
    }
  }

  const perPage = Math.min(Math.max(limit, 1), 1000)
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage })

  if (error) {
    throw error
  }

  return {
    synced: true,
    users: data.users,
  }
}

export async function updateSupabaseUserByAppUserId(
  params: UpdateSupabaseUserByAppUserIdParams
): Promise<SyncSupabaseUserResult> {
  const supabase = getSupabaseAdminClient()

  if (!supabase) {
    return {
      synced: false,
      skipped: true,
      reason: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured",
    }
  }

  let targetUser = await findSupabaseUserByAppUserId(params.appUserId)
  if (!targetUser && params.email) {
    targetUser = await findSupabaseUserByEmail(params.email)
  }

  if (!targetUser) {
    return {
      synced: false,
      skipped: true,
      reason: "Supabase user not found for app user",
    }
  }

  const existingMetadata = (targetUser.user_metadata || {}) as Record<string, unknown>
  const nextMetadata: Record<string, unknown> = { ...existingMetadata }
  nextMetadata.appUserId = params.appUserId

  if (params.name !== undefined) {
    nextMetadata.displayName = params.name
  }
  if (params.role !== undefined) {
    nextMetadata.role = params.role
  }
  if (params.teamId !== undefined) {
    nextMetadata.teamId = params.teamId
  }
  if (params.isPlatformOwner !== undefined) {
    nextMetadata.isPlatformOwner = params.isPlatformOwner
  }

  const updatePayload: {
    email?: string
    password?: string
    user_metadata?: Record<string, unknown>
    ban_duration?: string
  } = {
    user_metadata: nextMetadata,
  }

  if (params.email !== undefined) {
    updatePayload.email = params.email
  }
  if (params.password !== undefined) {
    updatePayload.password = params.password
  }
  if (params.banned !== undefined) {
    updatePayload.ban_duration = params.banned ? "876000h" : "none"
  }

  const { data, error } = await supabase.auth.admin.updateUserById(targetUser.id, updatePayload)

  if (error) {
    throw error
  }

  return {
    synced: true,
    supabaseUserId: data.user.id,
  }
}

