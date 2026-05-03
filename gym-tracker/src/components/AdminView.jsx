import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { DAYS_OF_WEEK, CYCLE_LABELS, roundToNearest5, getMainLiftSets } from '../utils/progression'

export default function AdminView() {
  const [tab, setTab] = useState('schedule')
  const [users, setUsers] = useState([])
  const [exercises, setExercises] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedDay, setSelectedDay] = useState('Monday')
  const [schedule, setSchedule] = useState([])
  const [configs, setConfigs] = useState({})
  const [mainLifts, setMainLifts] = useState({})
  const [accessoryWeights, setAccessoryWeights] = useState({})
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (selectedUser && selectedDay) loadSchedule() }, [selectedUser, selectedDay])
  useEffect(() => { if (selectedUser) loadWeights() }, [selectedUser])
  useEffect(() => { if (tab === 'history' && selectedUser) loadHistory() }, [tab, selectedUser])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  async function loadBase() {
    const [{ data: u }, { data: e }] = await Promise.all([
      supabase.from('users').select('*').order('name'),
      supabase.from('exercises').select('*').order('name'),
    ])
    setUsers(u || [])
    setExercises(e || [])
    if (u?.length) setSelectedUser(u[0])
  }

  async function loadSchedule() {
    const { data } = await supabase
      .from('schedules')
      .select('*, exercises(*)')
      .eq('user_id', selectedUser.id)
      .eq('day_of_week', selectedDay)
      .order('sort_order')
    setSchedule(data || [])

    // Load configs for these exercises
    if (data?.length) {
      const ids = data.map(s => s.exercise_id)
      const { data: cfgs } = await supabase
        .from('exercise_config')
        .select('*')
        .eq('user_id', selectedUser.id)
        .in('exercise_id', ids)
      const map = {}
      cfgs?.forEach(c => { map[c.exercise_id] = c })
      setConfigs(map)

      const { data: ml } = await supabase
        .from('main_lift_progress')
        .select('*')
        .eq('user_id', selectedUser.id)
        .in('exercise_id', ids)
      const mlMap = {}
      ml?.forEach(m => { mlMap[m.exercise_id] = m })
      setMainLifts(mlMap)
    }
  }

  async function loadWeights() {
    const { data } = await supabase
      .from('accessory_weights')
      .select('*, exercises(name)')
      .eq('user_id', selectedUser.id)
      .order('exercises(name)')
    setAccessoryWeights(data || [])
  }

  async function loadHistory() {
    const [{ data: workoutData }, { data: cardioData }] = await Promise.all([
      supabase
        .from('workout_logs')
        .select('*, exercises(name)')
        .eq('user_id', selectedUser.id)
        .order('logged_at', { ascending: false })
        .limit(200),
      supabase
        .from('cardio_logs')
        .select('*, exercises(name)')
        .eq('user_id', selectedUser.id)
        .order('logged_at', { ascending: false })
        .limit(200),
    ])
    // Combine both logs with type indicator
    const combined = [
      ...(workoutData || []).map(l => ({ ...l, type: 'strength' })),
      ...(cardioData || []).map(l => ({ ...l, type: 'cardio' })),
    ]
    setHistory(combined)
  }

  // --- Exercise CRUD ---
  async function addExercise(name) {
    const { data } = await supabase.from('exercises').insert({ name }).select().single()
    setExercises(e => [...e, data].sort((a, b) => a.name.localeCompare(b.name)))
    showToast(`Added exercise: ${name}`)
    return data
  }

  async function updateExercise(id, fields) {
    await supabase.from('exercises').update(fields).eq('id', id)
    setExercises(e => e.map(ex => ex.id === id ? { ...ex, ...fields } : ex))
    showToast('Exercise updated')
  }

  async function deleteExercise(id, name) {
    if (!window.confirm(`Delete exercise "${name}"? This cannot be undone.`)) return
    setLoading(true)
    try {
      // Delete related records first
      await supabase.from('schedules').delete().eq('exercise_id', id)
      await supabase.from('exercise_config').delete().eq('exercise_id', id)
      await supabase.from('main_lift_progress').delete().eq('exercise_id', id)
      await supabase.from('accessory_weights').delete().eq('exercise_id', id)
      await supabase.from('workout_logs').delete().eq('exercise_id', id)
      // Finally delete the exercise
      await supabase.from('exercises').delete().eq('id', id)
      setExercises(e => e.filter(ex => ex.id !== id))
      showToast(`Deleted exercise: ${name}`)
    } catch (err) {
      showToast(`Error deleting exercise: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // --- Schedule management ---
  async function addToSchedule(exerciseId) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    const nextOrder = schedule.length ? Math.max(...schedule.map(s => s.sort_order)) + 1 : 0
    const { data } = await supabase.from('schedules').insert({
      user_id: selectedUser.id,
      day_of_week: selectedDay,
      exercise_id: exerciseId,
      sort_order: nextOrder,
    }).select('*, exercises(*)').single()
    setSchedule(s => [...s, data])

    // Create default config with all required fields
    const { error: cfgError } = await supabase.from('exercise_config').upsert({
      user_id: selectedUser.id,
      exercise_id: exerciseId,
      sets: 3,
      rep_target: '8-12',
      rest_seconds: 60,
      is_main_lift: false,
      tempo: null,
      exercise_type: 'strength',
    }, { onConflict: 'user_id,exercise_id' })
    
    if (cfgError) {
      showToast(`Error creating config: ${cfgError.message}`, 'error')
    } else {
      // Reload configs to ensure they're synced
      const { data: cfgData } = await supabase
        .from('exercise_config')
        .select('*')
        .eq('user_id', selectedUser.id)
        .eq('exercise_id', exerciseId)
      if (cfgData?.length > 0) {
        setConfigs(c => ({ ...c, [exerciseId]: cfgData[0] }))
      }
    }

    // Create default accessory weight
    const { error: awError } = await supabase.from('accessory_weights').upsert({
      user_id: selectedUser.id,
      exercise_id: exerciseId,
      working_weight: 0,
      increase_suggested: false,
    }, { onConflict: 'user_id,exercise_id' })

    if (awError) {
      showToast(`Error creating weight: ${awError.message}`, 'error')
    }

    showToast(`Added ${ex.name} to ${selectedDay}`)
  }

  async function removeFromSchedule(schedId, exName) {
    await supabase.from('schedules').delete().eq('id', schedId)
    setSchedule(s => s.filter(x => x.id !== schedId))
    showToast(`Removed ${exName}`)
  }

  async function moveExercise(schedId, dir) {
    const idx = schedule.findIndex(s => s.id === schedId)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= schedule.length) return
    const newSchedule = [...schedule]
    ;[newSchedule[idx], newSchedule[newIdx]] = [newSchedule[newIdx], newSchedule[idx]]
    setSchedule(newSchedule)
    // Update sort orders
    await Promise.all(newSchedule.map((s, i) =>
      supabase.from('schedules').update({ sort_order: i }).eq('id', s.id)
    ))
  }

  async function updateConfig(exerciseId, fields) {
    const { error } = await supabase.from('exercise_config').update(fields)
      .eq('user_id', selectedUser.id)
      .eq('exercise_id', exerciseId)
    if (error) {
      showToast(`Error saving config: ${error.message}`, 'error')
      return
    }
    setConfigs(c => ({ ...c, [exerciseId]: { ...c[exerciseId], ...fields } }))
    showToast('Config saved')
  }

  async function updateMainLift(exerciseId, fields) {
    await supabase.from('main_lift_progress').upsert({
      user_id: selectedUser.id,
      exercise_id: exerciseId,
      ...mainLifts[exerciseId],
      ...fields,
    })
    setMainLifts(m => ({ ...m, [exerciseId]: { ...m[exerciseId], ...fields } }))
    showToast('Main lift updated')
  }

  async function toggleMainLift(exerciseId, isMain) {
    await updateConfig(exerciseId, { is_main_lift: isMain })
    if (isMain && !mainLifts[exerciseId]) {
      const { data } = await supabase.from('main_lift_progress').upsert({
        user_id: selectedUser.id,
        exercise_id: exerciseId,
        one_rep_max: 100,
        cycle_week: 1,
      }).select().single()
      setMainLifts(m => ({ ...m, [exerciseId]: data }))
    }
  }

  async function updateAccessoryWeight(id, weight) {
    await supabase.from('accessory_weights').update({ working_weight: weight, increase_suggested: false }).eq('id', id)
    setAccessoryWeights(aw => aw.map(w => w.id === id ? { ...w, working_weight: weight, increase_suggested: false } : w))
    showToast('Weight updated')
  }

  async function dismissSuggestion(id) {
    await supabase.from('accessory_weights').update({ increase_suggested: false }).eq('id', id)
    setAccessoryWeights(aw => aw.map(w => w.id === id ? { ...w, increase_suggested: false } : w))
  }

  // --- Superset management ---
  async function createSuperset(selectedScheduleIds) {
    if (selectedScheduleIds.length < 2) {
      showToast('Select 2 or more exercises to create a superset', 'error')
      return
    }
    
    const supersetId = Math.random().toString(36).substr(2, 9) // Simple UUID-like ID
    setLoading(true)
    try {
      // Update all selected schedules with the superset_id
      await Promise.all(
        selectedScheduleIds.map(schedId =>
          supabase.from('schedules').update({ superset_id: supersetId }).eq('id', schedId)
        )
      )
      
      // Reload schedule
      await loadSchedule()
      showToast('Superset created!')
    } catch (err) {
      showToast(`Error creating superset: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function removeFromSuperset(schedId) {
    try {
      await supabase.from('schedules').update({ superset_id: null }).eq('id', schedId)
      await loadSchedule()
      showToast('Removed from superset')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    }
  }

  // --- Render tabs ---
  return (
    <div className="admin-view">
      {toast && <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="admin-header">
        <div className="admin-logo">GYMTRACKER <span>ADMIN</span></div>
        <a href="/" className="admin-gym-link">→ Gym View</a>
      </div>

      {/* User selector */}
      <div className="admin-user-tabs">
        {users.map(u => (
          <button
            key={u.id}
            className={`admin-user-tab ${selectedUser?.id === u.id ? 'active' : ''}`}
            onClick={() => setSelectedUser(u)}
          >
            {u.name}
          </button>
        ))}
      </div>

      {/* Nav tabs */}
      <div className="admin-nav">
        {['schedule', 'exercises', 'weights', 'cycle', 'history'].map(t => (
          <button
            key={t}
            className={`admin-nav-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {tab === 'schedule' && selectedUser && (
          <ScheduleTab
            days={DAYS_OF_WEEK}
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            schedule={schedule}
            exercises={exercises}
            configs={configs}
            mainLifts={mainLifts}
            onAdd={addToSchedule}
            onRemove={removeFromSchedule}
            onMove={moveExercise}
            onUpdateConfig={updateConfig}
            onToggleMainLift={toggleMainLift}
            onUpdateMainLift={updateMainLift}
            onCreateSuperset={createSuperset}
            onRemoveFromSuperset={removeFromSuperset}
            userName={selectedUser.name}
          />
        )}
        {tab === 'exercises' && (
          <ExercisesTab
            exercises={exercises}
            onAdd={addExercise}
            onUpdate={updateExercise}
            onDelete={deleteExercise}
          />
        )}
        {tab === 'weights' && selectedUser && (
          <WeightsTab
            weights={accessoryWeights}
            onUpdate={updateAccessoryWeight}
            onDismiss={dismissSuggestion}
          />
        )}
        {tab === 'cycle' && selectedUser && (
          <CycleTab
            mainLifts={mainLifts}
            exercises={exercises}
            onUpdate={updateMainLift}
            userId={selectedUser.id}
          />
        )}
        {tab === 'history' && (
          <HistoryTab history={history} />
        )}
      </div>
    </div>
  )
}

// --- Sub-tabs ---

function ScheduleTab({ days, selectedDay, onDayChange, schedule, exercises, configs, mainLifts, onAdd, onRemove, onMove, onUpdateConfig, onToggleMainLift, onUpdateMainLift, onCreateSuperset, onRemoveFromSuperset, userName }) {
  const [addEx, setAddEx] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [selected, setSelected] = useState(new Set())

  return (
    <div className="admin-section">
      <h2>{userName}'s Schedule</h2>

      <div className="day-tabs">
        {days.map(d => (
          <button key={d} className={`day-tab ${selectedDay === d ? 'active' : ''}`} onClick={() => onDayChange(d)}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="superset-toolbar">
          <span>{selected.size} selected</span>
          <button className="create-superset-btn" onClick={() => {
            onCreateSuperset(Array.from(selected))
            setSelected(new Set())
          }}>
            ⛓️ Create Superset
          </button>
          <button className="cancel-selection-btn" onClick={() => setSelected(new Set())}>
            Cancel
          </button>
        </div>
      )}

      <div className="schedule-list">
        {schedule.map((s, idx) => {
          const ex = s.exercises
          const cfg = configs[ex.id] || {}
          const ml = mainLifts[ex.id]
          const isOpen = expanded === s.id

          return (
            <div key={s.id} className="schedule-item">
              <div className="schedule-item-header" onClick={() => setExpanded(isOpen ? null : s.id)}>
                <input 
                  type="checkbox" 
                  className="schedule-item-checkbox"
                  checked={selected.has(s.id)}
                  onChange={e => {
                    e.stopPropagation()
                    const newSelected = new Set(selected)
                    if (e.target.checked) newSelected.add(s.id)
                    else newSelected.delete(s.id)
                    setSelected(newSelected)
                  }}
                />
                <div className="schedule-item-order">{idx + 1}</div>
                <div className="schedule-item-name">{ex.name}</div>
                {s.superset_id && <div className="superset-badge">⛓️ Superset</div>}
                <div className="schedule-item-meta">
                  {cfg.exercise_type === 'cardio' 
                    ? `${cfg.target_duration ? cfg.target_duration + ' min' : 'Cardio'} ${cfg.target_distance ? '@ ' + cfg.target_distance : ''}`
                    : `${cfg.sets}×${cfg.rep_target} ${cfg.is_main_lift ? '🏋️' : ''}`}
                </div>
                <div className="schedule-item-actions">
                  {s.superset_id && (
                    <button onClick={e => { e.stopPropagation(); onRemoveFromSuperset(s.id) }} title="Remove from superset">🔗</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); onMove(s.id, -1) }}>↑</button>
                  <button onClick={e => { e.stopPropagation(); onMove(s.id, 1) }}>↓</button>
                  <button className="remove-btn" onClick={e => { e.stopPropagation(); onRemove(s.id, ex.name) }}>✕</button>
                </div>
              </div>

              {isOpen && (
                <div className="schedule-item-config">
                  <div className="config-row">
                    <label>Exercise Type</label>
                    <select defaultValue={cfg.exercise_type || 'strength'} onChange={e => onUpdateConfig(ex.id, { exercise_type: e.target.value })}>
                      <option value="strength">Strength</option>
                      <option value="cardio">Cardio</option>
                    </select>
                  </div>

                  {cfg.exercise_type === 'cardio' ? (
                    <>
                      <div className="config-row">
                        <label>Target Duration (min)</label>
                        <input type="number" defaultValue={cfg.target_duration || ''} onChange={e => onUpdateConfig(ex.id, { target_duration: parseInt(e.target.value) || null })} onBlur={e => onUpdateConfig(ex.id, { target_duration: parseInt(e.target.value) || null })} placeholder="Optional" />
                      </div>
                      <div className="config-row">
                        <label>Target Distance</label>
                        <input type="number" step="0.1" defaultValue={cfg.target_distance || ''} onChange={e => onUpdateConfig(ex.id, { target_distance: parseFloat(e.target.value) || null })} onBlur={e => onUpdateConfig(ex.id, { target_distance: parseFloat(e.target.value) || null })} placeholder="Optional" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="config-row">
                        <label>Sets</label>
                        <input type="number" defaultValue={cfg.sets ?? 3} onChange={e => onUpdateConfig(ex.id, { sets: parseInt(e.target.value) || 3 })} onBlur={e => onUpdateConfig(ex.id, { sets: parseInt(e.target.value) || 3 })} />
                      </div>
                      <div className="config-row">
                        <label>Rep Target</label>
                        <input defaultValue={cfg.rep_target ?? '8-12'} onBlur={e => onUpdateConfig(ex.id, { rep_target: e.target.value || '8-12' })} />
                      </div>
                      <div className="config-row">
                        <label>Tempo</label>
                        <input defaultValue={cfg.tempo || ex.default_tempo || ''} onBlur={e => onUpdateConfig(ex.id, { tempo: e.target.value })} />
                      </div>
                      <div className="config-row">
                        <label>Rest (sec)</label>
                        <input type="number" defaultValue={cfg.rest_seconds ?? 90} onChange={e => onUpdateConfig(ex.id, { rest_seconds: parseInt(e.target.value) || 90 })} onBlur={e => onUpdateConfig(ex.id, { rest_seconds: parseInt(e.target.value) || 90 })} />
                      </div>
                      <div className="config-row">
                        <label>Main Lift (1RM)</label>
                        <input type="checkbox" checked={!!cfg.is_main_lift} onChange={e => onToggleMainLift(ex.id, e.target.checked)} />
                      </div>
                      {cfg.is_main_lift && ml && (
                        <>
                          <div className="config-row">
                            <label>1RM (lb)</label>
                            <input type="number" defaultValue={ml.one_rep_max} onChange={e => onUpdateMainLift(ex.id, { one_rep_max: parseFloat(e.target.value) })} onBlur={e => onUpdateMainLift(ex.id, { one_rep_max: parseFloat(e.target.value) })} />
                          </div>
                          <div className="config-row">
                            <label>Cycle Week</label>
                            <select defaultValue={ml.cycle_week} onChange={e => onUpdateMainLift(ex.id, { cycle_week: parseInt(e.target.value) })}>
                              {[1, 2, 3, 4].map(w => <option key={w} value={w}>{CYCLE_LABELS[w]}</option>)}
                            </select>
                          </div>
                          <div className="main-lift-preview">
                            {getMainLiftSets(ml.one_rep_max, ml.cycle_week).map(s => (
                              <div key={s.setNumber} className="lift-preview-row">
                                Set {s.setNumber}: {s.pct}% → <strong>{s.targetWeight} lb</strong> × {s.targetReps}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {schedule.length === 0 && (
          <div className="empty-schedule">No exercises for {selectedDay}. Add one below.</div>
        )}
      </div>

      <div className="add-exercise-row">
        <select value={addEx} onChange={e => setAddEx(e.target.value)}>
          <option value="">Select exercise to add…</option>
          {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="add-btn" onClick={() => { if (addEx) { onAdd(addEx); setAddEx('') } }}>
          + Add
        </button>
      </div>
    </div>
  )
}

function ExercisesTab({ exercises, onAdd, onUpdate, onDelete }) {
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})

  return (
    <div className="admin-section">
      <h2>Exercise Library</h2>

      <div className="add-exercise-form">
        <input
          placeholder="New exercise name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newName) { onAdd(newName); setNewName('') } }}
        />
        <button className="add-btn" onClick={() => { if (newName) { onAdd(newName); setNewName('') } }}>+ Add</button>
      </div>

      <div className="exercise-library">
        {exercises.map(ex => (
          <div key={ex.id} className="exercise-lib-item">
            <div className="exercise-lib-header">
              <div className="exercise-lib-name" onClick={() => {
                setEditing(editing === ex.id ? null : ex.id)
                setEditData({ default_tempo: ex.default_tempo, cue_text: ex.cue_text, media_url: ex.media_url })
              }}>
                {ex.name}
              </div>
              <button className="delete-btn" title="Delete exercise" onClick={() => onDelete(ex.id, ex.name)}>✕</button>
            </div>
            {editing === ex.id && (
              <div className="exercise-lib-edit">
                <div className="config-row">
                  <label>Default Tempo</label>
                  <input defaultValue={ex.default_tempo} onChange={e => setEditData(d => ({ ...d, default_tempo: e.target.value }))} />
                </div>
                <div className="config-row">
                  <label>Cue Text</label>
                  <textarea defaultValue={ex.cue_text} onChange={e => setEditData(d => ({ ...d, cue_text: e.target.value }))} rows={3} />
                </div>
                <div className="config-row">
                  <label>Media URL</label>
                  <input defaultValue={ex.media_url} onChange={e => setEditData(d => ({ ...d, media_url: e.target.value }))} placeholder="https://…" />
                </div>
                {editData.media_url && (
                  <img src={editData.media_url} alt="preview" className="media-preview" />
                )}
                <button className="save-btn" onClick={() => { onUpdate(ex.id, editData); setEditing(null) }}>Save</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeightsTab({ weights, onUpdate, onDismiss }) {
  return (
    <div className="admin-section">
      <h2>Working Weights</h2>
      {weights.filter(w => w.increase_suggested).length > 0 && (
        <div className="suggestions-banner">
          🔺 {weights.filter(w => w.increase_suggested).length} weight increase(s) suggested
        </div>
      )}
      <div className="weights-list">
        {weights.map(w => (
          <div key={w.id} className={`weight-row ${w.increase_suggested ? 'suggested' : ''}`}>
            <div className="weight-ex-name">{w.exercises?.name}</div>
            {w.increase_suggested && <div className="weight-badge">↑ Increase suggested</div>}
            <input
              type="number"
              defaultValue={w.working_weight}
              className="weight-input"
              onBlur={e => onUpdate(w.id, parseFloat(e.target.value))}
            />
            <span className="weight-unit">lb</span>
            {w.increase_suggested && (
              <button className="dismiss-btn" onClick={() => onDismiss(w.id)}>Dismiss</button>
            )}
          </div>
        ))}
        {weights.length === 0 && <div className="empty-schedule">No weights configured yet.</div>}
      </div>
    </div>
  )
}

function CycleTab({ mainLifts, exercises, onUpdate }) {
  const liftEntries = Object.entries(mainLifts)

  return (
    <div className="admin-section">
      <h2>Cycle Control</h2>
      {liftEntries.length === 0 && <div className="empty-schedule">No main lifts configured yet. Toggle "Main Lift" in the Schedule tab.</div>}
      {liftEntries.map(([exId, ml]) => {
        const ex = exercises.find(e => e.id === exId)
        const sets = getMainLiftSets(ml.one_rep_max, ml.cycle_week)
        return (
          <div key={exId} className="cycle-card">
            <div className="cycle-card-header">
              <div className="cycle-ex-name">{ex?.name}</div>
              <div className="cycle-week-badge">{CYCLE_LABELS[ml.cycle_week]}</div>
            </div>
            <div className="cycle-controls">
              <div className="config-row">
                <label>1RM</label>
                <input type="number" defaultValue={ml.one_rep_max}
                  onBlur={e => onUpdate(exId, { one_rep_max: parseFloat(e.target.value) })} />
                <span>lb</span>
              </div>
              <div className="config-row">
                <label>Week</label>
                <select value={ml.cycle_week} onChange={e => onUpdate(exId, { cycle_week: parseInt(e.target.value) })}>
                  {[1, 2, 3, 4].map(w => <option key={w} value={w}>{CYCLE_LABELS[w]}</option>)}
                </select>
              </div>
            </div>
            <div className="cycle-preview">
              {sets.map(s => (
                <div key={s.setNumber} className="lift-preview-row">
                  Set {s.setNumber} · {s.pct}% · <strong>{s.targetWeight} lb</strong> × {s.targetReps} reps
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HistoryTab({ history }) {
  // Group by date + exercise
  const grouped = {}
  history.forEach(l => {
    const date = new Date(l.logged_at).toLocaleDateString()
    const key = `${date}__${l.exercises?.name}`
    if (!grouped[key]) grouped[key] = { date, name: l.exercises?.name, type: l.type, logs: [] }
    grouped[key].logs.push(l)
  })

  return (
    <div className="admin-section">
      <h2>Workout History</h2>
      {Object.values(grouped).length === 0 && <div className="empty-schedule">No workout history yet.</div>}
      {Object.values(grouped).map((g, i) => (
        <div key={i} className="history-group">
          <div className="history-group-header">
            <span className="history-date">{g.date}</span>
            <span className="history-ex">{g.name}</span>
          </div>
          <div className="history-logs">
            {g.type === 'cardio' ? (
              g.logs.map(l => (
                <div key={l.id} className="history-cardio-row">
                  {l.duration_minutes} min {l.distance ? `@ ${l.distance}` : ''} • RPE {l.rpe} {l.notes ? `• ${l.notes}` : ''}
                </div>
              ))
            ) : (
              g.logs.sort((a, b) => a.set_number - b.set_number).map(s => (
                <div key={s.id} className="history-set-row">
                  Set {s.set_number}: {s.weight_used} lb × {s.reps_completed} reps
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
