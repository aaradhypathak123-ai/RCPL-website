import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project  { id: number; name: string }
interface SiteName { id: number; name: string }
interface Employee { id: number; name: string }
interface Material { id: number; name: string }

interface ItemRow {
  id:           string   // local UUID-like key
  particulars:  string   // material_names id as string
  shape:        string
  nos:          string
  length:       string
  width:        string
  height:       string
  qty:          string
  unit:         string
  rate:         string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const today  = () => new Date().toISOString().split('T')[0]
const uid    = () => Math.random().toString(36).slice(2)
const mkRow  = (): ItemRow => ({
  id: uid(), particulars: '', shape: '', nos: '', length: '',
  width: '', height: '', qty: '', unit: '', rate: '',
})

const SHAPES = ['Rectangle', 'Circle', 'Triangle']
const UNITS  = ['Sqm', 'Cum', 'Rmt', 'Nos']

// ── Style tokens ─────────────────────────────────────────────────────────────
const labelCls = 'block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2'
const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const selectCls = inputCls + ' appearance-none cursor-pointer'

// Table cell input — tight fit
const cellInputCls = `w-full bg-bg-base border border-border rounded-md px-1.5 py-1
  text-[11.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15
  transition-[border-color,box-shadow] duration-150`
const cellSelectCls = cellInputCls + ' appearance-none cursor-pointer'

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
export default function AddMeasurement() {
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  // Dropdowns
  const [projects,        setProjects]        = useState<Project[]>([])
  const [siteNames,       setSiteNames]       = useState<SiteName[]>([])
  const [employees,       setEmployees]       = useState<Employee[]>([])
  const [materials,       setMaterials]       = useState<Material[]>([])
  const [assignedSiteIds, setAssignedSiteIds] = useState<number[]>([])
  const [dropLoading,     setDropLoading]     = useState(true)

  // Header fields
  const [projectId,  setProjectId]  = useState('')
  const [siteNameId, setSiteNameId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date,       setDate]       = useState(today())
  const [bmNo,       setBmNo]       = useState('')

  // Items
  const [items, setItems] = useState<ItemRow[]>([mkRow()])

  // UI state
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Load dropdowns ──────────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    setDropLoading(true)

    // For site_manager, fetch assigned site IDs first
    let assignedIds: number[] = []
    if (role === 'site_manager' && userId) {
      const { data: assigns } = await supabase
        .from('user_site_assignments')
        .select('site_name_id')
        .eq('user_id', userId)
      assignedIds = (assigns ?? []).map((a: { site_name_id: number }) => a.site_name_id)
      setAssignedSiteIds(assignedIds)
    }

    const [projRes, siteRes, deptRes, matRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('site_names').select('id, name').order('name'),
      supabase.from('departments').select('id').eq('name', 'Site Department').single(),
      supabase.from('material_names').select('id, name').order('name'),
    ])
    setProjects((projRes.data ?? []) as Project[])
    setSiteNames((siteRes.data ?? []) as SiteName[])
    setMaterials((matRes.data ?? []) as Material[])

    // Fetch employees whose department_id matches Site Department
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deptId = (deptRes.data as any)?.id
    if (deptId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let empQ: any = supabase
        .from('employees')
        .select('id, name')
        .eq('department_id', deptId)
        .order('name')
      if (role === 'site_manager') {
        if (assignedIds.length === 0) { setEmployees([]); setDropLoading(false); return }
        empQ = empQ.in('site_name_id', assignedIds)
      }
      const { data: empData } = await empQ
      setEmployees((empData ?? []) as Employee[])
    }
    setDropLoading(false)
  }, [role, userId])

  useEffect(() => { loadDropdowns() }, [loadDropdowns])

  // ── Item helpers ────────────────────────────────────────────────────────────
  const updateItem = (id: string, field: keyof ItemRow, value: string) => {
    setItems(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  const addRow = () => setItems(prev => [...prev, mkRow()])

  // ── Derived: row amounts + grand total ──────────────────────────────────────
  const rowAmount = (row: ItemRow) => {
    const q = parseFloat(row.qty  || '0')
    const r = parseFloat(row.rate || '0')
    return isNaN(q) || isNaN(r) ? 0 : q * r
  }

  const grandTotal = useMemo(
    () => items.reduce((sum, row) => sum + rowAmount(row), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  )

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!projectId)      { setError('Please select a project.');  return }
    if (!employeeId)     { setError('Please select a name.');     return }
    if (!bmNo.trim())    { setError('BM No is required.');        return }
    if (items.some(r => !r.particulars)) {
      setError('All items must have Particulars selected.'); return
    }
    if (items.some(r => !r.qty || isNaN(parseFloat(r.qty)))) {
      setError('All items must have a valid Quantity.'); return
    }
    if (items.some(r => !r.rate || isNaN(parseFloat(r.rate)))) {
      setError('All items must have a valid Rate.'); return
    }

    setSaving(true)

    // 1 — Insert measurement header
    const { data: mData, error: mErr } = await supabase
      .from('measurements')
      .insert({
        project_id:   Number(projectId),
        site_name_id: siteNameId ? Number(siteNameId) : null,
        employee_id:  Number(employeeId),
        date,
        bm_no:        bmNo.trim(),
        grand_total:  grandTotal,
      })
      .select('id')
      .single()

    if (mErr || !mData) {
      setError(mErr?.message ?? 'Failed to save measurement.')
      setSaving(false)
      return
    }

    // 2 — Insert measurement_items
    const { error: itemsErr } = await supabase.from('measurement_items').insert(
      items.map((row, idx) => ({
        measurement_id:   mData.id,
        sr_no:            idx + 1,
        material_name_id: Number(row.particulars),
        shape:            row.shape  || null,
        nos:              row.nos    ? parseFloat(row.nos)    : null,
        length:           row.length ? parseFloat(row.length) : null,
        width:            row.width  ? parseFloat(row.width)  : null,
        height:           row.height ? parseFloat(row.height) : null,
        quantity:         parseFloat(row.qty),
        unit:             row.unit   || null,
        rate:             parseFloat(row.rate),
        amount:           rowAmount(row),
      }))
    )

    setSaving(false)

    if (itemsErr) {
      // Roll back measurement header
      await supabase.from('measurements').delete().eq('id', mData.id)
      setError(itemsErr.message)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/dashboard/measurement'), 1200)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
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
            Add Measurement
          </h2>
          <p className="text-ink-muted text-[13px] mt-0.5">Fill in measurement details and line items.</p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 bg-success/10 border border-success/25 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <span className="text-[13px] text-success">Measurement saved! Redirecting…</span>
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

        {/* ── Section 1: Measurement Info ── */}
        <Section title="Measurement Info">
          {dropLoading ? (
            <div className="flex items-center gap-2 text-ink-muted text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="From Project *">
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className={selectCls}>
                  <option value="">— Select Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>

              <Field label="Site">
                <select value={siteNameId} onChange={e => setSiteNameId(e.target.value)} className={selectCls}>
                  <option value="">— Select Site —</option>
                  {(role === 'site_manager'
                    ? siteNames.filter(s => assignedSiteIds.includes(s.id))
                    : siteNames
                  ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>

              <Field label="Name *">
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className={selectCls}>
                  <option value="">— Select Name —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </Field>

              <Field label="Date *">
                <input
                  type="date" value={date}
                  onChange={e => setDate(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="BM No *">
                <input
                  type="text" value={bmNo}
                  onChange={e => setBmNo(e.target.value)}
                  placeholder="e.g. BM-2024-001"
                  className={inputCls}
                />
              </Field>
            </div>
          )}
        </Section>

        {/* ── Section 2: Measurement Items ── */}
        <Section title="Measurement Items">
          <div className="space-y-2">

            {/* ── Column label header ─────────────────────────────────── */}
            <div className="border-b border-border pb-2 space-y-0.5 select-none">
              <div className="flex gap-2 items-center text-[10px] font-semibold text-ink-muted uppercase tracking-[0.07em]">
                <span className="w-5 shrink-0" />
                <span className="flex-1 min-w-[150px]">Particulars</span>
                <span className="w-[120px] shrink-0">Shape</span>
                <span className="w-[70px] shrink-0">Nos</span>
                <span className="w-6 shrink-0" />
              </div>
              <div className="flex gap-2 items-center text-[10px] font-semibold text-ink-muted uppercase tracking-[0.07em] pl-7">
                <span className="w-[70px] shrink-0">Length</span>
                <span className="w-[70px] shrink-0">Width</span>
                <span className="w-[70px] shrink-0">Height</span>
                <span className="w-[70px] shrink-0">Qty</span>
                <span className="w-[80px] shrink-0">Unit</span>
                <span className="w-[90px] shrink-0">Rate (₹)</span>
                <span className="w-[90px] shrink-0 ml-auto text-right">Amount (₹)</span>
              </div>
            </div>

            {/* ── Item rows ───────────────────────────────────────────── */}
            {items.map((row, idx) => {
              const amt = rowAmount(row)
              return (
                <div key={row.id} className="rounded-lg border border-border-subtle bg-bg-base/30 p-2 space-y-1.5">

                  {/* Row 1: Sr · Particulars · Shape · Nos · Delete */}
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-[11px] text-ink-muted font-medium">{idx + 1}</span>
                    <div className="flex-1 min-w-[150px]">
                      <select
                        value={row.particulars}
                        onChange={e => updateItem(row.id, 'particulars', e.target.value)}
                        className={cellSelectCls}
                      >
                        <option value="">— Select —</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="w-[120px] shrink-0">
                      <select
                        value={row.shape}
                        onChange={e => updateItem(row.id, 'shape', e.target.value)}
                        className={cellSelectCls}
                      >
                        <option value="">— Select —</option>
                        {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="w-[70px] shrink-0">
                      <input
                        type="number" min="0" step="any"
                        value={row.nos}
                        onChange={e => updateItem(row.id, 'nos', e.target.value)}
                        placeholder="0"
                        className={cellInputCls}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(row.id)}
                      disabled={items.length === 1}
                      className="w-6 shrink-0 p-1 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10
                        disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Row 2: Length · Width · Height · Qty · Unit · Rate · Amount */}
                  <div className="flex items-center gap-2 pl-7">
                    <div className="w-[70px] shrink-0">
                      <input
                        type="number" min="0" step="any"
                        value={row.length}
                        onChange={e => updateItem(row.id, 'length', e.target.value)}
                        placeholder="Length"
                        className={cellInputCls}
                      />
                    </div>
                    <div className="w-[70px] shrink-0">
                      <input
                        type="number" min="0" step="any"
                        value={row.width}
                        onChange={e => updateItem(row.id, 'width', e.target.value)}
                        placeholder="Width"
                        className={cellInputCls}
                      />
                    </div>
                    <div className="w-[70px] shrink-0">
                      <input
                        type="number" min="0" step="any"
                        value={row.height}
                        onChange={e => updateItem(row.id, 'height', e.target.value)}
                        placeholder="Height"
                        className={cellInputCls}
                      />
                    </div>
                    <div className="w-[70px] shrink-0">
                      <input
                        type="number" min="0" step="any"
                        value={row.qty}
                        onChange={e => updateItem(row.id, 'qty', e.target.value)}
                        placeholder="Qty"
                        className={cellInputCls}
                      />
                    </div>
                    <div className="w-[80px] shrink-0">
                      <select
                        value={row.unit}
                        onChange={e => updateItem(row.id, 'unit', e.target.value)}
                        className={cellSelectCls}
                      >
                        <option value="">—</option>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="w-[90px] shrink-0">
                      <input
                        type="number" min="0" step="any"
                        value={row.rate}
                        onChange={e => updateItem(row.id, 'rate', e.target.value)}
                        placeholder="0.00"
                        className={cellInputCls}
                      />
                    </div>
                    <div className="w-[90px] shrink-0 ml-auto">
                      <div className="px-1.5 py-1 rounded-md bg-bg-elevated text-[11.5px] font-semibold text-ink-primary text-right">
                        ₹&nbsp;{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                </div>
              )
            })}

            {/* ── Grand Total ─────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3 pt-3 mt-1 border-t border-border">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.06em]">Grand Total</span>
              <div className="w-[90px] px-1.5 py-1 rounded-md bg-primary/10 border border-primary/25 text-[12px] font-bold text-primary text-right">
                ₹&nbsp;{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

          </div>

          {/* Add row button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border
                text-ink-muted hover:text-ink-secondary hover:border-border-bright
                text-[13px] font-medium transition-colors duration-150"
            >
              <Plus className="w-4 h-4" /> Add More
            </button>
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/measurement')}
            className="px-5 py-2.5 rounded-xl border border-border text-ink-secondary text-[13px] font-medium
              hover:bg-bg-elevated transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || success || dropLoading}
            className="flex items-center gap-2 bg-success hover:bg-success/80 disabled:opacity-60
              text-bg-base font-semibold text-[13px] px-6 py-2.5 rounded-xl
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50
              transition-colors duration-150"
            style={{ boxShadow: '0 4px 16px rgba(52,211,153,0.30), inset 0 1px 0 rgba(255,255,255,0.15)' }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}
