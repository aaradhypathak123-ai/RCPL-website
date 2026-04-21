import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Loader2, AlertTriangle,
  FileSpreadsheet, FileText,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MeasItem {
  id:               number
  sr_no:            number
  material_name_id: number
  material_name:    string
  shape:            string | null
  nos:              number | null
  length:           number | null
  width:            number | null
  height:           number | null
  quantity:         number
  unit:             string | null
  rate:             number
  amount:           number
}

interface Measurement {
  id:          number
  bm_no:       string
  date:        string
  grand_total: number
  project:     string
  site_name:   string | null
  employee:    string | null
  items:       MeasItem[]
}

const COMPANY = 'Rational Construction Pvt. Ltd.'

// ── Style tokens ─────────────────────────────────────────────────────────────
const metaLabel = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1'
const metaValue = 'text-[13.5px] font-medium text-ink-primary'

function MetaField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className={metaLabel}>{label}</p>
      <p className={metaValue}>{value ?? '—'}</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ViewMeasurement() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meas,    setMeas]    = useState<Measurement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null)

    const { data, error: err } = await supabase
      .from('measurements')
      .select(`
        id, bm_no, date, grand_total,
        project:project_id ( name ),
        site_name:site_name_id ( name ),
        employee:employee_id ( name ),
        measurement_items (
          id, sr_no, quantity, unit, rate, amount, shape, nos,
          length, width, height, material_name_id,
          material_name:material_name_id ( name )
        )
      `)
      .eq('id', Number(id))
      .single()

    if (err || !data) {
      setError(err?.message ?? 'Measurement not found.')
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any

    const items: MeasItem[] = ((d.measurement_items ?? []) as any[])
      .sort((a: any, b: any) => a.sr_no - b.sr_no)
      .map((it: any) => ({
        id:               it.id,
        sr_no:            it.sr_no,
        material_name_id: it.material_name_id,
        material_name:    Array.isArray(it.material_name)
          ? it.material_name[0]?.name ?? '—'
          : it.material_name?.name ?? '—',
        shape:    it.shape,
        nos:      it.nos,
        length:   it.length,
        width:    it.width,
        height:   it.height,
        quantity: Number(it.quantity ?? 0),
        unit:     it.unit,
        rate:     Number(it.rate ?? 0),
        amount:   Number(it.amount ?? 0),
      }))

    setMeas({
      id:          d.id,
      bm_no:       d.bm_no,
      date:        d.date,
      grand_total: Number(d.grand_total ?? 0),
      project:     Array.isArray(d.project)   ? d.project[0]?.name   ?? '—' : d.project?.name   ?? '—',
      site_name:   Array.isArray(d.site_name) ? d.site_name[0]?.name ?? null : d.site_name?.name ?? null,
      employee:    Array.isArray(d.employee)  ? d.employee[0]?.name  ?? null : d.employee?.name  ?? null,
      items,
    })
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Exports ─────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!meas) return
    const wb = XLSX.utils.book_new()

    // Info sheet
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet([{
        'BM No':    meas.bm_no,
        'Date':     meas.date,
        'Project':  meas.project,
        'Site':     meas.site_name ?? '—',
        'Name':     meas.employee  ?? '—',
        'Grand Total': meas.grand_total.toFixed(2),
      }]), 'Summary')

    // Items sheet
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(meas.items.map(it => ({
        'Sr':        it.sr_no,
        'Particulars': it.material_name,
        'Shape':     it.shape    ?? '—',
        'Nos':       it.nos      ?? '—',
        'Length':    it.length   ?? '—',
        'Width':     it.width    ?? '—',
        'Height':    it.height   ?? '—',
        'Qty':       it.quantity,
        'Unit':      it.unit     ?? '—',
        'Rate':      it.rate.toFixed(2),
        'Amount':    it.amount.toFixed(2),
      }))), 'Items')

    XLSX.writeFile(wb, `${COMPANY}_BM_${meas.bm_no}.xlsx`)
  }

  const exportPDF = () => {
    if (!meas) return
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(13); doc.text(COMPANY, 14, 14)
    doc.setFontSize(10); doc.text(`Measurement Book — ${meas.bm_no}`, 14, 21)
    doc.setFontSize(9)
    doc.text(`Project: ${meas.project}   Site: ${meas.site_name ?? '—'}   Name: ${meas.employee ?? '—'}   Date: ${meas.date}`, 14, 28)

    autoTable(doc, {
      startY: 34,
      head: [['Sr', 'Particulars', 'Shape', 'Nos', 'L', 'W', 'H', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)']],
      body: [
        ...meas.items.map(it => [
          it.sr_no,
          it.material_name,
          it.shape    ?? '—',
          it.nos      ?? '—',
          it.length   ?? '—',
          it.width    ?? '—',
          it.height   ?? '—',
          it.quantity,
          it.unit     ?? '—',
          `₹${it.rate.toFixed(2)}`,
          `₹${it.amount.toFixed(2)}`,
        ]),
        ['', '', '', '', '', '', '', '', '', 'Grand Total',
          `₹${meas.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
      ],
      styles:     { fontSize: 8 },
      headStyles: { fillColor: [90, 127, 255] },
      foot:       [],
      // Bold last row
      didParseCell: (data) => {
        if (data.row.index === meas.items.length) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [20, 29, 46]
        }
      },
    })
    doc.save(`${COMPANY}_BM_${meas.bm_no}.pdf`)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !meas) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <p className="text-danger text-[13px]">{error ?? 'Not found.'}</p>
        <button onClick={() => navigate('/dashboard/measurement')}
          className="text-primary text-[13px] underline">← Back to list</button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/measurement')}
            className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-bg-elevated border border-transparent
              hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
              {meas.bm_no}
            </h2>
            <p className="text-ink-muted text-[13px] mt-0.5">{meas.items.length} line item{meas.items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-elevated
              hover:bg-bg-floating text-ink-secondary text-[13px] font-medium transition-colors duration-150">
            <FileSpreadsheet className="w-4 h-4 text-success" /> Excel
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-elevated
              hover:bg-bg-floating text-ink-secondary text-[13px] font-medium transition-colors duration-150">
            <FileText className="w-4 h-4 text-danger" /> PDF
          </button>
          <button
            onClick={() => navigate(`/dashboard/measurement/${meas.id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark
              text-white text-[13px] font-semibold transition-colors duration-150"
            style={{ boxShadow: '0 4px 14px rgba(90,127,255,0.30)' }}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      {/* Meta card */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Measurement Info</p>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-5">
          <MetaField label="BM No"    value={meas.bm_no} />
          <MetaField label="Date"     value={meas.date} />
          <MetaField label="Project"  value={meas.project} />
          <MetaField label="Site"     value={meas.site_name} />
          <MetaField label="Name"     value={meas.employee} />
        </div>
      </div>

      {/* Items table */}
      <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>

        <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Line Items</p>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ minWidth: 1000 }}>
            <thead>
              <tr className="border-b border-border bg-bg-elevated/40">
                {['Sr', 'Particulars', 'Shape', 'Nos', 'L', 'W', 'H', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)'].map((h, i) => (
                  <th key={h}
                    className={`px-4 py-3 text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]
                      ${i >= 9 ? 'text-right' : 'text-left'}
                      ${i === 0 ? 'w-10' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {meas.items.map(it => (
                <tr key={it.id} className="hover:bg-white/[0.02] transition-colors duration-100">
                  <td className="px-4 py-3 text-ink-muted">{it.sr_no}</td>
                  <td className="px-4 py-3 font-medium text-ink-primary">{it.material_name}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.shape    ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.nos      ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.length   ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.width    ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.height   ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.quantity}</td>
                  <td className="px-4 py-3 text-ink-secondary">{it.unit     ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-ink-secondary">
                    ₹&nbsp;{it.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink-primary">
                    ₹&nbsp;{it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-primary/5">
                <td colSpan={10}
                  className="px-4 py-3 text-right text-[12px] font-bold text-ink-secondary uppercase tracking-[0.06em]">
                  Grand Total
                </td>
                <td className="px-4 py-3 text-right text-[14px] font-bold text-primary">
                  ₹&nbsp;{meas.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
