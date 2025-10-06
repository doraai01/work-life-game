#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   REPO_URL=https://github.com/doraai01/work-life-game.git \
#   GH_TOKEN=ghp_xxx \
#   GIT_USER="Your Name" GIT_EMAIL="you@example.com" \
#   ./scripts/deploy.sh
#
# Notes:
# - If GH_TOKEN is set, it's used transiently via http.extraheader (not saved).
# - If the repo is already initialized, this script won’t re-init.

REMOTE=${REMOTE:-origin}
BRANCH=${BRANCH:-main}

if [[ -z "${REPO_URL:-}" ]]; then
  echo "[deploy] Please set REPO_URL (e.g., https://github.com/<owner>/<repo>.git)" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "[deploy] Initializing git repo"
  git init
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: deploy snapshot"
fi

git branch -M "$BRANCH" || true

# Configure identity (if provided)
if [[ -n "${GIT_USER:-}" ]]; then git config user.name "$GIT_USER"; fi
if [[ -n "${GIT_EMAIL:-}" ]]; then git config user.email "$GIT_EMAIL"; fi

# Set remote
if git remote get-url "$REMOTE" >/dev/null 2>&1; then
  git remote set-url "$REMOTE" "$REPO_URL"
else
  git remote add "$REMOTE" "$REPO_URL"
fi

echo "[deploy] Pushing to $REPO_URL ($BRANCH)"
if [[ -n "${GH_TOKEN:-}" ]]; then
  git -c http.extraheader="Authorization: Bearer ${GH_TOKEN}" push -u "$REMOTE" "$BRANCH"
else
  git push -u "$REMOTE" "$BRANCH"
fi

echo "[deploy] Done. Check GitHub Actions → Deploy GitHub Pages."

