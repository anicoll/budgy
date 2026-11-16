#!/usr/bin/env bash
# Refresh the vendored Modern Web Guidance skill from
# https://github.com/GoogleChrome/modern-web-guidance (Apache 2.0).
#
#   scripts/update-web-guidance.sh          latest main
#   scripts/update-web-guidance.sh <ref>    a tag, branch or commit
#
# The skill lives in .claude/skills/modern-web-guidance. It is copied in
# rather than installed as a plugin so cloud sessions, which may not be able
# to run npx, can still read the guides from disk. Review the diff and commit.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
ref="${1:-main}"
dest=.claude/skills/modern-web-guidance
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --filter=blob:none https://github.com/GoogleChrome/modern-web-guidance "$tmp/src"
git -C "$tmp/src" checkout --quiet "$ref"
commit="$(git -C "$tmp/src" rev-parse HEAD)"

rm -rf "$dest"
mkdir -p "$(dirname "$dest")"
cp -R "$tmp/src/skills/modern-web-guidance" "$dest"
cp "$tmp/src/LICENSE" "$dest/LICENSE"
echo "$commit" > "$dest/UPSTREAM_COMMIT"

echo "Updated $dest to $commit"
git status --short -- "$dest" | head -20
