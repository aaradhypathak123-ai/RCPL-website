import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Receipt, PackageCheck, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface Card {
  label:       string
  description: string
  icon:        React.ElementType
  iconColor:   string
  iconBg:      string
  borderGlow:  string
  path:        string
  countTable:  string
}

const CARDS: Card[] = [
  {
    label:       'Challans',
    description: 'Challans issued from site to site',
    icon:        Receipt,
    iconColor:   'text-primary',
    iconBg:      'bg-primary/15 border-primary/25',
    borderGlow:  'rgba(90,127,255,0.18)',
    path:        '/dashboard/accounts/invoices',
    countTable:  'challans',
  },
  {
    label:       'Material Receipt',
    description: 'Inward material receipt records',
    icon:        PackageCheck,
    iconColor:   'text-accent',
    iconBg:      'bg-accent/15 border-accent/25',
    borderGlow:  'rgba(255,181,71,0.18)',
    path:        '/dashboard/accounts/material-receipt',
    countTable:  'material_receipts',
  },
]

export default function AccountsHub() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCounts() {
      const results = await Promise.all(
        CARDS.map(c =>
          supabase.from(c.countTable).select('id', { count: 'exact', head: true })
        )
      )
      const map: Record<string, number> = {}
      CARDS.forEach((c, i) => {
        map[c.countTable] = results[i].count ?? 0
      })
      setCounts(map)
      setLoading(false)
    }
    fetchCounts()
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Page heading */}
      <div>
        <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
          Accounts
        </h2>
        <p className="text-ink-secondary text-[13px] mt-0.5">
          Select a module to view or manage records.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card, idx) => {
          const Icon  = card.icon
          const count = counts[card.countTable] ?? 0

          return (
            <motion.button
              key={card.path}
              onClick={() => navigate(card.path)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3, boxShadow: `0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px ${card.borderGlow}` }}
              whileTap={{ scale: 0.98 }}
              className="group text-left bg-bg-surface border border-border rounded-2xl p-6 flex items-center gap-5
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                transition-[border-color] duration-200 hover:border-border-bright"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)' }}
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl ${card.iconBg} border flex items-center justify-center shrink-0`}
                style={{ boxShadow: `0 4px 12px ${card.borderGlow}` }}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em] leading-tight">
                  {card.label}
                </p>
                <p className="text-ink-muted text-[12px] mt-1 leading-snug">{card.description}</p>

                {/* Count badge */}
                <div className="mt-2.5">
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 text-ink-muted animate-spin" />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold
                      text-ink-secondary bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
                      {count.toLocaleString('en-IN')} record{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink-secondary shrink-0
                transition-[transform,color] duration-200 group-hover:translate-x-0.5" />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
