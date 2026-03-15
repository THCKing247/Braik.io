import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Get or create the organization for the given Athletic Director (auth user id).
 * AD is identified by athletic_departments.athletic_director_user_id.
 * Returns organization id or null if user is not an AD or creation failed.
 */
export async function getOrCreateAdOrganization(
  supabase: SupabaseClient,
  userId: string
): Promise<{ organizationId: string; isNew: boolean } | null> {
  const { data: dept, error: deptErr } = await supabase
    .from("athletic_departments")
    .select("id, school_id")
    .eq("athletic_director_user_id", userId)
    .maybeSingle()

  if (deptErr || !dept?.id) return null

  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("athletic_department_id", dept.id)
    .maybeSingle()

  if (existing?.id) {
    return { organizationId: existing.id, isNew: false }
  }

  let schoolName = "Athletic Department"
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", dept.school_id)
    .maybeSingle()
  if (school?.name) schoolName = String(school.name)

  const slugBase = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org"
  let slug = slugBase
  let suffix = 0
  for (;;) {
    const { data: conflict } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (!conflict) break
    suffix += 1
    slug = `${slugBase}-${suffix}`
  }

  const { data: created, error: createErr } = await supabase
    .from("organizations")
    .insert({
      name: schoolName,
      slug,
      athletic_department_id: dept.id,
      created_by_user_id: userId,
    })
    .select("id")
    .single()

  if (createErr || !created?.id) return null
  return { organizationId: created.id, isNew: true }
}
