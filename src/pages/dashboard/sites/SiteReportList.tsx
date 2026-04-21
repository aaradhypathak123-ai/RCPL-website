import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Search, X, FileSpreadsheet, FileText,
  Loader2, AlertTriangle, ClipboardList, ChevronLeft, ChevronRight, Lock,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

interface SiteReport {
  id:              number
  date:            string | null
  opening_balance: number | null
  close_balance:   number | null
  created_at:      string
  project_name:    string | null
  site_label:      string | null
  reporter_name:   string | null
}

const PAGE_SIZE = 10

const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-[13.5px] text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 hover:border-border-bright transition-[border-color,box-shadow] duration-200`

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

function within24h(ts: string) {
  return Date.now() - new Date(ts).getTime() < 24 * 60 * 60 * 1000
}


export default function SiteReportList() {
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  const [items, setItems]     = useState<SiteReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [matExporting, setMatExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    // For site_manager, fetch assigned site IDs and filter reports
    let siteFilter: number[] | null = null
    if (role === 'site_manager' && userId) {
      const { data: assigns } = await supabase
        .from('user_site_assignments')
        .select('site_name_id')
        .eq('user_id', userId)
      siteFilter = (assigns ?? []).map((a: { site_name_id: number }) => a.site_name_id)
      if (siteFilter.length === 0) {
        setItems([])
        setLoading(false)
        return
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('site_reports')
      .select(`
        id, site_name, date, opening_balance, close_balance, created_at,
        project:from_project_id ( name ),
        site:site_name_id ( name ),
        reporter:reported_by ( full_name )
      `)
      .order('date', { ascending: false })

    if (siteFilter !== null) q = q.in('site_name_id', siteFilter)

    const { data, error: e } = await q
    if (e) { setError(e.message); setLoading(false); return }

    // Supabase can return joined rows as arrays or objects — handle both
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolve = (v: any) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: SiteReport[] = (data ?? []).map((r: any) => ({
      id:              r.id,
      date:            r.date,
      opening_balance: r.opening_balance,
      close_balance:   r.close_balance,
      created_at:      r.created_at,
      project_name:    resolve(r.project)?.name      ?? null,
      site_label:      resolve(r.site)?.name         ?? r.site_name ?? null,
      reporter_name:   resolve(r.reporter)?.full_name ?? null,
    }))
    setItems(mapped)
    setLoading(false)
  }, [role, userId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i =>
      (i.project_name  ?? '').toLowerCase().includes(q) ||
      (i.site_label    ?? '').toLowerCase().includes(q) ||
      (i.reporter_name ?? '').toLowerCase().includes(q)
    )
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search])

  function exportXlsx() {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map((r, i) => ({
      '#': i + 1,
      'Project': r.project_name ?? '',
      'Site Name': r.site_label ?? '',
      'Reported By': r.reporter_name ?? '',
      'Date': fmtDate(r.date),
      'Opening Balance': r.opening_balance ?? '',
      'Close Balance': r.close_balance ?? '',
    }))), 'Site Reports')
    XLSX.writeFile(wb, 'site_reports.xlsx')
  }

  async function exportMaterialReport() {
    setMatExporting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolveJoin = (v: any) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
      const { data, error: err } = await supabase
        .from('site_reports')
        .select(`date, site_name, site:site_name_id ( name ),
          sand_credit, sand_consumed,
          agg20_credit, agg20_consumed,
          agg10_credit, agg10_consumed,
          diesel_credit, diesel_consumed,
          cement_credit, cement_consumed,
          brick_credit, brick_consumed,
          tmt10_credit, tmt10_consumed,
          tmt12_credit, tmt12_consumed,
          tmt16_credit, tmt16_consumed,
          tmt20_credit, tmt20_consumed,
          tmt25_credit, tmt25_consumed,
          tmt32_credit, tmt32_consumed`)
        .order('date', { ascending: true })
      if (err) { console.error('Material report:', err.message); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groups: Record<string, any[]> = {}
      for (const r of (data ?? [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = resolveJoin((r as any).site)?.name ?? ((r as any).site_name as string | null) ?? 'Unknown'
        if (!groups[name]) groups[name] = []
        groups[name].push(r)
      }

      // ── ExcelJS constants (all column indices are 1-based) ─────────────
      // 0-based layout: DATE=[0,13,27,40] MAT_BASES=[1,5,9,14,18,22,28,32,36,41,45,49] gap=26
      // 1-based layout: DATE=[1,14,28,41] MAT_BASES=[2,6,10,15,19,23,29,33,37,42,46,50] gap=27
      const DATE_COLS_1 = [1, 14, 28, 41]
      const MAT_BASES_1 = [2, 6, 10, 15, 19, 23, 29, 33, 37, 42, 46, 50]
      const SUB_LABELS  = ['OP. BAL', 'CREDIT', 'CONSUMED', 'CL. BAL']
      const SUB_WIDTHS  = [14, 13.5, 17, 14.5]
      const TOTAL_COLS  = 53
      const MAT_COLORS_ARGB = [
        'FFB4C6E7', // COARSE SAND — light blue
        'FFC6EFCE', // 20MM AGG   — light green
        'FFFFEB9C', // 10MM AGG   — light yellow
        'FFF8CBAD', // DIESEL     — light orange
        'FFD9C6EC', // CEMENT     — light purple
        'FFFCE4EC', // BRICK      — light pink
        'FFB2EBF2', // TMT 10mm  — light cyan
        'FFDCEDC8', // TMT 12mm  — light lime
        'FFFFE0B2', // TMT 16mm  — light amber
        'FFB2DFDB', // TMT 20mm  — light teal
        'FFC5CAE9', // TMT 25mm  — light indigo
        'FFFFCDD2', // TMT 32mm  — light red
      ]
      const MAT_LABELS_LIST = [
        'COARSE SAND (CFT)', '20 MM AGGREGATE (TON)', '10 MM AGGREGATE (TON)',
        'DIESEL (LTR)', 'CEMENT (BAG)', 'BRICK (NOS)',
        'TMT BAR (TON) 10 MM', 'TMT BAR (TON) 12 MM', 'TMT BAR (TON) 16 MM',
        'TMT BAR (TON) 20 MM', 'TMT BAR (TON) 25 MM', 'TMT BAR (TON) 32 MM',
      ]
      const MATS = [
        { cr: 'sand_credit',   co: 'sand_consumed'   },
        { cr: 'agg20_credit',  co: 'agg20_consumed'  },
        { cr: 'agg10_credit',  co: 'agg10_consumed'  },
        { cr: 'diesel_credit', co: 'diesel_consumed'  },
        { cr: 'cement_credit', co: 'cement_consumed'  },
        { cr: 'brick_credit',  co: 'brick_consumed'   },
        { cr: 'tmt10_credit',  co: 'tmt10_consumed'  },
        { cr: 'tmt12_credit',  co: 'tmt12_consumed'  },
        { cr: 'tmt16_credit',  co: 'tmt16_consumed'  },
        { cr: 'tmt20_credit',  co: 'tmt20_consumed'  },
        { cr: 'tmt25_credit',  co: 'tmt25_consumed'  },
        { cr: 'tmt32_credit',  co: 'tmt32_consumed'  },
      ]
      const THIN_BORDER = {
        top:    { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        left:   { style: 'thin' as const },
        right:  { style: 'thin' as const },
      }

      // Helper: set value + style on a cell
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function styled(cell: any, value: string | number | null, opts: {
        bold?: boolean; sz?: number; argb?: string
        halign?: string; wrap?: boolean
      }) {
        cell.value = value
        if (opts.bold !== undefined || opts.sz !== undefined)
          cell.font = { bold: opts.bold ?? false, size: opts.sz ?? 11 }
        if (opts.argb)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.argb } }
        cell.border = THIN_BORDER
        cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle', wrapText: opts.wrap ?? false }
      }

      // Convert 1-based column index → Excel letter (1→A, 27→AA, 28→AB …)
      function colLetter(n: number): string {
        let s = ''
        while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
        return s
      }

      // Helper: write an Excel formula + styling (mirrors `styled` but uses a formula value)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function styledF(cell: any, formula: string, opts: {
        bold?: boolean; sz?: number; argb?: string; halign?: string; wrap?: boolean
      }) {
        cell.value = { formula }
        if (opts.bold !== undefined || opts.sz !== undefined)
          cell.font = { bold: opts.bold ?? false, size: opts.sz ?? 11 }
        if (opts.argb)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.argb } }
        cell.border = THIN_BORDER
        cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle', wrapText: opts.wrap ?? false }
      }

      const wb = new ExcelJS.Workbook()

      for (const [siteName, reports] of Object.entries(groups)) {
        const sheetName = siteName.slice(0, 31).replace(/[:\\/?*[\]]/g, '-') || 'Sheet'
        const ws = wb.addWorksheet(sheetName)

        // ── Column widths ────────────────────────────────────────────────
        const cols: Partial<ExcelJS.Column>[] = []
        for (let c = 1; c <= TOTAL_COLS; c++) {
          if (DATE_COLS_1.includes(c))      cols.push({ width: 13 })
          else if (c === 27)                 cols.push({ width: 3 })  // gap AA
          else {
            const mi = MAT_BASES_1.findIndex(base => c >= base && c < base + 4)
            cols.push({ width: mi !== -1 ? SUB_WIDTHS[c - MAT_BASES_1[mi]] : 10 })
          }
        }
        ws.columns = cols

        // ── Row 1: Site name (merged across material-section columns) ────
        ws.getRow(1).height = 30
        // Section spans (1-indexed): B-M, N-Z, AB-AN, AO-BA
        const SITE_SPANS: [number, number][] = [[2, 13], [14, 26], [28, 40], [41, 53]]
        SITE_SPANS.forEach(([s, e]) => {
          ws.mergeCells(1, s, 1, e)
          styled(ws.getCell(1, s), siteName, { bold: true, sz: 14, argb: 'FFBDD7EE' })
        })

        // ── Row 2: Material group headers | DATE (merged into row 3) ────
        ws.getRow(2).height = 30
        DATE_COLS_1.forEach(c => {
          ws.mergeCells(2, c, 3, c)               // DATE spans rows 2–3 vertically
          styled(ws.getCell(2, c), 'DATE', { bold: true, sz: 12, argb: 'FFD9D9D9' })
        })
        MAT_BASES_1.forEach((base, mi) => {
          ws.mergeCells(2, base, 2, base + 3)     // material label spans 4 cols
          styled(ws.getCell(2, base), MAT_LABELS_LIST[mi], {
            bold: true, sz: 12, argb: MAT_COLORS_ARGB[mi], wrap: true,
          })
        })

        // ── Row 3: Sub-headers ───────────────────────────────────────────
        ws.getRow(3).height = 25
        MAT_BASES_1.forEach((base, mi) => {
          SUB_LABELS.forEach((lbl, i) => {
            styled(ws.getCell(3, base + i), lbl, { bold: true, sz: 11, argb: MAT_COLORS_ARGB[mi] })
          })
        })

        // ── Row 4: Initial balances — Op.Bal=0, Credit=0, Consumed=0, Cl.Bal=formula ──
        ws.getRow(4).height = 22.5
        DATE_COLS_1.forEach(c => styled(ws.getCell(4, c), '', {}))
        MAT_BASES_1.forEach(base => {
          styled( ws.getCell(4, base),     0, {})  // Op. Bal = 0
          styled( ws.getCell(4, base + 1), 0, {})  // Credit = 0 (init row)
          styled( ws.getCell(4, base + 2), 0, {})  // Consumed = 0 (init row)
          // Cl. Bal = Op. Bal + Credit - Consumed
          styledF(ws.getCell(4, base + 3),
            `${colLetter(base)}4+${colLetter(base + 1)}4-${colLetter(base + 2)}4`, {})
        })

        // ── Data rows — Op.Bal=prev Cl.Bal formula, Credit/Consumed=raw, Cl.Bal=formula ──
        let exRow = 5

        for (const rep of reports) {
          let dateStr = ''
          if (rep.date) {
            const p = String(rep.date).split('-')
            dateStr = p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(rep.date)
          }
          ws.getRow(exRow).height = 22.5
          DATE_COLS_1.forEach(c => styled(ws.getCell(exRow, c), dateStr, {}))

          for (let i = 0; i < 12; i++) {
            const base = MAT_BASES_1[i]
            const opL  = colLetter(base)
            const crL  = colLetter(base + 1)
            const coL  = colLetter(base + 2)
            const clL  = colLetter(base + 3)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const credit   = Number((rep as any)[MATS[i].cr]) || 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const consumed = Number((rep as any)[MATS[i].co]) || 0
            // Op. Bal = previous row's Cl. Bal
            styledF(ws.getCell(exRow, base),     `${clL}${exRow - 1}`, {})
            // Credit and Consumed = raw numbers from database
            styled( ws.getCell(exRow, base + 1), credit,   {})
            styled( ws.getCell(exRow, base + 2), consumed, {})
            // Cl. Bal = Op. Bal + Credit - Consumed
            styledF(ws.getCell(exRow, base + 3),
              `${opL}${exRow}+${crL}${exRow}-${coL}${exRow}`, {})
          }
          exRow++
        }
      }

      // ── Trigger browser download ─────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer()
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = 'MATERIAL_ENTRY_RCPL_2026.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setMatExporting(false)
    }
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(13); doc.text('Rational Construction Pvt. Ltd. — Site Reports', 14, 14)
    autoTable(doc, {
      startY: 22,
      head: [['#', 'Project', 'Site Name', 'Reported By', 'Date', 'Opening Balance', 'Close Balance']],
      body: filtered.map((r, i) => [
        i + 1,
        r.project_name  ?? '—',
        r.site_label    ?? '—',
        r.reporter_name ?? '—',
        fmtDate(r.date),
        r.opening_balance !== null ? `Rs.${r.opening_balance}` : '—',
        r.close_balance   !== null ? `Rs.${r.close_balance}`   : '—',
      ]),
      headStyles: { fillColor: [90, 127, 255] }, styles: { fontSize: 8 },
    })
    doc.save('site_reports.pdf')
  }

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
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">Site Report</h2>
            <p className="text-ink-secondary text-[13px] mt-0.5">{items.length} report{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success border border-success/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={exportMaterialReport}
            disabled={matExporting}
            className="flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success border border-success/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors disabled:opacity-60"
          >
            {matExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Material Report
          </button>
          <button onClick={exportPdf} className="flex items-center gap-1.5 bg-danger/15 hover:bg-danger/25 text-danger border border-danger/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          {role !== 'office_staff' && (
            <button
              onClick={() => navigate('/dashboard/sites/site-report/add')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-[13px] font-semibold transition-colors"
              style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30), inset 0 1px 0 rgba(255,255,255,0.12)' }}
            >
              <Plus className="w-4 h-4" /> Add Site Report
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by project, site name, or reporter…"
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
            <ClipboardList className="w-8 h-8 text-ink-muted opacity-40" />
            <p className="text-ink-secondary text-[13px] font-medium">{search ? 'No results.' : 'No site reports yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-elevated/50">
                  {['#', 'Project Name', 'Name of Site', 'Reported By', 'Date', 'Opening Balance', 'Close Balance', 'Actions'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((it, i) => (
                  <tr
                    key={it.id}
                    onClick={() => navigate(`/dashboard/sites/site-report/${it.id}`)}
                    className={`border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors duration-150 cursor-pointer ${i % 2 !== 0 ? 'bg-bg-elevated/15' : ''}`}
                  >
                    <td className="px-5 py-3.5 text-ink-muted text-[12px]">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-5 py-3.5 text-ink-primary font-medium whitespace-nowrap">{it.project_name  ?? '—'}</td>
                    <td className="px-5 py-3.5 text-ink-secondary">{it.site_label    ?? '—'}</td>
                    <td className="px-5 py-3.5 text-ink-secondary whitespace-nowrap">{it.reporter_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{fmtDate(it.date)}</td>
                    <td className="px-5 py-3.5 text-ink-secondary whitespace-nowrap">{fmtCurrency(it.opening_balance)}</td>
                    <td className="px-5 py-3.5 text-ink-secondary whitespace-nowrap">{fmtCurrency(it.close_balance)}</td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {/* Edit — admin always, site_manager only within 24h */}
                        {role === 'admin' && (
                          <button
                            onClick={() => navigate(`/dashboard/sites/site-report/edit/${it.id}`)}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-accent/80 hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {role === 'site_manager' && (
                          within24h(it.created_at) ? (
                            <button
                              onClick={() => navigate(`/dashboard/sites/site-report/edit/${it.id}`)}
                              className="px-2 py-1 rounded-lg text-[11px] font-medium text-accent/80 hover:text-accent hover:bg-accent/10 transition-colors"
                            >
                              Edit
                            </button>
                          ) : (
                            <span
                              title="Editing locked after 24 hours"
                              className="p-1.5 text-ink-muted/50 cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )
                        )}
                        {/* Delete — admin only */}
                        {role === 'admin' && (
                          <button
                            onClick={async () => {
                              if (!confirm('Are you sure you want to delete this report?')) return
                              const { error: delErr } = await supabase
                                .from('site_reports')
                                .delete()
                                .eq('id', it.id)
                              if (delErr) { alert(`Delete failed: ${delErr.message}`); return }
                              load()
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors"
                          >
                            Delete
                          </button>
                        )}
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
    </div>
  )
}
