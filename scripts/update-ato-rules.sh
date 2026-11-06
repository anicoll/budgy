#!/usr/bin/env bash
# Check the engine's tax and super rules against the ATO, and open a PR if
# the ATO's tables have changed. Run it locally each July to September: the
# ATO turns away scripted requests from GitHub's servers, so this can't run
# in Actions.
#
#   scripts/update-ato-rules.sh                 fetch the pages with update_ato_rules.py
#   scripts/update-ato-rules.sh --snapshot F    use F, saved from ato-snapshot.browser.js
#   scripts/update-ato-rules.sh --no-pr         update the snapshot and report, but don't commit
#
# What it does:
#   1. Starts a branch ato-rules/<today> from origin/main (needs a clean tree).
#   2. Refreshes packages/engine/src/golden/data/ato-pages.json and formats it.
#   3. Stops if nothing changed.
#   4. Runs src/golden/ato.snapshot.test.ts, which lists every engine value
#      that no longer matches the ATO, with its source page.
#   5. Commits the snapshot, pushes, and opens a PR with that list. The PR's
#      Test check stays red until TAX_RULES, SUPER_RULES and HELP_INDEXATION
#      are updated on the branch.
#
# Needs git, python3, pnpm (pnpm install done) and, for the PR, gh signed in.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
SNAPSHOT=packages/engine/src/golden/data/ato-pages.json
from_file=""
make_pr=true
while [ $# -gt 0 ]; do
  case "$1" in
    --snapshot) from_file="$(realpath "$2")"; shift 2 ;;
    --no-pr) make_pr=false; shift ;;
    -h | --help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first; this starts a branch from origin/main." >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

branch="ato-rules/$(date +%Y-%m-%d)"
git fetch --quiet origin main
git switch --quiet -c "$branch" origin/main
echo "On new branch $branch"

if [ -n "$from_file" ]; then
  python3 -c 'import json, sys; json.load(open(sys.argv[1]))' "$from_file"
  cp "$from_file" "$SNAPSHOT"
  echo "- snapshot taken in a browser with ato-snapshot.browser.js" > "$work/changes.txt"
elif ! python3 -I scripts/update_ato_rules.py > "$work/changes.txt"; then
  cat >&2 <<'EOF'

Couldn't fetch the ATO pages. If the ATO is turning this machine away too,
open any www.ato.gov.au page in a browser, paste scripts/ato-snapshot.browser.js
into the developer console, save what it prints to a file, and run:

  scripts/update-ato-rules.sh --snapshot that-file.json
EOF
  git switch --quiet - && git branch --quiet -D "$branch"
  exit 1
fi
cat "$work/changes.txt"
pnpm exec biome format --write "$SNAPSHOT" > /dev/null 2>&1

if git diff --quiet; then
  echo "The ATO's tables match the snapshot. Nothing to do."
  git switch --quiet - && git branch --quiet -D "$branch"
  exit 0
fi

echo "Comparing the engine with the ATO..."
if pnpm --filter @budgy/engine exec vitest run src/golden/ato.snapshot.test.ts > "$work/test.log" 2>&1; then
  echo "The engine still matches every ATO figure. Only page dates or tables outside the engine's years changed." > "$work/report.md"
else
  sed -n '/^<!-- ato-report -->$/,/^<!-- \/ato-report -->$/p' "$work/test.log" | sed '1d;$d' > "$work/report.md"
  if [ ! -s "$work/report.md" ]; then
    cat "$work/test.log" >&2
    echo "The snapshot test failed without a report (see above)." > "$work/report.md"
  fi
fi
echo
cat "$work/report.md"
echo

if ! $make_pr; then
  echo "Snapshot updated on $branch (not committed, --no-pr)."
  exit 0
fi

{
  echo "The ATO has changed a table our rules come from. This updates the snapshot in \`$SNAPSHOT\`."
  echo
  echo "## Pages that changed"
  echo
  cat "$work/changes.txt"
  echo
  echo "## What the engine needs"
  echo
  cat "$work/report.md"
  echo
  echo "## To finish this PR"
  echo
  echo "- [ ] Update \`TAX_RULES\` (packages/engine/src/tax/rules.ts), \`SUPER_RULES\` (super/rules.ts) or \`HELP_INDEXATION\` and \`HELP_THRESHOLDS_PUBLISHED_TO\` (help/early.ts) on this branch until the Test check is green."
  echo "- [ ] Drop any \`notes\` that say a value was carried from the year before, now the ATO has published it."
  echo "- [ ] If tax rates changed, check the withholding coefficients and golden cases in packages/engine/src/golden too, and move \`checked\` on in golden/sources.ts."
  echo "- [ ] Check a couple of figures against the ATO pages linked above before merging."
} > "$work/body.md"

git commit --quiet -am "Update the ATO rules snapshot ($(date +%Y-%m-%d))"
git push --quiet -u origin "$branch"
gh pr create --base main --head "$branch" \
  --title "Update tax and super rules from the ATO ($(date +%Y-%m-%d))" --body-file "$work/body.md"
