import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Eye, Pencil, Trash2,
  FileSpreadsheet, FileText, Loader2, AlertTriangle,
  Ruler, ChevronLeft, ChevronRight, X, Lock,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MeasRow {
  id:          number
  bm_no:       string
  date:        string
  grand_total: number
  created_at:  string
  project:     { name: string } | null
  site_name:   { name: string } | null
  employee:    { name: string } | null
}

function within24h(ts: string) {
  return Date.now() - new Date(ts).getTime() < 24 * 60 * 60 * 1000
}

const PAGE_SIZE = 10
const COMPANY   = 'Rational Construction Pvt. Ltd.'

const btnIcon = `p-1.5 rounded-lg text-ink-muted transition-colors duration-150
  focus-visible:outline-none focus-visible:ring-2`

export default function MeasurementList() {
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  const [rows,     setRows]     = useState<MeasRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(0)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null)

    // For site_manager, fetch assigned site IDs and filter
    let siteFilter: number[] | null = null
    if (role === 'site_manager' && userId) {
      const { data: assigns } = await supabase
        .from('user_site_assignments')
        .select('site_name_id')
        .eq('user_id', userId)
      siteFilter = (assigns ?? []).map((a: { site_name_id: number }) => a.site_name_id)
      if (siteFilter.length === 0) {
        setRows([])
        setLoading(false)
        return
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('measurements')
      .select(`
        id, bm_no, date, grand_total, created_at,
        project:project_id ( name ),
        site_name:site_name_id ( name ),
        employee:employee_id ( name )
      `)
      .order('created_at', { ascending: false })

    if (siteFilter !== null) q = q.in('site_name_id', siteFilter)

    const { data, error: err } = await q
    if (err) { setError(err.message); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: MeasRow[] = (data ?? []).map((r: any) => ({
      id:          r.id,
      bm_no:       r.bm_no,
      date:        r.date,
      grand_total: Number(r.grand_total ?? 0),
      created_at:  r.created_at,
      project:     Array.isArray(r.project)   ? r.project[0]   ?? null : r.project,
      site_name:   Array.isArray(r.site_name) ? r.site_name[0] ?? null : r.site_name,
      employee:    Array.isArray(r.employee)  ? r.employee[0]  ?? null : r.employee,
    }))
    setRows(mapped)
    setLoading(false)
  }, [role, userId])

  useEffect(() => { load() }, [load])

  // ── Filter + paginate ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.bm_no.toLowerCase().includes(q) ||
      r.project?.name.toLowerCase().includes(q) ||
      r.site_name?.name.toLowerCase().includes(q) ||
      r.employee?.name.toLowerCase().includes(q)
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    // measurement_items cascade-delete from measurements
    await supabase.from('measurements').delete().eq('id', deleteId)
    setDeleteId(null); setDeleting(false); load()
  }

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(filtered.map((r, i) => ({
        '#':           i + 1,
        'BM No':       r.bm_no,
        'Date':        r.date,
        'Project':     r.project?.name ?? '—',
        'Site':        r.site_name?.name ?? '—',
        'Name':        r.employee?.name ?? '—',
        'Grand Total': r.grand_total.toFixed(2),
      }))),
      'Measurements')
    XLSX.writeFile(wb, `${COMPANY}_Measurements.xlsx`)
  }

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(13); doc.text(COMPANY, 14, 14)
    doc.setFontSize(10); doc.text('Measurement List', 14, 21)
    autoTable(doc, {
      startY: 27,
      head: [['#', 'BM No', 'Date', 'Project', 'Site', 'Name', 'Grand Total (₹)']],
      body: filtered.map((r, i) => [
        i + 1, r.bm_no, r.date,
        r.project?.name ?? '—', r.site_name?.name ?? '—',
        r.employee?.name ?? '—',
        `₹${r.grand_total.toFixed(2)}`,
      ]),
      styles:     { fontSize: 8 },
      headStyles: { fillColor: [90, 127, 255] },
    })
    doc.save(`${COMPANY}_Measurements.pdf`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
            Measurement
          </h2>
          <p className="text-ink-muted text-[13px] mt-0.5">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {role !== 'office_staff' && (
          <button
            onClick={() => navigate('/dashboard/measurement/add')}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold
              text-[13px] px-4 py-2.5 rounded-xl
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
              transition-colors duration-150"
            style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30)' }}
          >
            <Plus className="w-4 h-4" /> Add Measurement
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search BM no, project, site…"
            className="w-full bg-bg-elevated border border-border rounded-xl pl-9 pr-9 py-2.5
              text-[13px] text-ink-primary placeholder-ink-muted
              focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
              transition-[border-color] duration-200"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-elevated
            hover:bg-bg-floating text-ink-secondary text-[13px] font-medium transition-colors duration-150">
          <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
        </button>
        <button onClick={exportPDF}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-elevated
            hover:bg-bg-floating text-ink-secondary text-[13px] font-medium transition-colors duration-150">
          <FileText className="w-4 h-4 text-danger" /> PDF
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle className="w-8 h-8 text-danger" />
            <p className="text-danger text-[13px]">{error}</p>
            <button onClick={load} className="text-primary text-[13px] underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center"
              style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.15)' }}>
              <Ruler className="w-5 h-5 text-ink-muted" />
            </div>
            <p className="text-ink-secondary text-[14px] font-medium">No measurements yet.</p>
            <p className="text-ink-muted text-[12px]">Click "+ Add Measurement" to create the first one.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-bg-elevated/50">
                    {['#', 'Project', 'Site', 'Name', 'Date', 'BM No', 'Grand Total', 'Actions'].map((h, i) => (
                      <th key={h}
                        className={`px-4 py-3 text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]
                          ${i === 6 ? 'text-right' : i === 7 ? 'text-center w-28' : 'text-left'}
                          ${i === 0 ? 'w-10' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {paged.map((r, idx) => (
                    <tr key={r.id}
                      onClick={() => navigate(`/dashboard/measurement/${r.id}`)}
                      className="hover:bg-white/[0.04] transition-colors duration-100 cursor-pointer">
                      <td className="px-4 py-3 text-ink-muted">{page * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-ink-primary">{r.project?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-secondary">{r.site_name?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-secondary">{r.employee?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-secondary">{r.date}</td>
                      <td className="px-4 py-3 font-medium text-ink-primary">{r.bm_no}</td>
                      <td className="px-4 py-3 text-right font-medium text-ink-primary">
                        ₹&nbsp;{r.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* View — always visible */}
                          <button onClick={() => navigate(`/dashboard/measurement/${r.id}`)}
                            className={`${btnIcon} hover:text-primary hover:bg-primary/10 focus-visible:ring-primary/40`} title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* Edit — admin always, site_manager within 24h only */}
                          {role === 'admin' && (
                            <button onClick={() => navigate(`/dashboard/measurement/${r.id}/edit`)}
                              className={`${btnIcon} hover:text-accent hover:bg-accent/10 focus-visible:ring-accent/40`} title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {role === 'site_manager' && (
                            within24h(r.created_at) ? (
                              <button onClick={() => navigate(`/dashboard/measurement/${r.id}/edit`)}
                                className={`${btnIcon} hover:text-accent hover:bg-accent/10 focus-visible:ring-accent/40`} title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span title="Editing locked after 24 hours"
                                className={`${btnIcon} text-ink-muted/50 cursor-not-allowed`}>
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )
                          )}
                          {/* Delete — admin only */}
                          {role === 'admin' && (
                            <button onClick={() => setDeleteId(r.id)}
                              className={`${btnIcon} hover:text-danger hover:bg-danger/10 focus-visible:ring-danger/40`} title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
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

      {/* Delete modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-elevated border border-border rounded-2xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <h3 className="font-display text-[16px] font-bold text-ink-primary mb-2">Delete Measurement?</h3>
            <p className="text-ink-secondary text-[13px] mb-5" style={{ lineHeight: 1.6 }}>
              This will permanently delete the measurement and all its line items. This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-ink-secondary
                  text-[13px] font-medium hover:bg-white/[0.04] transition-colors duration-150">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-danger hover:bg-danger/80 text-white text-[13px] font-semibold
                  disabled:opacity-60 transition-colors duration-150">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
