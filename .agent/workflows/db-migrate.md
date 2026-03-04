---
description: How to apply database schema migrations
---
# Database Migration
1. Edit `drizzle/schema.ts` with new tables or columns — always use `mysqlTable` (TiDB, not pgTable)
2. Run `pnpm db:push` to generate and apply migration
3. Verify: `grep -c "mysqlTable" drizzle/schema.ts` — count should increase by the number of new tables
4. Current baseline: 87 tables (as of MIYAR 3.0 Phase B — includes `space_program_rooms` + `amenity_sub_spaces`)
5. Update table count in `PROGRESS.md`, `miyar-memory.md`, and this file after every schema change
