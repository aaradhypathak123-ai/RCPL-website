import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { session, mustChangePassword } = useAuthStore()

  // Navigate once both session AND profile are resolved
  useEffect(() => {
    if (!session) return
    if (mustChangePassword === null) return  // profile still loading
    if (mustChangePassword) navigate('/change-password', { replace: true })
    else navigate('/dashboard', { replace: true })
  }, [session, mustChangePassword, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // Update last_login (fire-and-forget, non-blocking)
      if (data.user) {
        supabase
          .from('profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id)
          .then(({ error: e }) => { if (e) console.error('[login] last_login update failed:', e.message) })
      }
      // Navigation handled by useEffect above once mustChangePassword resolves
    } catch (err) {
      console.error('[login] unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 relative overflow-hidden font-body">

      {/* ── Background depth layers ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large ambient orb — top left */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(90,127,255,0.12) 0%, transparent 70%)' }} />
        {/* Warm orb — bottom right */}
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,181,71,0.08) 0%, transparent 70%)' }} />
        {/* Center subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(90,127,255,0.05) 0%, transparent 70%)' }} />

        {/* SVG grain texture */}
        <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" opacity="0.04" />
        </svg>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(90,127,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(90,127,255,0.8) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }} />
      </div>

      {/* ── Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Logo mark + wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-8 gap-3"
        >
          <div className="w-14 h-14 rounded-[14px] bg-bg-elevated border border-border flex items-center justify-center shadow-card"
            style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.2), 0 8px 24px rgba(0,0,0,0.4)' }}>
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
              <rect x="2" y="2" width="11" height="11" rx="2.5" fill="#5A7FFF" />
              <rect x="15" y="2" width="11" height="11" rx="2.5" fill="#5A7FFF" opacity="0.55" />
              <rect x="2" y="15" width="11" height="11" rx="2.5" fill="#5A7FFF" opacity="0.55" />
              <rect x="15" y="15" width="11" height="11" rx="2.5" fill="#FFB547" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="font-display text-[22px] font-bold text-ink-primary tracking-[-0.03em] leading-tight">
              Rational ERP
            </h1>
            <p className="text-ink-muted text-[13px] mt-0.5">Sign in to your workspace</p>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-bg-surface border border-border rounded-2xl p-8"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <form onSubmit={handleLogin} className="space-y-5" noValidate>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-[14px] text-ink-primary placeholder-ink-muted
                  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                  hover:border-border-bright
                  transition-[border-color,box-shadow] duration-200"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 pr-11 text-[14px] text-ink-primary placeholder-ink-muted
                    focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                    hover:border-border-bright
                    transition-[border-color,box-shadow] duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-secondary
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md
                    transition-colors duration-150"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div className="text-right">
              <button
                type="button"
                className="text-[12px] text-primary/80 hover:text-primary focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary/40 rounded transition-colors duration-150"
              >
                Forgot password?
              </button>
            </div>

            {/* Error message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex items-start gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 overflow-hidden"
                >
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                  <span className="text-[13px] text-danger/90 leading-snug">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.015 } : {}}
              whileTap={!loading ? { scale: 0.985 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full flex items-center justify-center gap-2.5 bg-primary hover:bg-primary-dark
                disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-semibold text-[14px] rounded-xl py-3
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface
                transition-[background-color] duration-150"
              style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </motion.button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center text-ink-muted text-[12px] mt-6"
        >
          Rational Construction Pvt. Ltd. &nbsp;·&nbsp; All rights reserved
        </motion.p>
      </motion.div>
    </div>
  )
}
