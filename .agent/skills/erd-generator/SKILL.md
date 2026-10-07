---
name: erd-generator
description: Designs a database Entity-Relationship Diagram (ERD) in Mermaid erDiagram syntax from a plain-language domain description, validates it with a local renderer script, self-corrects syntax errors, and compiles it to an SVG. Use when the user asks to design, draft, model, or diagram an ERD, entity-relationship diagram, data model, database schema, table relationships, or architecture diagram for a system.
---

# ERD Generator

Turn a domain description into a validated Mermaid `erDiagram`, saved at
`docs/architecture/schema.mmd` and rendered to `docs/architecture/erd.svg`.

All commands run from the repository root.

## Execution Workflow

Follow these steps in order. Do not skip the validation step.

### 1. Gather context
- Read the user's domain requirements and business rules.
- List `src/db/migrations/` and read any existing migration files. Every table
  created there ALREADY EXISTS. Include those entities in the ERD with their
  exact existing columns and types, but do not redesign them.
  (`users` already exists: `id` serial PK, `email` varchar unique,
  `name` varchar, `created_at` timestamp.)

### 2. Parse requirements into a model
Before writing any Mermaid, decide:
- **Entities**: one per real-world concept; UPPER_SNAKE_CASE plural names (e.g. `BOOKS`, `BOOK_AUTHORS`).
- **Primary keys (PK)**: every entity gets `int id PK`, except junction tables (see below).
- **Foreign keys (FK)**: named `<singular_referenced_entity>_id` (e.g. `book_id`), typed to match the referenced PK (`int`).
- **Cardinalities**:
  - one-to-many: `PARENT ||--o{ CHILD`
  - one-to-one (optional child): `PARENT ||--o| CHILD`, with the FK on the child marked `FK, UK`
  - many-to-many: never draw directly; create a junction table with two FKs,
    both marked `PK, FK` (composite primary key), and two one-to-many lines into it.
- If a requirement is ambiguous, choose the simplest reasonable option and state it in the final output.

### 3. Write the Mermaid file
Write the diagram directly to `docs/architecture/schema.mmd` (create the folder if needed).

The first line after `erDiagram` must be a comment listing pre-existing tables, e.g.:

```
erDiagram
    %% EXISTING_TABLES: USERS
```

### 4. Validate and render
Run:

```
node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
```

- Output `SUCCESS` → go to step 6.
- Output starting with `SYNTAX_ERROR:` → go to step 5.

### 5. Self-correction loop (maximum 3 retries)
1. Read the error trace. It names the line number and the offending token
   (e.g. `Parse error on line 4 ... Expecting 'ZERO_OR_MORE' ... got 'UNICODE_TEXT'`).
2. Open `docs/architecture/schema.mmd`, fix ONLY the cause of that error
   using the syntax rules below, and save.
3. Re-run the command from step 4.
4. Repeat at most 3 times. If it still fails after the 3rd retry, stop and
   show the user the last error and the current file contents. Never claim success
   without a `SUCCESS` line.

### 6. Final output
Respond to the user with:
1. The full contents of `docs/architecture/schema.mmd` in a mermaid code block.
2. The rendered image path: `docs/architecture/erd.svg`.
3. A short bullet list of the design decisions/assumptions you made.
4. How many self-correction retries were needed (0 if none).

## Mermaid Syntax Rules

- File starts with `erDiagram` on its own line.
- Entity block example:

```
BOOKS {
    int id PK
    varchar title
    int genre_id FK
}
```

- Attribute format: `type name [PK|FK|UK|PK, FK|FK, UK] ["optional comment"]`.
- Types must be a single word from this list ONLY:
  `int`, `uuid`, `varchar`, `text`, `boolean`, `date`, `timestamp`, `decimal`.
  No lengths or parentheses (`varchar(255)` is INVALID).
- Entity and attribute names: letters, digits, underscores only. No spaces or hyphens.
- Relationship lines need a quoted label: `GENRES ||--o{ BOOKS : "categorizes"`.
- Valid relationship tokens: `||--o{`, `||--|{`, `||--o|`, `||--||`. Do not invent others.
- Comments start with `%%` on their own line.
- Nullable/optional columns: add the comment `"nullable"` (e.g. `timestamp returned_at "nullable"`).
  All other columns are assumed NOT NULL.

## Guardrails
- Only create or modify `docs/architecture/schema.mmd` and `docs/architecture/erd.svg`.
- Do not write migrations or application code; that is a different skill.
- Do not edit the renderer script to make validation pass.
