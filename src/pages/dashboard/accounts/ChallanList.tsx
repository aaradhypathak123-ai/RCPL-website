import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Eye, Pencil, Trash2,
  FileSpreadsheet, FileText, Download, Loader2, AlertTriangle,
  Receipt, ChevronLeft, ChevronRight, X, ArrowLeft,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChallanRow {
  id: number
  challan_no: string
  date: string
  from_project: { name: string } | null
  to_project:   { name: string } | null
  total_value:  number
}

const PAGE_SIZE = 10
const COMPANY   = 'Rational Construction Pvt. Ltd.'

// ── Helpers ───────────────────────────────────────────────────────────────────
const btnIcon = `p-1.5 rounded-lg text-ink-muted transition-colors duration-150
  focus-visible:outline-none focus-visible:ring-2`

export default function ChallanList() {
  const navigate = useNavigate()

  const [rows,      setRows]      = useState<ChallanRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [page,      setPage]      = useState(0)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('challans')
      .select(`
        id, challan_no, date,
        from_project:from_project_id ( name ),
        to_project:to_project_id     ( name ),
        challan_items ( value )
      `)
      .order('created_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: ChallanRow[] = (data ?? []).map((c: any) => ({
      id:           c.id,
      challan_no:   c.challan_no,
      date:         c.date,
      from_project: Array.isArray(c.from_project) ? c.from_project[0] ?? null : c.from_project,
      to_project:   Array.isArray(c.to_project)   ? c.to_project[0]   ?? null : c.to_project,
      total_value:  (c.challan_items ?? []).reduce(
        (s: number, i: { value: string | number }) => s + Number(i.value ?? 0), 0
      ),
    }))

    setRows(mapped)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filter + paginate ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.challan_no.toLowerCase().includes(q) ||
      r.from_project?.name.toLowerCase().includes(q) ||
      r.to_project?.name.toLowerCase().includes(q)
    )
  }, [rows, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('challans').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    load()
  }

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((r, i) => ({
        '#':               i + 1,
        'From Project':    r.from_project?.name ?? '—',
        'To Project':      r.to_project?.name   ?? '—',
        'Challan No':      r.challan_no,
        'Date':            r.date,
        'Total Value (₹)': r.total_value.toFixed(2),
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Challans')
    XLSX.writeFile(wb, `${COMPANY}_Challans.xlsx`)
  }

  const exportTally = async () => {
    const ids = filtered.map(r => r.id)
    if (ids.length === 0) return

    const { data } = await supabase
      .from('challans')
      .select(`
        challan_no, date, note,
        to_project:to_project_id ( name ),
        challan_items ( sr_no, particulars, unit, qty, rate, value )
      `)
      .in('id', ids)

    function esc(s: string | null | undefined) {
      return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = (data ?? []).map((c: any) => {
      const toProject = Array.isArray(c.to_project)
        ? (c.to_project[0]?.name ?? '')
        : (c.to_project?.name ?? '')
      const dateStr = (c.date ?? '').replace(/-/g, '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = (c.challan_items ?? []).slice().sort(
        (a: { sr_no: number }, b: { sr_no: number }) => a.sr_no - b.sr_no
      )
      const total = items.reduce((s, i) => s + Number(i.value ?? 0), 0)

      const inventoryLines = items.map(item => `
    <INVENTORYENTRIES.LIST>
     <STOCKITEMNAME>${esc(item.particulars)}</STOCKITEMNAME>
     <ACTUALQTY>${item.qty} ${esc(item.unit)}</ACTUALQTY>
     <RATE>${item.rate}/${esc(item.unit)}</RATE>
     <AMOUNT>-${Number(item.value).toFixed(2)}</AMOUNT>
    </INVENTORYENTRIES.LIST>`).join('')

      return `
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Sales" ACTION="Create">
     <DATE>${dateStr}</DATE>
     <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${esc(c.challan_no)}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${esc(toProject)}</PARTYLEDGERNAME>
     <NARRATION>${esc(c.note)}</NARRATION>${inventoryLines}
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(toProject)}</LEDGERNAME>
      <AMOUNT>-${total.toFixed(2)}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales Account</LEDGERNAME>
      <AMOUNT>${total.toFixed(2)}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>All Masters</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>RATIONAL CONSTRUCTIONS PVT. LTD.</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>${messages}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`

    const blob = new Blob([xml], { type: 'application/xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'rational_erp_tally_export.xml'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(13); doc.text(COMPANY, 14, 14)
    doc.setFontSize(10); doc.text('Challan List', 14, 21)
    autoTable(doc, {
      startY: 27,
      head: [['#', 'From Project', 'To Project', 'Challan No', 'Date', 'Total (₹)']],
      body: filtered.map((r, i) => [
        i + 1,
        r.from_project?.name ?? '—',
        r.to_project?.name   ?? '—',
        r.challan_no,
        r.date,
        `₹ ${r.total_value.toFixed(2)}`,
      ]),
      styles:     { fontSize: 9 },
      headStyles: { fillColor: [90, 127, 255] },
    })
    doc.save(`${COMPANY}_Challans.pdf`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/accounts')}
            className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-bg-elevated border border-transparent
              hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150"
            aria-label="Back to Accounts"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
              Challans
            </h2>
            <p className="text-ink-muted text-[13px] mt-0.5">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard/accounts/invoices/add')}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold
            text-[13px] px-4 py-2.5 rounded-xl
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
            transition-colors duration-150"
          style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30)' }}
        >
          <Plus className="w-4 h-4" />
          Add Challan
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search challan no, project…"
            className="w-full bg-bg-elevated border border-border rounded-xl pl-9 pr-9 py-2.5
              text-[13px] text-ink-primary placeholder-ink-muted
              focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
              transition-[border-color] duration-200"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={exportExcel}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-elevated
            hover:bg-bg-floating text-ink-secondary text-[13px] font-medium transition-colors duration-150"
        >
          <FileSpreadsheet className="w-4 h-4 text-success" />
          Excel
        </button>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-elevated
            hover:bg-bg-floating text-ink-secondary text-[13px] font-medium transition-colors duration-150"
        >
          <FileText className="w-4 h-4 text-danger" />
          PDF
        </button>
        <button
          onClick={exportTally}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-teal-500/25
            bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[13px] font-medium
            transition-colors duration-150"
        >
          <Download className="w-4 h-4" />
          Tally
        </button>
      </div>

      {/* Table card */}
      <div
        className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >
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
            <div
              className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center"
              style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.15)' }}
            >
              <Receipt className="w-5 h-5 text-ink-muted" />
            </div>
            <p className="text-ink-secondary text-[14px] font-medium">No challans yet.</p>
            <p className="text-ink-muted text-[12px]">Click "+ Add Challan" to create the first one.</p>
          </div>

        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-bg-elevated/50">
                    {['#', 'From Project', 'To Project', 'Challan No', 'Date', 'Total Value', 'Actions'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]
                          ${i === 5 ? 'text-right' : i === 6 ? 'text-center w-28' : 'text-left'}
                          ${i === 0 ? 'w-10' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {paged.map((r, idx) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/dashboard/accounts/invoices/${r.id}`)}
                      className="hover:bg-white/[0.04] transition-colors duration-100 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-ink-muted">{page * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 text-ink-primary font-medium">{r.from_project?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-secondary">{r.to_project?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-primary">{r.challan_no}</td>
                      <td className="px-4 py-3 text-ink-secondary">{r.date}</td>
                      <td className="px-4 py-3 text-right font-medium text-ink-primary">
                        ₹&nbsp;{r.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/dashboard/accounts/invoices/${r.id}`)}
                            className={`${btnIcon} hover:text-primary hover:bg-primary/10 focus-visible:ring-primary/40`}
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/dashboard/accounts/invoices/${r.id}/edit`)}
                            className={`${btnIcon} hover:text-accent hover:bg-accent/10 focus-visible:ring-accent/40`}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(r.id)}
                            className={`${btnIcon} hover:text-danger hover:bg-danger/10 focus-visible:ring-danger/40`}
                            title="Delete"
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
                <span className="text-[12px] text-ink-muted">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06]
                      disabled:opacity-40 transition-colors duration-150"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] text-ink-secondary px-2">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06]
                      disabled:opacity-40 transition-colors duration-150"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-bg-elevated border border-border rounded-2xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            <h3 className="font-display text-[16px] font-bold text-ink-primary mb-2">Delete Challan?</h3>
            <p className="text-ink-secondary text-[13px] mb-5" style={{ lineHeight: 1.6 }}>
              This will permanently delete the challan and all its line items. This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-ink-secondary
                  text-[13px] font-medium hover:bg-white/[0.04] transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-danger hover:bg-danger/80 text-white text-[13px] font-semibold
                  disabled:opacity-60 transition-colors duration-150"
              >
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
