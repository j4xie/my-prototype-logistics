#!/bin/bash
# safe-commit.sh — concurrent-edit-safe git commit
#
# Problem: when 2+ Claude sessions or IDE instances modify files simultaneously,
# `git add file1 && git commit -m "msg"` commits ALL staged files (including
# concurrent session's staged work). Result: commit message describes one change
# but commit body includes unrelated files.
#
# Apr 28 2026 incident count: 3 (Phase A 6-keyword, Phase B factoryAge+cross-factory).
# Each fix commit ended up containing 1-2 unrelated food-kb files from concurrent
# session. Already-pushed → can't roll back, only follow-up doc commits.
#
# This script uses `git commit -- FILE...` which uses --only mode (the default
# when paths are listed). The git docs say:
#
#   "Whether index has changes for other paths or not, this matters only for
#    the resulting commit; index entries are not affected by --only."
#
# So even if another session pre-staged X, my `safe-commit "msg" Y` only commits
# Y. The pre-staged X stays staged for the other session to handle.
#
# Usage:
#   ./scripts/safe-commit.sh "commit message" file1 [file2 ...]
#   ./scripts/safe-commit.sh "$(cat <<'EOF'
#   multi-line
#   commit message
#   EOF
#   )" path1 path2

set -e

if [ "$#" -lt 2 ]; then
    cat <<'USAGE'
Usage: safe-commit.sh "commit message" <file1> [file2 ...]

Wraps `git commit -- FILE...` for concurrent-edit safety. Only the listed
files end up in the commit, even if other files are staged by concurrent sessions.

For multi-line messages, use a heredoc:
  ./scripts/safe-commit.sh "$(cat <<'EOF'
  Subject line

  Body explanation.
  EOF
  )" backend/foo.py web/bar.vue
USAGE
    exit 1
fi

MSG="$1"
shift
FILES=("$@")

# Sanity: all listed files must exist
for f in "${FILES[@]}"; do
    if [ ! -e "$f" ]; then
        echo "[safe-commit] ERROR: '$f' does not exist" >&2
        exit 1
    fi
done

echo "[safe-commit] Committing ${#FILES[@]} file(s) only:"
printf '  → %s\n' "${FILES[@]}"

# Inform user about other dirty/staged work that will NOT be in this commit
OTHER_STAGED=$(git diff --cached --name-only 2>/dev/null | grep -vFx -f <(printf '%s\n' "${FILES[@]}") || true)
OTHER_DIRTY=$(git diff --name-only 2>/dev/null | grep -vFx -f <(printf '%s\n' "${FILES[@]}") || true)

if [ -n "$OTHER_STAGED" ]; then
    echo "[safe-commit] ⚠️  Other STAGED files (concurrent session — NOT in this commit):"
    echo "$OTHER_STAGED" | head -10 | sed 's/^/    /'
fi
if [ -n "$OTHER_DIRTY" ]; then
    DIRTY_COUNT=$(echo "$OTHER_DIRTY" | wc -l)
    echo "[safe-commit] ℹ  Other unstaged dirty files: $DIRTY_COUNT (not affected)"
fi

# Use --only mode via path arguments. NB: this updates index from working tree
# for these paths, then commits, then restores original index. Other staged
# files remain staged for the concurrent session to handle.
git commit -m "$MSG" -- "${FILES[@]}"

echo "[safe-commit] ✓ Committed. Verifying scope..."

# Verify-after-commit: did pre-commit hook auto-stage anything sneaky?
ACTUAL_FILES=$(git show --name-only --pretty=format: HEAD | grep -v '^$' | sort)
EXPECTED_FILES=$(printf '%s\n' "${FILES[@]}" | sort)

if [ "$ACTUAL_FILES" = "$EXPECTED_FILES" ]; then
    echo "[safe-commit] ✓ Commit scope verified — exactly the listed files."
else
    echo "[safe-commit] ⚠️  WARNING: commit contains unexpected files!"
    echo "Expected:"
    echo "$EXPECTED_FILES" | sed 's/^/    /'
    echo "Actual:"
    echo "$ACTUAL_FILES" | sed 's/^/    /'
    echo
    echo "If this was caused by a pre-commit hook auto-formatting, that may be"
    echo "fine. If from concurrent session, review the commit and consider"
    echo "git reset --soft HEAD~1 (only if NOT yet pushed) to redo cleanly."
fi
