import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
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
          {sent ? (
            <div className="text-center py-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3">✓</div>
              <h2 className="font-display text-lg">Check your inbox</h2>
              <p className="text-sm text-muted mt-1">
                We sent a magic link to <span className="font-medium text-ink">{email}</span>. Click it to sign in.
              </p>
              <button onClick={() => setSent(false)} className="btn btn-soft mt-5 w-full">Use a different email</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label className="label">Email</label>
              <input className="input" type="email" required autoFocus placeholder="you@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="text-sm text-accent mt-2">{error}</p>}
              <button className="btn btn-primary w-full mt-4" disabled={loading}>
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
              <p className="text-xs text-faint text-center mt-3">No password needed — we email you a sign-in link.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
