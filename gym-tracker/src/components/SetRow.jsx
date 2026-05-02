import { useState } from 'react'

export default function SetRow({ setNum, targetReps, targetWeight, pct, previousLog, onComplete, onSetEdit, disabled }) {
  const [weight, setWeight] = useState(targetWeight > 0 ? targetWeight : '')
  const [reps, setReps] = useState('')
  const [done, setDone] = useState(false)
  const [editing, setEditing] = useState(false)
  const [completedWeight, setCompletedWeight] = useState(null)
  const [completedReps, setCompletedReps] = useState(null)

  function handleComplete() {
    if (done || disabled) return
    const r = parseInt(reps) || (typeof targetReps === 'number' ? targetReps : 0)
    const w = parseFloat(weight) || 0
    setDone(true)
    setCompletedWeight(w)
    setCompletedReps(r)
    onComplete({ setNumber: setNum, repsCompleted: r, weightUsed: w })
  }

  function handleEditToggle() {
    if (!done) return
    setWeight(completedWeight)
    setReps(completedReps)
    setEditing(!editing)
  }

  function handleSaveEdit() {
    const r = parseInt(reps) || 0
    const w = parseFloat(weight) || 0
    setCompletedWeight(w)
    setCompletedReps(r)
    onSetEdit({ setNumber: setNum, repsCompleted: r, weightUsed: w })
    setEditing(false)
  }

  function handleCancelEdit() {
    setWeight(completedWeight)
    setReps(completedReps)
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
        value={done && !editing ? (completedWeight ?? '') : weight}
        onChange={e => setWeight(e.target.value)}
        disabled={done && !editing}
        placeholder={targetWeight > 0 ? String(targetWeight) : 'lb'}
      />

      <input
        className="set-reps"
        type="number"
        value={done && !editing ? (completedReps ?? '') : reps}
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
          <button className="set-save" onClick={handleSaveEdit}>Save</button>
          <button className="set-cancel" onClick={handleCancelEdit}>Cancel</button>
        </div>
      )}
    </div>
  )
}