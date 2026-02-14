import fs from 'fs'
import path from 'path'
import { validateKB } from './content-schema.mjs'

const root = process.cwd()
const candidates = [
  path.join(root, 'data', 'kb.json'),
  path.join(root, 'data', 'kb.generated.json'),
]

let hasError = false
for (const file of candidates) {
  if (!fs.existsSync(file)) continue
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw)
  const result = validateKB(parsed, path.basename(file))

  if (result.warnings.length) {
    console.warn(`Warnings in ${file}:`)
    result.warnings.forEach((w) => console.warn(` - ${w}`))
  }

  if (result.errors.length) {
    hasError = true
    console.error(`Errors in ${file}:`)
    result.errors.forEach((e) => console.error(` - ${e}`))
  } else {
    console.log(`Schema OK: ${file}`)
  }
}

if (hasError) process.exit(1)
