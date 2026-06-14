import { Routes, Route, Navigate } from 'react-router-dom'
import { isConfigured } from './lib/supabase.js'
import { useAuth } from './lib/auth.jsx'
import { Spinner } from './components/ui.jsx'
import Layout from './components/Layout.jsx'
import Setup from './pages/Setup.jsx'
import Login from './pages/Login.jsx'
import Feed from './pages/Feed.jsx'
import Tasks from './pages/Tasks.jsx'
import Files from './pages/Files.jsx'
import Notes from './pages/Notes.jsx'
import Moodboard from './pages/Moodboard.jsx'

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <Setup />
  if (loading) return <div className="min-h-full grid place-items-center"><Spinner /></div>
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="files" element={<Files />} />
        <Route path="notes" element={<Notes />} />
        <Route path="mood" element={<Moodboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
