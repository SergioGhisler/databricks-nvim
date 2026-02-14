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

app.get('/api/kb', (_req, res) => {
  try {
    const raw = fs.readFileSync(kbPath, 'utf8')
    res.json(JSON.parse(raw))
  } catch {
    res.json({ topics: [], quizBank: [], cases: [] })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'oncology-learning-app' })
})

app.listen(PORT, () => {
  console.log(`Oncology learning app running on http://localhost:${PORT}`)
})
