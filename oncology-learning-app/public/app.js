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

function awardStudy(topicId, delta) {
  state.progress.topicMastery[topicId] = clamp((state.progress.topicMastery[topicId] ?? 0) + delta, 0, 100)
  state.progress.xp += Math.max(5, delta)
  const today = todayIso()
  if (state.progress.lastStudyDate !== today) {
    state.progress.streak = state.progress.lastStudyDate ? state.progress.streak + 1 : 1
    state.progress.lastStudyDate = today
  }
  saveProgress()
  renderAll()
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
  return hits >= Math.max(1, Math.ceil(keywords.length / 3))
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
    <p><b>${q.question}</b></p>
    ${q.type === 'mcq'
      ? `<select id="quiz-answer"><option value="">Select answer</option>${q.options.map((o) => `<option>${o}</option>`).join('')}</select>`
      : '<textarea id="quiz-answer" rows="3" placeholder="Type your short answer..."></textarea>'}
    <button id="submit-quiz">Submit</button>
    <button id="next-quiz" class="secondary">Next</button>
    <div id="quiz-feedback" class="quiz-feedback"></div>
  `

  root.querySelector('#submit-quiz')?.addEventListener('click', () => {
    const input = root.querySelector('#quiz-answer')?.value?.trim() || ''
    let correct = false
    if (q.type === 'mcq') {
      correct = input === q.answer
    } else {
      correct = scoreShortAnswer(input, q.answerKeywords || [])
    }

    const feedback = root.querySelector('#quiz-feedback')
    if (correct) {
      feedback.textContent = `✅ Correct. ${q.explanation}`
      awardStudy(q.topicId, 6)
    } else {
      feedback.textContent = `❌ Not quite. Suggested answer cues: ${q.type === 'mcq' ? q.answer : (q.answerKeywords || []).join(', ')}. ${q.explanation}`
      awardStudy(q.topicId, 2)
    }
  })

  root.querySelector('#next-quiz')?.addEventListener('click', () => {
    state.quizIndex += 1
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
