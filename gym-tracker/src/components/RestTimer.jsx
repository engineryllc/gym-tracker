import { useState, useEffect, useRef } from 'react'

export default function RestTimer({ seconds, onDismiss }) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    setRemaining(seconds)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          // Vibrate on final buzz
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100])
          }
          // Auto-dismiss when timer reaches 0
          onDismiss()
          return 0
        }
        // Vibrate on each tick
        if (navigator.vibrate) {
          navigator.vibrate(100)
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [seconds, onDismiss])

  const pct = remaining / seconds
  const circumference = 2 * Math.PI * 28
  const dash = circumference * pct

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`

  return (
    <div className="rest-timer" onClick={onDismiss}>
      <div className="rest-timer-inner">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke="var(--timer-track)" strokeWidth="4" />
          <circle
            cx="36" cy="36" r="28"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset="0"
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dasharray 1s linear' }}
          />
        </svg>
        <div className="rest-timer-text">{display}</div>
      </div>
      <div className="rest-timer-label">REST · tap to skip</div>
    </div>
  )
}
