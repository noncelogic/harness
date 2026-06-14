# Harness

Portable agent harnesses for Claude and Codex.

This repo starts with `delivery-train`: a multi-agent delivery workflow that can triage PRs, plan unblocked GitHub issues, run architecture/design stages when labels require them, implement in isolated worktrees, review adversarially, fix, and merge sequentially.

More harnesses can live here later.

## Contents

- `.claude/workflows/delivery-train.js` - generic Claude workflow engine.
- `.claude/workflows/walwarden-delivery-train.js` - Walwarden preset.
- `.claude/skills/delivery-train/SKILL.md` - Claude skill wrapper.
- `.codex/skills/delivery-train/SKILL.md` - Codex skill wrapper.
- `scripts/install-local.sh` - local installer for Claude and/or Codex.

## Install

From a clone:

```sh
./scripts/install-local.sh
```

The installer copies Claude workflows into `~/.claude/workflows`, copies the Claude skill into `~/.claude/skills/delivery-train`, and copies the Codex skill into `~/.codex/skills/delivery-train`.

## Claude Usage

```js
Workflow({ name: "delivery-train", args: "walwarden" })
```

or:

```js
Workflow({ name: "walwarden-delivery-train" })
```

The object form still works when you need more options:

```js
Workflow({ name: "delivery-train", args: { project: "walwarden" } })
```

Pinned tickets:

```js
Workflow({
  name: "delivery-train",
  args: {
    project: "walwarden",
    tickets: [123, { n: 456, hint: "operator guidance" }],
    triagePrs: false
  }
})
```

## Codex Usage

Codex cannot directly call Claude's `Workflow(...)` primitive. The Codex skill documents the delivery-train behavior so Codex can inspect, adapt, or manually reproduce the same staged process with available tools.

## Notes

The initial `delivery-train` project registry includes Walwarden:

- Repo: `noncelogic/walwarden`
- Local path: `/home/cortex/projects/walwarden`
- Worktree root: `/home/cortex/ws`

Those defaults are host-specific. For other repos or machines, pass an inline project config to the workflow or edit the project registry.
