-- QueuePass RLS + grants.
-- Tenancy is enforced in two places: the app sets app.tenant_id per
-- transaction (from the verified JWT), and the database enforces it here.
-- The app runtime role (queuepass_app) is NOT a superuser and does NOT
-- bypass RLS; FORCE RLS also binds the table owner. The migration owner
-- (queuepass_owner) runs migrations; the postgres superuser (seed) bypasses
-- RLS by design. Audit logs are append-only: revoke UPDATE/DELETE from the
-- app role.

-- Grants for the runtime role
GRANT USAGE ON SCHEMA public TO queuepass_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO queuepass_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO queuepass_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO queuepass_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO queuepass_app;

-- RLS: enable + force on every tenant table
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters FORCE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats FORCE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

-- Policies: a row is visible/modifiable only when its tenant matches the
-- transaction-local app.tenant_id. The organisation row matches its own id.
DROP POLICY IF EXISTS tenant_isolation ON organisations;
CREATE POLICY tenant_isolation ON organisations
  USING (id = current_setting('app.tenant_id', true))
  WITH CHECK (id = current_setting('app.tenant_id', true));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','branches','services','counters','tokens','appointments','notifications','audit_logs','daily_stats','idempotency_keys'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("orgId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("orgId" = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Audit log is append-only for the app role
REVOKE UPDATE, DELETE ON audit_logs FROM queuepass_app;
