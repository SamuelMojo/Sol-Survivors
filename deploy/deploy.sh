#!/usr/bin/env bash
# Run on YOUR computer, from the game folder:   bash deploy/deploy.sh ec2-user@nasa.samuelojo.tech  [path-to-key.pem]
# Copies the game to the server, installs packages and restarts it. Safe to run again for every update.
set -euo pipefail
TARGET="${1:?usage: bash deploy/deploy.sh ec2-user@HOST [key.pem]}"
KEY="${2:-}"
SSH_OPTS=(); [ -n "$KEY" ] && SSH_OPTS=(-i "$KEY")
cd "$(dirname "$0")/.."
echo "-> copying files"
rsync -az --delete -e "ssh ${SSH_OPTS[*]:-}" \
  --exclude node_modules --exclude .git --exclude dist --exclude tests --exclude '*.pdf' --exclude cloud-resume \
  ./ "$TARGET:/tmp/sol-upload/"
echo "-> installing and restarting"
ssh "${SSH_OPTS[@]}" "$TARGET" 'sudo rsync -a --delete --exclude node_modules /tmp/sol-upload/ /opt/sol-survivors/ \
  && sudo chown -R sol:sol /opt/sol-survivors \
  && sudo -u sol env npm_config_cache=/tmp/sol-npm-cache bash -c "cd /opt/sol-survivors && npm ci --omit=dev --no-audit --no-fund" \
  && sudo systemctl restart sol-survivors && sleep 2 \
  && curl -fsS http://127.0.0.1:3000/healthz && echo'
echo "Done. Open https://nasa.samuelojo.tech"
