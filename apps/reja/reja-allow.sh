#!/usr/bin/env sh
set -eu

. /usr/local/lib/reja-lib.sh

usage() {
  cat <<'USAGE'
Usage:
  reja-allow list
  reja-allow add CIDR [CIDR...]
  reja-allow rm CIDR [CIDR...]
  reja-allow set CIDR [CIDR...]
USAGE
}

normalize_args() {
  for raw in "$@"; do
    reja_normalize_cidr "$raw"
  done
}

current_cidrs() {
  reja_read_allow_list
}

cmd="${1:-}"
if [ -n "$cmd" ]; then
  shift
fi

case "$cmd" in
  list|"")
    current=$(current_cidrs || true)
    if [ -z "$current" ]; then
      echo "(empty)"
      exit 0
    fi
    printf '%s\n' "$current"
    ;;
  add)
    [ "$#" -gt 0 ] || { usage >&2; exit 1; }
    added=$(normalize_args "$@")
    current=$(current_cidrs || true)
    # shellcheck disable=SC2086
    reja_write_allow_list $current $added
    reja_apply_config
    reja_reload
    current_cidrs
    ;;
  rm)
    [ "$#" -gt 0 ] || { usage >&2; exit 1; }
    removed=$(normalize_args "$@")
    kept=""
    for cidr in $(current_cidrs || true); do
      skip=0
      for gone in $removed; do
        if [ "$cidr" = "$gone" ]; then
          skip=1
          break
        fi
      done
      if [ "$skip" -eq 0 ]; then
        kept="$kept $cidr"
      fi
    done
    # shellcheck disable=SC2086
    reja_write_allow_list $kept
    reja_apply_config
    reja_reload
    current_cidrs
    ;;
  set)
    [ "$#" -gt 0 ] || { usage >&2; exit 1; }
    next=$(normalize_args "$@")
    # shellcheck disable=SC2086
    reja_write_allow_list $next
    reja_apply_config
    reja_reload
    current_cidrs
    ;;
  -h|--help)
    usage
    ;;
  *)
    echo "error: unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
