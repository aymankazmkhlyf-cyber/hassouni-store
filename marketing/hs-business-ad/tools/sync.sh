#!/usr/bin/env bash
# Mirror the project source into the main repo's next-release branch (worktree) and push, so work survives the container.
# Usage: tools/sync.sh "<commit message>"
set -euo pipefail
cd "$(dirname "$0")/.."
WT=/tmp/claude-0/nr
[ -d "$WT" ] || git -C /home/user/hassouni-store worktree add "$WT" next-release
D="$WT/marketing/hs-business-ad"
mkdir -p "$D"
rsync -a --delete --exclude node_modules --exclude out --exclude deliver --exclude .git \
  --exclude 'audio/*.wav' --exclude 'premiere_project/clips' --exclude 'premiere_project/audio' --exclude '__pycache__' --exclude 'public/studio/videoA.mp4' ./ "$D/"
cd "$WT"
git add -f -A marketing/hs-business-ad
git commit -q -m "$1" || true
git push -q origin next-release
git log --oneline -1
