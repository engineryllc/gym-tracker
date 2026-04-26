import { useState } from 'react'

export default function SetRow({ setNum, targetReps, targetWeight, pct, previousLog, onComplete, disabled }) {
  const [weight, setWeight] = useState(targetWeight ?? '')
  const [reps, setReps] = useState('')
  const [done, setDone] = useState(false)

  function handleComplete() {
    if (done || disabled) return
    const r = parseInt(reps) || (typeof targetReps === 'number' ? targetReps : 0)
    const w = parseFloat(weight) || 0
    setDone(true)
    onComplete({ setNumber: setNum, repsCompleted: r, weightUsed: w })
  }

  return (
    <div className={`set-row ${done ? 'set-done' : ''} ${disabled ? 'set-disabled' : ''}`}>
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
        disabled={done}
        placeholder="lb"
      />

      <input
        className="set-reps"
        type="number"
        value={reps}
        onChange={e => setReps(e.target.value)}
        placeholder={String(targetReps)}
        disabled={done}
        onKeyDown={e => e.key === 'Enter' && handleComplete()}
      />

      <button
        className={`set-check ${done ? 'checked' : ''}`}
        onClick={handleComplete}
        disabled={disabled}
      >
        {done ? '✓' : '○'}
      </button>
    </div>
  )
}
