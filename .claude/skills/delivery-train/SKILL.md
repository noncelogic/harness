---
name: delivery-train
description: Use when the user wants to run, inspect, adapt, or continue the local Claude delivery-train workflow: a multi-agent GitHub ticket delivery pipeline that triages PRs, plans unblocked issues, runs architecture/design stages when labels require them, implements in isolated worktrees, reviews adversarially, fixes, and merges sequentially. Applies especially to Walwarden via the walwarden project preset.
---

# Delivery Train

This skill is a wrapper around the local Claude workflow engine:

- Generic workflow: `/home/cortex/.claude/workflows/delivery-train.js`
- Walwarden preset: `/home/cortex/.claude/workflows/walwarden-delivery-train.js`
- Walwarden memory note: `/home/cortex/.claude/projects/-home-cortex/memory/project_walwarden_delivery_train.md`

## Use

When Claude workflow execution is available, invoke:

```js
Workflow({ name: "delivery-train", args: { project: "walwarden" } })
```

or the preset:

```js
Workflow({ name: "walwarden-delivery-train" })
```

For a pinned set of tickets:

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

## What The Workflow Does

The workflow is designed to autonomously deliver unblocked GitHub tickets:

1. Triage open PRs unless `triagePrs:false`.
2. Discover or accept pinned tickets.
3. Exclude blocked/operator-only/epic issues.
4. For each ticket, run architecture and/or design stages when labels require them.
5. Implement in a dedicated worktree off fresh `origin/main`.
6. Run adversarial review gates.
7. Fix review findings.
8. Open a PR, arm auto-merge, and move to the next ticket only after handoff/merge.

## Walwarden Defaults

The `walwarden` project preset in `delivery-train.js` uses:

- Repo: `noncelogic/walwarden`
- Repo path: `/home/cortex/projects/walwarden`
- Worktree root: `/home/cortex/ws`
- Branch prefix: `wal`
- Excluded labels: `epic`, `needs-operator`, `blocked-by-operator`
- Architecture label: `needs-architectural-review`
- Design label: `needs-design`

Hard operating rule from the workflow: never work directly in the operator's primary checkout; each ticket gets its own worktree.

## In Codex

Codex cannot directly call Claude's `Workflow(...)` primitive. When operating from Codex, use this skill as the canonical spec for the workflow behavior, read the JS workflow if exact rules are needed, and either:

- ask the user to run the Claude workflow invocation, or
- manually reproduce the same staged process with available Codex tools.

Do not rewrite the workflow from memory. Read `/home/cortex/.claude/workflows/delivery-train.js` before modifying or emulating it.
