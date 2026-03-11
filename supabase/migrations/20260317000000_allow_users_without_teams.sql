-- Allow users to access their own data even without team membership
-- This enables players and other roles to login and access their portal without a team code

-- ============================================================================
-- UPDATE PLAYERS POLICIES
-- ============================================================================

-- Update players read policy to allow users to read players linked to their account
-- even if they don't have a team_members entry
drop policy if exists players_team_member_read on public.players;
create policy players_team_member_read on public.players
  for select
  using (
    -- Team members can view players
    public.is_team_member(team_id)
    or
    -- Users can view players linked to their account (user_id = auth.uid())
    user_id = auth.uid()
    or
    -- Parents can view their linked players
    exists (
      select 1
      from public.guardian_links gl
      join public.guardians g on g.id = gl.guardian_id
      where gl.player_id = players.id
        and g.user_id = auth.uid()
    )
  );

-- Update players update policy to allow users to update their own player record
drop policy if exists players_team_member_update on public.players;
create policy players_team_member_update on public.players
  for update
  using (
    -- Coaches can update players in their team
    public.can_edit_roster(team_id)
    or
    -- Users can update their own player record
    user_id = auth.uid()
  )
  with check (
    -- Coaches can update players in their team
    public.can_edit_roster(team_id)
    or
    -- Users can update their own player record
    user_id = auth.uid()
  );

-- ============================================================================
-- UPDATE GUARDIANS POLICIES
-- ============================================================================

-- Guardians policies already allow users to access their own guardian record
-- (see 20260310050000_guardians.sql), so no changes needed here

-- ============================================================================
-- UPDATE PROFILES POLICIES
-- ============================================================================

-- Profiles already have a policy that allows users to read/update their own profile
-- (see 20260303000000_profiles_and_auth_sync.sql), so no changes needed here

-- ============================================================================
-- UPDATE TEAM_MEMBERS POLICIES (if they exist)
-- ============================================================================

-- Ensure team_members table has RLS enabled and allows users to see their own memberships
-- This is optional - users can exist without team_members entries
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'team_members'
  ) then
    -- Enable RLS if not already enabled
    alter table public.team_members enable row level security;
    
    -- Allow users to read their own team memberships
    drop policy if exists team_members_own_read on public.team_members;
    create policy team_members_own_read on public.team_members
      for select
      using (user_id = auth.uid());
    
    -- Keep service role policy for server-side operations
    drop policy if exists team_members_service_role on public.team_members;
    create policy team_members_service_role on public.team_members
      for all using (true) with check (true);
  end if;
end $$;

-- ============================================================================
-- UPDATE NOTIFICATIONS POLICIES
-- ============================================================================

-- Allow users to read their own notifications even without team membership
-- (Notifications require team_id, but users should be able to see their own)
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'notifications'
  ) then
    -- Update notifications read policy
    drop policy if exists notifications_user_read on public.notifications;
    create policy notifications_user_read on public.notifications
      for select
      using (
        -- Users can read their own notifications
        user_id = auth.uid()
        or
        -- Team members can read team notifications (if they have team membership)
        (team_id is not null and public.is_team_member(team_id))
      );
  end if;
end $$;

-- ============================================================================
-- UPDATE COMPLIANCE_LOG POLICIES
-- ============================================================================

-- Allow users to read their own compliance log entries
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'compliance_log'
  ) then
    -- Update compliance_log read policy
    drop policy if exists compliance_log_user_read on public.compliance_log;
    create policy compliance_log_user_read on public.compliance_log
      for select
      using (user_id = auth.uid());
  end if;
end $$;
