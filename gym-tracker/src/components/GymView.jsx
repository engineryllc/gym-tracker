import WorkoutColumn from './WorkoutColumn'

// These UUIDs will be populated after first Supabase load
// We fetch them dynamically
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GymView({ mode, onExit }) {
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('users').select('*').then(({ data }) => {
      const map = {}
      data?.forEach(u => { map[u.name.toLowerCase()] = u })
      setUsers(map)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="gym-loading">Loading…</div>

  const andy = users['andy']
  const ali = users['ali']

  return (
    <div className="gym-view">
      <div className="gym-topbar">
        <div className="gym-logo">GYMTRACKER</div>
        <button className="gym-exit-btn" onClick={onExit}>✕ End Session</button>
      </div>

      <div className={`gym-columns ${mode === 'both' ? 'dual' : 'solo'}`}>
        {(mode === 'andy' || mode === 'both') && andy && (
          <WorkoutColumn
            userId={andy.id}
            userName="Andy"
            soloInstructionMode={mode === 'andy'}
          />
        )}
        {(mode === 'ali' || mode === 'both') && ali && (
          <WorkoutColumn
            userId={ali.id}
            userName="Ali"
            soloInstructionMode={mode === 'ali'}
          />
        )}
      </div>
    </div>
  )
}
