alter table public.audit_requests alter column phone drop not null;
alter table public.audit_requests drop constraint if exists audit_requests_phone_check;
alter table public.audit_requests add constraint audit_requests_phone_check check (phone is null or char_length(phone) between 5 and 40);
-- Spam trap: the site sends its hidden field; anything in it is rejected by the database itself.
alter table public.audit_requests add column botcheck text check (botcheck is null or botcheck = '');
