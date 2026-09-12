import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflow = await readFile(
  new URL('../.claude/workflows/delivery-train.js', import.meta.url),
  'utf8',
)

assert.match(workflow, /repoPath: '\/home\/josgraha\/projects\/noncelogic\/cortexplane'/)
assert.match(workflow, /metaProjectPath: '\/home\/josgraha\/projects\/meta-harness\/projects\/cortexplane-v2'/)
assert.match(workflow, /P\.metaProjectPath !== CANONICAL_CORTEXPLANE_META_PROJECT_PATH/)
assert.doesNotMatch(workflow, /projects\/cortexplane\//)
assert.doesNotMatch(workflow, /process\.env/)
assert.match(workflow, /requiredLabels: \['program:cortexplane', 'rail:runtime'\]/)
assert.match(workflow, /A pin narrows the candidate set; it does not bypass admission\./)
assert.match(workflow, /REQUIRE all of these labels: \$\{C\.requiredLabels/)
assert.match(workflow, /\$\{C\.metaProjectPath\}\/scripts\/validate/)
assert.match(workflow, /\$\{C\.metaProjectPath\}\/scripts\/dispatch cortexplane#\$\{ticket\.n\} --json/)
assert.match(workflow, /before accepting a plan/)
assert.match(workflow, /before implementation/)
assert.match(workflow, /JSON\.parse\(admission\.output\)/)
assert.match(workflow, /dispatch\.item !== `cortexplane#\$\{ticket\.n\}`/)
assert.match(workflow, /planningCandidates\.some\(\(candidate\) => candidate\.n === ticket\.n\)/)
assert.match(workflow, /\(RAW\.tickets \|\| \[\]\)\.map\(normalizePinnedTicket\)/)

const normalizerSource = workflow.match(/function normalizePinnedTicket[\s\S]*?\n}\n\nconst PINNED/)
assert.ok(normalizerSource, 'ticket normalizer must be present')
const normalizePinnedTicket = new Function(
  `${normalizerSource[0].replace(/\n\nconst PINNED$/, '')}\nreturn normalizePinnedTicket`,
)()
assert.deepEqual(normalizePinnedTicket({ n: 486, hint: 'safe' }), { n: 486, hint: 'safe' })
assert.throws(
  () => normalizePinnedTicket({ n: '486; touch /tmp/cortexplane-injection' }),
  /positive safe integer/,
)

const discovered = workflow.indexOf('const discovered = await agent(')
const autoAdmission = workflow.indexOf("await admitCortexplaneTicket(ticket, 'before planning')", discovered)
const autoPlan = workflow.indexOf('const planned = await agent(', discovered)
assert.ok(discovered >= 0 && autoAdmission > discovered && autoPlan > autoAdmission,
  'auto-discovered tickets must pass runner-controlled admission before planning')

console.log('Cortexplane delivery-train admission guards are present.')
