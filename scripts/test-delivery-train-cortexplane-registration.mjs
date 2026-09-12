import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflow = await readFile(
  new URL('../.claude/workflows/delivery-train.js', import.meta.url),
  'utf8',
)

assert.match(workflow, /repoPath: '\/home\/josgraha\/projects\/noncelogic\/cortexplane'/)
assert.doesNotMatch(workflow, /process\.env\.HOME/)
assert.match(workflow, /requiredLabels: \['program:cortexplane', 'rail:runtime'\]/)
assert.match(workflow, /A pin narrows the candidate set; it does not bypass admission\./)
assert.match(workflow, /REQUIRE all of these labels: \$\{C\.requiredLabels/)

console.log('Cortexplane delivery-train admission guards are present.')
