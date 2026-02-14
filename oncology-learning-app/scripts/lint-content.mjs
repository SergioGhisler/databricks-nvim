import fs from 'fs'
import path from 'path'
import { validateKB } from './content-schema.mjs'

const root = process.cwd()
const files = [
  path.join(root, 'data', 'kb.json'),
  path.join(root, 'data', 'kb.generated.json'),
].filter((f) => fs.existsSync(f))

const reportDir = path.join(root, 'reports')
const outPath = path.join(reportDir, 'content-lint-summary.json')

const summary = {
  generatedAt: new Date().toISOString(),
  summary: {
    filesScanned: 0,
    totalWarnings: 0,
    weakRationaleCount: 0,
    weakCommonMistakeCount: 0,
  },
  files: [],
}

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw)
  const { warnings } = validateKB(parsed, path.basename(file))

  const weakRationale = warnings.filter((w) => w.includes('rationale'))
  const weakCommonMistake = warnings.filter((w) => w.includes('commonMistake'))

  summary.summary.filesScanned += 1
  summary.summary.totalWarnings += warnings.length
  summary.summary.weakRationaleCount += weakRationale.length
  summary.summary.weakCommonMistakeCount += weakCommonMistake.length

  summary.files.push({
    path: file,
    warningCount: warnings.length,
    warnings,
  })
}

if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
console.log(`Lint report written: ${outPath}`)
