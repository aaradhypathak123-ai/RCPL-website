import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Settings, X, LogOut,
  UserCog, Building2, ChevronDown,
  Package, Wrench, MapPin, Globe, Tag, Award, Layers, Building,
  Receipt, Ruler,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

// ── Nav item lists ─────────────────────────────────────────────────────────
const MAIN_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
]

const ADMIN_NAV = [
  { label: 'Manage Users', icon: UserCog, path: '/dashboard/manage-users' },
]

const SITES_NAV = [
  { label: 'Sites', icon: Building, path: '/dashboard/sites' },
]

const ACCOUNTS_NAV = [
  { label: 'Accounts', icon: Receipt, path: '/dashboard/accounts' },
]

const MEASUREMENT_NAV = [
  { label: 'Measurement', icon: Ruler, path: '/dashboard/measurement' },
]

const PREFERENCES_NAV = [
  { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
]

const MASTER_NAV = [
  { label: 'Employee Department', icon: Building2, path: '/dashboard/master/employee-department' },
  { label: 'Employee Type',        icon: Tag,       path: '/dashboard/master/employee-type' },
  { label: 'Employee Designation', icon: Award,     path: '/dashboard/master/employee-designation' },
  { label: 'Material Type',        icon: Layers,    path: '/dashboard/master/material-type' },
  { label: 'Material Name',        icon: Package,   path: '/dashboard/master/material-name' },
  { label: 'Machine Type',         icon: Wrench,    path: '/dashboard/master/machine-type' },
  { label: 'Machine Name',         icon: Wrench,    path: '/dashboard/master/machine-name' },
  { label: 'City',                 icon: MapPin,    path: '/dashboard/master/city' },
  { label: 'State',                icon: Globe,     path: '/dashboard/master/state' },
]

// ── Single nav item ────────────────────────────────────────────────────────
function SidebarItem({
  label, icon: Icon, path, onClick,
}: {
  label: string
  icon: React.ElementType
  path: string
  onClick?: () => void
}) {
  const { pathname } = useLocation()
  const isActive =
    path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(path)

  return (
    <motion.div
      animate={
        isActive
          ? { y: -2, boxShadow: '0 6px 20px rgba(90,127,255,0.22), 0 2px 6px rgba(0,0,0,0.3)' }
          : { y: 0,  boxShadow: '0 0px 0px rgba(0,0,0,0)' }
      }
      whileHover={!isActive ? { y: -1 } : {}}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="rounded-xl"
    >
      <NavLink
        to={path}
        end={path === '/dashboard'}
        onClick={onClick}
        className={({ isActive: navActive }) => `
          flex items-center gap-3 px-3 py-2 rounded-xl border w-full
          transition-[background-color,border-color] duration-150
          ${navActive
            ? 'bg-primary/[0.14] border-primary/[0.28]'
            : 'bg-transparent border-transparent hover:bg-white/[0.04]'
          }
        `}
      >
        {({ isActive: navActive }) => (
          <>
            <Icon
              className={`w-[16px] h-[16px] shrink-0 transition-colors duration-150
                ${navActive ? 'text-primary' : 'text-ink-muted'}`}
            />
            <span
              className={`text-[13px] font-medium leading-none transition-colors duration-150
                ${navActive ? 'text-ink-primary' : 'text-ink-secondary'}`}
            >
              {label}
            </span>
            {navActive && (
              <span
                className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                style={{ boxShadow: '0 0 6px rgba(90,127,255,0.8)' }}
              />
            )}
          </>
        )}
      </NavLink>
    </motion.div>
  )
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.1em] px-3 mb-1.5 mt-1">
      {label}
    </p>
  )
}

const SITE_MANAGER_MASTER_PATHS = new Set([
  '/dashboard/master/employee-department',
  '/dashboard/master/material-type',
  '/dashboard/master/material-name',
  '/dashboard/master/machine-type',
  '/dashboard/master/machine-name',
  '/dashboard/master/city',
  '/dashboard/master/state',
])

// ── Collapsible Master Section ─────────────────────────────────────────────
function MasterSection({ onClose, role }: { onClose?: () => void; role: string | null }) {
  const [open, setOpen] = useState(true)

  const visibleItems = role === 'site_manager'
    ? MASTER_NAV.filter(item => SITE_MANAGER_MASTER_PATHS.has(item.path))
    : MASTER_NAV

  return (
    <div className="pt-3 pb-1">
      <div className="h-px bg-border-subtle mb-3" />

      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg
          text-ink-secondary hover:text-ink-primary hover:bg-white/[0.03]
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
          Master Section
        </span>
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="flex items-center"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="master-items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden space-y-0.5"
          >
            {visibleItems.map(item => (
              <SidebarItem key={item.path} {...item} onClick={onClose} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sidebar shell ──────────────────────────────────────────────────────────
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { signOut, user, role } = useAuthStore()

  return (
    <div className="flex flex-col h-full">

      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[8px] bg-bg-elevated border border-border flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.2)' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <rect x="1"  y="1"  width="8" height="8" rx="1.5" fill="#5A7FFF" />
              <rect x="11" y="1"  width="8" height="8" rx="1.5" fill="#5A7FFF" opacity="0.5" />
              <rect x="1"  y="11" width="8" height="8" rx="1.5" fill="#5A7FFF" opacity="0.5" />
              <rect x="11" y="11" width="8" height="8" rx="1.5" fill="#FFB547" />
            </svg>
          </div>
          <div>
            <p className="font-display text-[13px] font-bold text-ink-primary tracking-[-0.02em] leading-none">
              Rational ERP
            </p>
            <p className="text-[10px] text-ink-muted mt-0.5 leading-none">v1.0 · RCPL</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mx-4 h-px bg-border-subtle mb-3" />

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 overflow-y-auto scrollbar-hide space-y-0.5">

        {/* Main */}
        <SectionLabel label="Main" />
        {MAIN_NAV.map(item => (
          <SidebarItem key={item.path} {...item} onClick={onClose} />
        ))}

        {/* Administration — hidden for site_manager and office_staff */}
        {role === 'admin' && (
          <div className="pt-3">
            <div className="h-px bg-border-subtle mb-3" />
            <SectionLabel label="Administration" />
            {ADMIN_NAV.map(item => (
              <SidebarItem key={item.path} {...item} onClick={onClose} />
            ))}
          </div>
        )}

        {/* Sites */}
        <div className="pt-3">
          <div className="h-px bg-border-subtle mb-3" />
          <SectionLabel label="Sites" />
          {SITES_NAV.map(item => (
            <SidebarItem key={item.path} {...item} onClick={onClose} />
          ))}
        </div>

        {/* Accounts — hidden for site_manager */}
        {role !== 'site_manager' && (
          <div className="pt-3">
            <div className="h-px bg-border-subtle mb-3" />
            <SectionLabel label="Accounts" />
            {ACCOUNTS_NAV.map(item => (
              <SidebarItem key={item.path} {...item} onClick={onClose} />
            ))}
          </div>
        )}

        {/* Measurement */}
        <div className="pt-3">
          <div className="h-px bg-border-subtle mb-3" />
          <SectionLabel label="Measurement" />
          {MEASUREMENT_NAV.map(item => (
            <SidebarItem key={item.path} {...item} onClick={onClose} />
          ))}
        </div>

        {/* Preferences */}
        <div className="pt-3">
          <div className="h-px bg-border-subtle mb-3" />
          <SectionLabel label="Preferences" />
          {PREFERENCES_NAV.map(item => (
            <SidebarItem key={item.path} {...item} onClick={onClose} />
          ))}
        </div>

        {/* Master Section — collapsible */}
        <MasterSection onClose={onClose} role={role} />
      </nav>

      {/* ── User card ── */}
      <div className="p-3 mt-2">
        <div
          className="bg-bg-elevated border border-border rounded-xl p-3 flex items-center gap-3"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 text-primary text-[12px] font-bold uppercase">
            {user?.email?.[0] ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-ink-primary truncate leading-none">
              {user?.email ?? 'User'}
            </p>
            <p className="text-[10px] text-ink-muted mt-0.5 leading-none">{role ?? '—'}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40
              transition-colors duration-150 shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  )
}

// ── Desktop sidebar ────────────────────────────────────────────────────────
export function DesktopSidebar() {
  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 bg-bg-surface border-r border-border h-screen sticky top-0 z-10"
      style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.25)' }}
    >
      <SidebarContent />
    </aside>
  )
}

// ── Mobile drawer ──────────────────────────────────────────────────────────
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-bg-surface border-r border-border md:hidden"
            style={{ boxShadow: '8px 0 32px rgba(0,0,0,0.5)' }}
          >
            <SidebarContent onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
