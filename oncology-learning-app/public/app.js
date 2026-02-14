const STORAGE_KEY = 'oncologyLearningProgressV1'

const state = {
  kb: { topics: [], quizBank: [], cases: [] },
  progress: {
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    topicMastery: {},
  },
  quizIndex: 0,
  quizSession: {
    answered: 0,
    correct: 0,
    submitted: false,
    feedbackHtml: '',
  },
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try { state.progress = { ...state.progress, ...JSON.parse(raw) } } catch {}
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress))
}

function getMastery(topic) {
  return state.progress.topicMastery[topic.id] ?? topic.mastery ?? 0
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
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
}

function renderQuiz() {
  const root = document.getElementById('quiz')
  if (!state.kb.quizBank.length) {
    root.innerHTML = '<h2>3) Quiz Mode</h2><p>No quiz items available.</p>'
    return
  }

  const q = state.kb.quizBank[state.quizIndex % state.kb.quizBank.length]
  root.innerHTML = `
    <h2>3) Quiz Mode (MCQ + Short Answer)</h2>
    <p class="quiz-score"><span id="quiz-score-badge" class="badge">Score ${state.quizSession.correct}/${state.quizSession.answered}</span><span class="badge">Question ${state.quizIndex + 1}</span></p>
    <p><b>${q.question}</b></p>
    ${q.type === 'mcq'
      ? `<div id="mcq-options">${q.options.map((o, i) => `<label class="mcq-option" data-option="${o.replace(/"/g, '&quot;')}"><input type="radio" name="quiz-answer" value="${o.replace(/"/g, '&quot;')}" /> ${String.fromCharCode(65 + i)}. ${o}</label>`).join('')}</div>`
      : '<textarea id="quiz-answer" rows="3" placeholder="Type your short answer..."></textarea>'}
    <div class="quiz-actions">
      <button id="submit-quiz">Submit</button>
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

      state.quizSession.feedbackHtml = isCorrect
        ? `✅ <b>Correct</b><br/>${q.explanation}`
        : `❌ <b>Incorrect</b><br/>Correct option: <b>${q.answer}</b><br/>${q.explanation}`
    } else {
      const input = root.querySelector('#quiz-answer')?.value?.trim() || ''
      if (!input) {
        state.quizSession.feedbackHtml = '⚠️ Please enter an answer first.'
        renderQuiz()
        return
      }
      const rubric = scoreShortAnswer(input, q.answerKeywords || [])
      isCorrect = rubric.label === 'pass'
      const model = (q.answerKeywords || []).join(', ')
      state.quizSession.feedbackHtml = `${rubric.label === 'pass' ? '✅' : rubric.label === 'partial' ? '🟡' : '❌'} <b>${rubric.label.toUpperCase()}</b> (${rubric.hits} keyword hits)<br/>Model answer cues: <b>${model || 'n/a'}</b><br/>${q.explanation}`
    }

    state.quizSession.submitted = true
    state.quizSession.answered += 1
    if (isCorrect) state.quizSession.correct += 1

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
    state.quizIndex = (state.quizIndex + 1) % state.kb.quizBank.length
    resetQuizStateForNextQuestion()
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
  const res = await fetch('/api/kb')
  state.kb = await res.json()
  renderAll()
}

boot()
