import { useState, useEffect } from 'react'

export default function SetRow({ setNum, targetReps, targetWeight, pct, previousLog, onComplete, onSetEdit, disabled }) {
  const [weight, setWeight] = useState(() => {
    // Initialize with previous log weight if available, otherwise use target weight if it's > 0, else empty
    if (targetWeight && targetWeight > 0) return targetWeight
    if (previousLog?.weight_used) return previousLog.weight_used
    return ''
  })
  const [reps, setReps] = useState('')
  const [done, setDone] = useState(false)
  const [editing, setEditing] = useState(false)

  // When set is completed, populate with the values that were just entered
  useEffect(() => {
    if (done && !editing && previousLog) {
      setWeight(previousLog.weight_used)
      setReps(previousLog.reps_completed)
    }
  }, [done, editing, previousLog])

  function handleComplete() {
    if (done || disabled) return
    const r = parseInt(reps) || (typeof targetReps === 'number' ? targetReps : 0)
    const w = parseFloat(weight) || 0
    setDone(true)
    onComplete({ setNumber: setNum, repsCompleted: r, weightUsed: w })
  }

  function handleEditToggle() {
    if (!done) return
    setEditing(!editing)
  }

  function handleSaveEdit() {
    const r = parseInt(reps) || 0
    const w = parseFloat(weight) || 0
    onSetEdit({ setNumber: setNum, repsCompleted: r, weightUsed: w })
    setEditing(false)
  }

  function handleCancelEdit() {
    // Reset to previous values
    if (previousLog) {
      setWeight(previousLog.weight_used)
      setReps(previousLog.reps_completed)
    }
    setEditing(false)
  }

  return (
    <div className={`set-row ${done ? 'set-done' : ''} ${disabled ? 'set-disabled' : ''} ${editing ? 'set-editing' : ''}`}>
      <div className="set-num">{setNum}</div>

      {pct && <div className="set-pct">{pct}%</div>}

      <div className="set-prev">
        {previousLog ? `${previousLog.weight_used}lb × ${previousLog.reps_completed}` : '—'}
      </div>

      <input
        className="set-weight"
        type="number"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        disabled={done && !editing}
        placeholder={targetWeight > 0 ? String(targetWeight) : 'lb'}
      />

      <input
        className="set-reps"
        type="number"
        value={reps}
        onChange={e => setReps(e.target.value)}
        placeholder={String(targetReps)}
        disabled={done && !editing}
        onKeyDown={e => e.key === 'Enter' && (editing ? handleSaveEdit() : handleComplete())}
      />

      {!editing && (
        <button
          className={`set-check ${done ? 'checked' : ''}`}
          onClick={done ? handleEditToggle : handleComplete}
          disabled={disabled && !done}
          title={done ? 'Click to edit' : ''}
        >
          {done ? '✓' : '○'}
        </button>
      )}

      {editing && (
        <div className="set-edit-buttons">
          <button className="set-save" onClick={handleSaveEdit}>
            Save
          </button>
          <button className="set-cancel" onClick={handleCancelEdit}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
