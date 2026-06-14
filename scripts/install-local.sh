#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install_claude=1
install_codex=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --claude-only)
      install_codex=0
      ;;
    --codex-only)
      install_claude=0
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: scripts/install-local.sh [--claude-only|--codex-only]

Installs harness files into the current user's local Claude/Codex config:
  ~/.claude/workflows/
  ~/.claude/skills/delivery-train/
  ~/.codex/skills/delivery-train/
USAGE
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [ "$install_claude" -eq 1 ]; then
  mkdir -p "$HOME/.claude/workflows" "$HOME/.claude/skills/delivery-train"
  cp "$ROOT/.claude/workflows/delivery-train.js" "$HOME/.claude/workflows/delivery-train.js"
  cp "$ROOT/.claude/workflows/walwarden-delivery-train.js" "$HOME/.claude/workflows/walwarden-delivery-train.js"
  cp "$ROOT/.claude/skills/delivery-train/SKILL.md" "$HOME/.claude/skills/delivery-train/SKILL.md"
  echo "installed Claude delivery-train workflow and skill"
fi

if [ "$install_codex" -eq 1 ]; then
  mkdir -p "$HOME/.codex/skills/delivery-train"
  cp "$ROOT/.codex/skills/delivery-train/SKILL.md" "$HOME/.codex/skills/delivery-train/SKILL.md"
  echo "installed Codex delivery-train skill"
fi
