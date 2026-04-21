import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project      { id: number; name: string }
interface MaterialName { id: number; name: string }
interface SiteName     { id: number; name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0]

// ── Shared style tokens ───────────────────────────────────────────────────────
const labelCls  = 'block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2'
const inputCls  = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const selectCls = inputCls + ' appearance-none cursor-pointer'
const readonlyCls = inputCls + ' opacity-60 cursor-not-allowed select-none'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
      <div className="flex items-center gap-3 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted whitespace-nowrap">{title}</p>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AddMaterialReceipt() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Dropdowns
  const [projects,       setProjects]       = useState<Project[]>([])
  const [siteNames,      setSiteNames]      = useState<SiteName[]>([])
  const [materialNames,  setMaterialNames]  = useState<MaterialName[]>([])
  const [dropLoading,    setDropLoading]    = useState(true)

  // Form fields
  const [receiptNo,      setReceiptNo]      = useState('')
  const [date,           setDate]           = useState(today())
  const [supplierName,   setSupplierName]   = useState('')
  const [supplierNo,     setSupplierNo]     = useState('')
  const [vehicleName,    setVehicleName]    = useState('')
  const [vehicleNo,      setVehicleNo]      = useState('')
  const [projectId,      setProjectId]      = useState('')
  const [siteNameId,     setSiteNameId]     = useState('')
  const [materialNameId, setMaterialNameId] = useState('')
  const [measL,          setMeasL]          = useState('')
  const [measW,          setMeasW]          = useState('')
  const [measH,          setMeasH]          = useState('')
  const [quantity,       setQuantity]       = useState('')
  const [rate,           setRate]           = useState('')

  // UI state
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity || '0')
    const r = parseFloat(rate     || '0')
    return isNaN(q) || isNaN(r) ? 0 : q * r
  }, [quantity, rate])

  const selectedSiteName = useMemo(
    () => siteNames.find(s => String(s.id) === siteNameId)?.name ?? null,
    [siteNames, siteNameId]
  )

  // ── Load dropdowns ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadDropdowns() {
      setDropLoading(true)
      const [projRes, siteNamesRes, matRes] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('site_names').select('id, name').order('name'),
        supabase.from('material_names').select('id, name').order('name'),
      ])
      setProjects((projRes.data ?? []) as Project[])
      setSiteNames((siteNamesRes.data ?? []) as SiteName[])
      setMaterialNames((matRes.data ?? []) as MaterialName[])
      setDropLoading(false)
    }
    loadDropdowns()
  }, [])

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!receiptNo.trim())    { setError('Receipt No is required.');    return }
    if (!supplierName.trim()) { setError('Supplier Name is required.'); return }
    if (!vehicleName.trim())  { setError('Vehicle Name is required.');  return }
    if (!projectId)           { setError('Please select a project.');   return }
    if (!materialNameId)      { setError('Please select a material.');  return }
    if (!quantity || isNaN(parseFloat(quantity))) { setError('Quantity must be a valid number.'); return }
    if (!rate     || isNaN(parseFloat(rate)))     { setError('Rate must be a valid number.');     return }

    setSaving(true)

    const { error: insertErr } = await supabase.from('material_receipts').insert({
      receipt_no:       receiptNo.trim(),
      date,
      supplier_name:    supplierName.trim(),
      supplier_no:      supplierNo.trim() || null,
      vehicle_name:     vehicleName.trim(),
      vehicle_no:       vehicleNo.trim() || null,
      project_id:       Number(projectId),
      site_name:        selectedSiteName || null,
      material_name_id: Number(materialNameId),
      measurement_l:    measL ? parseFloat(measL) : null,
      measurement_w:    measW ? parseFloat(measW) : null,
      measurement_h:    measH ? parseFloat(measH) : null,
      quantity:         parseFloat(quantity),
      rate:             parseFloat(rate),
      total_amount:     totalAmount,
      created_by:       user?.id ?? null,
    })

    setSaving(false)

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/dashboard/accounts/material-receipt'), 1200)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/accounts/material-receipt')}
          className="p-2 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-bg-elevated border border-transparent
            hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
            transition-colors duration-150"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
            Add Material Receipt
          </h2>
          <p className="text-ink-muted text-[13px] mt-0.5">Fill in all details below and submit.</p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 bg-success/10 border border-success/25 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <span className="text-[13px] text-success">Receipt saved! Redirecting…</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span className="text-[13px] text-danger">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* ── Section 1: Receipt Info ── */}
        <Section title="Receipt Info">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Material Receipt No *">
              <input
                type="text" value={receiptNo}
                onChange={e => setReceiptNo(e.target.value)}
                placeholder="e.g. MR-2024-001"
                className={inputCls}
              />
            </Field>
            <Field label="Date *">
              <input
                type="date" value={date}
                onChange={e => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ── Section 2: Supplier & Vehicle ── */}
        <Section title="Supplier & Vehicle">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Supplier Name *">
              <input
                type="text" value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="e.g. ABC Traders"
                className={inputCls}
              />
            </Field>
            <Field label="Supplier No">
              <input
                type="text" value={supplierNo}
                onChange={e => setSupplierNo(e.target.value)}
                placeholder="Phone / Reg No"
                className={inputCls}
              />
            </Field>
            <Field label="Vehicle Name *">
              <input
                type="text" value={vehicleName}
                onChange={e => setVehicleName(e.target.value)}
                placeholder="e.g. Tata Truck"
                className={inputCls}
              />
            </Field>
            <Field label="Vehicle No">
              <input
                type="text" value={vehicleNo}
                onChange={e => setVehicleNo(e.target.value)}
                placeholder="e.g. MH 12 AB 1234"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ── Section 3: Project & Site ── */}
        <Section title="Project & Site">
          {dropLoading ? (
            <div className="flex items-center gap-2 text-ink-muted text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="From Project *">
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className={selectCls}>
                  <option value="">— Select Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Site">
                <select value={siteNameId} onChange={e => setSiteNameId(e.target.value)} className={selectCls}>
                  <option value="">— Select Site —</option>
                  {siteNames.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Section>

        {/* ── Section 4: Material ── */}
        <Section title="Material">
          {dropLoading ? (
            <div className="flex items-center gap-2 text-ink-muted text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading materials…
            </div>
          ) : (
            <Field label="Material Name *">
              <select
                value={materialNameId}
                onChange={e => setMaterialNameId(e.target.value)}
                className={selectCls}
              >
                <option value="">— Select Material —</option>
                {materialNames.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          )}
        </Section>

        {/* ── Section 5: Measurement & Quantity ── */}
        <Section title="Measurement & Quantity">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Field label="Length (L)">
              <input
                type="number" min="0" step="any" value={measL}
                onChange={e => setMeasL(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Width (W)">
              <input
                type="number" min="0" step="any" value={measW}
                onChange={e => setMeasW(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Height (H)">
              <input
                type="number" min="0" step="any" value={measH}
                onChange={e => setMeasH(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Quantity *">
              <input
                type="number" min="0" step="any" value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="Rate (₹) *">
              <input
                type="number" min="0" step="any" value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Total Amount (auto)">
              <div className={readonlyCls + ' font-semibold text-ink-primary'}>
                ₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </Field>
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/accounts/material-receipt')}
            className="px-5 py-2.5 rounded-xl border border-border text-ink-secondary text-[13px] font-medium
              hover:bg-bg-elevated transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || success}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-60
              text-bg-base font-semibold text-[13px] px-6 py-2.5 rounded-xl
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
              transition-colors duration-150"
            style={{ boxShadow: '0 4px 16px rgba(255,181,71,0.30), inset 0 1px 0 rgba(255,255,255,0.15)' }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
