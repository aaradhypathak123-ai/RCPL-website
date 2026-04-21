import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderKanban, Loader2, AlertTriangle, MapPin, FileText, Calendar, Tag } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface Project {
  id: number
  name: string
  site_name: string | null
  description: string | null
  city_id: number | null
  status: string
  created_at: string
  cities: { name: string } | null
}

const STATUS_LABELS: Record<string, string> = { active: 'Active', completed: 'Completed', on_hold: 'On Hold' }
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-success/15 text-success border-success/30',
  completed: 'bg-primary/15 text-primary border-primary/30',
  on_hold:   'bg-accent/15 text-accent border-accent/30',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[12px] font-semibold uppercase tracking-wider ${STATUS_COLORS[status] ?? 'bg-white/10 text-ink-muted border-border'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function InfoRow({ icon: Icon, label, value, valueClass = '' }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border-subtle last:border-0">
      <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-ink-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.1em] mb-1">{label}</p>
        <div className={`text-[14px] text-ink-primary ${valueClass}`}>{value}</div>
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    const { data, error: e } = await supabase
      .from('projects')
      .select('*, cities(name)')
      .eq('id', id)
      .maybeSingle()
    if (e) setError(e.message)
    else if (!data) setError('Project not found.')
    else setProject(data as unknown as Project)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/sites/projects')}
          className="p-2 rounded-xl bg-bg-elevated border border-border text-ink-muted
            hover:text-ink-primary hover:border-border-bright transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
            {loading ? 'Loading…' : (project?.name ?? 'Project')}
          </h2>
          <p className="text-ink-secondary text-[13px] mt-0.5">Project details</p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-ink-secondary text-[13px]">Loading project…</span>
        </div>
      )}

      {/* ── Detail card ── */}
      {!loading && project && (
        <div
          className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)' }}
        >
          {/* Card header strip */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-bg-elevated/40">
            <div
              className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0"
              style={{ boxShadow: '0 2px 8px rgba(90,127,255,0.15)' }}
            >
              <FolderKanban className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-ink-primary truncate">{project.name}</p>
              {project.site_name && (
                <p className="text-[12px] text-ink-muted mt-0.5">{project.site_name}</p>
              )}
            </div>
            <StatusBadge status={project.status} />
          </div>

          {/* Fields */}
          <div className="px-6 divide-y divide-border-subtle">
            <InfoRow
              icon={FolderKanban}
              label="Project Name"
              value={project.name}
              valueClass="font-semibold"
            />
            <InfoRow
              icon={Tag}
              label="Name of Site"
              value={project.site_name ?? <span className="text-ink-muted">—</span>}
            />
            <InfoRow
              icon={FileText}
              label="Description"
              value={
                project.description
                  ? <span className="leading-relaxed whitespace-pre-wrap">{project.description}</span>
                  : <span className="text-ink-muted">—</span>
              }
            />
            <InfoRow
              icon={MapPin}
              label="City"
              value={project.cities?.name ?? <span className="text-ink-muted">—</span>}
            />
            <InfoRow
              icon={Tag}
              label="Status"
              value={<StatusBadge status={project.status} />}
            />
            <InfoRow
              icon={Calendar}
              label="Created Date"
              value={fmtDate(project.created_at)}
              valueClass="text-ink-secondary"
            />
          </div>
        </div>
      )}
    </div>
  )
}
