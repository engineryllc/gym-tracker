import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function CardioCard({
  exercise,
  config,
  previousLog,
  nextExerciseName,
  onExerciseComplete,
  userId,
}) {
  const [duration, setDuration] = useState(previousLog?.duration_minutes || '')
  const [distance, setDistance] = useState(previousLog?.distance || '')
  const [rpe, setRpe] = useState(previousLog?.rpe || 5)
  const [notes, setNotes] = useState(previousLog?.notes || '')
  const [allDone, setAllDone] = useState(false)

  // Reset state when exercise changes
  useEffect(() => {
    setDuration(previousLog?.duration_minutes || '')
    setDistance(previousLog?.distance || '')
    setRpe(previousLog?.rpe || 5)
    setNotes(previousLog?.notes || '')
    setAllDone(false)
  }, [exercise?.id, previousLog])

  async function handleComplete() {
    if (allDone) return

    const durationVal = parseInt(duration) || 0
    if (durationVal === 0) {
      alert('Please enter a duration')
      return
    }

    setAllDone(true)

    // Log to Supabase
    await supabase.from('cardio_logs').insert({
      user_id: userId,
      exercise_id: exercise.id,
      duration_minutes: durationVal,
      distance: distance ? parseFloat(distance) : null,
      rpe: rpe,
      notes: notes || null,
    })

    onExerciseComplete()
  }

  return (
    <div className={`exercise-card cardio-card ${allDone ? 'card-done' : ''}`}>
      {/* Header */}
      <div className="card-header">
        <div className="card-exercise-name">{exercise?.name}</div>
      </div>

      {/* Cues */}
      {exercise?.cue_text && (
        <div className="card-cues">{exercise.cue_text}</div>
      )}

      {/* Cardio form */}
      <div className="cardio-form">
        <div className="cardio-field">
          <label>Duration (minutes)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            disabled={allDone}
            placeholder={config?.target_duration ? `${config.target_duration} min` : 'minutes'}
          />
        </div>

        <div className="cardio-field">
          <label>Distance (optional)</label>
          <input
            type="number"
            step="0.1"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            disabled={allDone}
            placeholder={config?.target_distance ? `${config.target_distance}` : 'miles/km'}
          />
        </div>

        <div className="cardio-field">
          <label>RPE (Perceived Exertion)</label>
          <div className="rpe-buttons">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
              <button
                key={val}
                className={`rpe-btn ${rpe === val ? 'active' : ''}`}
                onClick={() => setRpe(val)}
                disabled={allDone}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div className="cardio-field">
          <label>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={allDone}
            placeholder="How did it feel?"
            rows={3}
          />
        </div>
      </div>

      {/* Complete button */}
      <button
        className={`cardio-complete-btn ${allDone ? 'completed' : ''}`}
        onClick={handleComplete}
        disabled={allDone}
      >
        {allDone ? '✓ Complete' : 'Complete Cardio'}
      </button>

      {/* Next up */}
      {nextExerciseName && (
        <div className="card-next">
          <span className="next-label">NEXT UP</span>
          <span className="next-name">{nextExerciseName}</span>
        </div>
      )}
    </div>
  )
}
