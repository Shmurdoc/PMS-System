-- PostgreSQL initialization script for Aquri
-- Runs on first container startup

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Set default transaction isolation level
SET default_transaction_isolation_level = 'Read Committed';

-- Configure pg_stat_statements
SET pg_stat_statements.track = 'all';

-- Set timezone
SET timezone = 'UTC';

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS application;
CREATE SCHEMA IF NOT EXISTS infrastructure;

-- Set search path
ALTER DATABASE "Aquri" SET search_path = core, application, infrastructure, public;

COMMENT ON EXTENSION btree_gist IS 'GIST index support for B-tree equivalent operations, used for complex indexing';
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions for PostgreSQL';
COMMENT ON EXTENSION pg_stat_statements IS 'Tracks execution statistics of all SQL statements executed';