#!/usr/bin/env bash
# Clones the private repos the build reads, next to the website checkout, the
# way they sit on a developer's machine:
#   ../learncivicsense-content   required: lessons + taxonomy
#   ../learncivicsense-workflow  optional: PUBLISH-MANIFEST.json (homepage
#                                rotation signals) and lint.py (content lint)
#
# Tokens: CONTENT_REPO_TOKEN (required). For lcs-workflow, WORKFLOW_REPO_TOKEN
# is used when set, otherwise the content token is tried. Writes content_sha,
# workflow_sha and workflow_available to $GITHUB_OUTPUT.
#
# CI only: it refuses to run anywhere else, because on a laptop those sibling
# folders are the real working copies, with work that is not on GitHub.
set -euo pipefail

if [ "${GITHUB_ACTIONS:-}" != "true" ]; then
  echo "clone-sources.sh runs in GitHub Actions only (it would replace your local sibling repos)." >&2
  exit 1
fi
: "${CONTENT_REPO_TOKEN:?CONTENT_REPO_TOKEN is not set: the build needs lcs-content}"
out="${GITHUB_OUTPUT:-/dev/null}"

for dir in ../learncivicsense-content ../learncivicsense-workflow; do
  if [ -e "$dir" ]; then echo "::error::$dir already exists" >&2; exit 1; fi
done

clone() { # <repo> <dir> <token>
  git clone --quiet --depth 1 "https://x-access-token:${3}@github.com/gragtajar/${1}.git" "$2"
}

clone lcs-content ../learncivicsense-content "$CONTENT_REPO_TOKEN"
content_sha=$(git -C ../learncivicsense-content rev-parse HEAD)
lessons=$(find ../learncivicsense-content -name '*.en.md' | wc -l | tr -d ' ')
echo "lcs-content  @ ${content_sha:0:7}  (${lessons} English lesson files)"
echo "content_sha=${content_sha}" >> "$out"

workflow_sha=""
for token in "${WORKFLOW_REPO_TOKEN:-}" "$CONTENT_REPO_TOKEN"; do
  [ -n "$token" ] || continue
  if clone lcs-workflow ../learncivicsense-workflow "$token" 2>/dev/null; then
    workflow_sha=$(git -C ../learncivicsense-workflow rev-parse HEAD)
    break
  fi
  rm -rf ../learncivicsense-workflow
done

if [ -n "$workflow_sha" ]; then
  echo "lcs-workflow @ ${workflow_sha:0:7}"
  echo "workflow_available=true" >> "$out"
else
  echo "::notice title=lcs-workflow not readable::No token here can read gragtajar/lcs-workflow, so the build uses content-derived homepage rotation signals and the content lint is skipped. Give WORKFLOW_REPO_TOKEN (or CONTENT_REPO_TOKEN) read access to lcs-workflow to enable both."
  echo "workflow_available=false" >> "$out"
fi
echo "workflow_sha=${workflow_sha}" >> "$out"
