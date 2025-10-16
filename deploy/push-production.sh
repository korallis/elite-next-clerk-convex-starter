#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST=${REMOTE_HOST:-root@31.97.58.72}
REMOTE_APP_DIR=${REMOTE_APP_DIR:-/var/www/leo-app}
REMOTE_CURRENT_DIR="${REMOTE_APP_DIR}/current"
REMOTE_SHARED_DIR="${REMOTE_APP_DIR}/shared"
REMOTE_SHARED_CONFIG_DIR="${REMOTE_SHARED_DIR}/config"

COMPOSE_PROJECT=${COMPOSE_PROJECT:-leo}
REMOTE_COMPOSE_DIR="${REMOTE_CURRENT_DIR}/deploy"
REMOTE_COMPOSE_FILE="${REMOTE_COMPOSE_DIR}/compose.production.yml"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

SSH_KEY_PATH=${SSH_KEY_PATH:-${REPO_ROOT}/SSH/id_ed25519}
SSH_BASE_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=no)
if [ -f "${SSH_KEY_PATH}" ]; then
  SSH_BASE_OPTS+=(-i "${SSH_KEY_PATH}")
fi

HEALTHCHECK_URL=${HEALTHCHECK_URL:-https://leo.lb-tech.co.uk/api/health}
ENV_FILES_RAW=${ENV_FILES:-.env.production,.env.local}
GENERATE_PROD_ENV=${GENERATE_PROD_ENV:-1}

PROD_ENV_VARIABLES=(
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  NEXT_PUBLIC_CLERK_FRONTEND_API_URL
  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
  NEXT_PUBLIC_CONVEX_URL
  CONVEX_ADMIN_TOKEN
  CONNECTION_ENCRYPTION_KEY
  CLERK_SECRET_KEY
  OPENAI_API_KEY
)

OPTIONAL_PROD_ENV_VARIABLES=(
  QDRANT_URL
  QDRANT_API_KEY
)

RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude '.github'
  --exclude '.next'
  --exclude '.turbo'
  --exclude 'node_modules'
  --exclude 'SSH'
  --exclude 'deploy/push-production.sh'
  --exclude '.DS_Store'
  --exclude '*.log'
)

echo "[deploy] Ensuring shared directories on remote"
ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" "mkdir -p '${REMOTE_SHARED_CONFIG_DIR}' '${REMOTE_SHARED_DIR}/data' '${REMOTE_SHARED_DIR}/prometheus' '${REMOTE_SHARED_DIR}/loki' '${REMOTE_SHARED_DIR}/grafana' '${REMOTE_SHARED_DIR}/backups' '${REMOTE_CURRENT_DIR}' '${REMOTE_COMPOSE_DIR}'"

echo "[deploy] Syncing repository to ${REMOTE_HOST}:${REMOTE_CURRENT_DIR}"
rsync -az --delete "${RSYNC_EXCLUDES[@]}" -e "ssh ${SSH_BASE_OPTS[*]}" "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_CURRENT_DIR}"

IFS=',' read -r -a ENV_FILE_CANDIDATES <<< "${ENV_FILES_RAW}"
ENV_FILE_BASENAMES=()
for env_path in "${ENV_FILE_CANDIDATES[@]}"; do
  trimmed=$(echo "${env_path}" | xargs)
  if [ -z "${trimmed}" ]; then
    continue
  fi
  local_path="${REPO_ROOT}/${trimmed}"
  if [ -f "${local_path}" ]; then
    base_name="$(basename "${trimmed}")"
    echo "[deploy] Uploading secret file ${trimmed}"
    rsync -az -e "ssh ${SSH_BASE_OPTS[*]}" "${local_path}" "${REMOTE_HOST}:${REMOTE_SHARED_CONFIG_DIR}/${base_name}"
    ENV_FILE_BASENAMES+=("${base_name}")
  else
    if [ "${GENERATE_PROD_ENV}" = "1" ] && [ "${trimmed}" = ".env.production" ]; then
      echo "[deploy] Info: ${trimmed} will be generated from environment variables"
    else
      echo "[deploy] Warning: secret file ${trimmed} not found locally; skipping" >&2
    fi
  fi
done

ENV_FILE_NAMES="${ENV_FILE_BASENAMES[*]}"

if [ "${GENERATE_PROD_ENV}" = "1" ]; then
  missing_prod_envs=()
  temp_env_file=$(mktemp)
  # Required variables
  for key in "${PROD_ENV_VARIABLES[@]}"; do
    pref="PROD_${key}"
    value="$(printenv "${pref}" 2>/dev/null || true)"
    if [ -z "${value}" ]; then
      value="$(printenv "${key}" 2>/dev/null || true)"
    fi
    if [ -z "${value}" ]; then
      missing_prod_envs+=("${pref}")
      continue
    fi
    escaped_value=$(printf '%s' "${value}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '%s="%s"\n' "${key}" "${escaped_value}" >>"${temp_env_file}"
  done

  if [ ${#missing_prod_envs[@]} -ne 0 ]; then
    rm -f "${temp_env_file}"
    echo "[deploy] Error: missing production environment variables: ${missing_prod_envs[*]}" >&2
    echo "[deploy] Provide these via exported environment variables before running deploy." >&2
    exit 1
  fi

  # Optional variables
  for key in "${OPTIONAL_PROD_ENV_VARIABLES[@]}"; do
    pref="PROD_${key}"
    value="$(printenv "${pref}" 2>/dev/null || true)"
    if [ -z "${value}" ]; then
      value="$(printenv "${key}" 2>/dev/null || true)"
    fi
    if [ -z "${value}" ]; then
      continue
    fi
    escaped_value=$(printf '%s' "${value}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '%s="%s"\n' "${key}" "${escaped_value}" >>"${temp_env_file}"
  done

  echo "[deploy] Generating production environment file from shell variables"
  rsync -az -e "ssh ${SSH_BASE_OPTS[*]}" "${temp_env_file}" "${REMOTE_HOST}:${REMOTE_SHARED_CONFIG_DIR}/.env.production"
  rm -f "${temp_env_file}"
  ENV_FILE_BASENAMES+=(".env.production")
fi

echo "[deploy] Linking environment files and deploying containers on remote host"
ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_HOST}" bash <<EOSSH
set -euo pipefail

REMOTE_SHARED_CONFIG_DIR="${REMOTE_SHARED_CONFIG_DIR}"
REMOTE_SHARED_DIR="${REMOTE_SHARED_DIR}"
REMOTE_CURRENT_DIR="${REMOTE_CURRENT_DIR}"
REMOTE_COMPOSE_DIR="${REMOTE_COMPOSE_DIR}"
REMOTE_COMPOSE_FILE="${REMOTE_COMPOSE_FILE}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT}"

export COMPOSE_PROJECT_NAME

cd "${REMOTE_CURRENT_DIR}"

ln -sfn "${REMOTE_SHARED_DIR}" shared

echo "[remote] Linking environment files"
for env_path in "${REMOTE_SHARED_CONFIG_DIR}"/.env*; do
  if [ -f "\${env_path}" ]; then
    env_file=\$(basename "\${env_path}")
    ln -sfn "\${env_path}" "\${env_file}"
  fi
done

if [ -f "./.env.production" ]; then
  set -a
  . ./.env.production
  set +a
fi

if [ -f "./.env.local" ]; then
  set -a
  . ./.env.local
  set +a
fi

cd "${REMOTE_COMPOSE_DIR}"

if [ ! -f "${REMOTE_COMPOSE_FILE}" ]; then
  echo "[remote] Missing compose file at ${REMOTE_COMPOSE_FILE}" >&2
  exit 1
fi

echo "[remote] Building web image"
docker compose -p "\${COMPOSE_PROJECT_NAME}" -f "${REMOTE_COMPOSE_FILE}" build --pull web

echo "[remote] Stopping existing stack"
docker compose -p "\${COMPOSE_PROJECT_NAME}" -f "${REMOTE_COMPOSE_FILE}" down --remove-orphans || true

echo "[remote] Launching stack"
docker compose -p "\${COMPOSE_PROJECT_NAME}" -f "${REMOTE_COMPOSE_FILE}" up -d --remove-orphans

echo "[remote] Pruning unused images"
docker image prune -f >/dev/null 2>&1 || true

echo "[remote] Deployment complete"
EOSSH

if command -v curl >/dev/null 2>&1; then
  echo "[deploy] Checking production health at ${HEALTHCHECK_URL}"
  if curl -fsSL "${HEALTHCHECK_URL}" | grep -q "ok"; then
    echo "[deploy] Healthcheck succeeded"
  else
    echo "[deploy] Healthcheck did not return expected response" >&2
    exit 1
  fi
else
  echo "[deploy] curl not available locally; skipping healthcheck"
fi

echo "[deploy] Production deployment finished successfully"

