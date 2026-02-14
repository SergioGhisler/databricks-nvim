const STORAGE_KEY = 'oncologyLearningProgressV1'
const QUIZ_PREFS_KEY = 'oncologyQuizPrefsV1'

const state = {
  kb: { topics: [], quizBank: [], cases: [] },
  progress: {
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    topicMastery: {},
    quizAnalytics: {
      byTopicDifficulty: {},
      trend: [],
      askedCounts: {},
      recentQuestionIds: [],
    },
  },
  quizIndex: 0,
  quizSession: {
    answered: 0,
    correct: 0,
    submitted: false,
    feedbackHtml: '',
    explainWhy: true,
    difficulty: 'intern',
    topicId: 'all',
    currentQuestionId: null,
  },
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    state.progress = { ...state.progress, ...JSON.parse(raw) }
    state.progress.quizAnalytics = {
      byTopicDifficulty: {},
      trend: [],
      askedCounts: {},
      recentQuestionIds: [],
      ...(state.progress.quizAnalytics || {}),
    }
  } catch {}
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress))
}

function loadQuizPrefs() {
  const raw = localStorage.getItem(QUIZ_PREFS_KEY)
  if (!raw) return
  try {
    const prefs = JSON.parse(raw)
    state.quizSession.topicId = prefs.topicId || 'all'
    state.quizSession.difficulty = prefs.difficulty || 'intern'
    state.quizSession.explainWhy = typeof prefs.explainWhy === 'boolean' ? prefs.explainWhy : true
  } catch {}
}

function saveQuizPrefs() {
  localStorage.setItem(QUIZ_PREFS_KEY, JSON.stringify({
    topicId: state.quizSession.topicId,
    difficulty: state.quizSession.difficulty,
    explainWhy: state.quizSession.explainWhy,
  }))
}

function getMastery(topic) {
  return state.progress.topicMastery[topic.id] ?? topic.mastery ?? 0
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function pickWeightedQuestion(filtered) {
  if (!filtered.length) return null
  const asked = state.progress.quizAnalytics.askedCounts || {}
  const recent = state.progress.quizAnalytics.recentQuestionIds || []
  const recentSet = new Set(recent)

  let pool = filtered
  const nonRecent = filtered.filter((q) => !recentSet.has(q.id))
  if (nonRecent.length > 0) pool = nonRecent

  const weighted = pool.map((q) => {
    const timesAsked = asked[q.id] || 0
    const weight = 1 / (1 + timesAsked)
    return { q, weight }
  })

  const total = weighted.reduce((acc, w) => acc + w.weight, 0)
  let r = Math.random() * total
  for (const w of weighted) {
    r -= w.weight
    if (r <= 0) return w.q
  }
  return weighted[weighted.length - 1]?.q || pool[0]
}

function recordQuizAnalytics(question, isCorrect) {
  const difficulty = question.difficulty || 'intern'
  const key = `${question.topicId}::${difficulty}`
  const stats = state.progress.quizAnalytics.byTopicDifficulty[key] || { asked: 0, correct: 0 }
  stats.asked += 1
  if (isCorrect) stats.correct += 1
  state.progress.quizAnalytics.byTopicDifficulty[key] = stats

  const askedCounts = state.progress.quizAnalytics.askedCounts || {}
  askedCounts[question.id] = (askedCounts[question.id] || 0) + 1
  state.progress.quizAnalytics.askedCounts = askedCounts

  const trend = state.progress.quizAnalytics.trend || []
  trend.push({ at: new Date().toISOString(), topicId: question.topicId, difficulty, correct: isCorrect ? 1 : 0 })
  state.progress.quizAnalytics.trend = trend.slice(-200)

  const recent = state.progress.quizAnalytics.recentQuestionIds || []
  recent.push(question.id)
  state.progress.quizAnalytics.recentQuestionIds = recent.slice(-5)
}

function refreshProgressViews() {
  renderDashboard()
  renderDailyPlan()
}

function awardStudy(topicId, delta) {
  state.progress.topicMastery[topicId] = clamp((state.progress.topicMastery[topicId] ?? 0) + delta, 0, 100)
  state.progress.xp += Math.max(5, delta)
  const today = todayIso()
  if (state.progress.lastStudyDate !== today) {
    state.progress.streak = state.progress.lastStudyDate ? state.progress.streak + 1 : 1
    state.progress.lastStudyDate = today
  }
  saveProgress()
  refreshProgressViews()
}

function renderDashboard() {
  const root = document.getElementById('dashboard')
  const avg = state.kb.topics.length
    ? Math.round(state.kb.topics.reduce((acc, t) => acc + getMastery(t), 0) / state.kb.topics.length)
    : 0

  const analytics = state.progress.quizAnalytics.byTopicDifficulty || {}
  const trend = state.progress.quizAnalytics.trend || []

  root.innerHTML = `
    <h2>1) Topic Mastery Dashboard</h2>
    <p><span class="badge">XP ${state.progress.xp}</span><span class="badge">Streak ${state.progress.streak} day(s)</span><span class="badge">Avg Mastery ${avg}%</span></p>
    <div>
      ${state.kb.topics.map((t) => {
        const m = getMastery(t)
        return `
          <div class="progress-wrap">
            <div class="progress-label"><span>${t.name}</span><span>${m}%</span></div>
            <div class="progress"><span style="width:${m}%"></span></div>
            <button data-topic-inc="${t.id}" class="secondary">+ Quick Review XP</button>
          </div>
        `
      }).join('')}
    </div>

    <h3>Quiz Analytics (Topic + Difficulty)</h3>
    <div class="analytics-grid">
      ${Object.keys(analytics).length === 0 ? '<p>No quiz analytics yet.</p>' : Object.entries(analytics).map(([k, v]) => {
        const [topicId, difficulty] = k.split('::')
        const topicName = state.kb.topics.find((t) => t.id === topicId)?.name || topicId
        const accuracy = v.asked ? Math.round((v.correct / v.asked) * 100) : 0
        const recent = trend.filter((x) => x.topicId === topicId && x.difficulty === difficulty).slice(-10)
        const trendPct = recent.length ? Math.round((recent.reduce((a, x) => a + x.correct, 0) / recent.length) * 100) : 0
        return `<div class="analytics-card"><b>${topicName}</b><br/><small>${difficulty.toUpperCase()}</small><br/>Accuracy: <b>${accuracy}%</b> (${v.correct}/${v.asked})<br/>Recent trend (last ${recent.length || 0}): <b>${trendPct}%</b></div>`
      }).join('')}
    </div>
  `

  root.querySelectorAll('[data-topic-inc]').forEach((btn) => {
    btn.addEventListener('click', () => awardStudy(btn.dataset.topicInc, 4))
  })
}

function renderDailyPlan() {
  const root = document.getElementById('daily-plan')
  const sorted = [...state.kb.topics].sort((a, b) => getMastery(a) - getMastery(b)).slice(0, 3)
  root.innerHTML = `
    <h2>2) Daily Oncology Review Plan</h2>
    <p>Auto-prioritized weak topics for today:</p>
    <ol>${sorted.map((t) => `<li>${t.name} (${getMastery(t)}%)</li>`).join('')}</ol>
    <p>Plan:</p>
    <ul>
      <li>15 min concept recap</li>
      <li>10 min flash quiz</li>
      <li>5 min case reflection notes</li>
    </ul>
    <button id="complete-plan">Mark plan complete (+20 XP)</button>
  `
  root.querySelector('#complete-plan')?.addEventListener('click', () => {
    state.progress.xp += 20
    const today = todayIso()
    if (state.progress.lastStudyDate !== today) {
      state.progress.streak = state.progress.lastStudyDate ? state.progress.streak + 1 : 1
      state.progress.lastStudyDate = today
    }
    saveProgress()
    renderAll()
  })
}

function scoreShortAnswer(input, keywords = []) {
  const lower = input.toLowerCase()
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length
  if (hits >= Math.max(2, Math.ceil(keywords.length * 0.6))) return { label: 'pass', hits }
  if (hits >= 1) return { label: 'partial', hits }
  return { label: 'fail', hits }
}

function resetQuizStateForNextQuestion() {
  state.quizSession.submitted = false
  state.quizSession.feedbackHtml = ''
  state.quizSession.currentQuestionId = null
}

function getFilteredQuizBank() {
  return state.kb.quizBank.filter((q) => {
    const topicMatch = state.quizSession.topicId === 'all' || q.topicId === state.quizSession.topicId
    const difficulty = q.difficulty || 'intern'
    const difficultyMatch = state.quizSession.difficulty === 'resident'
      ? ['resident', 'intern'].includes(difficulty)
      : difficulty === 'intern'
    return topicMatch && difficultyMatch
  })
}

function renderQuiz() {
  const root = document.getElementById('quiz')
  const filtered = getFilteredQuizBank()
  if (!filtered.length) {
    root.innerHTML = '<h2>3) Quiz Mode</h2><p>No quiz items match the selected topic/difficulty.</p>'
    return
  }

  let q = filtered.find((item) => item.id === state.quizSession.currentQuestionId)
  if (!q) {
    q = pickWeightedQuestion(filtered)
    state.quizSession.currentQuestionId = q?.id || null
  }
  const qPos = Math.max(0, filtered.findIndex((item) => item.id === q.id))

  root.innerHTML = `
    <h2>3) Quiz Mode (MCQ + Short Answer)</h2>
    <div class="quiz-controls">
      <label>Topic
        <select id="quiz-topic">
          <option value="all" ${state.quizSession.topicId === 'all' ? 'selected' : ''}>All oncology topics</option>
          ${state.kb.topics.map((t) => `<option value="${t.id}" ${state.quizSession.topicId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </label>
      <label>Difficulty
        <select id="quiz-difficulty">
          <option value="intern" ${state.quizSession.difficulty === 'intern' ? 'selected' : ''}>Intern</option>
          <option value="resident" ${state.quizSession.difficulty === 'resident' ? 'selected' : ''}>Resident</option>
        </select>
      </label>
      <label class="checkbox-inline"><input type="checkbox" id="explain-why" ${state.quizSession.explainWhy ? 'checked' : ''}/> Explain-why mode</label>
    </div>
    <p class="quiz-score"><span id="quiz-score-badge" class="badge">Score ${state.quizSession.correct}/${state.quizSession.answered}</span><span class="badge">Question ${qPos + 1}/${filtered.length}</span><span class="badge">Level ${(q.difficulty || 'intern').toUpperCase()}</span></p>
    <p><b>${q.question}</b></p>
    ${q.type === 'mcq'
      ? `<div id="mcq-options">${q.options.map((o, i) => `<label class="mcq-option" data-option="${o.replace(/"/g, '&quot;')}"><input type="radio" name="quiz-answer" value="${o.replace(/"/g, '&quot;')}" /> ${String.fromCharCode(65 + i)}. ${o}</label>`).join('')}</div>`
      : '<textarea id="quiz-answer" rows="3" placeholder="Type your short answer..."></textarea>'}
    <div class="quiz-actions">
      <button id="submit-quiz" ${state.quizSession.submitted ? 'disabled' : ''}>Submit</button>
      <button id="next-quiz" class="secondary">Next Question</button>
    </div>
    <div id="quiz-feedback" class="quiz-feedback">${state.quizSession.feedbackHtml}</div>
  `

  root.querySelector('#submit-quiz')?.addEventListener('click', () => {
    if (state.quizSession.submitted) return

    let isCorrect = false
    if (q.type === 'mcq') {
      const selected = root.querySelector('input[name="quiz-answer"]:checked')?.value || ''
      if (!selected) {
        state.quizSession.feedbackHtml = '⚠️ Please select an option first.'
        renderQuiz()
        return
      }
      isCorrect = selected === q.answer

      root.querySelectorAll('.mcq-option').forEach((el) => {
        const option = el.getAttribute('data-option') || ''
        if (option === q.answer) el.classList.add('correct-option')
        if (option === selected && selected !== q.answer) el.classList.add('wrong-option')
      })

      const explainBlock = state.quizSession.explainWhy
        ? `<br/><br/><b>Clinical rationale:</b> ${q.rationale || q.explanation || 'n/a'}<br/><b>Common mistake:</b> ${q.commonMistake || 'Choosing based on memorized buzzwords instead of staging/prognostic context.'}`
        : ''
      state.quizSession.feedbackHtml = isCorrect
        ? `✅ <b>Correct</b><br/>${q.explanation || ''}${explainBlock}`
        : `❌ <b>Incorrect</b><br/>Correct option: <b>${q.answer}</b><br/>${q.explanation || ''}${explainBlock}`
    } else {
      const input = root.querySelector('#quiz-answer')?.value?.trim() || ''
      if (!input) {
        state.quizSession.feedbackHtml = '⚠️ Please enter an answer first.'
        renderQuiz()
        return
      }
      const rubric = scoreShortAnswer(input, q.answerKeywords || [])
      isCorrect = rubric.label === 'pass'
      const model = q.modelAnswer || (q.answerKeywords || []).join(', ')
      const depth = state.quizSession.difficulty === 'resident'
        ? `<br/><b>Resident depth:</b> include decision thresholds, expected toxicities, and follow-up planning.`
        : ''
      const explainBlock = state.quizSession.explainWhy
        ? `<br/><br/><b>Clinical rationale:</b> ${q.rationale || q.explanation || 'n/a'}<br/><b>Common mistake:</b> ${q.commonMistake || 'Giving generic oncology facts without case-specific risk framing.'}`
        : ''
      state.quizSession.feedbackHtml = `${rubric.label === 'pass' ? '✅' : rubric.label === 'partial' ? '🟡' : '❌'} <b>${rubric.label.toUpperCase()}</b> (${rubric.hits} keyword hits)<br/>Model answer: <b>${model || 'n/a'}</b><br/>${q.explanation || ''}${depth}${explainBlock}`
    }

    state.quizSession.submitted = true
    state.quizSession.answered += 1
    if (isCorrect) state.quizSession.correct += 1
    recordQuizAnalytics(q, isCorrect)
    saveProgress()

    if (q.type === 'short') {
      awardStudy(q.topicId, isCorrect ? 6 : 3)
    } else {
      awardStudy(q.topicId, isCorrect ? 6 : 2)
    }

    const feedback = root.querySelector('#quiz-feedback')
    if (feedback) feedback.innerHTML = state.quizSession.feedbackHtml
    const scoreBadge = root.querySelector('#quiz-score-badge')
    if (scoreBadge) scoreBadge.textContent = `Score ${state.quizSession.correct}/${state.quizSession.answered}`

    const submitBtn = root.querySelector('#submit-quiz')
    if (submitBtn) submitBtn.disabled = true
  })

  root.querySelector('#next-quiz')?.addEventListener('click', () => {
    state.quizIndex = (state.quizIndex + 1) % filtered.length
    resetQuizStateForNextQuestion()
    const next = pickWeightedQuestion(filtered)
    state.quizSession.currentQuestionId = next?.id || null
    renderQuiz()
  })

  root.querySelector('#quiz-topic')?.addEventListener('change', (ev) => {
    state.quizSession.topicId = ev.target.value
    state.quizIndex = 0
    resetQuizStateForNextQuestion()
    saveQuizPrefs()
    renderQuiz()
  })

  root.querySelector('#quiz-difficulty')?.addEventListener('change', (ev) => {
    state.quizSession.difficulty = ev.target.value
    state.quizIndex = 0
    resetQuizStateForNextQuestion()
    saveQuizPrefs()
    renderQuiz()
  })

  root.querySelector('#explain-why')?.addEventListener('change', (ev) => {
    state.quizSession.explainWhy = Boolean(ev.target.checked)
    resetQuizStateForNextQuestion()
    saveQuizPrefs()
    renderQuiz()
  })
}

function renderCases() {
  const root = document.getElementById('cases')
  root.innerHTML = `
    <h2>4) Oncology Case Review Templates</h2>
    ${state.kb.cases.map((c) => `
      <div class="case-template">
        <h3>${c.title}</h3>
        <ul>${c.template.map((i) => `<li>${i}</li>`).join('')}</ul>
      </div>
    `).join('')}
  `
}

function renderAll() {
  renderDashboard()
  renderDailyPlan()
  renderQuiz()
  renderCases()
}

async function boot() {
  loadProgress()
  loadQuizPrefs()
  const res = await fetch('/api/kb')
  state.kb = await res.json()
  renderAll()
}

boot()
