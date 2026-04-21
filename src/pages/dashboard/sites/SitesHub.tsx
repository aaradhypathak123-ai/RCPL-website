import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, ClipboardList, MapPin, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

export default function SitesHub() {
  const navigate = useNavigate()
  const [projectCount,  setProjectCount]  = useState(0)
  const [reportCount,   setReportCount]   = useState(0)
  const [siteNameCount, setSiteNameCount] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [projRes, repRes, siteRes] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('site_reports').select('id', { count: 'exact', head: true }),
      supabase.from('site_names').select('id', { count: 'exact', head: true }),
    ])
    if (projRes.error) setError(projRes.error.message)
    else setProjectCount(projRes.count ?? 0)
    if (!repRes.error)  setReportCount(repRes.count ?? 0)
    if (!siteRes.error) setSiteNameCount(siteRes.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sections = [
    {
      key: 'projects',
      label: 'Projects',
      sub: 'Manage construction projects',
      count: projectCount,
      countLabel: (n: number) => `${n} project${n !== 1 ? 's' : ''}`,
      Icon: FolderKanban,
      path: '/dashboard/sites/projects',
      color: 'primary' as const,
    },
    {
      key: 'site-report',
      label: 'Site Report',
      sub: 'Daily site activity reports',
      count: reportCount,
      countLabel: (n: number) => `${n} report${n !== 1 ? 's' : ''}`,
      Icon: ClipboardList,
      path: '/dashboard/sites/site-report',
      color: 'accent' as const,
    },
    {
      key: 'site-names',
      label: 'Site Names',
      sub: 'Manage site name master list',
      count: siteNameCount,
      countLabel: (n: number) => `${n} site name${n !== 1 ? 's' : ''}`,
      Icon: MapPin,
      path: '/dashboard/sites/site-names',
      color: 'success' as const,
    },
  ]

  const colorMap = {
    primary: { bg: 'bg-primary/15 border-primary/25', icon: 'text-primary', glow: 'rgba(90,127,255,0.15)' },
    accent:  { bg: 'bg-accent/15 border-accent/25',   icon: 'text-accent',  glow: 'rgba(255,181,71,0.15)' },
    success: { bg: 'bg-success/15 border-success/25', icon: 'text-success', glow: 'rgba(52,211,153,0.15)' },
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      <div>
        <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">Sites</h2>
        <p className="text-ink-secondary text-[13px] mt-0.5">Click a section to manage it.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span className="text-[13px] text-danger/90">{error}</span>
        </div>
      )}

      <div
        className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-ink-secondary text-[13px]">Loading…</span>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {sections.map(({ key, label, count, countLabel, Icon, path, color }, i) => {
              const c = colorMap[color]
              return (
                <div
                  key={key}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated/60
                    transition-colors duration-150 cursor-pointer group
                    ${i % 2 !== 0 ? 'bg-bg-elevated/15' : ''}`}
                  onClick={() => navigate(path)}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${c.bg}`}
                    style={{ boxShadow: `0 2px 8px ${c.glow}` }}
                  >
                    <Icon className={`w-4 h-4 ${c.icon}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-ink-primary">{label}</p>
                    <p className="text-[12px] text-ink-muted mt-0.5">{countLabel(count)}</p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink-secondary transition-colors duration-150 shrink-0 mr-1" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
