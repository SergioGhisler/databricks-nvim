import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 4040

app.use(express.json({ limit: '2mb' }))
app.use(express.static(path.join(__dirname, 'public')))

const kbPath = path.join(__dirname, 'data', 'kb.json')
const lintSummaryPath = path.join(__dirname, 'reports', 'content-lint-summary.json')

app.get('/api/kb', (_req, res) => {
  try {
    const raw = fs.readFileSync(kbPath, 'utf8')
    res.json(JSON.parse(raw))
  } catch {
    res.json({ topics: [], quizBank: [], cases: [] })
  }
})

app.get('/api/content-lint-summary', (_req, res) => {
  try {
    if (!fs.existsSync(lintSummaryPath)) {
      return res.json({ ok: false, reason: 'missing-report' })
    }
    const raw = fs.readFileSync(lintSummaryPath, 'utf8')
    res.json({ ok: true, ...JSON.parse(raw) })
  } catch {
    res.json({ ok: false, reason: 'read-failed' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'oncology-learning-app' })
})

app.listen(PORT, () => {
  console.log(`Oncology learning app running on http://localhost:${PORT}`)
})
