export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function validateKB(kb, label = 'kb') {
  const errors = []
  const warnings = []

  if (!kb || typeof kb !== 'object') {
    return { errors: [`${label}: root must be an object`], warnings }
  }

  if (!Array.isArray(kb.topics)) errors.push(`${label}: topics must be an array`)
  if (!Array.isArray(kb.quizBank)) errors.push(`${label}: quizBank must be an array`)
  if (!Array.isArray(kb.cases)) errors.push(`${label}: cases must be an array`)

  ;(kb.topics || []).forEach((t, i) => {
    if (!isNonEmptyString(t.id)) errors.push(`${label}.topics[${i}].id required`)
    if (!isNonEmptyString(t.name)) errors.push(`${label}.topics[${i}].name required`)
  })

  ;(kb.quizBank || []).forEach((q, i) => {
    if (!isNonEmptyString(q.id)) errors.push(`${label}.quizBank[${i}].id required`)
    if (!isNonEmptyString(q.topicId)) errors.push(`${label}.quizBank[${i}].topicId required`)
    if (!['mcq', 'short'].includes(q.type)) errors.push(`${label}.quizBank[${i}].type must be mcq|short`)
    if (!isNonEmptyString(q.question)) errors.push(`${label}.quizBank[${i}].question required`)
    if (!isNonEmptyString(q.explanation)) errors.push(`${label}.quizBank[${i}].explanation required`)
    if (!['intern', 'resident'].includes(q.difficulty)) errors.push(`${label}.quizBank[${i}].difficulty must be intern|resident`)
    if (!isNonEmptyString(q.rationale)) errors.push(`${label}.quizBank[${i}].rationale required`)
    if (!isNonEmptyString(q.commonMistake)) errors.push(`${label}.quizBank[${i}].commonMistake required`)

    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${label}.quizBank[${i}].options needs >=2`)
      if (!isNonEmptyString(q.answer)) errors.push(`${label}.quizBank[${i}].answer required for mcq`)
    }

    if (q.type === 'short') {
      if (!Array.isArray(q.answerKeywords) || q.answerKeywords.length < 1) errors.push(`${label}.quizBank[${i}].answerKeywords required for short`)
      if (!isNonEmptyString(q.modelAnswer)) errors.push(`${label}.quizBank[${i}].modelAnswer required for short`)
    }

    if (isNonEmptyString(q.rationale) && q.rationale.trim().split(/\s+/).length < 8) {
      warnings.push(`${label}.quizBank[${i}].rationale looks weak (too short)`)
    }
    if (isNonEmptyString(q.commonMistake) && q.commonMistake.trim().split(/\s+/).length < 6) {
      warnings.push(`${label}.quizBank[${i}].commonMistake looks weak (too short)`)
    }
  })

  ;(kb.cases || []).forEach((c, i) => {
    if (!isNonEmptyString(c.id)) errors.push(`${label}.cases[${i}].id required`)
    if (!isNonEmptyString(c.title)) errors.push(`${label}.cases[${i}].title required`)
    if (!Array.isArray(c.template) || c.template.length < 1) errors.push(`${label}.cases[${i}].template required`)
  })

  return { errors, warnings }
}
