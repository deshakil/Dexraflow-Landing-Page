-- Second Ring audit requests (project: second-ring, ref smerteqnuoqzawmdwlod)
create table public.audit_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  shop text not null check (char_length(shop) between 1 and 160),
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check (char_length(phone) between 5 and 40),
  booking_tool text not null check (booking_tool in ('Jobber','Housecall Pro','Something else','None yet')),
  source text check (char_length(source) <= 200),
  referrer text check (char_length(referrer) <= 500),
  handled boolean not null default false
);

alter table public.audit_requests enable row level security;

create policy "anon can insert audit requests"
  on public.audit_requests for insert
  to anon
  with check (true);

-- No select, update or delete policies for anon: the website key can only add rows.
comment on table public.audit_requests is 'Free missed-call audit requests from secondring.dexraflow.in. Mark handled when replied to.';
