---
description: Mandatory file update protocol — must be followed after every task, every session
---

# MIYAR 3.0 — Mandatory Update Protocol

> **This rule is non-negotiable. Skip these updates and the next session starts with wrong context.**
> GEMINI.md enforces this at the start of every session. This file explains the WHY and HOW in detail.

---

## The Chain of Truth

These 3 files form the chain of truth. They must always be in sync:

```
GEMINI.md          ← master file (loaded every session)
PROGRESS.md        ← live task tracker (what is done vs pending)
miyar-memory.md    ← phase architecture + system stats + immutable rules
```

If any of these diverges from reality, the next Antigravity session builds on false context.

---

## What to Update After Every Task

### After ANY change to code or DB:

| File | What to Update |
|------|---------------|
| `PROGRESS.md` | Mark completed tasks ✅, add any newly discovered tasks, update System Stats if numbers changed |
| `miyar-memory.md` | Update phase status if it changed (e.g., "NEXT" → "IN PROGRESS" → "DONE — commit hash") |
| `GEMINI.md` | Update "Active Phase" line (top of file) if the phase changed |

### After completing a full phase:

| File | What to Update |
|------|---------------|
| `PROGRESS.md` | All tasks for the phase marked ✅, new system stats recorded, Agent File Update Log row added |
| `miyar-memory.md` | Phase status set to `✅ DONE — committed <hash>`, next phase set to 🔴 NEXT |
| `GEMINI.md` | Active Phase updated, Architecture tables updated if new files added |

### After adding new major files (engines, routers, pages):

Add a row to the Architecture tables in `GEMINI.md`:
- Server engine → Server table
- tRPC router → Server table
- Client page → Client table

### After DB schema changes:

1. Update table count in `miyar-memory.md` (System Stats section)
2. Update table count in `PROGRESS.md` (System Stats Snapshot)
3. Update baseline in `.agent/workflows/db-migrate.md`

### After tests change:

1. Record new test count in `PROGRESS.md` (System Stats Snapshot)
2. Update baseline in `miyar-memory.md` (System Stats)
3. Update baseline in `.agent/rules/coding-conventions.md`
4. Update baseline in `.agent/workflows/run-tests.md`

---

## Commit Format

Always commit with this format:
```
feat: MIYAR 3.0 Phase X — Short description of what was built
```

Examples:
- `feat: MIYAR 3.0 Phase A — Material Quantity Intelligence`
- `feat: MIYAR 3.0 Phase A — Surface area engine + allocation UI`
- `fix: MIYAR 3.0 — Supplier scraper DynamicConnector upgrade`

Never commit without running:
1. `pnpm test` — all tests pass
2. `pnpm check` — zero TypeScript errors

---

## The Update Log in PROGRESS.md

Every session must add one row to the Agent File Update Log table in `PROGRESS.md`:

```markdown
| YYYY-MM-DD | Brief description of what was done | Files updated (comma separated) |
```

This gives a human-readable timeline of what changed and when.

---

## Quick Checklist (copy this mentally before ending any session)

- [ ] All completed tasks marked ✅ in `PROGRESS.md`
- [ ] New tasks discovered added to `PROGRESS.md`
- [ ] Phase status updated in `miyar-memory.md`
- [ ] `GEMINI.md` Active Phase line correct
- [ ] New files added to Architecture tables in `GEMINI.md`
- [ ] DB table count updated if schema changed
- [ ] Test count updated if tests added
- [ ] `pnpm test` ran — baseline recorded
- [ ] `pnpm check` ran — zero errors
- [ ] Commit created with correct format
- [ ] Agent File Update Log row added to `PROGRESS.md`
