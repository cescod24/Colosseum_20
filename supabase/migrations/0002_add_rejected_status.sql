-- 0002_add_rejected_status.sql — extend orders.status to allow 'rejected'.
--
-- Phase 5 (Dev B lane) adds a Reject button on the procurement approval queue.
-- The original CHECK constraint in 0001_init.sql allows only
-- draft/pending/approved/ordered/delivered; reject needs a distinct terminal
-- state so the foreman's status pill can show "Rejected" instead of being
-- stuck on "Pending" or rolled back to "Draft".
--
-- Additive: every existing status value remains valid; no data migration
-- needed. Devs A and C should re-run `npx supabase db push` against their
-- own cloud project after pulling main.

alter table orders drop constraint if exists orders_status_check;

alter table orders add constraint orders_status_check
  check (status in ('draft', 'pending', 'approved', 'ordered', 'delivered', 'rejected'));
