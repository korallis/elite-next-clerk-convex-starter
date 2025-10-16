#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

INVENTORY_FILE=${1:-"${SCRIPT_DIR}/ansible/inventory.ini"}
EXTRA_VARS=${2:-}

if ! command -v ansible-playbook >/dev/null 2>&1; then
  echo "[provision] ansible is required. Install via: pip install ansible" >&2
  exit 1
fi

if [ ! -f "${INVENTORY_FILE}" ]; then
  echo "[provision] inventory file not found at ${INVENTORY_FILE}" >&2
  echo "Copy ${SCRIPT_DIR}/ansible/inventory.example.ini to ${INVENTORY_FILE} and update host details." >&2
  exit 1
fi

echo "[provision] Installing required Ansible collections"
ansible-galaxy collection install -r "${SCRIPT_DIR}/ansible/requirements.yml" >/dev/null

PLAYBOOK="${SCRIPT_DIR}/ansible/site.yml"

CMD=(ansible-playbook -i "${INVENTORY_FILE}" "${PLAYBOOK}" -e "local_repo_root=${ROOT_DIR}")

if [ -n "${EXTRA_VARS}" ]; then
  CMD+=(-e "${EXTRA_VARS}")
fi

echo "[provision] Running Ansible playbook"
"${CMD[@]}"

echo "[provision] Playbook completed"
