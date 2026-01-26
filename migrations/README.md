# Database Migrations

This folder contains SQL migration files for database schema changes.

## How to Run Migrations

### Run All Pending Migrations (Recommended)

This will automatically run all migration files in order that haven't been run yet:

```bash
npm run migrate
```

or

```bash
node migrations/migrate.js
```

### Run a Single Migration File

If you need to run a specific migration file:

```bash
npm run migrate:single migrations/001_add_employee_commission_fields.sql
```

or

```bash
node migrations/run-migration.js migrations/001_add_employee_commission_fields.sql
```

## Migration Tracking

The migration system automatically:
- Creates a `migrations` table to track which migrations have been run
- Skips migrations that have already been executed
- Runs migrations in alphabetical order (by filename)
- Groups migrations into batches

## Migration Files

- `001_add_employee_commission_fields.sql` - Adds employee commission fields to employees and orders tables

## Environment

Migrations use the database configuration from `config/config.json` based on `NODE_ENV`:
- `development` - Uses config from `config/config.json` development section
- `test` - Uses config from `config/config.json` test section  
- `production` - Uses `DATABASE_URL` environment variable

## Notes

- Always backup your database before running migrations
- Migrations are tracked in the `migrations` table - safe to run multiple times
- Migration files should be named with a number prefix (e.g., `001_`, `002_`) to ensure correct order
- Check the migration file before running to understand what changes will be made
