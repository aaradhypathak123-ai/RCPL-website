import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertTriangle, Pencil } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Receipt {
  id:            number
  receipt_no:    string
  date:          string
  supplier_name: string
  vehicle_name:  string
  site_name:     string | null
  length:        number | null
  width:         number | null
  height:        number | null
  quantity:      number
  rate:          number
  total_amount:  number
  project:       { name: string } | null
  material_name: { name: string } | null
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-bg-surface border border-border rounded-2xl p-6"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted whitespace-nowrap">
          {title}
        </p>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-[0.07em] mb-1">
        {label}
      </p>
      <p className="text-[14px] text-ink-primary font-medium">
        {value ?? <span className="text-ink-muted font-normal">—</span>}
      </p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MaterialReceiptDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    if (isNaN(numId)) { setError('Invalid receipt ID.'); setLoading(false); return }

    async function fetch() {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('material_receipts')
        .select(`
          id, receipt_no, date, supplier_name, vehicle_name, site_name,
          measurement_l, measurement_w, measurement_h, quantity, rate, total_amount,
          project:project_id ( name ),
          material_name:material_name_id ( name )
        `)
        .eq('id', numId)
        .maybeSingle()

      if (err) { setError(err.message); setLoading(false); return }
      if (!data) { setError('Receipt not found.'); setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = data
      setReceipt({
        id:            r.id,
        receipt_no:    r.receipt_no,
        date:          r.date,
        supplier_name: r.supplier_name,
        vehicle_name:  r.vehicle_name,
        site_name:     r.site_name ?? null,
        length:        r.measurement_l != null ? Number(r.measurement_l) : null,
        width:         r.measurement_w != null ? Number(r.measurement_w) : null,
        height:        r.measurement_h != null ? Number(r.measurement_h) : null,
        quantity:      Number(r.quantity ?? 0),
        rate:          Number(r.rate ?? 0),
        total_amount:  Number(r.total_amount ?? 0),
        project:       Array.isArray(r.project) ? r.project[0] ?? null : r.project,
        material_name: Array.isArray(r.material_name) ? r.material_name[0] ?? null : r.material_name,
      })
      setLoading(false)
    }

    fetch()
  }, [id])

  const fmt = (n: number | null) =>
    n != null ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <p className="text-danger text-[13px]">{error ?? 'Receipt not found.'}</p>
        <button
          onClick={() => navigate('/dashboard/accounts/material-receipt')}
          className="text-primary text-[13px] underline"
        >
          Back to list
        </button>
      </div>
    )
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/accounts/material-receipt')}
            className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-bg-elevated border border-transparent
              hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150"
            aria-label="Back to Material Receipts"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
              {receipt.receipt_no}
            </h2>
            <p className="text-ink-muted text-[13px] mt-0.5">Material Receipt Detail</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/dashboard/accounts/material-receipt/${receipt.id}/edit`)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border
            bg-bg-elevated hover:bg-bg-floating text-ink-secondary text-[13px] font-medium
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
            transition-colors duration-150"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* ── S1: Receipt Info ── */}
      <InfoCard title="Receipt Info">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Receipt No" value={receipt.receipt_no} />
          <Field label="Date"       value={receipt.date} />
          <Field label="Supplier"   value={receipt.supplier_name} />
          <Field label="Vehicle"    value={receipt.vehicle_name} />
          <Field label="Project"    value={receipt.project?.name} />
          <Field label="Site"       value={receipt.site_name} />
        </div>
      </InfoCard>

      {/* ── S2: Material ── */}
      <InfoCard title="Material">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Material Name" value={receipt.material_name?.name} />
        </div>
      </InfoCard>

      {/* ── S3: Measurements ── */}
      <InfoCard title="Measurements">
        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Length (m)" value={receipt.length != null ? receipt.length : null} />
          <Field label="Width (m)"  value={receipt.width  != null ? receipt.width  : null} />
          <Field label="Height (m)" value={receipt.height != null ? receipt.height : null} />
        </div>
      </InfoCard>

      {/* ── S4: Financials ── */}
      <InfoCard title="Financials">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 mb-5">
          <Field label="Quantity"   value={receipt.quantity} />
          <Field label="Rate (₹)"   value={`₹ ${fmt(receipt.rate)}`} />
        </div>

        {/* Total highlight */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-xl bg-bg-elevated border border-border"
          style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.1)' }}
        >
          <p className="text-[12px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
            Total Amount
          </p>
          <p
            className="font-display text-[22px] font-bold text-primary tracking-[-0.03em]"
            style={{ textShadow: '0 0 24px rgba(90,127,255,0.35)' }}
          >
            ₹&nbsp;{fmt(receipt.total_amount)}
          </p>
        </div>
      </InfoCard>

    </div>
  )
}
