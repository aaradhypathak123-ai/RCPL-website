import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { session, mustChangePassword, setMustChangePassword } = useAuthStore()

  // Guard: if not logged in → login; if already changed → dashboard
  useEffect(() => {
    if (!session) { navigate('/login', { replace: true }); return }
    if (mustChangePassword === false) { navigate('/dashboard', { replace: true }) }
  }, [session, mustChangePassword, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Clear the force-change flag in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', session!.user.id)

    if (profileError) console.error('[ChangePassword] profile update failed:', profileError.message)

    // Update store so navigation guard lifts
    setMustChangePassword(false)
    // useEffect above will navigate to /dashboard
  }

  // Show spinner while mustChangePassword is still resolving
  if (mustChangePassword === null) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 pr-11
    text-[14px] text-ink-primary placeholder-ink-muted
    focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
    hover:border-border-bright transition-[border-color,box-shadow] duration-200`

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 relative overflow-hidden font-body">

      {/* Background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(90,127,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,181,71,0.08) 0%, transparent 70%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Icon + heading */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-[14px] bg-bg-elevated border border-border flex items-center justify-center"
            style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.2), 0 8px 24px rgba(0,0,0,0.4)' }}>
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-[22px] font-bold text-ink-primary tracking-[-0.03em] leading-tight">
              Set Your Password
            </h1>
            <p className="text-ink-muted text-[13px] mt-1 max-w-[280px] mx-auto leading-snug">
              Your account requires a new password before you can continue.
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-bg-surface border border-border rounded-2xl p-8"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* New password */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  className={inputCls}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-secondary
                    focus-visible:outline-none rounded-md transition-colors duration-150"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  className={inputCls}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-secondary
                    focus-visible:outline-none rounded-md transition-colors duration-150"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
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
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                transition-[background-color] duration-150"
              style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Updating…' : 'Set New Password'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
