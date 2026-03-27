-- Public waitlist capture; inserts only via service-role API (RLS blocks direct client access).

CREATE TABLE IF NOT EXISTS public.waitlist_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  organization_name text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_submissions_email_lower_idx
  ON public.waitlist_submissions (lower(trim(email)));

ALTER TABLE public.waitlist_submissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.waitlist_submissions IS
  'Marketing waitlist; application server inserts with service role only.';
