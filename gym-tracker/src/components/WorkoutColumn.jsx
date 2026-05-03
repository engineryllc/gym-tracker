import { useState, useEffect } from 'react'
import ExerciseCard from './ExerciseCard'
import CardioCard from './CardioCard'
import SupersetCard from './SupersetCard'
import InstructionPanel from './InstructionPanel'
import { supabase } from '../supabase'
import { getTodayName, DAYS_OF_WEEK } from '../utils/progression'

export default function WorkoutColumn({ userId, userName, soloInstructionMode }) {
  const [schedule, setSchedule] = useState([]) // ordered exercises for today with superset_id
  const [currentIndex, setCurrentIndex] = useState(0)
  const [configs, setConfigs] = useState({})
  const [mainLifts, setMainLifts] = useState({})
  const [accessoryWeights, setAccessoryWeights] = useState({})
  const [previousLogs, setPreviousLogs] = useState({})
  const [previousCardioLogs, setPreviousCardioLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [showingNextInstruction, setShowingNextInstruction] = useState(false)
  const [workoutDone, setWorkoutDone] = useState(false)
  const [selectedDay, setSelectedDay] = useState(getTodayName())
  const [restTimer, setRestTimer] = useState(null)

  useEffect(() => {
    setSelectedDay(getTodayName())
    setCurrentIndex(0)
    setWorkoutDone(false)
  }, [userId])

  useEffect(() => {
    loadWorkout()
  }, [userId, selectedDay])

  async function loadWorkout() {
    setLoading(true)

    // Load schedule for selected day (including superset_id)
    const { data: schedData } = await supabase
      .from('schedules')
      .select('sort_order, superset_id, exercises(*)')
      .eq('user_id', userId)
      .eq('day_of_week', selectedDay)
      .order('sort_order')

    if (!schedData || schedData.length === 0) {
      setLoading(false)
      return
    }

    // Store full schedule data (including superset_id)
    setSchedule(schedData)

    const exercises = schedData.map(s => s.exercises)
    const exerciseIds = exercises.map(e => e.id)

    // Load configs
    const { data: cfgData } = await supabase
      .from('exercise_config')
      .select('*')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)

    const cfgMap = {}
    cfgData?.forEach(c => { cfgMap[c.exercise_id] = c })
    setConfigs(cfgMap)

    // Load main lift progress
    const { data: mlData } = await supabase
      .from('main_lift_progress')
      .select('*')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)

    const mlMap = {}
    mlData?.forEach(m => { mlMap[m.exercise_id] = m })
    setMainLifts(mlMap)

    // Load accessory weights
    const { data: awData } = await supabase
      .from('accessory_weights')
      .select('*')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)

    const awMap = {}
    awData?.forEach(a => { awMap[a.exercise_id] = a })
    setAccessoryWeights(awMap)

    // Load previous logs (last session per exercise+set)
    const { data: logData } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)
      .order('logged_at', { ascending: false })

    const logMap = {}
    logData?.forEach(l => {
      const key = l.exercise_id
      if (!logMap[key]) logMap[key] = []
      // Only keep last session's sets
      const existing = logMap[key]
      if (!existing.find(e => e.set_number === l.set_number)) {
        existing.push(l)
      }
    })
    setPreviousLogs(logMap)

    // Load cardio logs (last session per exercise)
    const { data: cardioData } = await supabase
      .from('cardio_logs')
      .select('*')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)
      .order('logged_at', { ascending: false })

    const cardioMap = {}
    cardioData?.forEach(c => {
      const key = c.exercise_id
      if (!cardioMap[key]) cardioMap[key] = c
    })
    setPreviousCardioLogs(cardioMap)

    setLoading(false)
  }

  function handleExerciseComplete() {
    setShowingNextInstruction(false)
    
    const currentSupersetId = schedule[currentIndex]?.superset_id
    
    if (currentSupersetId) {
      // If current exercise is part of a superset, skip to the first exercise after the superset
      const supersetEndIndex = schedule.findIndex(
        (s, idx) => idx > currentIndex && s.superset_id !== currentSupersetId
      )
      if (supersetEndIndex === -1) {
        // No more exercises after this superset
        setWorkoutDone(true)
      } else {
        setCurrentIndex(supersetEndIndex)
      }
    } else {
      // Regular exercise
      if (currentIndex >= schedule.length - 1) {
        setWorkoutDone(true)
      } else {
        setCurrentIndex(i => i + 1)
      }
    }
  }

  if (loading) return (
    <div className="workout-column loading">
      <div className="loading-spinner" />
      <div className="loading-text">Loading {userName}'s workout…</div>
    </div>
  )

  if (schedule.length === 0) return (
    <div className="workout-column rest-day">
      <div className="rest-day-icon">🏖</div>
      <div className="rest-day-text">Rest day</div>
      <div className="rest-day-sub">
        <select className="day-select" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
          {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
        </select> · {userName}
      </div>
    </div>
  )

  if (workoutDone) return (
    <div className="workout-column workout-complete">
      <div className="complete-icon">🏆</div>
      <div className="complete-text">Workout Complete</div>
      <div className="complete-sub">{schedule.length} exercises · {userName}</div>
    </div>
  )

  const currentScheduleItem = schedule[currentIndex]
  const currentExercise = currentScheduleItem?.exercises
  const nextExerciseItem = schedule[currentIndex + 1]
  const nextExercise = nextExerciseItem?.exercises || null
  const config = configs[currentExercise?.id]
  const mainLift = mainLifts[currentExercise?.id]
  const accessory = accessoryWeights[currentExercise?.id]
  const prevLogs = previousLogs[currentExercise?.id] || []
  const prevCardioLog = previousCardioLogs[currentExercise?.id] || null
  const isCardio = config?.exercise_type === 'cardio'
  const isSuperset = currentScheduleItem?.superset_id

  // If part of a superset, get all exercises in the superset
  const supersetExercises = isSuperset 
    ? schedule
        .filter(s => s.superset_id === currentScheduleItem.superset_id)
        .map(s => ({
          id: s.exercises.id,
          name: s.exercises.name,
          config: configs[s.exercises.id],
          mainLift: mainLifts[s.exercises.id],
          lastLogs: previousLogs[s.exercises.id] || [],
        }))
    : null

  // Progress bar
  const progress = currentIndex / schedule.length

  return (
    <div className="workout-column">
      {/* Column header */}
      <div className="column-header">
        <div className="column-header-top">
          <div className="column-name">{userName}</div>
          <select className="day-select" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="column-progress-bar">
          <div className="column-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="column-progress-text">{currentIndex + 1} / {schedule.length}</div>
      </div>

      {/* Main content */}
      <div className="column-content">
        {isSuperset ? (
          // Superset: render all exercises in the superset
          <SupersetCard
            exercises={supersetExercises}
            userId={userId}
            onExerciseComplete={handleExerciseComplete}
          />
        ) : soloInstructionMode && !isCardio ? (
          // Solo mode: tracker left, instruction right (strength only)
          <>
            <ExerciseCard
              exercise={currentExercise}
              config={config}
              mainLiftProgress={mainLift}
              accessoryWeight={accessory}
              previousLogs={prevLogs}
              nextExerciseName={nextExercise?.name}
              onExerciseComplete={handleExerciseComplete}
              userId={userId}
            />
            <InstructionPanel
              exercise={currentExercise}
              nextExercise={nextExercise}
              showingNext={showingNextInstruction}
              onShowNext={() => setShowingNextInstruction(v => !v)}
            />
          </>
        ) : isCardio ? (
          <CardioCard
            exercise={currentExercise}
            config={config}
            previousLog={prevCardioLog}
            nextExerciseName={nextExercise?.name}
            onExerciseComplete={handleExerciseComplete}
            userId={userId}
          />
        ) : (
          <ExerciseCard
            exercise={currentExercise}
            config={config}
            mainLiftProgress={mainLift}
            accessoryWeight={accessory}
            previousLogs={prevLogs}
            nextExerciseName={nextExercise?.name}
            onExerciseComplete={handleExerciseComplete}
            userId={userId}
          />
        )}
      </div>
    </div>
  )
}
