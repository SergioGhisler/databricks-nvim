import fs from 'fs'
import path from 'path'
import { validateKB } from './content-schema.mjs'

const root = process.cwd()
const sourceDir = path.join(root, 'content', 'raw')
const outPath = path.join(root, 'data', 'kb.generated.json')

function parseBlocks(text) {
  const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  const topics = []
  const quizBank = []
  const cases = []

  let topicIndex = 1
  let quizIndex = 1
  let caseIndex = 1

  for (const b of blocks) {
    if (b.startsWith('TOPIC:')) {
      const name = b.replace('TOPIC:', '').trim()
      topics.push({ id: `topic-${topicIndex++}`, name, mastery: 20 })
    } else if (b.startsWith('QUIZ-MCQ:')) {
      const lines = b.split('\n').map((l) => l.trim())
      const question = lines[0].replace('QUIZ-MCQ:', '').trim()
      const options = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2))
      const answer = (lines.find((l) => l.startsWith('ANSWER:')) || 'ANSWER:').replace('ANSWER:', '').trim()
      const explanation = (lines.find((l) => l.startsWith('EXPLAIN:')) || 'EXPLAIN:').replace('EXPLAIN:', '').trim()
      quizBank.push({
        id: `q-${quizIndex++}`,
        topicId: topics[0]?.id || 'topic-1',
        difficulty: 'intern',
        type: 'mcq',
        question,
        options,
        answer,
        explanation,
        rationale: explanation || 'Clinical rationale pending author enrichment.',
        commonMistake: 'Selecting an answer without integrating staging/prognostic context.',
      })
    } else if (b.startsWith('QUIZ-SHORT:')) {
      const lines = b.split('\n').map((l) => l.trim())
      const question = lines[0].replace('QUIZ-SHORT:', '').trim()
      const keywords = (lines.find((l) => l.startsWith('KEYWORDS:')) || 'KEYWORDS:').replace('KEYWORDS:', '').split(',').map((s) => s.trim()).filter(Boolean)
      const explanation = (lines.find((l) => l.startsWith('EXPLAIN:')) || 'EXPLAIN:').replace('EXPLAIN:', '').trim()
      quizBank.push({
        id: `q-${quizIndex++}`,
        topicId: topics[0]?.id || 'topic-1',
        difficulty: 'intern',
        type: 'short',
        question,
        answerKeywords: keywords,
        modelAnswer: keywords.join(', '),
        explanation,
        rationale: explanation || 'Clinical rationale pending author enrichment.',
        commonMistake: 'Providing generic points without case-linked prioritization.',
      })
    } else if (b.startsWith('CASE:')) {
      const lines = b.split('\n').map((l) => l.trim())
      const title = lines[0].replace('CASE:', '').trim()
      const template = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2))
      cases.push({ id: `case-${caseIndex++}`, title, template })
    }
  }

  return { topics, quizBank, cases }
}

function ingest() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`Missing source directory: ${sourceDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(sourceDir).filter((f) => /\.(txt|md|json)$/i.test(f))
  const merged = { topics: [], quizBank: [], cases: [] }

  for (const file of files) {
    const full = path.join(sourceDir, file)
    const raw = fs.readFileSync(full, 'utf8')

    if (file.endsWith('.json')) {
      try {
        const parsed = JSON.parse(raw)
        merged.topics.push(...(parsed.topics || []))
        merged.quizBank.push(...(parsed.quizBank || []))
        merged.cases.push(...(parsed.cases || []))
      } catch {
        console.warn(`Skipping invalid JSON: ${file}`)
      }
      continue
    }

    const parsed = parseBlocks(raw)
    merged.topics.push(...parsed.topics)
    merged.quizBank.push(...parsed.quizBank)
    merged.cases.push(...parsed.cases)
  }

  const { errors, warnings } = validateKB(merged, 'kb.generated')
  if (warnings.length) warnings.forEach((w) => console.warn(`WARN: ${w}`))
  if (errors.length) {
    errors.forEach((e) => console.error(`ERROR: ${e}`))
    process.exit(1)
  }

  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2))
  console.log(`Generated KB: ${outPath}`)
}

ingest()
