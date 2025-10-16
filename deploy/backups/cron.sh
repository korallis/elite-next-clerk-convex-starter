#!/bin/sh
set -euo pipefail

SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 3 * * *}"
SCRIPT_DIR="/backups/scripts"

echo "${SCHEDULE} ${SCRIPT_DIR}/run-backup.sh" > /etc/crontabs/root

echo "[backup] Cron schedule set to: ${SCHEDULE}" >&2
exec crond -f -d 8
