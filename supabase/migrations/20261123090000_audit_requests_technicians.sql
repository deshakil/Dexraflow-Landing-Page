alter table public.audit_requests add column technicians text check (technicians is null or technicians in ('1-3','4-6','7-10','10+'));
