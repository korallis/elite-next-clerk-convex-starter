#!/usr/bin/env bash
set -euo pipefail

# Usage: bash deploy/provision.sh <app_user> <app_dir> <repo_url>
APP_USER=${1:-www-data}
APP_DIR=${2:-/var/www/leo}
REPO_URL=${3:-https://github.com/korallis/leo.git}

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx ufw

# Node via NVM
if ! command -v node >/dev/null 2>&1; then
  su - ${APP_USER} -s /bin/bash -c "\
    if [ ! -d \"$HOME/.nvm\" ]; then \n\
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash; \n\
    fi; \n\
    export NVM_DIR=\"$HOME/.nvm\"; \n\
    . \"$HOME/.nvm/nvm.sh\"; \n\
    nvm install 22; \n\
    npm i -g pnpm; \n\
  "
fi

mkdir -p ${APP_DIR}
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone ${REPO_URL} ${APP_DIR}
fi

cd ${APP_DIR}
su - ${APP_USER} -s /bin/bash -c "\
  export NVM_DIR=\"$HOME/.nvm\"; \n\
  . \"$HOME/.nvm/nvm.sh\"; \n\
  cd ${APP_DIR}; \n\
  pnpm install; \n\
  pnpm build; \n\
"

echo "Provisioning complete. Configure systemd and nginx, then enable service."
