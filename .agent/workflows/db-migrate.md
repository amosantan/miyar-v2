---
description: How to apply database schema migrations
---
# Database Migration
1. Edit `drizzle/schema.ts` with new tables or columns
2. Run `pnpm db:push` to generate and apply migration
3. Verify table count with: `grep -c "^export const" drizzle/schema.ts`
4. Current baseline: 47 tables
