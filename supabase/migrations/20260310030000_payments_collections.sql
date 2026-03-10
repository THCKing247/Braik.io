-- Payments and Collections: team payment management
-- Supports roster dues, custom collections, invoices, and transactions

-- Collections: payment collection campaigns (roster dues or custom)
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  collection_type text not null, -- 'roster-dues', 'custom'
  title text not null,
  description text,
  amount numeric(10,2) not null default 0,
  status text not null default 'open', -- 'open', 'closed'
  due_date timestamptz,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_team_id on public.collections(team_id);
create index if not exists idx_collections_status on public.collections(status);
create index if not exists idx_collections_type on public.collections(collection_type);
alter table public.collections enable row level security;

-- Invoices: individual payment obligations per player
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  payer_user_id uuid references public.users(id) on delete set null, -- Parent or player who pays
  amount_due numeric(10,2) not null,
  amount_paid numeric(10,2) not null default 0,
  status text not null default 'pending', -- 'pending', 'paid', 'partial', 'overdue'
  invoice_id text, -- External invoice ID if applicable
  date timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_collection_id on public.invoices(collection_id);
create index if not exists idx_invoices_player_id on public.invoices(player_id);
create index if not exists idx_invoices_payer_user_id on public.invoices(payer_user_id) where payer_user_id is not null;
create index if not exists idx_invoices_status on public.invoices(status);
alter table public.invoices enable row level security;

-- Transactions: payment records (cash, card, etc.)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_method text not null, -- 'cash', 'card', 'check', 'other'
  payment_type text not null, -- 'payment', 'refund', 'adjustment'
  processed_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_invoice_id on public.transactions(invoice_id);
create index if not exists idx_transactions_collection_id on public.transactions(collection_id);
create index if not exists idx_transactions_processed_by on public.transactions(processed_by) where processed_by is not null;
alter table public.transactions enable row level security;

-- Memberships: team membership records (may overlap with team_members but for payment context)
-- Note: This may be redundant with team_members, but kept for payment-specific context
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  position_groups jsonb, -- Array of position groups for coordinators
  permissions jsonb, -- Permissions object with coordinatorType, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists idx_memberships_team_id on public.memberships(team_id);
create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_memberships_role on public.memberships(role);
alter table public.memberships enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists collections_service_role on public.collections;
create policy collections_service_role on public.collections for all using (true) with check (true);

drop policy if exists invoices_service_role on public.invoices;
create policy invoices_service_role on public.invoices for all using (true) with check (true);

drop policy if exists transactions_service_role on public.transactions;
create policy transactions_service_role on public.transactions for all using (true) with check (true);

drop policy if exists memberships_service_role on public.memberships;
create policy memberships_service_role on public.memberships for all using (true) with check (true);

-- Function to update invoice amount_paid when transaction is created/updated
create or replace function public.update_invoice_amount_paid()
returns trigger
language plpgsql
as $$
begin
  update public.invoices
  set amount_paid = (
    select coalesce(sum(amount), 0)
    from public.transactions
    where invoice_id = new.invoice_id
      and payment_type = 'payment'
  ),
  status = case
    when (select coalesce(sum(amount), 0) from public.transactions where invoice_id = new.invoice_id and payment_type = 'payment') >= amount_due then 'paid'
    when (select coalesce(sum(amount), 0) from public.transactions where invoice_id = new.invoice_id and payment_type = 'payment') > 0 then 'partial'
    else 'pending'
  end,
  paid_at = case
    when (select coalesce(sum(amount), 0) from public.transactions where invoice_id = new.invoice_id and payment_type = 'payment') >= amount_due 
      and paid_at is null then now()
    else paid_at
  end,
  updated_at = now()
  where id = new.invoice_id;
  return new;
end;
$$;

drop trigger if exists update_invoice_amount_paid_trigger on public.transactions;

create trigger update_invoice_amount_paid_trigger
after insert or update on public.transactions
for each row
execute function public.update_invoice_amount_paid();
