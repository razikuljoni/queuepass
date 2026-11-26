-- QueuePass table grants — run AFTER migrations, once per database:
--   psql -U postgres -d queuepass -f scripts/db-grants.sql
--   psql -U postgres -d queuepass_test -f scripts/db-grants.sql
-- The public role is BYPASSRLS and SELECT-only (plus INSERT/UPDATE on the
-- notifications outbox, which the SMS worker writes). It never gets DELETE.
GRANT USAGE ON SCHEMA public TO queuepass_public;
GRANT SELECT ON branches, services, tokens, counters, organisations, users TO queuepass_public;
GRANT SELECT, INSERT, UPDATE ON notifications TO queuepass_public;
GRANT SELECT ON audit_logs, daily_stats, idempotency_keys TO queuepass_public;
