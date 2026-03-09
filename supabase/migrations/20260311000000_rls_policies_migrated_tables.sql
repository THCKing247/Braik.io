-- Row Level Security Policies for Migrated Tables
-- Replaces permissive service_role policies with proper access control
-- Enforces team-based access and role-based permissions

-- Helper function: Check if user is an active team member
create or replace function public.is_team_member(team_id_param uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
  );
$$;

-- Helper function: Get user's role in a team
create or replace function public.get_team_role(team_id_param uuid)
returns text
language sql
stable
security definer
as $$
  select tm.role
  from public.team_members tm
  where tm.team_id = team_id_param
    and tm.user_id = auth.uid()
    and tm.active = true
  limit 1;
$$;

-- Helper function: Check if user can edit roster (head coach or assistant coach)
create or replace function public.can_edit_roster(team_id_param uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
  );
$$;

-- Helper function: Check if user is head coach or admin
create or replace function public.can_manage_team(team_id_param uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.users u on u.id = auth.uid()
    where tm.team_id = team_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
      and (tm.role = 'HEAD_COACH' or lower(u.role) = 'admin')
  );
$$;

-- Helper function: Check if user is a participant in a message thread
create or replace function public.is_thread_participant(thread_id_param uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = thread_id_param
      and mtp.user_id = auth.uid()
  );
$$;

-- Helper function: Check if user can access a player (for parents via guardian links)
create or replace function public.can_access_player(player_id_param uuid)
returns boolean
language sql
stable
security definer
as $$
  -- User is the player themselves
  select exists (
    select 1
    from public.players p
    where p.id = player_id_param
      and p.user_id = auth.uid()
  )
  or
  -- User is a guardian linked to this player
  exists (
    select 1
    from public.guardian_links gl
    join public.guardians g on g.id = gl.guardian_id
    where gl.player_id = player_id_param
      and g.user_id = auth.uid()
  )
  or
  -- User is a team member of the player's team
  exists (
    select 1
    from public.players p
    join public.team_members tm on tm.team_id = p.team_id
    where p.id = player_id_param
      and tm.user_id = auth.uid()
      and tm.active = true
  );
$$;

-- ============================================================================
-- MESSAGING SYSTEM POLICIES
-- ============================================================================

-- Message Threads
-- Read: Team members can see threads they're participants in
drop policy if exists message_threads_team_member_read on public.message_threads;
create policy message_threads_team_member_read on public.message_threads
  for select
  using (
    public.is_team_member(team_id)
    and public.is_thread_participant(id)
  );

-- Insert: Team members can create threads for their team
drop policy if exists message_threads_team_member_insert on public.message_threads;
create policy message_threads_team_member_insert on public.message_threads
  for insert
  with check (
    public.is_team_member(team_id)
    and created_by = auth.uid()
  );

-- Update: Only thread creator or head coach can update
drop policy if exists message_threads_team_member_update on public.message_threads;
create policy message_threads_team_member_update on public.message_threads
  for update
  using (
    public.is_team_member(team_id)
    and (created_by = auth.uid() or public.can_manage_team(team_id))
  )
  with check (
    public.is_team_member(team_id)
  );

-- Delete: Only head coach or admin can delete threads
drop policy if exists message_threads_team_member_delete on public.message_threads;
create policy message_threads_team_member_delete on public.message_threads
  for delete
  using (
    public.can_manage_team(team_id)
  );

-- Keep service role policy for server-side operations
-- Note: Service role key bypasses RLS, but this policy documents server-side access
drop policy if exists message_threads_service_role on public.message_threads;
create policy message_threads_service_role on public.message_threads
  for all using (true) with check (true);

-- Message Thread Participants
-- Read: Team members can see participants in threads they're in
drop policy if exists message_thread_participants_team_member_read on public.message_thread_participants;
create policy message_thread_participants_team_member_read on public.message_thread_participants
  for select
  using (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.is_team_member(mt.team_id)
        and public.is_thread_participant(thread_id)
    )
  );

-- Insert: Team members can add participants to threads in their team
drop policy if exists message_thread_participants_team_member_insert on public.message_thread_participants;
create policy message_thread_participants_team_member_insert on public.message_thread_participants
  for insert
  with check (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.is_team_member(mt.team_id)
    )
  );

-- Update: Only head coach can update participants
drop policy if exists message_thread_participants_team_member_update on public.message_thread_participants;
create policy message_thread_participants_team_member_update on public.message_thread_participants
  for update
  using (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.can_manage_team(mt.team_id)
    )
  );

-- Delete: Head coach or thread creator can remove participants
drop policy if exists message_thread_participants_team_member_delete on public.message_thread_participants;
create policy message_thread_participants_team_member_delete on public.message_thread_participants
  for delete
  using (
    exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and (public.can_manage_team(mt.team_id) or mt.created_by = auth.uid())
    )
  );

-- Keep service role policy
drop policy if exists message_thread_participants_service_role on public.message_thread_participants;
create policy message_thread_participants_service_role on public.message_thread_participants
  for all using (true) with check (true);

-- Messages
-- Read: Thread participants can read messages
drop policy if exists messages_thread_participant_read on public.messages;
create policy messages_thread_participant_read on public.messages
  for select
  using (
    public.is_thread_participant(thread_id)
  );

-- Insert: Thread participants can send messages
drop policy if exists messages_thread_participant_insert on public.messages;
create policy messages_thread_participant_insert on public.messages
  for insert
  with check (
    public.is_thread_participant(thread_id)
    and sender_id = auth.uid()
  );

-- Update: Only message sender can update their own messages
drop policy if exists messages_thread_participant_update on public.messages;
create policy messages_thread_participant_update on public.messages
  for update
  using (
    sender_id = auth.uid()
    and public.is_thread_participant(thread_id)
  )
  with check (
    sender_id = auth.uid()
    and public.is_thread_participant(thread_id)
  );

-- Delete: Message sender or head coach can delete
drop policy if exists messages_thread_participant_delete on public.messages;
create policy messages_thread_participant_delete on public.messages
  for delete
  using (
    sender_id = auth.uid()
    or exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.can_manage_team(mt.team_id)
    )
  );

-- Keep service role policy
drop policy if exists messages_service_role on public.messages;
create policy messages_service_role on public.messages
  for all using (true) with check (true);

-- Message Attachments
-- Read: Thread participants can read attachments
drop policy if exists message_attachments_thread_participant_read on public.message_attachments;
create policy message_attachments_thread_participant_read on public.message_attachments
  for select
  using (
    public.is_thread_participant(thread_id)
  );

-- Insert: Thread participants can upload attachments
drop policy if exists message_attachments_thread_participant_insert on public.message_attachments;
create policy message_attachments_thread_participant_insert on public.message_attachments
  for insert
  with check (
    public.is_thread_participant(thread_id)
    and uploaded_by = auth.uid()
  );

-- Update: Only uploader or head coach can update
drop policy if exists message_attachments_thread_participant_update on public.message_attachments;
create policy message_attachments_thread_participant_update on public.message_attachments
  for update
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.can_manage_team(mt.team_id)
    )
  );

-- Delete: Uploader or head coach can delete
drop policy if exists message_attachments_thread_participant_delete on public.message_attachments;
create policy message_attachments_thread_participant_delete on public.message_attachments
  for delete
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1
      from public.message_threads mt
      where mt.id = thread_id
        and public.can_manage_team(mt.team_id)
    )
  );

-- Keep service role policy
drop policy if exists message_attachments_service_role on public.message_attachments;
create policy message_attachments_service_role on public.message_attachments
  for all using (true) with check (true);

-- ============================================================================
-- PLAYS AND PLAYBOOKS POLICIES
-- ============================================================================

-- Plays
-- Read: Team members can read plays for their team
drop policy if exists plays_team_member_read on public.plays;
create policy plays_team_member_read on public.plays
  for select
  using (
    public.is_team_member(team_id)
  );

-- Insert: Coaches can create plays
drop policy if exists plays_team_member_insert on public.plays;
create policy plays_team_member_insert on public.plays
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Update: Coaches can update plays
drop policy if exists plays_team_member_update on public.plays;
create policy plays_team_member_update on public.plays
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Delete: Coaches can delete plays
drop policy if exists plays_team_member_delete on public.plays;
create policy plays_team_member_delete on public.plays
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy
drop policy if exists plays_service_role on public.plays;
create policy plays_service_role on public.plays
  for all using (true) with check (true);

-- Playbooks
-- Read: Team members can read playbooks for their team
drop policy if exists playbooks_team_member_read on public.playbooks;
create policy playbooks_team_member_read on public.playbooks
  for select
  using (
    public.is_team_member(team_id)
  );

-- Insert: Coaches can create playbooks
drop policy if exists playbooks_team_member_insert on public.playbooks;
create policy playbooks_team_member_insert on public.playbooks
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Update: Coaches can update playbooks
drop policy if exists playbooks_team_member_update on public.playbooks;
create policy playbooks_team_member_update on public.playbooks
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Delete: Coaches can delete playbooks
drop policy if exists playbooks_team_member_delete on public.playbooks;
create policy playbooks_team_member_delete on public.playbooks
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy
drop policy if exists playbooks_service_role on public.playbooks;
create policy playbooks_service_role on public.playbooks
  for all using (true) with check (true);

-- ============================================================================
-- DEPTH CHART POLICIES
-- ============================================================================

-- Depth Chart Entries
-- Read: Team members can read depth chart
drop policy if exists depth_chart_entries_team_member_read on public.depth_chart_entries;
create policy depth_chart_entries_team_member_read on public.depth_chart_entries
  for select
  using (
    public.is_team_member(team_id)
  );

-- Insert: Coaches can create depth chart entries
drop policy if exists depth_chart_entries_team_member_insert on public.depth_chart_entries;
create policy depth_chart_entries_team_member_insert on public.depth_chart_entries
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Update: Coaches can update depth chart entries
drop policy if exists depth_chart_entries_team_member_update on public.depth_chart_entries;
create policy depth_chart_entries_team_member_update on public.depth_chart_entries
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Delete: Coaches can delete depth chart entries
drop policy if exists depth_chart_entries_team_member_delete on public.depth_chart_entries;
create policy depth_chart_entries_team_member_delete on public.depth_chart_entries
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy
drop policy if exists depth_chart_entries_service_role on public.depth_chart_entries;
create policy depth_chart_entries_service_role on public.depth_chart_entries
  for all using (true) with check (true);

-- Depth Chart Position Labels
-- Read: Team members can read position labels
drop policy if exists depth_chart_position_labels_team_member_read on public.depth_chart_position_labels;
create policy depth_chart_position_labels_team_member_read on public.depth_chart_position_labels
  for select
  using (
    public.is_team_member(team_id)
  );

-- Insert: Coaches can create position labels
drop policy if exists depth_chart_position_labels_team_member_insert on public.depth_chart_position_labels;
create policy depth_chart_position_labels_team_member_insert on public.depth_chart_position_labels
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Update: Coaches can update position labels
drop policy if exists depth_chart_position_labels_team_member_update on public.depth_chart_position_labels;
create policy depth_chart_position_labels_team_member_update on public.depth_chart_position_labels
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Delete: Coaches can delete position labels
drop policy if exists depth_chart_position_labels_team_member_delete on public.depth_chart_position_labels;
create policy depth_chart_position_labels_team_member_delete on public.depth_chart_position_labels
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy
drop policy if exists depth_chart_position_labels_service_role on public.depth_chart_position_labels;
create policy depth_chart_position_labels_service_role on public.depth_chart_position_labels
  for all using (true) with check (true);

-- ============================================================================
-- GUARDIANS POLICIES
-- ============================================================================

-- Guardians
-- Read: Users can read their own guardian record
drop policy if exists guardians_own_read on public.guardians;
create policy guardians_own_read on public.guardians
  for select
  using (
    user_id = auth.uid()
  );

-- Insert: Users can create their own guardian record
drop policy if exists guardians_own_insert on public.guardians;
create policy guardians_own_insert on public.guardians
  for insert
  with check (
    user_id = auth.uid()
  );

-- Update: Users can update their own guardian record
drop policy if exists guardians_own_update on public.guardians;
create policy guardians_own_update on public.guardians
  for update
  using (
    user_id = auth.uid()
  )
  with check (
    user_id = auth.uid()
  );

-- Delete: Users can delete their own guardian record
drop policy if exists guardians_own_delete on public.guardians;
create policy guardians_own_delete on public.guardians
  for delete
  using (
    user_id = auth.uid()
  );

-- Team coaches can read guardians linked to their team's players
drop policy if exists guardians_team_coach_read on public.guardians;
create policy guardians_team_coach_read on public.guardians
  for select
  using (
    exists (
      select 1
      from public.guardian_links gl
      join public.players p on p.id = gl.player_id
      join public.team_members tm on tm.team_id = p.team_id
      where gl.guardian_id = id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    )
  );

-- Keep service role policy
drop policy if exists guardians_service_role on public.guardians;
create policy guardians_service_role on public.guardians
  for all using (true) with check (true);

-- Guardian Links
-- Read: Guardians can read their own links, coaches can read links for their team's players
drop policy if exists guardian_links_read on public.guardian_links;
create policy guardian_links_read on public.guardian_links
  for select
  using (
    -- Guardian can see their own links
    exists (
      select 1
      from public.guardians g
      where g.id = guardian_id
        and g.user_id = auth.uid()
    )
    or
    -- Coaches can see links for their team's players
    exists (
      select 1
      from public.players p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = player_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    )
  );

-- Insert: Guardians can create links to players (with verification), coaches can create links
drop policy if exists guardian_links_insert on public.guardian_links;
create policy guardian_links_insert on public.guardian_links
  for insert
  with check (
    -- Guardian creating link to their own account
    exists (
      select 1
      from public.guardians g
      where g.id = guardian_id
        and g.user_id = auth.uid()
    )
    or
    -- Coach creating link for their team
    exists (
      select 1
      from public.players p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = player_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    )
  );

-- Update: Only coaches can update (e.g., verify links)
drop policy if exists guardian_links_update on public.guardian_links;
create policy guardian_links_update on public.guardian_links
  for update
  using (
    exists (
      select 1
      from public.players p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = player_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    )
  )
  with check (
    exists (
      select 1
      from public.players p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = player_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    )
  );

-- Delete: Guardians can delete their own links, coaches can delete any link for their team
drop policy if exists guardian_links_delete on public.guardian_links;
create policy guardian_links_delete on public.guardian_links
  for delete
  using (
    -- Guardian deleting their own link
    exists (
      select 1
      from public.guardians g
      where g.id = guardian_id
        and g.user_id = auth.uid()
    )
    or
    -- Coach deleting link for their team
    exists (
      select 1
      from public.players p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = player_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('HEAD_COACH', 'ASSISTANT_COACH')
    )
  );

-- Keep service role policy
drop policy if exists guardian_links_service_role on public.guardian_links;
create policy guardian_links_service_role on public.guardian_links
  for all using (true) with check (true);

-- ============================================================================
-- PLAYERS POLICIES (Update existing)
-- ============================================================================

-- Players: Team members can read players in their team
-- (Note: More granular filtering by role is handled in app code via data-filters.ts)
drop policy if exists players_team_member_read on public.players;
create policy players_team_member_read on public.players
  for select
  using (
    public.is_team_member(team_id)
    or public.can_access_player(id)
  );

-- Players: Coaches can insert players
drop policy if exists players_team_member_insert on public.players;
create policy players_team_member_insert on public.players
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Players: Coaches can update players
drop policy if exists players_team_member_update on public.players;
create policy players_team_member_update on public.players
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Players: Coaches can delete players
drop policy if exists players_team_member_delete on public.players;
create policy players_team_member_delete on public.players
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy (existing policy remains for server-side operations)
-- Note: The existing players_service_role policy is already in place from 20260309100000_players_onboarding_invites.sql
