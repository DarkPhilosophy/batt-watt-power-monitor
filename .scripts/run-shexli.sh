#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_PATH="${1:-}"
SHEXLI_AUTO_UPDATE="${SHEXLI_AUTO_UPDATE:-1}"

if [[ -z "$TARGET_PATH" || ! -d "$TARGET_PATH" ]]; then
    echo "Usage: .scripts/run-shexli.sh <extension-directory>" >&2
    exit 2
fi

PROJECT_VENV="$PROJECT_DIR/venv"
PROJECT_SHEXLI="$PROJECT_VENV/bin/shexli"

if [[ -n "${SHEXLI_BIN:-}" && ! -x "$SHEXLI_BIN" ]]; then
    echo "SHEXLI_BIN is not executable: $SHEXLI_BIN" >&2
    exit 1
fi

if [[ -z "${SHEXLI_BIN:-}" && "$SHEXLI_AUTO_UPDATE" != "0" ]] && command -v python3 >/dev/null 2>&1; then
    if [[ ! -x "$PROJECT_VENV/bin/python" ]]; then
        echo "Creating the project SHEXLI virtual environment..."
        python3 -m venv "$PROJECT_VENV"
    fi
    echo "Updating SHEXLI in the project virtual environment..."
    if ! "$PROJECT_VENV/bin/python" -m pip install --disable-pip-version-check --quiet --upgrade shexli 'tree-sitter==0.25.2'; then
        if [[ ! -x "$PROJECT_SHEXLI" ]]; then
            echo "Could not provision SHEXLI and no cached project executable exists." >&2
        else
            echo "SHEXLI update unavailable; continuing with the cached project executable." >&2
        fi
    fi
fi

PATH_SHEXLI="$(command -v shexli 2>/dev/null || true)"
SHEXLI_PATHS=()
for candidate in \
    "${SHEXLI_BIN:-}" \
    "$PROJECT_SHEXLI" \
    "$PATH_SHEXLI"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
        duplicate=false
        for existing in "${SHEXLI_PATHS[@]:-}"; do
            if [[ "$existing" == "$candidate" ]]; then
                duplicate=true
                break
            fi
        done
        if [[ "$duplicate" == false ]]; then
            SHEXLI_PATHS+=("$candidate")
        fi
    fi
done

if [[ ${#SHEXLI_PATHS[@]} -eq 0 ]]; then
    echo "SHEXLI executable not found." >&2
    echo "Checked SHEXLI_BIN, the project venv, and PATH." >&2
    exit 1
fi

STAGED_COPY="$(mktemp -d)"
cleanup() {
    rm -rf "$STAGED_COPY"
}
trap cleanup EXIT
cp -R "$TARGET_PATH/." "$STAGED_COPY/"

last_crash_status=1
for SHEXLI_PATH in "${SHEXLI_PATHS[@]}"; do
    echo "Running SHEXLI with $SHEXLI_PATH..."
    set +e
    shexli_output=$("$SHEXLI_PATH" "$STAGED_COPY" 2>&1)
    shexli_status=$?
    set -e

    if [[ $shexli_status -eq 0 ]]; then
        if [[ -n "$shexli_output" ]]; then
            printf '%s\n' "$shexli_output"
        fi
        echo "SHEXLI passed."
        exit 0
    fi

    if [[ $shexli_status -ge 128 ]]; then
        if [[ -n "$shexli_output" ]]; then
            printf '%s\n' "$shexli_output" >&2
        fi
        echo "SHEXLI runtime crashed; trying the next executable." >&2
        last_crash_status=$shexli_status
        continue
    fi

    printf '%s\n' "$shexli_output"
    echo "SHEXLI found extension issues." >&2
    exit "$shexli_status"
done

echo "Every available SHEXLI executable crashed at runtime." >&2
exit "$last_crash_status"
