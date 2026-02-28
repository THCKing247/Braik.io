import { prisma } from "@/lib/prisma"

export type ConfigScope = "future_only" | "all" | "selective"

export interface SystemConfigRow {
  id: string
  key: string
  value_json: unknown
  version: number
  applied_scope: ConfigScope
  applied_team_ids: string[] | null
  applied_at: string
  applied_by: string
}

export async function listSystemConfig(limit = 200): Promise<SystemConfigRow[]> {
  const rows = await prisma.$queryRawUnsafe<SystemConfigRow[]>(
    `
      select
        id::text,
        key,
        value_json,
        version,
        applied_scope,
        applied_team_ids,
        applied_at::text,
        applied_by::text
      from system_config
      order by applied_at desc
      limit $1
    `,
    limit
  )
  return rows
}

export async function appendSystemConfigVersion(input: {
  key: string
  valueJson: unknown
  appliedScope: ConfigScope
  appliedTeamIds?: string[] | null
  appliedBy: string
}): Promise<SystemConfigRow> {
  const rows = await prisma.$queryRawUnsafe<SystemConfigRow[]>(
    `
      with next_version as (
        select coalesce(max(version), 0) + 1 as version
        from system_config
        where key = $1
      )
      insert into system_config (
        id,
        key,
        value_json,
        version,
        applied_scope,
        applied_team_ids,
        applied_at,
        applied_by
      )
      select
        gen_random_uuid(),
        $1,
        $2::jsonb,
        next_version.version,
        $3,
        case
          when $3 = 'selective' then $4::uuid[]
          else null
        end,
        now(),
        $5::uuid
      from next_version
      returning
        id::text,
        key,
        value_json,
        version,
        applied_scope,
        applied_team_ids,
        applied_at::text,
        applied_by::text
    `,
    input.key,
    JSON.stringify(input.valueJson ?? {}),
    input.appliedScope,
    input.appliedTeamIds ?? null,
    input.appliedBy
  )

  return rows[0]
}
