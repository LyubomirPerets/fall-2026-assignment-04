---
name: kysely-migration-generator
description: Translates a Mermaid ERD (docs/architecture/schema.mmd, or the erd.svg compiled from it) into a type-safe Kysely PostgreSQL migration file in src/db/migrations/. Use when the user asks to generate, write, or create a database migration, Kysely migration, DDL, or table-creation script from an ERD, Mermaid diagram, schema.mmd, or data model.
---

# Kysely Migration Generator

Read a Mermaid `erDiagram` and produce ONE new Kysely migration that creates its
tables in PostgreSQL. All commands run from the repository root.

## Execution Workflow

### 1. Read inputs
- Read `docs/architecture/schema.mmd`. If only `docs/architecture/erd.svg` exists,
  read entity, attribute and relationship labels from the SVG's text elements instead.
- Read every file in `src/db/migrations/`. Use `001_initial_schema.ts` as the
  style reference (import style, column builders, `sql` usage).
- Build the set of EXISTING tables: every table created by a prior migration,
  plus any listed in the `%% EXISTING_TABLES:` comment of the ERD.
  Existing tables are NEVER created, altered, or dropped by the new migration.

### 2. Parse the ERD
For each entity collect: attributes (type, name, key markers, comment) and
every relationship line it appears in.

### 3. Order the tables
Create a table only after every table it references. Existing tables count as
already created. Record this order; `down` uses the exact reverse.

### 4. Write the migration file
- Filename: `src/db/migrations/<timestamp>_<migration_name>.ts`
  - `<timestamp>`: current UTC time from `date -u +%Y%m%d%H%M%S`
  - `<migration_name>`: short snake_case description, e.g. `library_schema`
  - It must sort alphabetically AFTER all existing migration files.
- Use exactly this structure:

```ts
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // one `await db.schema.createTable(...)...execute();` per new table, parents first
}

export async function down(db: Kysely<any>): Promise<void> {
  // one `await db.schema.dropTable(...).execute();` per new table, in REVERSE order of up
}
```

- Import `sql` only if it is used.

### 5. Verify (self-correction, maximum 3 retries)
Make sure the database is running (`docker compose up -d`), then run:

```
npm run build
npm run migrate:up
npm run migrate:down
npm run migrate:up
```

- `build` must report no TypeScript errors.
- `migrate:up` must print that the new migration "was executed successfully".
- `migrate:down` then `migrate:up` proves the `down` function works.
- If any command fails, read the error, fix ONLY the new migration file, and
  re-run. After 3 failed retries, stop and show the user the error.

### 6. Final output
Tell the user: the migration file path, the table creation order, the drop
order, and the output of the verification commands.

## Translation Rules

### Entities to tables
- Table name = entity name in lowercase snake_case: `USERS` -> `users`,
  `BOOK_AUTHORS` -> `book_authors`.
- Column name = attribute name unchanged (already snake_case).

### Data types (Mermaid -> Kysely column type)
| Mermaid     | Kysely             |
|-------------|--------------------|
| `int`       | `'integer'`        |
| `uuid`      | `'uuid'`           |
| `varchar`   | `'varchar(255)'`   |
| `text`      | `'text'`           |
| `boolean`   | `'boolean'`        |
| `date`      | `'date'`           |
| `timestamp` | `'timestamp'`      |
| `decimal`   | `'numeric(10, 2)'` |

### Nullability and defaults
- Every column is `.notNull()` UNLESS its comment contains `nullable`.
- A `created_at` timestamp column gets ``.defaultTo(sql`NOW()`).notNull()``,
  matching `001_initial_schema.ts`.
- A comment like `"default: 5"` or `"default: false"` becomes `.defaultTo(5)` / `.defaultTo(false)`.

### Keys
- Single `PK`, type `int` -> `.addColumn('id', 'serial', (col) => col.primaryKey())`
  (auto-incrementing, matches `users.id`).
- Single `PK`, type `uuid` -> ``.addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))``.
- `UK` -> `.unique()`.
- `FK` -> `.references('<parent_table>.id').onDelete('cascade').notNull()`.
  The parent is the entity on the `||` side of the relationship line that
  connects the two entities. Column type must match the parent's PK
  (`serial` parent -> `'integer'` FK).
- Two or more attributes marked `PK, FK` (junction table) -> no column-level
  `.primaryKey()`; instead add
  `.addPrimaryKeyConstraint('<table>_pkey', ['<col_a>', '<col_b>'])`.

### Cardinalities
- `PARENT ||--o{ CHILD` or `||--|{` (one-to-many): plain FK on CHILD.
- `PARENT ||--o| CHILD` or `||--||` (one-to-one): FK on CHILD plus `.unique()`,
  so each parent row has at most one child row.

## Guardrails
- Create exactly ONE new migration file. Never edit existing migrations.
- Never create, alter, or drop an existing table (e.g. `users`).
- Do not edit `docs/architecture/schema.mmd`. If the ERD is invalid or
  ambiguous, stop and tell the user.
- `down` must drop only the tables `up` created, in exact reverse order.
