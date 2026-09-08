#!/usr/bin/env sh
set -eu

. /usr/local/lib/eldenese-lib.sh

eldenese_seed_allow_list
eldenese_apply_config

exec "$@"
