---
description: How to apply database schema migrations
---
# Database Migration
1. Edit `drizzle/schema.ts` with new tables or columns — always use `mysqlTable` (TiDB, not pgTable)
2. Run `pnpm db:push` to generate and apply migration
3. Verify: `grep -c "mysqlTable" drizzle/schema.ts` — count should increase by the number of new tables
4. Current baseline: 82+ tables (as of MIYAR 3.0 Phase 10A)
5. MIYAR 3.0 Phase A adds 2 tables: `material_allocations` + `material_supplier_sources` → new baseline: 84+
