export const meta = {
  name: 'delivery-train',
  description: 'Generic multi-agent delivery train for any repo: PR-triage → plan → architecture → UX → implement → adversarial review (every stage) → fix → auto-merge, sequentially across all unblocked tickets',
  whenToUse:
    'Autonomously deliver a repo\'s unblocked GitHub tickets. Invoke: Workflow({name:"delivery-train", args:"walwarden"}) or args:{project:"walwarden"} for a registered repo, or pass an inline project config. args:{tickets:[...]} pins a list; args:{triagePrs:false} skips PR triage.',
  phases: [{ title: 'PR Triage' }, { title: 'Plan' }, { title: 'Deliver' }],
}

// ── Per-repo registry. Add a repo here (or pass an inline `project` object). ────
// Required: repo, repoPath. Everything else has a sane default below.
const PROJECTS = {
  walwarden: {
    repo: 'noncelogic/walwarden',
    repoPath: '/home/cortex/projects/walwarden',
    worktreeDir: '/home/cortex/ws',
    branchPrefix: 'wal',
    coauthor: 'Claude Fable 5 <noreply@anthropic.com>',
    adrDir: 'docs/adr/',
    archDoc: 'docs/architecture.md',
    checks: '`npm run typecheck` and `npm test`. Also run any :check / lint scripts in package.json that cover files you touched (e.g. lint:colors, lint:events, docs:check, contract:check)',
    excludeLabels: ['epic', 'needs-operator', 'blocked-by-operator'],
    archLabel: 'needs-architectural-review',
    designLabel: 'needs-design',
    includeNote: 'INCLUDE the large M-COMMERCIAL / scope-tier:L / needs-architectural-review tickets (e.g. #130 PITR, #131 BYOK) unless excluded above — the operator wants everything unblocked.',
    guardrails: `- CLAIM SAFETY (HARD RULE, zero tolerance): never add or keep COPY (site/docs/marketing) claiming PITR / point-in-time recovery / continuous backup / WAL streaming / real-time replication / zero data loss / automated or unattended restore drills, OR AWS RDS/Aurora as a CURRENT/shipping provider (Supabase + Neon only today; RDS is roadmap-only). Preferred vocabulary: verification, manifest, restore drill, audit chain, evidence bundle, pre-flight, recoverability, RPO. A roadmap/spike may DESCRIBE future PITR/BYOK but must label it explicitly as not-yet-shipped. This is a COPY guardrail — it never blocks building the underlying feature.`,
  },
}

// ── Resolve project config (registry name, inline object, or default walwarden) ─
const RAW =
  typeof args === 'string'
    ? { project: args }
    : args && !Array.isArray(args)
      ? args
      : { tickets: args }
const sel = RAW.project
let P
if (typeof sel === 'string') {
  P = PROJECTS[sel]
  if (!P) throw new Error(`Unknown project "${sel}". Registered: ${Object.keys(PROJECTS).join(', ')}. Or pass an inline project config object.`)
} else if (sel && typeof sel === 'object') {
  P = { ...(sel.base ? PROJECTS[sel.base] || {} : {}), ...sel }
} else {
  P = PROJECTS.walwarden // back-compat default
}
if (!P.repo || !P.repoPath) throw new Error('project config needs at least {repo, repoPath}')

// Defaults for optional config
const C = {
  worktreeDir: '/home/cortex/ws',
  branchPrefix: 'feat',
  coauthor: 'Claude <noreply@anthropic.com>',
  adrDir: 'docs/adr/',
  archDoc: '',
  checks: 'the repo\'s typecheck and test commands (discover them from package.json / CI config)',
  excludeLabels: ['epic'],
  archLabel: 'needs-architectural-review',
  designLabel: 'needs-design',
  includeNote: '',
  guardrails: '',
  ...P,
}

const TRIAGE_PRS = RAW.triagePrs !== false
const PINNED = (RAW.tickets || []).map((t) => (typeof t === 'number' ? { n: t } : t)).filter((t) => t && t.n)
const WT = `${C.worktreeDir}/${C.branchPrefix}-<n>` // documented worktree path for prompts

const RULES = `
Repo: ${C.repoPath} (GitHub ${C.repo}, gh CLI authed). Read the repo CLAUDE.md${C.archDoc ? ' and ' + C.archDoc : ''} and match conventions. Non-negotiables:
- NEVER push to main. Each ticket gets its OWN isolated worktree off fresh main:
    git -C ${C.repoPath} fetch origin
    git -C ${C.repoPath} worktree add ${WT} -B ${C.branchPrefix}-<n>-<slug> origin/main
  Work, commit, and push from that worktree. After the PR is merged (or left open), run: git -C ${C.repoPath} worktree remove ${WT} --force (skip removal if left open for humans). NEVER touch the operator's primary checkout branch.
- Run typecheck AND tests before EVERY commit: ${C.checks}. Fix what you broke.
${C.guardrails ? C.guardrails + '\n' : ''}- Minimal surgical diffs. No speculative abstractions. Match existing style.
- Commit messages end with: Co-Authored-By: ${C.coauthor}
- PR body: "Closes #<ticket>", what/why, test notes; end with: 🤖 Generated with [Claude Code](https://claude.com/claude-code)
`

const TRIAGE = { type: 'object', properties: { pr: { type: 'number' }, disposition: { type: 'string', enum: ['rebased_finished', 'closed_superseded', 'left_open'] }, details: { type: 'string' } }, required: ['pr', 'disposition', 'details'] }
const PLAN = { type: 'object', properties: { plan: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' }, title: { type: 'string' }, needsArch: { type: 'boolean' }, needsDesign: { type: 'boolean' }, note: { type: 'string' } }, required: ['n', 'title', 'needsArch', 'needsDesign'] } }, skipped: { type: 'array', items: { type: 'string' } } }, required: ['plan'] }
const ARTIFACT = { type: 'object', properties: { done: { type: 'boolean' }, summary: { type: 'string' }, location: { type: 'string' }, blockers: { type: 'string' } }, required: ['done', 'summary'] }
const REVIEW = { type: 'object', properties: { verdict: { type: 'string', enum: ['approve', 'request_changes'] }, issues: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'issues'] }
const IMPL = { type: 'object', properties: { pr: { type: 'number' }, branch: { type: 'string' }, summary: { type: 'string' }, blockers: { type: 'string' } }, required: ['pr', 'branch', 'summary'] }
const MERGE = { type: 'object', properties: { merged: { type: 'boolean' }, details: { type: 'string' } }, required: ['merged', 'details'] }

// Reusable adversarial-review gate; re-runs the producing agent once on request_changes.
async function reviewGate(t, subject, reviewPrompt, fixPrompt, label) {
  let review = await agent(reviewPrompt, { label: `review:${label}`, phase: 'Deliver', schema: REVIEW })
  if (review && review.verdict === 'request_changes' && review.issues.length && fixPrompt) {
    log(`#${t.n} ${subject}: changes requested (${review.issues.length}) — fixing`)
    await agent(`${fixPrompt}\nIssues:\n- ${review.issues.join('\n- ')}\nReturn a one-paragraph summary.`, { label: `fix:${label}`, phase: 'Deliver' })
    review = await agent(`Re-review after fixes. ${reviewPrompt}`, { label: `re-review:${label}`, phase: 'Deliver', schema: REVIEW })
  }
  return review
}

const results = []

// ── Stage 0: PR triage ─────────────────────────────────────────────────────────
if (TRIAGE_PRS) {
  phase('PR Triage')
  log(`Triaging open PRs on ${C.repo}`)
  const triage = await agent(
    `You are the PR TRIAGER for ${C.repo}.\n${RULES}\nList every open PR: gh pr list --repo ${C.repo} --state open --json number,title,isDraft,headRefName,updatedAt. For EACH, assess against current origin/main and recent changes: still valid, stale, or superseded?\n- Valid + wanted: rebase onto origin/main in its worktree, resolve conflicts, typecheck+tests green, mark ready (gh pr ready), push. Disposition "rebased_finished".\n- Superseded / no longer correct and not worth salvaging: close with an explanatory comment (gh pr close --comment). Disposition "closed_superseded".\n- Genuinely needs a human call: leave it, comment your assessment. Disposition "left_open".\nProcess ALL PRs, then return {pr,disposition,details} for the LAST one processed with details summarizing every PR's outcome.`,
    { label: 'pr-triage', phase: 'PR Triage', schema: TRIAGE },
  )
  results.push({ stage: 'pr-triage', outcome: triage ? triage.details : 'triager died' })
  log(`PR triage: ${triage ? triage.details.slice(0, 120) : 'died'}`)
}

// ── Stage 1: Plan ───────────────────────────────────────────────────────────────
phase('Plan')
let plan
if (PINNED.length) {
  log(`Using pinned ticket list (${PINNED.length})`)
  const planned = await agent(
    `You are the PLANNER for ${C.repo}. The operator pinned these tickets: ${PINNED.map((t) => t.n).join(', ')}.\n${RULES}\nFor each, gh issue view <n> --repo ${C.repo} --json number,title,labels,body. Set needsArch (label "${C.archLabel}") and needsDesign (label "${C.designLabel}"). Order by dependency (read bodies/epics for "depends on"/"blocked by"/sequence hints). Return {plan:[{n,title,needsArch,needsDesign,note}], skipped:[]}. Keep all pinned tickets; note any that look blocked.`,
    { label: 'planner', phase: 'Plan', schema: PLAN },
  )
  plan = planned && planned.plan
  if (plan) plan.forEach((p) => { const h = PINNED.find((x) => x.n === p.n); if (h && h.hint) p.hint = h.hint })
} else {
  log(`Auto-discovering unblocked tickets on ${C.repo}`)
  const planned = await agent(
    `You are the PLANNER for ${C.repo}.\n${RULES}\nDiscover the work: gh issue list --repo ${C.repo} --state open --limit 100 --json number,title,labels,body.\nINCLUDE every open issue EXCEPT those that are blocked or not actionable autonomously:\n- EXCLUDE these labels: ${C.excludeLabels.map((l) => '"' + l + '"').join(', ')} (umbrella trackers / require human credentials or decisions).\n- EXCLUDE any issue whose body clearly marks it blocked by another OPEN issue, or is a pure operator open-question.\n${C.includeNote ? C.includeNote + '\n' : ''}For each included ticket set needsArch (label "${C.archLabel}") and needsDesign (label "${C.designLabel}").\nORDER by dependency so prerequisites come first: read epic/ticket bodies for "depends on"/"blocked by"/numbered sequences (e.g. "redesign 1/2/3/4" must run in order; wireframes before the page that implements them). Within a tier, prefer small→large.\nReturn {plan:[{n,title,needsArch,needsDesign,note}], skipped:["#<n> — reason", ...]}. note = one line on dependencies/risk.`,
    { label: 'planner', phase: 'Plan', schema: PLAN },
  )
  plan = planned && planned.plan
  if (planned && planned.skipped && planned.skipped.length) log(`Skipped: ${planned.skipped.join(' | ')}`)
}
if (!plan || !plan.length) { results.push({ stage: 'plan', outcome: 'no actionable tickets found' }); return results }
log(`Plan: ${plan.map((p) => '#' + p.n + (p.needsArch ? '·arch' : '') + (p.needsDesign ? '·ux' : '')).join('  →  ')}`)

// ── Stage 2: Deliver each ticket, sequentially, handoff only after merge ─────────
for (const t of plan) {
  phase('Deliver')
  log(`#${t.n}: starting${t.needsArch ? ' (arch)' : ''}${t.needsDesign ? ' (ux)' : ''}`)
  const hint = t.hint ? `Operator guidance: ${t.hint}\n` : ''

  if (t.needsArch) {
    const arch = await agent(
      `You are the ARCHITECT for ${C.repo} ticket #${t.n}.\n${RULES}\ngh issue view ${t.n} --repo ${C.repo} (read every requirement). ${hint}Produce the architecture decision this ticket needs: chosen approach, boundaries, data flow, state machines, trade-offs, open questions. Write it as an ADR under ${C.adrDir} (follow existing ADR format) on the ticket's worktree branch, and post a summary as a ticket comment. Return {done,summary,location,blockers}.`,
      { label: `arch:#${t.n}`, phase: 'Deliver', schema: ARTIFACT },
    )
    if (arch) {
      const r = await reviewGate(t, 'architecture',
        `You are an ADVERSARIAL ARCHITECTURE REVIEWER for ${C.repo} ticket #${t.n}. ${RULES}\nReview the ADR (${arch.location || C.adrDir}) and ticket-comment summary. Check: does it satisfy #${t.n}'s intent; are boundaries/SLAs/state-machines sound and consistent with the repo's architecture docs; are open questions surfaced not hidden; do any guardrails above apply. Return {verdict,issues}.`,
        `You are the ARCHITECT revising the ADR for #${t.n}. ${RULES} Address the issues, update the ADR + ticket comment.`,
        `arch:#${t.n}`)
      log(`#${t.n} arch: ${r ? r.verdict : 'reviewer died'}`)
    }
  }

  if (t.needsDesign) {
    const ux = await agent(
      `You are the UX / PRODUCT advocate for ${C.repo} ticket #${t.n}.\n${RULES}\ngh issue view ${t.n} --repo ${C.repo}. ${hint}Produce the design artifact this ticket needs (user flows, wireframe/component spec, states incl. empty/error/loading, copy). Honor the existing design system. Post the design artifact as a ticket comment (and commit any spec file where the repo keeps design specs) so the implementer has an unambiguous target. Name the job-to-be-done and the success state. Return {done,summary,location,blockers}.`,
      { label: `ux:#${t.n}`, phase: 'Deliver', schema: ARTIFACT },
    )
    if (ux) {
      const r = await reviewGate(t, 'design',
        `You are an ADVERSARIAL DESIGN REVIEWER for ${C.repo} ticket #${t.n}. ${RULES}\nReview the design artifact posted on #${t.n}. Check: serves the real user job; all states covered (empty/loading/error); consistent with the existing design system; copy respects any guardrails above; implementable without guesswork. Return {verdict,issues}.`,
        `You are the UX / PRODUCT advocate revising the design for #${t.n}. ${RULES} Address the issues, update the artifact.`,
        `ux:#${t.n}`)
      log(`#${t.n} ux: ${r ? r.verdict : 'reviewer died'}`)
    }
  }

  const impl = await agent(
    `You are the IMPLEMENTER for ${C.repo} ticket #${t.n}.\n${RULES}\ngh issue view ${t.n} --repo ${C.repo} (read EVERY acceptance criterion). ${hint}If an ADR or design artifact was posted to this ticket, implement to it exactly. Explore the repo for where this belongs. Implement fully in the ticket's worktree on branch ${C.branchPrefix}-${t.n}-<slug>. typecheck + tests + relevant checks green. Push and open a PR. Return {pr,branch,summary,blockers} (blockers = anything incomplete + why; empty if none).`,
    { label: `impl:#${t.n}`, phase: 'Deliver', schema: IMPL },
  )
  if (!impl) { results.push({ ticket: t.n, status: 'implementer died' }); continue }
  log(`#${t.n}: PR #${impl.pr}${impl.blockers ? ' (blockers: ' + impl.blockers.slice(0, 80) + ')' : ''}`)

  const codeReview = await reviewGate(t, 'code',
    `You are an ADVERSARIAL CODE REVIEWER for PR #${impl.pr} on ${C.repo} (ticket #${t.n}).\n${RULES}\nReview via gh pr view/diff and read changed files in context (fetch the branch). Check: (1) EVERY acceptance criterion of #${t.n}; (2) conformance to any ADR/design posted on the ticket; (3) any guardrails above — zero tolerance; (4) correctness/conventions/test coverage; (5) NO fabricated artifacts presented as real; (6) CRITICAL: if the change adds any user-facing "run it / verify it yourself" command or published artifact, ACTUALLY EXECUTE it end-to-end from a clean directory (a fresh /tmp dir, no repo checkout). Post a real PR review (gh pr review --approve | --request-changes). Return {verdict,issues}.`,
    `You are the FIXER for PR #${impl.pr} on ${C.repo} (branch ${impl.branch}, ticket #${t.n}). ${RULES} Address every issue in the ticket's worktree, push to the same branch, typecheck+tests green, reply to review comments via gh.`,
    `code:#${t.n}`)

  if (!codeReview || codeReview.verdict !== 'approve') {
    log(`#${t.n}: NOT approved — leaving PR #${impl.pr} open for humans, moving on`)
    results.push({ ticket: t.n, pr: impl.pr, status: 'left open (not approved)', issues: codeReview ? codeReview.issues : ['reviewer died'] })
    continue
  }

  const merge = await agent(
    `You are the INTEGRATOR for PR #${impl.pr} on ${C.repo} (ticket #${t.n}).\n${RULES}\n(1) gh pr checks ${impl.pr} --repo ${C.repo} — if failing, only fix CI-config/flake issues on the branch, else report. (2) gh pr merge ${impl.pr} --repo ${C.repo} --squash --auto. (3) Poll gh pr view ${impl.pr} --json state,mergedAt ~every 60s (until-loops blocked; use judgment) up to ~10 min. (4) After merge: sync main, remove the ticket worktree. (5) Verify #${t.n} auto-closed; comment-close if not. Return {merged,details} (merged=false + "auto-merge armed, CI pending" if still running after ~10 min).`,
    { label: `merge:#${t.n}`, phase: 'Deliver', schema: MERGE },
  )
  results.push({ ticket: t.n, pr: impl.pr, status: merge ? (merge.merged ? 'merged' : merge.details) : 'integrator died', summary: (impl.summary || '').slice(0, 140) })
  log(`#${t.n}: ${merge ? (merge.merged ? 'MERGED' : merge.details) : 'integrator died'}`)
}

return results
