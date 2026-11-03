create table public.inventory_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent boolean not null check (consent = true),
  company_size text check (company_size in ('1-50','51-200','201-500','500+')),
  role text check (char_length(role) <= 60),
  total_workflows int not null check (total_workflows between 0 and 50),
  no_count int not null check (no_count >= 0),
  not_sure_count int not null check (not_sure_count >= 0),
  no_owner_count int not null check (no_owner_count >= 0),
  fix_count int not null check (fix_count >= 0),
  kill_count int not null check (kill_count >= 0),
  leads_at_risk_per_week int check (leads_at_risk_per_week >= 0),
  tools_used text[] check (array_length(tools_used, 1) is null or array_length(tools_used, 1) <= 15),
  utm_source text, utm_medium text, utm_campaign text,
  referrer text check (char_length(referrer) <= 500)
);

alter table public.inventory_submissions enable row level security;

create policy "anon can insert submissions"
  on public.inventory_submissions for insert
  to anon
  with check (consent = true);

-- No select, update or delete policies: the public key can only add rows, never read them.
