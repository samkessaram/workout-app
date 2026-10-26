import 'fake-indexeddb/auto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatReplay, replay } from '../src/lib/engine/replay'
import { parseLegacy } from '../src/lib/legacy/parse'

// Usage: npm run replay [-- <dir> [exercise-filter]]
// Defaults to fixtures/private (your gitignored S3 export), else the committed synthetic sample.
const dir = process.argv[2] ?? (existsSync('fixtures/private') ? 'fixtures/private' : 'fixtures/sample')
const filter = process.argv[3]?.toLowerCase()

function files(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.json') ? [p] : []
  })
}

const inputs = files(dir).map((name) => ({ name, text: readFileSync(name, 'utf8') }))
const parsed = parseLegacy(inputs)
console.log(`Replaying ${parsed.sessions.length} Sessions from ${dir}`)
if (parsed.errors.length) {
  console.log(`${parsed.errors.length} records could not be read:`)
  for (const e of parsed.errors.slice(0, 10)) console.log(`  ${e.source}: ${e.message}`)
}

const { rows, summary } = replay(parsed.sessions)
console.log(formatReplay(filter ? rows.filter((r) => r.exercise.toLowerCase().includes(filter)) : rows, summary))
