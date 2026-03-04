import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function isPlatformOwner(userId: string): Promise<boolean> {
  const supabase = getSupabaseServer()
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle()

  if (!user) return false
  const u = user as { role?: string; is_platform_owner?: boolean }
  return u.role?.toLowerCase() === "admin" || u.is_platform_owner === true
}
