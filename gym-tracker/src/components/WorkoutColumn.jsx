import { useState, useEffect } from 'react'
import ExerciseCard from './ExerciseCard'
import InstructionPanel from './InstructionPanel'
import { supabase } from '../supabase'
import { getTodayName } from '../utils/progression'

export default function WorkoutColumn({ userId, userName, soloInstructionMode }) {
  const [schedule, setSchedule] = useState([]) // ordered exercises for today
  const [currentIndex, setCurrentIndex] = useState(0)
  const [configs, setConfigs] = useState({})
  const [mainLifts, setMainLifts] = useState({})
  const [accessoryWeights, setAccessoryWeights] = useState({})
  const [previousLogs, setPreviousLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [showingNextInstruction, setShowingNextInstruction] = useState(false)
  const [workoutDone, setWorkoutDone] = useState(false)

  const today = getTodayName()

  useEffect(() => {
    loadWorkout()
  }, [userId])

  async function loadWorkout() {
    setLoading(true)

    // Load today's schedule
    const { data: schedData } = await supabase
      .from('schedules')
      .select('sort_order, exercises(*)')
      .eq('user_id', userId)
      .eq('day_of_week', today)
      .order('sort_order')

    if (!schedData || schedData.length === 0) {
      setLoading(false)
      return
    }

    const exercises = schedData.map(s => s.exercises)
    setSchedule(exercises)

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

    setLoading(false)
  }

  function handleExerciseComplete() {
    setShowingNextInstruction(false)
    if (currentIndex >= schedule.length - 1) {
      setWorkoutDone(true)
    } else {
      setCurrentIndex(i => i + 1)
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
      <div className="rest-day-sub">{today} · {userName}</div>
    </div>
  )

  if (workoutDone) return (
    <div className="workout-column workout-complete">
      <div className="complete-icon">🏆</div>
      <div className="complete-text">Workout Complete</div>
      <div className="complete-sub">{schedule.length} exercises · {userName}</div>
    </div>
  )

  const currentExercise = schedule[currentIndex]
  const nextExercise = schedule[currentIndex + 1] || null
  const config = configs[currentExercise?.id]
  const mainLift = mainLifts[currentExercise?.id]
  const accessory = accessoryWeights[currentExercise?.id]
  const prevLogs = previousLogs[currentExercise?.id] || []

  // Progress bar
  const progress = currentIndex / schedule.length

  return (
    <div className="workout-column">
      {/* Column header */}
      <div className="column-header">
        <div className="column-name">{userName}</div>
        <div className="column-progress-bar">
          <div className="column-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="column-progress-text">{currentIndex + 1} / {schedule.length}</div>
      </div>

      {/* Main content */}
      <div className="column-content">
        {soloInstructionMode ? (
          // Solo mode: tracker left, instruction right
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
