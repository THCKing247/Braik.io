-- Row Level Security Policies for Inventory, Players, and Documents
-- These tables were created earlier but need proper RLS policies for team-based access

-- ============================================================================
-- INVENTORY ITEMS POLICIES
-- ============================================================================

-- Read: Team members can view inventory items
drop policy if exists inventory_items_team_member_read on public.inventory_items;
create policy inventory_items_team_member_read on public.inventory_items
  for select
  using (
    public.is_team_member(team_id)
  );

-- Insert: Coaches can create inventory items
drop policy if exists inventory_items_team_member_insert on public.inventory_items;
create policy inventory_items_team_member_insert on public.inventory_items
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Update: Coaches can update inventory items
drop policy if exists inventory_items_team_member_update on public.inventory_items;
create policy inventory_items_team_member_update on public.inventory_items
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Delete: Coaches can delete inventory items
drop policy if exists inventory_items_team_member_delete on public.inventory_items;
create policy inventory_items_team_member_delete on public.inventory_items
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy for API access
drop policy if exists inventory_items_service_role on public.inventory_items;
create policy inventory_items_service_role on public.inventory_items
  for all using (true) with check (true);

-- ============================================================================
-- PLAYERS POLICIES
-- ============================================================================

-- Read: Team members can view players
drop policy if exists players_team_member_read on public.players;
create policy players_team_member_read on public.players
  for select
  using (
    public.is_team_member(team_id)
    or exists (
      -- Parents can view their linked players
      select 1
      from public.guardian_links gl
      join public.guardians g on g.id = gl.guardian_id
      where gl.player_id = players.id
        and g.user_id = auth.uid()
    )
  );

-- Insert: Coaches can create players
drop policy if exists players_team_member_insert on public.players;
create policy players_team_member_insert on public.players
  for insert
  with check (
    public.can_edit_roster(team_id)
  );

-- Update: Coaches can update players
drop policy if exists players_team_member_update on public.players;
create policy players_team_member_update on public.players
  for update
  using (
    public.can_edit_roster(team_id)
  )
  with check (
    public.can_edit_roster(team_id)
  );

-- Delete: Coaches can delete players
drop policy if exists players_team_member_delete on public.players;
create policy players_team_member_delete on public.players
  for delete
  using (
    public.can_edit_roster(team_id)
  );

-- Keep service role policy for API access
drop policy if exists players_service_role on public.players;
create policy players_service_role on public.players
  for all using (true) with check (true);

-- ============================================================================
-- DOCUMENTS POLICIES
-- ============================================================================

-- Read: Team members can view documents (with visibility filtering in app)
drop policy if exists documents_team_member_read on public.documents;
create policy documents_team_member_read on public.documents
  for select
  using (
    public.is_team_member(team_id)
  );

-- Insert: Team members can create documents
drop policy if exists documents_team_member_insert on public.documents;
create policy documents_team_member_insert on public.documents
  for insert
  with check (
    public.is_team_member(team_id)
    and created_by = auth.uid()
  );

-- Update: Document creator or coaches can update
drop policy if exists documents_team_member_update on public.documents;
create policy documents_team_member_update on public.documents
  for update
  using (
    created_by = auth.uid()
    or public.can_edit_roster(team_id)
  )
  with check (
    created_by = auth.uid()
    or public.can_edit_roster(team_id)
  );

-- Delete: Document creator or coaches can delete
drop policy if exists documents_team_member_delete on public.documents;
create policy documents_team_member_delete on public.documents
  for delete
  using (
    created_by = auth.uid()
    or public.can_edit_roster(team_id)
  );

-- Keep service role policy for API access
drop policy if exists documents_service_role on public.documents;
create policy documents_service_role on public.documents
  for all using (true) with check (true);

-- ============================================================================
-- DOCUMENT ACKNOWLEDGEMENTS POLICIES
-- ============================================================================

-- Read: Team members can view acknowledgements for their team's documents
drop policy if exists document_acknowledgements_team_member_read on public.document_acknowledgements;
create policy document_acknowledgements_team_member_read on public.document_acknowledgements
  for select
  using (
    exists (
      select 1
      from public.documents d
      where d.id = document_id
        and public.is_team_member(d.team_id)
    )
  );

-- Insert: Users can acknowledge documents for their team
drop policy if exists document_acknowledgements_team_member_insert on public.document_acknowledgements;
create policy document_acknowledgements_team_member_insert on public.document_acknowledgements
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and public.is_team_member(d.team_id)
    )
  );

-- Keep service role policy for API access
drop policy if exists document_acknowledgements_service_role on public.document_acknowledgements;
create policy document_acknowledgements_service_role on public.document_acknowledgements
  for all using (true) with check (true);
