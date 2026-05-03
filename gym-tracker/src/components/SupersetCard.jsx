import { useState } from 'react'
import { supabase } from '../supabase'
import SetRow from './SetRow'
import RestTimer from './RestTimer'

export default function SupersetCard({ exercises, userId, onExerciseComplete }) {
  const [currentSet, setCurrentSet] = useState(0)
  const [completed, setCompleted] = useState({})
  const [loading, setLoading] = useState(false)
  const [restTime, setRestTime] = useState(null)

  const sets = exercises[0]?.config?.sets || 3
  const restSeconds = exercises[0]?.config?.rest_seconds || 90
  
  // Track completion for each exercise at current set
  const allExercisesCompleted = exercises.every(ex => completed[ex.id])

  async function handleSetComplete(exerciseId, setData) {
    setLoading(true)
    try {
      const exercise = exercises.find(e => e.id === exerciseId)
      if (!exercise) return

      // Log to workout_logs
      const { error } = await supabase.from('workout_logs').insert({
        user_id: userId,
        exercise_id: exerciseId,
        set_number: setData.setNumber,
        weight: setData.weightUsed,
        reps: setData.repsCompleted,
        logged_at: new Date().toISOString(),
      })

      if (error) throw error

      // Mark this exercise as completed in current set
      setCompleted(c => ({ ...c, [exerciseId]: true }))
    } catch (err) {
      console.error('Error logging set:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleNextSet() {
    // Start rest timer
    setRestTime(restSeconds)
  }

  function handleTimerDismiss() {
    setRestTime(null)
    if (currentSet < sets - 1) {
      // Move to next set, reset completion tracking
      setCurrentSet(s => s + 1)
      setCompleted({})
    } else {
      // All sets done
      onExerciseComplete()
    }
  }

  return (
    <div className="superset-card">
      {restTime !== null ? (
        <RestTimer seconds={restTime} onDismiss={handleTimerDismiss} />
      ) : (
        <>
          <div className="superset-header">
            <div className="superset-title">
              Superset: {exercises.map(e => e.name).join(' + ')}
            </div>
            <div className="superset-progress">
              Set {currentSet + 1} of {sets}
            </div>
          </div>

          <div className="superset-block">
            {exercises.map((exercise) => {
              const lastLogsForCurrentSet = exercise.lastLogs?.[currentSet]
              const prevWeight = lastLogsForCurrentSet?.weight_used || 0
              const prevReps = lastLogsForCurrentSet?.reps_completed || exercise.config?.rep_target || '8-12'
              const isExCompleted = completed[exercise.id]
              
              return (
                <div key={exercise.id} className="superset-row">
                  <div className="superset-exercise-name">{exercise.name}</div>
                  <SetRow
                    setNum={currentSet + 1}
                    targetWeight={prevWeight}
                    targetReps={typeof prevReps === 'string' ? parseInt(prevReps.split('-')[0]) : prevReps}
                    previousLog={lastLogsForCurrentSet ? { weight_used: lastLogsForCurrentSet.weight_used, reps_completed: lastLogsForCurrentSet.reps_completed } : null}
                    onComplete={(setData) => handleSetComplete(exercise.id, setData)}
                    disabled={false}
                  />
                </div>
              )
            })}
          </div>

          <div className="superset-actions">
            {allExercisesCompleted ? (
              <button className="next-set-btn" onClick={handleNextSet} disabled={loading}>
                {currentSet < sets - 1 ? '↓ Next Set' : '✓ Finish'}
              </button>
            ) : (
              <div className="superset-status">
                Complete all exercises to proceed
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

