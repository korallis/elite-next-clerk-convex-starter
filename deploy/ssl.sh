#!/usr/bin/env bash
set -euo pipefail

DOMAIN=${1:-leo.lb-tech.co.uk}

apt-get update -y
apt-get install -y certbot python3-certbot-nginx

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@lb-tech.co.uk --redirect

systemctl reload nginx
echo "TLS enabled for $DOMAIN"
