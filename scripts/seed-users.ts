import { hasClientSupabaseEnv, missingSupabaseAdminEnv, requireSupabaseAdmin } from "../src/lib/supabaseAdmin"
import { runDevSeedUsers } from "../src/lib/devSeedUsers"

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    console.error("Refusing to run in production without ALLOW_PROD_SEED=true")
    process.exit(1)
  }

  if (missingSupabaseAdminEnv.length > 0) {
    console.error(`Missing required environment variables: ${missingSupabaseAdminEnv.join(", ")}`)
    process.exit(1)
  }

  const summary = await runDevSeedUsers(requireSupabaseAdmin())
  console.log(
    JSON.stringify(
      {
        success: true,
        usersSeeded: summary.createdAuthUsers,
        profilesUpserted: summary.profilesUpserted,
        teamId: summary.demoTeamId,
        users: summary.users,
        clientSupabaseEnvConfigured: hasClientSupabaseEnv(),
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seeding failed")
  process.exit(1)
})

