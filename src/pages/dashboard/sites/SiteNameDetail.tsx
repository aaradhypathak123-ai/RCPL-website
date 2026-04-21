import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertTriangle, MapPin } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SiteDetail {
  id:           number
  name:         string
  project_name: string | null
  site_info:    string | null
  work_details: string[]
  created_at:   string
}

// ── Badge colors ──────────────────────────────────────────────────────────────
const BADGE_COLORS = [
  'bg-primary/15 text-primary border-primary/25',
  'bg-accent/15 text-accent border-accent/25',
  'bg-success/15 text-success border-success/25',
  'bg-[#c084fc]/15 text-[#c084fc] border-[#c084fc]/25',
  'bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/25',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-6 py-4 border-b border-border-subtle last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-ink-muted sm:w-40 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="text-[13.5px] text-ink-primary font-medium flex-1" style={{ lineHeight: 1.65 }}>
        {value}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SiteNameDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [site,    setSite]    = useState<SiteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from('site_names')
      .select('id, name, site_info, work_details, created_at, project:project_id(name)')
      .eq('id', Number(id))
      .single()

    if (err || !data) {
      setError(err?.message ?? 'Site name not found.')
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any
    setSite({
      id:           d.id,
      name:         d.name,
      project_name: Array.isArray(d.project) ? d.project[0]?.name ?? null : d.project?.name ?? null,
      site_info:    d.site_info ?? null,
      work_details: Array.isArray(d.work_details) ? d.work_details.filter(Boolean) : [],
      created_at:   d.created_at,
    })
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !site) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <p className="text-danger text-[13px]">{error ?? 'Not found.'}</p>
        <button
          onClick={() => navigate('/dashboard/sites/site-names')}
          className="text-primary text-[13px] underline"
        >
          ← Back to Site Names
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/sites/site-names')}
          className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-bg-elevated border border-transparent
            hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
            transition-colors duration-150"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl bg-success/15 border border-success/25 flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 2px 8px rgba(52,211,153,0.15)' }}
          >
            <MapPin className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em] truncate">
              {site.name}
            </h2>
            {site.project_name && (
              <p className="text-ink-muted text-[13px] mt-0.5">{site.project_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Detail card */}
      <div
        className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Site Details</p>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        <div className="px-6 divide-y divide-border-subtle">
          <InfoRow label="Site Name"    value={site.name} />
          <InfoRow label="Project"      value={site.project_name ?? <span className="text-ink-muted">—</span>} />
          <InfoRow
            label="Site Information"
            value={
              site.site_info
                ? <span style={{ whiteSpace: 'pre-wrap' }}>{site.site_info}</span>
                : <span className="text-ink-muted">—</span>
            }
          />
          <InfoRow
            label="Work Details"
            value={
              site.work_details.length === 0
                ? <span className="text-ink-muted">—</span>
                : (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {site.work_details.map((wd, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center px-3 py-1 rounded-full border text-[12px] font-medium
                          ${BADGE_COLORS[i % BADGE_COLORS.length]}`}
                      >
                        {wd}
                      </span>
                    ))}
                  </div>
                )
            }
          />
        </div>
      </div>
    </div>
  )
}
