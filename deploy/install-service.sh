#!/usr/bin/env bash
# On the server, once (after the first deploy.sh): installs the service + nginx site.  sudo bash install-service.sh
set -euo pipefail
cd "$(dirname "$0")"
cp sol-survivors.service /etc/systemd/system/
[ -f /etc/nginx/conf.d/nasa.conf ] || cp nginx-nasa.conf /etc/nginx/conf.d/nasa.conf   # (never overwrites: certbot edits this file)
systemctl daemon-reload
systemctl enable --now sol-survivors
nginx -t && systemctl reload nginx
curl -fsS http://127.0.0.1:3000/healthz && echo
