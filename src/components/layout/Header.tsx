import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Bell, Search, LogOut, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  onMenuClick: () => void
  title?: string
}

// ── Role badge colours ────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    admin:         { label: 'Admin',        cls: 'bg-primary/20 text-primary border-primary/30' },
    site_manager:  { label: 'Site Manager', cls: 'bg-accent/20  text-accent  border-accent/30'  },
    office_staff:  { label: 'Office Staff', cls: 'bg-success/20 text-success border-success/30' },
  }
  const { label, cls } = map[role] ?? { label: role, cls: 'bg-white/10 text-ink-muted border-border' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}

// ── Dropdown container ────────────────────────────────────────────────────────
function Dropdown({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`absolute right-0 top-full mt-2 z-50 bg-bg-elevated border border-border rounded-2xl shadow-2xl
        ${className}`}
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
    >
      {children}
    </motion.div>
  )
}

// ── Hook: close on outside click ──────────────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [ref, onClose])
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ onClose }: { onClose: () => void }) {
  const { user, role, fullName, signOut } = useAuthStore()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, onClose)

  const displayName = fullName || user?.email || 'User'
  const initial = (fullName?.[0] || user?.email?.[0] || 'U').toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <Dropdown className="w-64 p-1" >
      <div ref={ref}>
        {/* User info */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 text-primary text-[14px] font-bold">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink-primary truncate leading-tight">{displayName}</p>
              {fullName && (
                <p className="text-[11px] text-ink-muted truncate mt-0.5 leading-tight">{user?.email}</p>
              )}
            </div>
          </div>
          {role && <RoleBadge role={role} />}
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-border-subtle" />

        {/* Logout */}
        <div className="p-1 mt-1">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              text-danger hover:bg-danger/10
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium">Sign out</span>
          </button>
        </div>
      </div>
    </Dropdown>
  )
}

// ── Search overlay ────────────────────────────────────────────────────────────
function SearchDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, onClose)

  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <Dropdown className="w-72 p-0 overflow-hidden">
      <div ref={ref}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="text-[12px] font-semibold text-ink-muted uppercase tracking-wider">Global Search</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06] transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center justify-center py-8 gap-3 px-4">
          <div className="w-12 h-12 rounded-2xl bg-bg-surface border border-border flex items-center justify-center"
            style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.15)' }}>
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-ink-primary">Global Search</p>
            <p className="text-[11px] text-ink-muted mt-1">Coming soon in the next phase.</p>
          </div>
        </div>
      </div>
    </Dropdown>
  )
}

// ── Notifications dropdown ────────────────────────────────────────────────────
function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, onClose)

  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <Dropdown className="w-72 p-0 overflow-hidden">
      <div ref={ref}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="text-[12px] font-semibold text-ink-muted uppercase tracking-wider">Notifications</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06] transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center justify-center py-8 gap-3 px-4">
          <div className="w-12 h-12 rounded-2xl bg-bg-surface border border-border flex items-center justify-center"
            style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.15)' }}>
            <Bell className="w-5 h-5 text-ink-muted" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-ink-primary">No notifications yet</p>
            <p className="text-[11px] text-ink-muted mt-1">You're all caught up.</p>
          </div>
        </div>
      </div>
    </Dropdown>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────
export default function Header({ onMenuClick, title = 'Dashboard' }: HeaderProps) {
  const { user } = useAuthStore()
  const [openPanel, setOpenPanel] = useState<'search' | 'notifications' | 'profile' | null>(null)

  function toggle(panel: 'search' | 'notifications' | 'profile') {
    setOpenPanel(prev => prev === panel ? null : panel)
  }

  const initial = (user?.email?.[0] ?? 'U').toUpperCase()

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 h-14 bg-bg-surface/80 backdrop-blur-md border-b border-border"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.2)' }}
    >
      {/* Hamburger — mobile only */}
      <motion.button
        onClick={onMenuClick}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="md:hidden p-2 rounded-lg text-ink-muted hover:text-ink-secondary
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </motion.button>

      {/* Page title */}
      <h1 className="font-display text-[15px] font-semibold text-ink-primary tracking-[-0.02em] flex-1 leading-none">
        {title}
      </h1>

      {/* Right actions */}
      <div className="flex items-center gap-1">

        {/* Search */}
        <div className="relative">
          <motion.button
            onClick={() => toggle('search')}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            whileTap={{ scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`p-2 rounded-lg transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              ${openPanel === 'search' ? 'text-ink-primary bg-white/[0.06]' : 'text-ink-muted hover:text-ink-secondary'}`}
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </motion.button>
          <AnimatePresence>
            {openPanel === 'search' && <SearchDropdown onClose={() => setOpenPanel(null)} />}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            onClick={() => toggle('notifications')}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            whileTap={{ scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`relative p-2 rounded-lg transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              ${openPanel === 'notifications' ? 'text-ink-primary bg-white/[0.06]' : 'text-ink-muted hover:text-ink-secondary'}`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {/* Badge — only shown when there are unread notifications */}
          </motion.button>
          <AnimatePresence>
            {openPanel === 'notifications' && <NotificationsDropdown onClose={() => setOpenPanel(null)} />}
          </AnimatePresence>
        </div>

        {/* Avatar / Profile */}
        <div className="relative ml-1">
          <motion.button
            onClick={() => toggle('profile')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`w-8 h-8 rounded-full bg-primary/20 border flex items-center justify-center
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150
              ${openPanel === 'profile' ? 'border-primary/60 bg-primary/30' : 'border-primary/30'}`}
            aria-label="User menu"
          >
            <span className="text-primary text-[12px] font-bold uppercase">{initial}</span>
          </motion.button>
          <AnimatePresence>
            {openPanel === 'profile' && <ProfileDropdown onClose={() => setOpenPanel(null)} />}
          </AnimatePresence>
        </div>

      </div>
    </header>
  )
}
