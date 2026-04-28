import { useState, useEffect } from 'react'
import SetRow from './SetRow'
import RestTimer from './RestTimer'
import { getMainLiftSets, CYCLE_LABELS, shouldBump1RM, shouldSuggestIncrease } from '../utils/progression'
import { supabase } from '../supabase'

export default function ExerciseCard({
  exercise,
  config,
  mainLiftProgress,
  accessoryWeight,
  previousLogs,
  nextExerciseName,
  onExerciseComplete,
  userId,
}) {
  const [restActive, setRestActive] = useState(false)
  const [restSeconds, setRestSeconds] = useState(config?.rest_seconds || 90)
  const [completedSets, setCompletedSets] = useState([])
  const [allDone, setAllDone] = useState(false)

  // Reset state when exercise changes
  useEffect(() => {
    setCompletedSets([])
    setAllDone(false)
    setRestActive(false)
    setRestSeconds(config?.rest_seconds || 90)
  }, [exercise?.id, config?.rest_seconds])

  const isMainLift = config?.is_main_lift && mainLiftProgress
  const cycleWeek = mainLiftProgress?.cycle_week || 1
  const sets = isMainLift
    ? getMainLiftSets(mainLiftProgress.one_rep_max, cycleWeek)
    : buildAccessorySets(config, accessoryWeight?.working_weight)

  function buildAccessorySets(cfg, weight) {
    const count = cfg?.sets || 3
    return Array.from({ length: count }, (_, i) => ({
      setNumber: i + 1,
      targetReps: cfg?.rep_target || '8-12',
      targetWeight: weight || 0,
      pct: null,
    }))
  }

  async function handleSetComplete(setData) {
    const newCompleted = [...completedSets, setData]
    setCompletedSets(newCompleted)

    // Log to Supabase
    await supabase.from('workout_logs').insert({
      user_id: userId,
      exercise_id: exercise.id,
      set_number: setData.setNumber,
      reps_completed: setData.repsCompleted,
      weight_used: setData.weightUsed,
    })

    // Start rest timer
    setRestSeconds(config?.rest_seconds || 90)
    setRestActive(true)

    // Check if all sets done - if so, wait for timer to finish
    // The timer will call onDismiss when it expires, which will trigger finishExercise
    if (newCompleted.length >= sets.length) {
      // Don't finishExercise here - let the timer finish first
    }
  }

  async function handleSetEdit(setData) {
    // Update the completed set in state
    const updated = completedSets.map(s =>
      s.setNumber === setData.setNumber
        ? { ...s, repsCompleted: setData.repsCompleted, weightUsed: setData.weightUsed }
        : s
    )
    setCompletedSets(updated)

    // Update in Supabase - find the log by user, exercise, set number
    // Assuming it was logged today
    const today = new Date().toISOString().split('T')[0]
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('exercise_id', exercise.id)
      .eq('set_number', setData.setNumber)
      .gte('logged_at', today)
      .order('logged_at', { ascending: false })
      .limit(1)

    if (logs && logs.length > 0) {
      await supabase.from('workout_logs')
        .update({
          reps_completed: setData.repsCompleted,
          weight_used: setData.weightUsed,
        })
        .eq('id', logs[0].id)
    }
  }

  async function finishExercise(allSets) {
    setAllDone(true)

    // Check 1RM bump for Andy's main lift
    if (isMainLift && shouldBump1RM(allSets[allSets.length - 1]?.repsCompleted, cycleWeek)) {
      const newMax = mainLiftProgress.one_rep_max + 5
      await supabase.from('main_lift_progress')
        .update({ one_rep_max: newMax })
        .eq('user_id', userId)
        .eq('exercise_id', exercise.id)
    }

    // Check accessory weight suggestion
    if (!isMainLift && allSets.length > 0) {
      const lastSet = allSets[allSets.length - 1]
      if (shouldSuggestIncrease(lastSet.repsCompleted, config?.rep_target)) {
        await supabase.from('accessory_weights')
          .update({ increase_suggested: true })
          .eq('user_id', userId)
          .eq('exercise_id', exercise.id)
      }
    }

    onExerciseComplete()
  }

  const getPrevLog = (setNum) => previousLogs?.find(l => l.set_number === setNum) || null

  return (
    <div className={`exercise-card ${allDone ? 'card-done' : ''}`}>
      {/* Header */}
      <div className="card-header">
        <div className="card-exercise-name">{exercise?.name}</div>
        {config?.tempo && <div className="card-tempo">TEMPO {config.tempo || exercise?.default_tempo}</div>}
        {isMainLift && (
          <div className="card-cycle-badge">{CYCLE_LABELS[cycleWeek]}</div>
        )}
      </div>

      {/* Cues */}
      {exercise?.cue_text && (
        <div className="card-cues">{exercise.cue_text}</div>
      )}

      {/* Set column headers */}
      <div className="set-headers">
        <span>SET</span>
        {isMainLift && <span>%</span>}
        <span>PREV</span>
        <span>LB</span>
        <span>REPS</span>
        <span></span>
      </div>

      {/* Set rows */}
      <div className="set-list">
        {sets.map((s, i) => (
          <SetRow
            key={`${exercise.id}-${s.setNumber}`}
            setNum={s.setNumber}
            targetReps={s.targetReps}
            targetWeight={s.targetWeight}
            pct={s.pct}
            previousLog={getPrevLog(s.setNumber)}
            onComplete={handleSetComplete}
            onSetEdit={handleSetEdit}
            disabled={completedSets.length < i}
          />
        ))}
      </div>

      {/* Rest timer */}
      {restActive && (
        <RestTimer 
          seconds={restSeconds} 
          onDismiss={() => {
            setRestActive(false)
            // If all sets are done and timer finished, move to next exercise
            if (completedSets.length >= sets.length) {
              finishExercise(completedSets)
            }
          }} 
        />
      )}

      {/* Next up */}
      {nextExerciseName && (
        <div className="card-next">
          <span className="next-label">NEXT UP</span>
          <span className="next-name">{nextExerciseName}</span>
        </div>
      )}

      {allDone && (
        <div className="card-complete-banner">✓ Complete</div>
      )}
    </div>
  )
}
