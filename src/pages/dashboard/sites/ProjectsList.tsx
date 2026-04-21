import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Pencil, Trash2, Search, X,
  FileSpreadsheet, FileText, Loader2, AlertTriangle, FolderKanban,
  ChevronLeft, ChevronRight, MapPin,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

interface City    { id: number; name: string }
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
interface Form { name: string; site_name: string; description: string; city_id: string; status: string }

const EMPTY: Form = { name: '', site_name: '', description: '', city_id: '', status: 'active' }
const PAGE_SIZE = 10
const STATUSES = ['active', 'completed', 'on_hold'] as const
const STATUS_LABELS: Record<string, string> = { active: 'Active', completed: 'Completed', on_hold: 'On Hold' }
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-success/15 text-success border-success/30',
  completed: 'bg-primary/15 text-primary border-primary/30',
  on_hold:   'bg-accent/15 text-accent border-accent/30',
}

const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-[13.5px] text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const selCls   = inputCls + ' appearance-none cursor-pointer'
const areaCls  = inputCls + ' resize-none'

// ── Stable primitives (defined outside component — never recreated) ────────
function Backdrop({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">{children}</div>
}
function ModalCard({ children, sm }: { children: React.ReactNode; sm?: boolean }) {
  return (
    <div className={`bg-bg-surface border border-border rounded-2xl w-full ${sm ? 'max-w-sm' : 'max-w-lg'}`}
      style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      {children}
    </div>
  )
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[status] ?? 'bg-white/10 text-ink-muted border-border'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ProjectsList() {
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  const [items, setItems]       = useState<Project[]>([])
  const [cities, setCities]     = useState<City[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [flash, setFlash]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [addOpen, setAddOpen]   = useState(false)
  const [editItem, setEditItem] = useState<Project | null>(null)
  const [delItem, setDelItem]   = useState<Project | null>(null)
  const [form, setForm]         = useState<Form>(EMPTY)
  const [formErr, setFormErr]   = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  // Add-City mini-modal
  const [addCityOpen, setAddCityOpen]   = useState(false)
  const [newCityName, setNewCityName]   = useState('')
  const [newCityErr, setNewCityErr]     = useState<string | null>(null)
  const [savingCity, setSavingCity]     = useState(false)

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)

    // site_manager: derive allowed project IDs from assigned sites
    let projectFilter: number[] | null = null
    if ((role ?? 'office_staff') === 'site_manager' && userId) {
      // Step 1: fetch assigned site IDs
      const { data: assigns } = await supabase
        .from('user_site_assignments')
        .select('site_name_id')
        .eq('user_id', userId)
      const assignedSiteIds = (assigns ?? []).map((a: { site_name_id: number }) => a.site_name_id)
      if (assignedSiteIds.length === 0) {
        setItems([]); setLoading(false); return
      }

      // Step 2: derive unique project_ids from those site_names
      const { data: siteData } = await supabase
        .from('site_names')
        .select('project_id')
        .in('id', assignedSiteIds)
      const assignedProjectIds = [
        ...new Set(
          (siteData ?? [])
            .map((s: { project_id: number | null }) => s.project_id)
            .filter((id): id is number => id !== null)
        ),
      ]
      if (assignedProjectIds.length === 0) {
        setItems([]); setLoading(false); return
      }
      projectFilter = assignedProjectIds
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let projQ: any = supabase.from('projects').select('*, cities(name)').order('created_at', { ascending: false })
    if (projectFilter !== null) projQ = projQ.in('id', projectFilter)

    const [projRes, cityRes] = await Promise.all([
      projQ,
      supabase.from('cities').select('id, name').order('name'),
    ])
    if (projRes.error) setError(projRes.error.message)
    else setItems((projRes.data as unknown as Project[]) ?? [])
    if (!cityRes.error) setCities((cityRes.data as City[]) ?? [])
    setLoading(false)
  }, [role, userId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.site_name ?? '').toLowerCase().includes(q) ||
      (i.cities?.name ?? '').toLowerCase().includes(q) ||
      i.status.toLowerCase().includes(q)
    )
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search])

  const fld = useCallback(
    (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
    []
  )

  // City select needs its own handler to catch the sentinel value
  const onCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '__add_city__') {
      setNewCityName(''); setNewCityErr(null); setAddCityOpen(true)
      return
    }
    setForm(p => ({ ...p, city_id: e.target.value }))
  }

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm(p => ({ ...p, status: e.target.value }))

  const openAdd  = () => { setForm(EMPTY); setFormErr(null); setAddOpen(true) }
  const openEdit = (it: Project) => {
    setForm({ name: it.name, site_name: it.site_name ?? '', description: it.description ?? '', city_id: it.city_id ? String(it.city_id) : '', status: it.status })
    setFormErr(null); setEditItem(it)
  }

  async function doAdd() {
    if (!form.name.trim()) { setFormErr('Project name is required.'); return }
    setSaving(true); setFormErr(null)
    const { error: e } = await supabase.from('projects').insert({
      name: form.name.trim(),
      site_name: form.site_name.trim() || null,
      description: form.description.trim() || null,
      city_id: form.city_id ? Number(form.city_id) : null,
      status: form.status,
    })
    if (e) { setFormErr(e.message); setSaving(false); return }
    setAddOpen(false); showFlash('Project added.'); load(); setSaving(false)
  }

  async function doEdit() {
    if (!editItem || !form.name.trim()) { setFormErr('Project name is required.'); return }
    setSaving(true); setFormErr(null)
    const { error: e } = await supabase.from('projects').update({
      name: form.name.trim(),
      site_name: form.site_name.trim() || null,
      description: form.description.trim() || null,
      city_id: form.city_id ? Number(form.city_id) : null,
      status: form.status,
    }).eq('id', editItem.id)
    if (e) { setFormErr(e.message); setSaving(false); return }
    setEditItem(null); showFlash('Project updated.'); load(); setSaving(false)
  }

  async function doDel() {
    if (!delItem) return; setSaving(true)
    const { error: e } = await supabase.from('projects').delete().eq('id', delItem.id)
    if (e) setError(e.message); else { showFlash('Project deleted.'); load() }
    setDelItem(null); setSaving(false)
  }

  async function doAddCity() {
    if (!newCityName.trim()) { setNewCityErr('City name is required.'); return }
    setSavingCity(true); setNewCityErr(null)
    const { data, error: e } = await supabase
      .from('cities').insert({ name: newCityName.trim() }).select('id, name').single()
    if (e) { setNewCityErr(e.message); setSavingCity(false); return }
    const newCity = data as City
    setCities(prev => [...prev, newCity].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(p => ({ ...p, city_id: String(newCity.id) }))
    setAddCityOpen(false); setSavingCity(false)
  }

  function exportXlsx() {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map((r, i) => ({
      '#': i + 1, 'Project Name': r.name, 'Name of Site': r.site_name ?? '',
      City: r.cities?.name ?? '', Status: STATUS_LABELS[r.status] ?? r.status, Created: fmtDate(r.created_at),
    }))), 'Projects')
    XLSX.writeFile(wb, 'projects.xlsx')
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(13); doc.text('Rational Construction Pvt. Ltd. — Projects', 14, 14)
    autoTable(doc, {
      startY: 22,
      head: [['#', 'Project Name', 'Name of Site', 'City', 'Status', 'Created']],
      body: filtered.map((r, i) => [i + 1, r.name, r.site_name ?? '', r.cities?.name ?? '', STATUS_LABELS[r.status] ?? r.status, fmtDate(r.created_at)]),
      headStyles: { fillColor: [90, 127, 255] }, styles: { fontSize: 9 },
    })
    doc.save('projects.pdf')
  }

  // ── Shared form fields JSX (inlined — NOT a sub-component) ───────────────
  const formFields = (
    <div className="px-6 py-5 space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">Project Name *</label>
        <input value={form.name} onChange={fld('name')} placeholder="e.g. Prayagraj Residential Block A" className={inputCls} autoFocus />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">Name of Site</label>
        <input value={form.site_name} onChange={fld('site_name')} placeholder="e.g. Block A, Tower 2" className={inputCls} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">Description</label>
        <textarea value={form.description} onChange={fld('description')} rows={3} placeholder="Brief project description…" className={areaCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">City</label>
          <select value={form.city_id} onChange={onCityChange} className={selCls}>
            <option value="">None</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__add_city__">＋ Add City…</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">Status</label>
          <select value={form.status} onChange={onStatusChange} className={selCls}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>
      {formErr && (
        <div className="flex gap-2 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{formErr}
        </div>
      )}
    </div>
  )

  const formFooter = (onSave: () => void, onCancel: () => void) => (
    <div className="px-6 pb-5 flex justify-end gap-2.5">
      <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-border text-ink-secondary hover:bg-white/[0.05] text-[13px] font-medium transition-colors">Cancel</button>
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-[13px] font-semibold transition-colors"
        style={{ boxShadow: '0 4px 14px rgba(90,127,255,0.3)' }}>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/sites')}
            className="p-2 rounded-xl bg-bg-elevated border border-border text-ink-muted
              hover:text-ink-primary hover:border-border-bright transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">Projects</h2>
            <p className="text-ink-secondary text-[13px] mt-0.5">{items.length} project{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success border border-success/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button onClick={exportPdf} className="flex items-center gap-1.5 bg-danger/15 hover:bg-danger/25 text-danger border border-danger/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-[13px] font-semibold transition-colors"
            style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30), inset 0 1px 0 rgba(255,255,255,0.12)' }}
          >
            <Plus className="w-4 h-4" /> Add Project
          </button>
        </div>
      </div>

      {flash && <div className="flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-xl px-4 py-3 text-[13px] text-success"><span className="w-2 h-2 rounded-full bg-success shrink-0" />{flash}</div>}
      {error && <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, site, city, or status…"
          className={`${inputCls} pl-10 pr-10`} />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"><X className="w-4 h-4" /></button>}
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-ink-secondary text-[13px]">Loading…</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FolderKanban className="w-8 h-8 text-ink-muted opacity-40" />
            <p className="text-ink-secondary text-[13px] font-medium">{search ? 'No results.' : 'No projects yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-elevated/50">
                  {['#', 'Project Name', 'Name of Site', 'City', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((it, i) => (
                  <tr
                    key={it.id}
                    onClick={() => navigate(`/dashboard/sites/projects/${it.id}`)}
                    className={`border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors duration-150 cursor-pointer group ${i % 2 !== 0 ? 'bg-bg-elevated/15' : ''}`}
                  >
                    <td className="px-5 py-3.5 text-ink-muted text-[12px]">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-ink-primary max-w-[180px] truncate group-hover:text-primary transition-colors">{it.name}</td>
                    <td className="px-5 py-3.5 text-ink-secondary">{it.site_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-ink-secondary">{it.cities?.name ?? '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={it.status} /></td>
                    <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{fmtDate(it.created_at)}</td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(it)} className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDelItem(it)} className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-ink-muted">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)} className={`w-7 h-7 rounded-lg text-[12px] font-medium transition-colors ${n === page ? 'bg-primary text-white' : 'hover:bg-white/[0.06] text-ink-secondary'}`}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ── Add Project modal (JSX inlined — no sub-component) ── */}
      {addOpen && (
        <Backdrop>
          <ModalCard>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">Add Project</h3>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg text-ink-muted hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4"/></button>
            </div>
            {formFields}
            {formFooter(doAdd, () => setAddOpen(false))}
          </ModalCard>
        </Backdrop>
      )}

      {/* ── Edit Project modal (JSX inlined — no sub-component) ── */}
      {editItem && (
        <Backdrop>
          <ModalCard>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">Edit Project</h3>
              <button onClick={() => setEditItem(null)} className="p-1.5 rounded-lg text-ink-muted hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4"/></button>
            </div>
            {formFields}
            {formFooter(doEdit, () => setEditItem(null))}
          </ModalCard>
        </Backdrop>
      )}

      {/* ── Delete modal ── */}
      {delItem && (
        <Backdrop>
          <ModalCard sm>
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-12 h-12 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-5 h-5 text-danger" /></div>
              <h3 className="font-display text-[16px] font-bold text-ink-primary mb-1">Delete Project?</h3>
              <p className="text-ink-muted text-[13px]">Remove <span className="text-ink-primary font-medium">"{delItem.name}"</span>? This cannot be undone.</p>
            </div>
            <div className="px-6 pb-5 flex gap-2.5">
              <button onClick={() => setDelItem(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-ink-secondary hover:bg-white/[0.05] text-[13px] font-medium transition-colors">Cancel</button>
              <button onClick={doDel} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger hover:bg-danger/90 disabled:opacity-60 text-white text-[13px] font-semibold transition-colors">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* ── Add City mini-modal ── */}
      {addCityOpen && (
        <Backdrop>
          <ModalCard sm>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">Add New City</h3>
              </div>
              <button onClick={() => setAddCityOpen(false)} className="p-1.5 rounded-lg text-ink-muted hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">City Name *</label>
                <input
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doAddCity()}
                  placeholder="e.g. Prayagraj"
                  className={inputCls}
                  autoFocus
                />
              </div>
              {newCityErr && (
                <div className="flex gap-2 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{newCityErr}
                </div>
              )}
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2.5">
              <button onClick={() => setAddCityOpen(false)} className="px-4 py-2.5 rounded-xl border border-border text-ink-secondary hover:bg-white/[0.05] text-[13px] font-medium transition-colors">Cancel</button>
              <button onClick={doAddCity} disabled={savingCity}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-[13px] font-semibold transition-colors"
                style={{ boxShadow: '0 4px 14px rgba(90,127,255,0.3)' }}>
                {savingCity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{savingCity ? 'Saving…' : 'Add City'}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  )
}
