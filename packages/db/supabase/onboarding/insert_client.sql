-- Run this ONCE manually in the new client's Supabase SQL Editor during setup.
-- Replace the placeholders before running.
--
-- This is intentionally NOT a migration: each client deployment has its own
-- unique CLIENT_ID, email, and brand name. Migrations stay generic.

insert into clients (id, email, display_name)
values (
  '<<PASTE_CLIENT_ID_HERE>>',           -- the UUID generated in HANDOFF.md §6.2
  '<<paste_client_email@example.com>>',
  '<<Brand Name Here>>'
)
on conflict (email) do nothing;

insert into app_settings (client_id)
values ('<<PASTE_CLIENT_ID_HERE>>')
on conflict (client_id) do nothing;