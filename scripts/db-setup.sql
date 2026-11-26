-- QueuePass database setup — run ONCE as the postgres superuser, BEFORE migrations.
-- Creates the three roles and the two databases. Idempotent (DO blocks).
-- Passwords come from psql variables; defaults are LOCAL DEV ONLY.
--   psql -U postgres -v owner_pass=... -v app_pass=... -v pub_pass=... -f scripts/db-setup.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'queuepass_owner') THEN
    CREATE ROLE queuepass_owner LOGIN PASSWORD :'owner_pass' CREATEDB;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'queuepass_app') THEN
    CREATE ROLE queuepass_app LOGIN PASSWORD :'app_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'queuepass_public') THEN
    CREATE ROLE queuepass_public LOGIN PASSWORD :'pub_pass' BYPASSRLS;
  END IF;
END $$;
SELECT 'CREATE DATABASE queuepass OWNER queuepass_owner' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'queuepass') \gexec
SELECT 'CREATE DATABASE queuepass_test OWNER queuepass_owner' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'queuepass_test') \gexec
