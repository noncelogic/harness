---
name: delivery-train
description: Run, target, extend, monitor, or resume the multi-agent delivery train — an autonomous GitHub ticket pipeline (triage PRs → plan unblocked issues → architecture/UX when labels require → implement in isolated worktrees → adversarial review every stage → fix → squash-merge, sequentially). Use when the user says "run the delivery train / ship the tickets / knock out the backlog", names a repo to deliver, wants to add a repo, pin or skip tickets, check train status, or resume a run. Walwarden is the pre-registered preset.
---

# Delivery Train

A *workflow* engine (`delivery-train.js`) does the work; this *skill* defines the verbs around it — what you can ask for and how each maps to an action. Read the engine before modifying it; never reconstruct it from memory.

- Engine: `/home/cortex/.claude/workflows/delivery-train.js` (per-repo `PROJECTS` registry)
- Walwarden preset: `/home/cortex/.claude/workflows/walwarden-delivery-train.js`
- Design spec: `/home/cortex/docs/superpowers/specs/2026-06-13-walwarden-delivery-train-design.md`
- Memory: `/home/cortex/.claude/projects/-home-cortex/memory/project_walwarden_delivery_train.md`

## Verbs

| The user says… | Do this |
|---|---|
| "run the train" / "ship the walwarden tickets" / "clear the backlog" | `Workflow({name:"walwarden-delivery-train"})` (or `delivery-train` with `args:{project:"walwarden"}`) — auto-discovers everything unblocked |
| "run it for <other repo>" | If the repo is in `PROJECTS`, `args:{project:"<name>"}`. If not, **add a repo** (below) first, or pass an inline config |
| "add <repo> to the train" | Add an entry to `PROJECTS` in `delivery-train.js`. Required: `repo`, `repoPath`. Optional: `worktreeDir`, `branchPrefix`, `coauthor`, `adrDir`, `archDoc`, `checks`, `excludeLabels`, `archLabel`, `designLabel`, `includeNote`, `guardrails` |
| "just do tickets 264 and 330" | `args:{tickets:[264, {n:330, hint:"…"}]}` — pins the list, planner only orders/labels them |
| "skip the PR triage" | `args:{triagePrs:false}` |
| "how's the train doing?" / "status" | The run is a background task — check `/workflows` for the live tree, or `TaskOutput` with the run's task id (`block:false`). Don't claim it's stalled without looking |
| "resume / continue that run" | `Workflow({scriptPath:"<persisted script path>", resumeFromRunId:"<wf_…>"})` — completed agents return cached results; only edited/new stages re-run |
| "change a stage / adjust the rules" | Edit `delivery-train.js` (prompts, gates, `reviewGate`), syntax-check, then run. Walwarden config lives in the `PROJECTS.walwarden` block |
| "make a preset for <repo>" | Mirror `walwarden-delivery-train.js`: a 3-line wrapper that `return await workflow('delivery-train', {...args, project:"<name>"})` |

## Pipeline (what one run does)

1. **PR triage** (unless `triagePrs:false`) — rebase+finish valid PRs, close superseded ones.
2. **Plan** — discover open issues, exclude blocked/operator/epic, order by dependency, label each with `needsArch`/`needsDesign`.
3. **Deliver** each ticket sequentially, handoff only after merge:
   - Architect (if `needsArch`) → adversarial review → fix
   - UX/Product (if `needsDesign`) → adversarial review → fix
   - Implementer → adversarial code review (executes any "verify-it-yourself" command from a clean dir) → fixer → re-review
   - Integrator: squash `--auto` merge, sync main, remove worktree, confirm ticket closed
   - A non-approving ticket is left open for humans; the train moves on.

## Invariants

- **Never** work in the operator's primary checkout — each ticket gets its own worktree off fresh `origin/main`.
- typecheck + tests + relevant `:check`/lint green before every commit.
- Per-repo `guardrails` (e.g. walwarden's claim-safety copy rule) are enforced by every reviewer. They are *copy* guardrails — they never block building a feature.

## In Codex

Codex cannot call Claude's `Workflow(...)`. Use this skill as the canonical spec, read `delivery-train.js` for exact rules, and either ask the user to run the Claude invocation or reproduce the staged process with Codex tools. Do not rewrite the workflow from memory.
