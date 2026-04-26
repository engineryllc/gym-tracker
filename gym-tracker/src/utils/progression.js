// Rounds to nearest 5
export function roundToNearest5(val) {
  return Math.round(val / 5) * 5
}

// Returns set scheme for Andy's main lifts
// cycle_week: 1=8-rep week, 2=6-rep week, 3=4-rep week, 4=deload
export function getMainLiftSets(oneRepMax, cycleWeek) {
  const schemes = {
    1: [ // 8-rep week
      { reps: 8, pct: 0.60 },
      { reps: 8, pct: 0.65 },
      { reps: 8, pct: 0.70 },
      { reps: 8, pct: 0.75 },
    ],
    2: [ // 6-rep week
      { reps: 6, pct: 0.65 },
      { reps: 6, pct: 0.70 },
      { reps: 6, pct: 0.75 },
      { reps: 6, pct: 0.80 },
    ],
    3: [ // 4-rep week
      { reps: 8, pct: 0.70 },
      { reps: 6, pct: 0.75 },
      { reps: 4, pct: 0.80 },
      { reps: 4, pct: 0.85 },
    ],
    4: [ // deload
      { reps: '10-12', pct: 0.55 },
      { reps: '10-12', pct: 0.55 },
      { reps: '10-12', pct: 0.55 },
      { reps: '10-12', pct: 0.55 },
    ],
  }

  const scheme = schemes[cycleWeek] || schemes[1]
  return scheme.map((s, i) => ({
    setNumber: i + 1,
    targetReps: s.reps,
    targetWeight: roundToNearest5(oneRepMax * s.pct),
    pct: Math.round(s.pct * 100),
  }))
}

// Cycle week labels
export const CYCLE_LABELS = {
  1: '8-Rep Week',
  2: '6-Rep Week',
  3: '4-Rep Week',
  4: 'Deload Week',
}

// Next cycle week
export function nextCycleWeek(current) {
  return current >= 4 ? 1 : current + 1
}

// Check if Andy should get a 1RM bump
// lastSet = { reps_completed, weight_used }, targetPct = 0.85, cycleWeek = 3
export function shouldBump1RM(lastSetReps, cycleWeek) {
  return cycleWeek === 3 && lastSetReps >= 5
}

// Parse rep target string to min/max
export function parseRepTarget(target) {
  if (!target) return { min: 8, max: 12 }
  if (target.includes('-')) {
    const [min, max] = target.split('-').map(Number)
    return { min, max }
  }
  if (target === 'Fail') return { min: 0, max: Infinity }
  const n = parseInt(target)
  return { min: n, max: n }
}

// Check if accessory weight should be suggested higher
export function shouldSuggestIncrease(repsCompleted, repTarget) {
  const { max } = parseRepTarget(repTarget)
  if (max === Infinity) return false
  return repsCompleted > max
}

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function getTodayName() {
  return DAYS_OF_WEEK[new Date().getDay()]
}
