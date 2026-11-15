#!/usr/bin/env bash
# One-time setup on a server that ALREADY runs other things (nginx, certbot, another app).
# It only adds: Node 22, rsync, a swap file (if there is none), and a 'sol' user. It does not touch nginx or certbot.
# Run on the server as:  sudo bash setup-server.sh
set -euo pipefail
dnf install -y rsync
# Node 22 from the Amazon Linux repo (ARM64); falls back to NodeSource
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  dnf install -y nodejs22 nodejs22-npm || { curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && dnf install -y nodejs; }
fi
node -v; npm -v
# 1 GB swap so npm install and the other apps never run out of memory on a 1 GB machine
if [ -z "$(swapon --show --noheadings)" ] && [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# The game runs as its own user, not root
id sol >/dev/null 2>&1 || useradd --system --home /opt/sol-survivors --shell /sbin/nologin sol
mkdir -p /opt/sol-survivors && chown sol:sol /opt/sol-survivors
free -m | head -3
echo "Server ready. Next (on your Mac): bash deploy/deploy.sh ..."
