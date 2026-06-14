import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() || email.split('@')[0] } },
        })
        if (error) throw error
        // If email confirmation is OFF, a session is returned and we're in immediately.
        if (!data.session) setInfo('Account created. If sign-in doesn\'t happen automatically, switch to "Sign in".')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-ink text-canvas flex items-center justify-center font-display text-2xl mb-4">B</div>
          <h1 className="font-display text-3xl tracking-tight">Brand HQ</h1>
          <p className="text-sm text-muted mt-1">Your shared space to build the brand.</p>
        </div>

        <div className="card p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-5 p-1 bg-canvas rounded-xl border border-line">
            <button onClick={() => { setMode('signin'); setError(''); setInfo('') }}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-surface shadow-sm text-ink' : 'text-muted'}`}>Sign in</button>
            <button onClick={() => { setMode('signup'); setError(''); setInfo('') }}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-surface shadow-sm text-ink' : 'text-muted'}`}>Create account</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="label">Your name</label>
                <input className="input" placeholder="e.g. Aman" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required autoComplete="email" placeholder="you@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}
            {info && <p className="text-sm text-muted">{info}</p>}

            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-faint text-center mt-4">
            {mode === 'signin'
              ? 'First time? Switch to "Create account".'
              : 'Already set up? Switch to "Sign in".'}
          </p>
        </div>
      </div>
    </div>
  )
}
