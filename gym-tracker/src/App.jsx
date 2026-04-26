import { useState } from 'react'
import SessionSelect from './components/SessionSelect'
import GymView from './components/GymView'
import AdminView from './components/AdminView'
import './App.css'

export default function App() {
  const [mode, setMode] = useState(null)
  const isAdmin = window.location.pathname === '/admin'

  if (isAdmin) return <AdminView />
  if (!mode) return <SessionSelect onSelect={setMode} />
  return <GymView mode={mode} onExit={() => setMode(null)} />
}
