import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Plus, Pencil, Trash2, Search, X,
  FileSpreadsheet, FileText, Loader2, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project { id: number; name: string }

interface SiteRow {
  id:           number
  project_id:   number | null
  project_name: string | null
  name:         string
  site_info:    string | null
  work_details: string[]
  created_at:   string
}

// ── Style tokens ──────────────────────────────────────────────────────────────
const labelCls  = 'block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2'
const inputCls  = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const selectCls = inputCls + ' appearance-none cursor-pointer'
const areaCls   = inputCls + ' resize-none'

const PAGE_SIZE = 15

// ── Work detail badge colors ───────────────────────────────────────────────────
const BADGE_COLORS = [
  'bg-primary/15 text-primary border-primary/25',
  'bg-accent/15 text-accent border-accent/25',
  'bg-success/15 text-success border-success/25',
  'bg-[#c084fc]/15 text-[#c084fc] border-[#c084fc]/25',
  'bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/25',
]

function WorkBadge({ label, idx }: { label: string; idx: number }) {
  const cls = BADGE_COLORS[idx % BADGE_COLORS.length]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── Blank form state ──────────────────────────────────────────────────────────
const blankForm = () => ({
  projectId:    '',
  name:         '',
  siteInfo:     '',
  workDetails:  [''],
})

// ── Component ─────────────────────────────────────────────────────────────────
export default function SiteNames() {
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  const [rows,       setRows]       = useState<SiteRow[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(0)

  // Modals
  const [addModal,     setAddModal]     = useState(false)
  const [editTarget,   setEditTarget]   = useState<SiteRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SiteRow | null>(null)

  // Form state
  const [form,      setForm]      = useState(blankForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000) }

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null)

    // site_manager: filter to assigned sites only
    let siteFilter: number[] | null = null
    if ((role ?? 'office_staff') === 'site_manager' && userId) {
      const { data: assigns } = await supabase
        .from('user_site_assignments')
        .select('site_name_id')
        .eq('user_id', userId)
      siteFilter = (assigns ?? []).map((a: { site_name_id: number }) => a.site_name_id)
      if (siteFilter.length === 0) {
        setRows([]); setLoading(false); return
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sitesQ: any = supabase
      .from('site_names')
      .select('id, name, site_info, work_details, project_id, created_at, project:project_id(name)')
      .order('created_at', { ascending: false })
    if (siteFilter !== null) sitesQ = sitesQ.in('id', siteFilter)

    const [sitesRes, projRes] = await Promise.all([
      sitesQ,
      supabase.from('projects').select('id, name').order('name'),
    ])
    if (sitesRes.error) { setError(sitesRes.error.message); setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: SiteRow[] = (sitesRes.data ?? []).map((r: any) => ({
      id:           r.id,
      project_id:   r.project_id,
      project_name: Array.isArray(r.project) ? r.project[0]?.name ?? null : r.project?.name ?? null,
      name:         r.name,
      site_info:    r.site_info ?? null,
      work_details: Array.isArray(r.work_details) ? r.work_details.filter(Boolean) : [],
      created_at:   r.created_at,
    }))
    setRows(mapped)
    setProjects((projRes.data ?? []) as Project[])
    setLoading(false)
  }, [role, userId])

  useEffect(() => { load() }, [load])

  // ── Filter + paginate ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.project_name?.toLowerCase().includes(q) ||
      r.site_info?.toLowerCase().includes(q) ||
      r.work_details.some(w => w.toLowerCase().includes(q))
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Work detail helpers ──────────────────────────────────────────────────────
  const setWorkDetail = (idx: number, val: string) => {
    setForm(f => {
      const wd = [...f.workDetails]; wd[idx] = val; return { ...f, workDetails: wd }
    })
  }
  const addWorkDetail = () => setForm(f => ({ ...f, workDetails: [...f.workDetails, ''] }))
  const removeWorkDetail = (idx: number) => {
    setForm(f => ({
      ...f,
      workDetails: f.workDetails.length > 1 ? f.workDetails.filter((_, i) => i !== idx) : [''],
    }))
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const buildPayload = () => ({
    project_id:   form.projectId ? Number(form.projectId) : null,
    name:         form.name.trim(),
    site_info:    form.siteInfo.trim() || null,
    work_details: form.workDetails.map(w => w.trim()).filter(Boolean),
  })

  const handleAdd = async () => {
    if (!form.name.trim()) { setFormError('Site Name is required.'); return }
    setSaving(true); setFormError(null)
    const { error: err } = await supabase.from('site_names').insert(buildPayload())
    setSaving(false)
    if (err) { setFormError(err.message); return }
    setAddModal(false); setForm(blankForm()); await load(); flash('Site name added.')
  }

  const handleEdit = async () => {
    if (!editTarget || !form.name.trim()) { setFormError('Site Name is required.'); return }
    setSaving(true); setFormError(null)
    const { error: err } = await supabase
      .from('site_names').update(buildPayload()).eq('id', editTarget.id)
    setSaving(false)
    if (err) { setFormError(err.message); return }
    setEditTarget(null); setForm(blankForm()); await load(); flash('Site name updated.')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    const { error: err } = await supabase.from('site_names').delete().eq('id', deleteTarget.id)
    setSaving(false)
    if (err) setError(err.message)
    else flash('Site name deleted.')
    setDeleteTarget(null); await load()
  }

  const openAdd = () => { setForm(blankForm()); setFormError(null); setAddModal(true) }

  const openEdit = (r: SiteRow) => {
    setForm({
      projectId:   r.project_id ? String(r.project_id) : '',
      name:        r.name,
      siteInfo:    r.site_info ?? '',
      workDetails: r.work_details.length ? r.work_details : [''],
    })
    setFormError(null)
    setEditTarget(r)
  }

  // ── Exports ───────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(filtered.map((r, i) => ({
        '#':             i + 1,
        'Project':       r.project_name ?? '—',
        'Site Name':     r.name,
        'Address/Info':  r.site_info ?? '—',
        'Work Details':  r.work_details.join(', ') || '—',
      }))),
      'Site Names')
    XLSX.writeFile(wb, 'site_names.xlsx')
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(13); doc.text('Rational Construction Pvt. Ltd.', 105, 14, { align: 'center' })
    doc.setFontSize(10); doc.setTextColor(120)
    doc.text('Site Names', 105, 21, { align: 'center' })
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 28,
      head: [['#', 'Project', 'Site Name', 'Address/Info', 'Work Details']],
      body: filtered.map((r, i) => [
        i + 1, r.project_name ?? '—', r.name,
        r.site_info ?? '—', r.work_details.join(', ') || '—',
      ]),
      styles:     { fontSize: 8 },
      headStyles: { fillColor: [90, 127, 255] },
      columnStyles: { 3: { cellWidth: 45 }, 4: { cellWidth: 45 } },
    })
    doc.save('site_names.pdf')
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/sites')}
            className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-bg-elevated border border-transparent
              hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">Site Names</h2>
            <p className="text-ink-secondary text-[13px] mt-0.5">{rows.length} site name{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white
            text-[13px] font-semibold px-4 py-2.5 rounded-xl
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
            transition-colors duration-150"
          style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30)' }}
        >
          <Plus className="w-4 h-4" /> Add Site Name
        </button>
      </div>

      {/* Banners */}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-xl px-4 py-3">
          <span className="text-[13px] text-success">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span className="text-[13px] text-danger/90 flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 text-danger/60 hover:text-danger" /></button>
        </div>
      )}

      {/* Table card */}
      <div
        className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
              <input
                value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search sites…"
                className="bg-bg-elevated border border-border rounded-xl pl-8 pr-3 py-2
                  text-[13px] text-ink-primary placeholder-ink-muted w-56
                  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                  transition-[border-color,box-shadow] duration-200"
              />
            </div>
            {search && (
              <button onClick={() => { setSearch(''); setPage(0) }}
                className="text-ink-muted hover:text-ink-secondary text-[12px] flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success
                border border-success/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors duration-150">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 bg-danger/15 hover:bg-danger/25 text-danger
                border border-danger/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors duration-150">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-ink-secondary text-[13px]">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <MapPin className="w-8 h-8 text-ink-muted opacity-40" />
            <p className="text-ink-secondary text-[13px] font-medium">
              {search ? 'No site names match your search.' : 'No site names yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-bg-elevated/50">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] w-10">#</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]">Project Name</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]">Site Name</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]">Address / Site Info</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]">Work Detail</th>
                    <th className="px-5 py-3 text-center text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {paged.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/dashboard/sites/site-names/${r.id}`)}
                      className={`hover:bg-bg-elevated/40 transition-colors duration-100 cursor-pointer
                        ${i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}
                    >
                      <td className="px-5 py-3 text-ink-muted">{page * PAGE_SIZE + i + 1}</td>
                      <td className="px-5 py-3 text-ink-secondary">{r.project_name ?? '—'}</td>
                      <td className="px-5 py-3 font-medium text-ink-primary">{r.name}</td>
                      <td className="px-5 py-3 text-ink-secondary max-w-[200px]">
                        <p className="truncate" title={r.site_info ?? ''}>{r.site_info || '—'}</p>
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        {r.work_details.length === 0 ? (
                          <span className="text-ink-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.work_details.slice(0, 2).map((w, wi) => (
                              <WorkBadge key={wi} label={w} idx={wi} />
                            ))}
                            {r.work_details.length > 2 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium bg-bg-elevated border-border text-ink-muted">
                                +{r.work_details.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent/10
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40
                              transition-colors duration-150" title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40
                              transition-colors duration-150" title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                <span className="text-[12px] text-ink-muted">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06] disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] text-ink-secondary px-2">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06] disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────────────── */}
      {addModal && (
        <FormModal
          title="Add Site Name"
          onClose={() => setAddModal(false)}
          onSubmit={handleAdd}
          saving={saving}
          formError={formError}
          submitLabel="Add Site Name"
          submitColor="primary"
          form={form}
          setForm={setForm}
          projects={projects}
          setWorkDetail={setWorkDetail}
          addWorkDetail={addWorkDetail}
          removeWorkDetail={removeWorkDetail}
          inputCls={inputCls}
          selectCls={selectCls}
          areaCls={areaCls}
          labelCls={labelCls}
        />
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      {editTarget && (
        <FormModal
          title="Edit Site Name"
          onClose={() => setEditTarget(null)}
          onSubmit={handleEdit}
          saving={saving}
          formError={formError}
          submitLabel="Save Changes"
          submitColor="accent"
          form={form}
          setForm={setForm}
          projects={projects}
          setWorkDetail={setWorkDetail}
          addWorkDetail={addWorkDetail}
          removeWorkDetail={removeWorkDetail}
          inputCls={inputCls}
          selectCls={selectCls}
          areaCls={areaCls}
          labelCls={labelCls}
        />
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm bg-bg-surface border border-border rounded-2xl"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle">
              <h3 className="font-display text-[15px] font-bold text-ink-primary">Delete Site Name</h3>
              <button onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-danger/8 border border-danger/20 rounded-xl p-4">
                <p className="text-[13px] text-ink-secondary" style={{ lineHeight: 1.65 }}>
                  Delete <span className="font-semibold text-ink-primary">"{deleteTarget.name}"</span>?
                  {' '}This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
                    px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="flex items-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-60
                    text-white font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-colors duration-150"
                  style={{ boxShadow: '0 4px 16px rgba(255,92,106,0.28)' }}>
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared form modal ─────────────────────────────────────────────────────────
interface FormModalProps {
  title:            string
  onClose:          () => void
  onSubmit:         () => void
  saving:           boolean
  formError:        string | null
  submitLabel:      string
  submitColor:      'primary' | 'accent'
  form:             ReturnType<typeof blankForm>
  setForm:          React.Dispatch<React.SetStateAction<ReturnType<typeof blankForm>>>
  projects:         Project[]
  setWorkDetail:    (idx: number, val: string) => void
  addWorkDetail:    () => void
  removeWorkDetail: (idx: number) => void
  inputCls:         string
  selectCls:        string
  areaCls:          string
  labelCls:         string
}

function FormModal({
  title, onClose, onSubmit, saving, formError,
  submitLabel, submitColor,
  form, setForm, projects,
  setWorkDetail, addWorkDetail, removeWorkDetail,
  inputCls, selectCls, areaCls, labelCls,
}: FormModalProps) {
  const btnCls = submitColor === 'accent'
    ? 'bg-accent hover:bg-accent-dark text-bg-base'
    : 'bg-primary hover:bg-primary-dark text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-bg-surface border border-border rounded-2xl max-h-[90vh] flex flex-col"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle shrink-0">
          <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">{title}</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Project */}
          <div>
            <label className={labelCls}>Project</label>
            <select
              value={form.projectId}
              onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
              className={selectCls}
            >
              <option value="">— Select Project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Site Name */}
          <div>
            <label className={labelCls}>Site Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. ROB 475"
              autoFocus
              className={inputCls}
            />
          </div>

          {/* Site Information */}
          <div>
            <label className={labelCls}>Site Information</label>
            <textarea
              value={form.siteInfo}
              onChange={e => setForm(f => ({ ...f, siteInfo: e.target.value }))}
              placeholder="Address or additional site details…"
              rows={3}
              className={areaCls}
            />
          </div>

          {/* Work Details */}
          <div>
            <label className={labelCls}>Work Detail</label>
            <div className="space-y-2">
              {form.workDetails.map((wd, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={wd}
                    onChange={e => setWorkDetail(idx, e.target.value)}
                    placeholder={`Work detail ${idx + 1}`}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => removeWorkDetail(idx)}
                    disabled={form.workDetails.length === 1 && idx === 0}
                    className="p-2 rounded-xl border border-danger/30 text-danger hover:bg-danger/10
                      disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addWorkDetail}
              className="mt-2 flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-dark
                font-medium transition-colors duration-150"
            >
              <Plus className="w-3.5 h-3.5" /> Add More
            </button>
          </div>

          {formError && (
            <p className="text-[12px] text-danger">{formError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle shrink-0">
          <button onClick={onClose}
            className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
              px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={saving}
            className={`flex items-center gap-2 ${btnCls} disabled:opacity-60
              font-semibold text-[13px] px-5 py-2.5 rounded-xl transition-colors duration-150`}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
