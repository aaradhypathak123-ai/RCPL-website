import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { UserCog, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export default function DashboardPage() {
  const { user, fullName } = useAuthStore()
  const navigate = useNavigate()

  const name = fullName || user?.email?.split('@')[0] || 'there'

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-8">

      {/* Logo mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto"
          style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.2), 0 8px 32px rgba(0,0,0,0.4)' }}
        >
          <svg viewBox="0 0 28 28" fill="none" className="w-8 h-8">
            <rect x="2"  y="2"  width="11" height="11" rx="2.5" fill="#5A7FFF" />
            <rect x="15" y="2"  width="11" height="11" rx="2.5" fill="#5A7FFF" opacity="0.5" />
            <rect x="2"  y="15" width="11" height="11" rx="2.5" fill="#5A7FFF" opacity="0.5" />
            <rect x="15" y="15" width="11" height="11" rx="2.5" fill="#FFB547" />
          </svg>
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3"
      >
        <h1 className="font-display text-[28px] font-bold text-ink-primary tracking-[-0.03em] leading-tight">
          Welcome to Rational Construction Pvt. Ltd.
        </h1>
        <p className="text-ink-secondary text-[15px]" style={{ lineHeight: 1.7 }}>
          Hello, <span className="text-ink-primary font-medium">{name}</span>. Your workspace is ready.
          <br />Head over to <span className="text-primary font-medium">Manage Users</span> to get started.
        </p>
      </motion.div>

      {/* CTA */}
      <motion.button
        onClick={() => navigate('/dashboard/manage-users')}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2.5 bg-primary hover:bg-primary-dark text-white
          font-semibold text-[14px] px-6 py-3 rounded-xl
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          transition-colors duration-150"
        style={{ boxShadow: '0 4px 20px rgba(90,127,255,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}
      >
        <UserCog className="w-4 h-4" />
        Go to Manage Users
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </div>
  )
}
