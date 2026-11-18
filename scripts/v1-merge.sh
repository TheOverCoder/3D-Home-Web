#!/usr/bin/env bash
# Update v1: merge one build agent's branch into the session branch, check the merged tree, and say in one screen how it
# went (update-v1/RUN.md §5, CHECKS.md §5). It never pushes: the orchestrator does.
#
#   scripts/v1-merge.sh <branch> [<agent>]
#
# Run it in the checkout that has the session branch (owners.json's "base") checked out, with nothing uncommitted.
# It merges with --no-ff (the message copies the trailers of the branch's last commit), runs `npm run check` with
# Vitest on V1_MAX_WORKERS workers (2), then scripts/v1-scope.mjs for the agent's row. The agent is the second
# argument, else what v1-scope finds (`git config branch.<branch>.v1agent`, or the end of the branch's name).
# Exits 0 when all is green, 1 when the check is red or a file is outside the row (the merge stays: the summary says
# how to undo it), 3 when the merge conflicts (it is aborted), 2 on a wrong call. Logs: <git dir>/v1-merge/.
set -uo pipefail

branch=${1:-}
agent=${2:-}
workers=${V1_MAX_WORKERS:-2}
if [ -z "$branch" ]; then
  echo "usage: scripts/v1-merge.sh <branch> [<agent>]" >&2
  exit 2
fi
root=$(git rev-parse --show-toplevel) || exit 2
cd "$root" || exit 2

base=$(node -p "require('./update-v1/owners.json').base") || exit 2
here=$(git branch --show-current)
if [ "$here" != "$base" ]; then
  echo "v1-merge: this checkout is on '$here', not $base" >&2
  exit 2
fi
if ! git rev-parse --verify --quiet "$branch^{commit}" >/dev/null; then
  echo "v1-merge: no branch $branch" >&2
  exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "v1-merge: uncommitted changes here; commit them or set them aside first" >&2
  exit 2
fi
if [ -z "$agent" ]; then
  agent=$(node scripts/v1-scope.mjs --which "$branch") || {
    echo "v1-merge: whose row is $branch? Pass the agent: scripts/v1-merge.sh $branch <agent>" >&2
    exit 2
  }
fi

pre=$(git rev-parse HEAD)
short=$(git rev-parse --short HEAD)
commits=$(git rev-list --count "$pre..$branch")
plural=s
[ "$commits" -eq 1 ] && plural=
if [ "$commits" -eq 0 ]; then
  echo "v1-merge: $branch has nothing that $base lacks"
  exit 0
fi
logs="$(git rev-parse --path-format=absolute --git-common-dir)/v1-merge"
mkdir -p "$logs"
stamp="$logs/$(date +%Y%m%d-%H%M%S)-$agent"

# the merge: its message names the agent and the branch, and keeps the trailers the agent's commits carry
trailers=$(git log -1 --format='%(trailers:only,unfold)' "$branch")
message="Merge update v1 $agent ($branch)"
[ -n "$trailers" ] && message="$message"$'\n\n'"$trailers"
if ! git merge --no-ff --no-edit -m "$message" "$branch" >"$stamp-merge.log" 2>&1; then
  conflicts=$(git diff --name-only --diff-filter=U)
  git merge --abort
  echo "── v1-merge $agent ── $branch → $base"
  echo "merge   CONFLICT, aborted ($commits commit$plural). The agent merges $base in and resolves (RUN.md §2):"
  echo "${conflicts:-  (see $stamp-merge.log)}" | sed 's/^/    /'
  exit 3
fi
stat=$(git diff --shortstat "$pre" HEAD | sed 's/^ *//')

# the check, on the merged tree: package.json's own command, with Vitest's workers capped
check=$(npm pkg get scripts.check | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")))')
case "$check" in
  *"vitest run"*) check=${check/vitest run/vitest run --maxWorkers=$workers} ;;
  *) echo "v1-merge: package.json's check runs no 'vitest run'; running it as it is" >&2 ;;
esac
start=$(date +%s)
PATH="$root/node_modules/.bin:$PATH" bash -c "$check" >"$stamp-check.log" 2>&1
checked=$?
took=$(($(date +%s) - start))

# the row: files changed against where the branch left the session branch, before this merge
scoped=$(node scripts/v1-scope.mjs "$branch" --agent "$agent" --base "$short")
inside=$?

echo "── v1-merge $agent ── $branch → $base"
echo "merge   $(git rev-parse --short HEAD) (no-ff) on $short · $commits commit$plural · $stat"
if [ "$checked" -eq 0 ]; then
  echo "check   green · $((took / 60)) min $((took % 60)) s · Vitest on $workers workers"
else
  echo "check   RED · $((took / 60)) min $((took % 60)) s · $stamp-check.log ends:"
  tail -n 12 "$stamp-check.log" | sed 's/^/    /'
fi
echo "$scoped" | sed '1s/^v1-scope /scope   /; 2,$s/^/  /'
if [ "$checked" -eq 0 ] && [ "$inside" -eq 0 ]; then
  echo "next    the agent's specs on the merged tree (CHECKS.md §5), then push"
  exit 0
fi
echo "next    send it back (RUN.md §5), or undo: git reset --keep $short"
exit 1
