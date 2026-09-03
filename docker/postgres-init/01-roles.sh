#!/bin/bash
# Creates the two runtime database roles at cluster initialization.
#
# - ajour_app:  the application role for all domain queries, fully subject to RLS
# - ajour_auth: the role Better Auth uses; only granted access to auth tables
#
# Passwords come from the environment (see docker-compose files). Migrations
# create the roles as NOLOGIN if they are missing, so this script only needs to
# guarantee LOGIN + password. It is idempotent.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ajour_app') THEN
      ALTER ROLE ajour_app LOGIN PASSWORD '${AJOUR_APP_PASSWORD:-ajour_app}';
    ELSE
      CREATE ROLE ajour_app LOGIN PASSWORD '${AJOUR_APP_PASSWORD:-ajour_app}';
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ajour_auth') THEN
      ALTER ROLE ajour_auth LOGIN PASSWORD '${AJOUR_AUTH_PASSWORD:-ajour_auth}';
    ELSE
      CREATE ROLE ajour_auth LOGIN PASSWORD '${AJOUR_AUTH_PASSWORD:-ajour_auth}';
    END IF;
  END
  \$\$;
EOSQL
