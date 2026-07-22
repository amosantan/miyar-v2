#!/bin/bash
# session-end.sh — objective machine session record for MIYAR's second memory.
#
# Fires on SessionEnd (and on PreCompact, with --precompact). Appends an
# OBJECTIVE record of the session (branch, commits, files touched, timings) to
# today's journal so EVERY session leaves a durable footprint even if the agent
# forgets the session-close protocol. The agent's narrative lives above this
# block, written by /miyar-memory.
#
# HARD RULES (see docs/runbooks/memory-sync.md):
#   1. Log writes only. Never interpretive content, never product changes.
#   2. Never block a session. Always exit 0.
#   3. If nothing objectively happened, write nothing — no journal spam.
#   4. Nothing here is hardcoded except project-permanent facts. Changing state
#      is read live at run time, never inlined.
#
# Marker: .claude/state/session_start.txt ("<full-sha> <iso-utc>") written by
# session-start.sh. SessionEnd consumes+clears it; PreCompact advances it to the
# current HEAD so the final SessionEnd records only post-compact work (no dup).

set -u

MODE="${1:-sessionend}"   # "sessionend" (default) or "--precompact"

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$PROJECT_ROOT/.claude/state"
MARKER="$STATE_DIR/session_start.txt"
JOURNAL_DIR="$PROJECT_ROOT/memory/journal"
TODAY="$(date -u +%Y-%m-%d)"
JOURNAL="$JOURNAL_DIR/$TODAY.md"
NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Drain stdin (hook JSON) so the caller never blocks on a pipe.
cat >/dev/null 2>&1 || true

# --- Session start reference (best-effort) ---
START_SHA=""
START_TS=""
if [ -f "$MARKER" ]; then
    START_SHA="$(awk 'NR==1{print $1}' "$MARKER" 2>/dev/null)"
    START_TS="$(awk 'NR==1{print $2}' "$MARKER" 2>/dev/null)"
fi

END_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

# --- Objective facts ---
COMMITS=""
if [ -n "$START_SHA" ] && [ "$START_SHA" != "unknown" ] \
   && git -C "$PROJECT_ROOT" cat-file -e "${START_SHA}^{commit}" 2>/dev/null; then
    COMMITS="$(git -C "$PROJECT_ROOT" log --oneline "${START_SHA}..HEAD" 2>/dev/null)"
fi

# Exclude the hook's OWN writes (journal + state marker) so an unrecorded auto
# entry from a prior session can't re-trigger this gate on a later empty session.
# `cut -c4-` (not `awk '{print $NF}'`) so filenames with spaces aren't truncated
# (porcelain v1: 2 status chars + space, path from col 4; renames show "old -> new").
FILES_TOUCHED="$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null \
    | cut -c4- | grep -vE '^(memory/journal/|\.claude/state/)' | head -n 40)"

# Nothing happened → no footprint, no spam.
if [ -z "$COMMITS" ] && [ -z "$FILES_TOUCHED" ]; then
    [ "$MODE" != "--precompact" ] && rm -f "$MARKER" 2>/dev/null
    exit 0
fi

# --- Active-task cursor freshness ---
# Work happened this session; if .agent/state/CURRENT_TASK.md was NOT modified
# since session start, flag it so the next session sees the gap. Warning only —
# this hook never blocks (AGENTS.md: state files must reflect reality).
TASK_WARN=""
CURRENT_TASK="$PROJECT_ROOT/.agent/state/CURRENT_TASK.md"
if [ -f "$CURRENT_TASK" ] && [ -f "$MARKER" ]; then
    if [ ! "$CURRENT_TASK" -nt "$MARKER" ]; then
        TASK_WARN="yes"
    fi
fi

# --- Ensure today's journal exists (frontmatter per memory/TAG_TAXONOMY.md) ---
mkdir -p "$JOURNAL_DIR" 2>/dev/null
if [ ! -f "$JOURNAL" ]; then
    # noclobber guard: if a concurrent run created the file between this test and
    # the write, fail the create instead of clobbering, then fall through to append.
    ( set -C
      cat > "$JOURNAL" <<HDR
---
title: 'Session Journal — $TODAY'
description: 'Daily MIYAR session journal: narrative above, objective machine records below.'
tags:
  - type/journal
  - domain/memory
  - project/miyar
  - status/active
type: journal
date: $TODAY
updated: $TODAY
---

# $TODAY

<!-- Agent narrative goes here (written by /miyar-memory). Machine records append below. -->
HDR
    ) 2>/dev/null || true
fi

# --- Append the objective auto-record ---
{
    echo ""
    echo "## ⟨auto⟩ Machine Session Record — $NOW_UTC"
    echo "> Objective footprint written by \`.claude/hooks/session-end.sh\`. No interpretation."
    echo ""
    if [ "$MODE" = "--precompact" ]; then
        echo "- **Branch:** \`$BRANCH\` · **Range:** \`${START_SHA:0:9}\` → \`${END_SHA:0:9}\` · **Started:** ${START_TS:-unknown} · **Checkpoint:** $NOW_UTC (pre-compact)"
    else
        echo "- **Branch:** \`$BRANCH\` · **Range:** \`${START_SHA:0:9}\` → \`${END_SHA:0:9}\` · **Started:** ${START_TS:-unknown} · **Ended:** $NOW_UTC"
    fi
    if [ -n "$COMMITS" ]; then
        echo "- **Commits this session:**"
        printf '%s\n' "$COMMITS" | sed 's/^/    - /'
    else
        echo "- **Commits this session:** none (uncommitted work only)"
    fi
    if [ -n "$FILES_TOUCHED" ]; then
        echo "- **Files touched (uncommitted, top 40):**"
        printf '%s\n' "$FILES_TOUCHED" | sed 's/^/    - /'
    fi
    if [ -n "$TASK_WARN" ]; then
        echo "- ⚠️ **CURRENT_TASK NOT UPDATED:** work happened this session but \`.agent/state/CURRENT_TASK.md\` did not change. Reconcile it before starting the next step."
    fi
} >> "$JOURNAL"

# SessionEnd consumes the marker; PreCompact advances it to the current HEAD so
# the final SessionEnd records only post-compact work (no double-record of range).
if [ "$MODE" = "--precompact" ]; then
    mkdir -p "$STATE_DIR" 2>/dev/null
    printf '%s %s\n' "$END_SHA" "$NOW_UTC" > "$MARKER" 2>/dev/null || true
else
    rm -f "$MARKER" 2>/dev/null
fi

exit 0
