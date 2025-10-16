#!/bin/sh
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TARGET_DIR="${BACKUP_TARGET:-/backups/archive}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "${TARGET_DIR}"

ARCHIVE_PATH="${TARGET_DIR}/leo-backup-${TIMESTAMP}.tar.gz"

echo "[backup] creating archive ${ARCHIVE_PATH}" >&2
tar -czf "${ARCHIVE_PATH}" -C / data

echo "[backup] pruning archives older than ${RETENTION_DAYS} days" >&2
find "${TARGET_DIR}" -type f -name 'leo-backup-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete
