#!/bin/bash
# session-start.sh — writes the session marker and prints a live recall banner.
#
# Runs on SessionStart. Two jobs:
#   1. Stamp .claude/state/session_start.txt so session-end.sh can compute an
#      objective range (commits/files since start).
#   2. Print a short orientation banner so the agent starts with real state.
#
# DRIFT RULE: nothing in this banner may be hardcoded except project-permanent
# facts (paths, file names). Anything that changes — HEAD, branch, next
# executable step, memory freshness — MUST be read live at run time. A banner
# that restates a fact is a banner that will eventually lie.
#
# Never blocks. Always exits 0.

set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$PROJECT_ROOT/.claude/state"
MARKER="$STATE_DIR/session_start.txt"
NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TODAY="$(date -u +%Y-%m-%d)"

# Drain stdin (hook JSON) so the caller never blocks on a pipe.
cat >/dev/null 2>&1 || true

# --- Stamp the marker (full SHA + ISO UTC) ---
HEAD_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
mkdir -p "$STATE_DIR" 2>/dev/null
printf '%s %s\n' "$HEAD_SHA" "$NOW_UTC" > "$MARKER" 2>/dev/null || true

# --- Live state, read at run time ---
ROADMAP="$PROJECT_ROOT/.agent/state/ROADMAP.md"
NEXT_STEP="(unknown — read .agent/state/ROADMAP.md)"
if [ -f "$ROADMAP" ]; then
    LINE="$(grep -m1 -i 'Next executable step' "$ROADMAP" 2>/dev/null || true)"
    [ -n "$LINE" ] && NEXT_STEP="$(printf '%s' "$LINE" | sed 's/^[-*] *//')"
fi

TASK_FILE="$PROJECT_ROOT/.agent/state/CURRENT_TASK.md"
TASK_LINE="(none)"
if [ -f "$TASK_FILE" ]; then
    TID="$(grep -m1 -E '^- ID:' "$TASK_FILE" 2>/dev/null | sed 's/^- ID: *//')"
    TST="$(grep -m1 -E '^- Status:' "$TASK_FILE" 2>/dev/null | sed 's/^- Status: *//')"
    [ -n "${TID:-}" ] && TASK_LINE="${TID} (${TST:-unknown})"
fi

# Memory freshness — most recent journal entry, computed live.
JOURNAL_DIR="$PROJECT_ROOT/memory/journal"
LAST_JOURNAL="(none yet)"
if [ -d "$JOURNAL_DIR" ]; then
    LJ="$(ls -1 "$JOURNAL_DIR"/[0-9]*.md 2>/dev/null | sed 's|.*/||; s|\.md$||' | sort | tail -n 1)"
    [ -n "$LJ" ] && LAST_JOURNAL="$LJ"
fi

cat <<BANNER
🧠 MIYAR second memory — session start ($NOW_UTC)

  Branch        : $BRANCH @ ${HEAD_SHA:0:9}
  Active task   : $TASK_LINE
  $NEXT_STEP
  Last journal  : $LAST_JOURNAL  (today: $TODAY)

  Read first    : AGENTS.md · docs/PROJECT_STATE.md · .agent/state/{ROADMAP,LESSONS,KNOWN_FAILURES}.md
  Then          : memory/README.md  (hot cache + index)

  ⚠️  Obsidian recall is UNSAFE unscoped — 67% of the index is stale
      .claude/worktrees duplicates that outrank the canonical file.
      Always pass pathPrefix ("memory", ".agent/state", "docs") or
      excludePaths [".claude/worktrees", ...].
      Rules: memory/context/obsidian-recall-discipline.md

  At close      : /miyar-memory   (the SessionEnd hook records objective facts on its own)
BANNER

exit 0
