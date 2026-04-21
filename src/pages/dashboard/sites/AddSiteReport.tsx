import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, X, Loader2, AlertTriangle, CheckCircle2, ChevronDown,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────
interface Project  { id: number; name: string }
interface Profile  { id: string; full_name: string }
interface Employee { id: number; name: string }
interface SiteName { id: number; name: string }

interface AttendanceRow { uid: string; employee_id: string; employee_text: string }
interface LabourRow     { uid: string; name: string; designation: string }
interface PurchaseRow   { uid: string; item: string; amount: string }
interface MachineName   { id: number; name: string }
interface MachineRow    { uid: string; machineNameId: string; dgOpen: string; dgClose: string; runHours: string }
interface MatData       { opBal: string; credit: string; consumed: string; clBal: string; message: string }
type MatKey = 'diesel' | 'cement' | 'agg20' | 'agg10' | 'sand' | 'brick' | 'tmt10' | 'tmt12' | 'tmt16' | 'tmt20' | 'tmt25' | 'tmt32'

const MAT_LABELS: Record<MatKey, string> = {
  diesel: 'Diesel',
  cement: 'Cement',
  agg20:  '20mm Aggregate',
  agg10:  '10mm Aggregate',
  sand:   'Course Sand',
  brick:  'Brick (NOS)',
  tmt10:  'TMT Bar 10mm (TON)',
  tmt12:  'TMT Bar 12mm (TON)',
  tmt16:  'TMT Bar 16mm (TON)',
  tmt20:  'TMT Bar 20mm (TON)',
  tmt25:  'TMT Bar 25mm (TON)',
  tmt32:  'TMT Bar 32mm (TON)',
}
const MAT_EMPTY: MatData = { opBal: '0', credit: '', consumed: '', clBal: '0', message: '' }
const emptyMats = (): Record<MatKey, MatData> => ({
  diesel: { ...MAT_EMPTY }, cement: { ...MAT_EMPTY },
  agg20:  { ...MAT_EMPTY }, agg10:  { ...MAT_EMPTY }, sand:  { ...MAT_EMPTY },
  brick:  { ...MAT_EMPTY }, tmt10:  { ...MAT_EMPTY }, tmt12: { ...MAT_EMPTY }, tmt16: { ...MAT_EMPTY },
  tmt20:  { ...MAT_EMPTY }, tmt25:  { ...MAT_EMPTY }, tmt32: { ...MAT_EMPTY },
})

// ── CSS helpers ───────────────────────────────────────────────────────────
const inp = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-[13.5px] text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const area = inp + ' resize-none'
const smInp = `bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15 hover:border-border-bright transition-[border-color,box-shadow] duration-200 w-full`
const smSel = smInp + ' appearance-none cursor-pointer'

function uid() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().split('T')[0] }

// ── ComboBox ──────────────────────────────────────────────────────────────
interface ComboOption { id: string; label: string }

function ComboBox({
  options, inputValue, onChangeText, onSelect, placeholder,
  onAddNew, addNewLabel, compact = false,
}: {
  options: ComboOption[]
  inputValue: string
  onChangeText: (t: string) => void
  onSelect: (id: string, label: string) => void
  placeholder?: string
  onAddNew?: () => void
  addNewLabel?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o =>
    !inputValue.trim() || o.label.toLowerCase().includes(inputValue.toLowerCase())
  )
  const hasExact = options.some(o => o.label.toLowerCase() === inputValue.trim().toLowerCase())
  const inputClass = compact ? smInp : inp

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={inputValue}
          onChange={e => { onChangeText(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={inputClass + ' pr-8'}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted w-3.5 h-3.5" />
      </div>
      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 bg-bg-floating border border-border rounded-xl overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.55)' }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 192 }}>
            {filtered.length === 0 && (
              <p className="px-3 py-2.5 text-[12px] text-ink-muted italic">
                {inputValue ? 'No matches — use as custom text or add below.' : 'Type to search…'}
              </p>
            )}
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); onSelect(o.id, o.label); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-white/[0.06] text-[13px] text-ink-primary transition-colors"
              >
                {o.label}
              </button>
            ))}
            {inputValue.trim() && !hasExact && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); onSelect('', inputValue.trim()); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-white/[0.04] text-[12px] text-ink-muted border-t border-border-subtle transition-colors"
              >
                Use &ldquo;<span className="text-ink-secondary font-medium">{inputValue.trim()}</span>&rdquo; as custom text
              </button>
            )}
          </div>
          {onAddNew && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); onAddNew(); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-primary hover:bg-primary/10 border-t border-border flex items-center gap-1.5 text-[13px] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {addNewLabel ?? 'Add new…'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── QuickAddModal ─────────────────────────────────────────────────────────
function QuickAddModal({
  title, fieldLabel, placeholder, infoOnly, infoMessage, onClose, onSave,
}: {
  title: string
  fieldLabel?: string
  placeholder?: string
  infoOnly?: boolean
  infoMessage?: string
  onClose: () => void
  onSave?: (name: string) => Promise<string | null>
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSave = async () => {
    if (!onSave) return
    const trimmed = value.trim()
    if (!trimmed) { setErr('Please enter a name.'); return }
    setSaving(true); setErr(null)
    const e = await onSave(trimmed)
    setSaving(false)
    if (e) { setErr(e); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 space-y-4"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[16px] font-bold text-ink-primary tracking-[-0.02em]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {infoOnly ? (
          <div className="bg-accent/10 border border-accent/25 rounded-xl px-4 py-3 text-[13px] text-accent leading-relaxed">
            {infoMessage}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">
                {fieldLabel ?? 'Name'}
              </label>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={placeholder ?? 'Enter name…'}
                className={inp}
                autoFocus
              />
            </div>
            {err && (
              <p className="text-[12px] text-danger flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />{err}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90
                  disabled:opacity-60 text-white text-[13px] font-semibold transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-ink-secondary hover:text-ink-primary hover:bg-white/[0.04] text-[13px] transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────
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

function Label({ text }: { text: string }) {
  return <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">{text}</label>
}

function AddRowBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border-bright
        text-ink-secondary hover:text-ink-primary hover:border-primary/40 text-[12px] font-medium
        transition-colors duration-150"
    >
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="p-1.5 rounded-lg text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors">
      <X className="w-3.5 h-3.5" />
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export default function AddSiteReport() {
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  // Dropdown data
  const [projects,        setProjects]        = useState<Project[]>([])
  const [siteNames,       setSiteNames]       = useState<SiteName[]>([])
  const [profiles,        setProfiles]        = useState<Profile[]>([])
  const [employees,       setEmployees]       = useState<Employee[]>([])
  const [assignedSiteIds,     setAssignedSiteIds]     = useState<number[]>([])
  const [loadingData,         setLoadingData]         = useState(true)

  // S1 — Basic info (dual id + text for combobox fields)
  const [fromProjectId,   setFromProjectId]   = useState('')
  const [fromProjectText, setFromProjectText] = useState('')
  const [siteNameId,      setSiteNameId]      = useState('')
  const [siteNameText,    setSiteNameText]    = useState('')
  const [reportedBy,      setReportedBy]      = useState('')
  const [reportedByText,  setReportedByText]  = useState('')
  const [date, setDate] = useState(today())

  // S2 — Attendance
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])

  // S3 — Labours
  const [noOfLabours, setNoOfLabours] = useState('')
  const [labours, setLabours]         = useState<LabourRow[]>([])

  // S4 — Purchases
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])

  // S4.5 — Machines in Operation
  const [machineNames, setMachineNames] = useState<MachineName[]>([])
  const [machines,     setMachines]     = useState<MachineRow[]>([])

  // S5 — Financial
  const [openingBal, setOpeningBal] = useState('')
  const [closeBal, setCloseBal]     = useState('')

  // S6 — Materials
  const [mats, setMats] = useState<Record<MatKey, MatData>>(emptyMats())

  // S7 — Site Activity
  const [concreting, setConcreting]   = useState('')
  const [concQty, setConcQty]         = useState('')
  const [visitor, setVisitor]         = useState('')
  const [workDone, setWorkDone]       = useState('')
  const [workNext, setWorkNext]       = useState('')
  const [requirement, setRequirement] = useState('')
  const [remark, setRemark]           = useState('')
  const [comment, setComment]         = useState('')

  // Submit
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Quick-add modal
  type QuickAddTarget = 'project' | 'site' | 'reporter' | 'employee' | null
  const [quickAdd,       setQuickAdd]       = useState<QuickAddTarget>(null)
  const [quickAddAttRow, setQuickAddAttRow] = useState<string | null>(null)

  // ── Load dropdown data ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadingData(true)

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

    const [projRes, siteNamesRes, profilesRes, deptRes, machRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('site_names').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('departments').select('id').eq('name', 'Site Department').maybeSingle(),
      supabase.from('machines').select('id, name').order('name'),
    ])
    if (!projRes.error)      setProjects(projRes.data as Project[] ?? [])
    if (!siteNamesRes.error) setSiteNames(siteNamesRes.data as SiteName[] ?? [])
    if (!profilesRes.error)  setProfiles(profilesRes.data as Profile[] ?? [])
    if (!machRes.error)      setMachineNames(machRes.data as MachineName[] ?? [])

    if (!deptRes.error && deptRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let empQ: any = supabase
        .from('employees')
        .select('id, name')
        .eq('department_id', deptRes.data.id)
        .order('name')
      if (role === 'site_manager') {
        if (assignedIds.length === 0) { setEmployees([]); setLoadingData(false); return }
        empQ = empQ.in('site_name_id', assignedIds)
      }
      const { data: empData } = await empQ
      if (empData) setEmployees(empData as Employee[])
    } else if (role !== 'site_manager') {
      const { data: empData } = await supabase
        .from('employees').select('id, name').order('name')
      if (empData) setEmployees(empData as Employee[])
    }
    setLoadingData(false)
  }, [role, userId])

  useEffect(() => { loadData() }, [loadData])

  // ── Fetch previous report's Cl. Bal → populate Op. Bal ───────────────────
  useEffect(() => {
    if (!siteNameId) {
      // No site selected — reset opBal to 0, recalc clBal
      setMats(prev => {
        const next = { ...prev } as Record<MatKey, MatData>
        ;(Object.keys(next) as MatKey[]).forEach(k => {
          const cr = parseFloat(next[k].credit) || 0
          const co = parseFloat(next[k].consumed) || 0
          next[k] = { ...next[k], opBal: '0', clBal: String(0 + cr - co) }
        })
        return next
      })
      return
    }
    supabase
      .from('site_reports')
      .select([
        'diesel_cl_bal','cement_cl_bal','agg20_cl_bal','agg10_cl_bal','sand_cl_bal',
        'brick_cl_bal','tmt10_cl_bal','tmt12_cl_bal','tmt16_cl_bal',
        'tmt20_cl_bal','tmt25_cl_bal','tmt32_cl_bal',
      ].join(','))
      .eq('site_name_id', Number(siteNameId))
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any
        const prevCl: Record<MatKey, number> = {
          diesel: d?.diesel_cl_bal ?? 0, cement: d?.cement_cl_bal ?? 0,
          agg20:  d?.agg20_cl_bal  ?? 0, agg10:  d?.agg10_cl_bal  ?? 0,
          sand:   d?.sand_cl_bal   ?? 0, brick:  d?.brick_cl_bal  ?? 0,
          tmt10:  d?.tmt10_cl_bal  ?? 0, tmt12:  d?.tmt12_cl_bal  ?? 0,
          tmt16:  d?.tmt16_cl_bal  ?? 0, tmt20:  d?.tmt20_cl_bal  ?? 0,
          tmt25:  d?.tmt25_cl_bal  ?? 0, tmt32:  d?.tmt32_cl_bal  ?? 0,
        }
        setMats(current => {
          const next = { ...current } as Record<MatKey, MatData>
          ;(Object.keys(next) as MatKey[]).forEach(k => {
            const op = prevCl[k]
            const cr = parseFloat(next[k].credit) || 0
            const co = parseFloat(next[k].consumed) || 0
            next[k] = { ...next[k], opBal: String(op), clBal: String(op + cr - co) }
          })
          return next
        })
      })
  }, [siteNameId])

  // ── Quick-add handlers ──────────────────────────────────────────────────
  const handleAddProject = async (name: string): Promise<string | null> => {
    const { data, error: err } = await supabase
      .from('projects').insert({ name }).select('id').single()
    if (err) return err.message
    const newId = String(data.id)
    setProjects(prev => [...prev, { id: data.id, name }].sort((a, b) => a.name.localeCompare(b.name)))
    setFromProjectId(newId)
    setFromProjectText(name)
    return null
  }

  const handleAddSite = async (name: string): Promise<string | null> => {
    const { data, error: err } = await supabase
      .from('site_names').insert({ name }).select('id').single()
    if (err) return err.message
    const newId = String(data.id)
    setSiteNames(prev => [...prev, { id: data.id, name }].sort((a, b) => a.name.localeCompare(b.name)))
    setSiteNameId(newId)
    setSiteNameText(name)
    return null
  }

  const handleAddEmployee = async (name: string): Promise<string | null> => {
    const { data, error: err } = await supabase
      .from('employees').insert({ name }).select('id').single()
    if (err) return err.message
    const newEmp = { id: data.id, name }
    setEmployees(prev => [...prev, newEmp].sort((a, b) => a.name.localeCompare(b.name)))
    // If opened from an attendance row, select the new employee in that row
    if (quickAddAttRow) {
      setAttendance(prev => prev.map(r =>
        r.uid === quickAddAttRow
          ? { ...r, employee_id: String(data.id), employee_text: name }
          : r
      ))
    }
    return null
  }

  // ── Attendance helpers ──────────────────────────────────────────────────
  const addAttendance = () => setAttendance(p => [...p, { uid: uid(), employee_id: '', employee_text: '' }])
  const removeAttendance = (id: string) => setAttendance(p => p.filter(r => r.uid !== id))
  const setAttEmployee = (rowUid: string, empId: string, empText: string) =>
    setAttendance(p => p.map(r => r.uid === rowUid ? { ...r, employee_id: empId, employee_text: empText } : r))

  // ── Other row helpers ───────────────────────────────────────────────────
  const addLabour    = () => setLabours(p => [...p, { uid: uid(), name: '', designation: '' }])
  const removeLabour = (id: string) => setLabours(p => p.filter(r => r.uid !== id))
  const setLabField  = (id: string, f: 'name' | 'designation', v: string) =>
    setLabours(p => p.map(r => r.uid === id ? { ...r, [f]: v } : r))

  const addPurchase    = () => setPurchases(p => [...p, { uid: uid(), item: '', amount: '' }])
  const removePurchase = (id: string) => setPurchases(p => p.filter(r => r.uid !== id))
  const setPurField    = (id: string, f: 'item' | 'amount', v: string) =>
    setPurchases(p => p.map(r => r.uid === id ? { ...r, [f]: v } : r))

  const addMachine    = () => setMachines(p => [...p, { uid: uid(), machineNameId: '', dgOpen: '', dgClose: '', runHours: '' }])
  const removeMachine = (id: string) => setMachines(p => p.filter(r => r.uid !== id))
  const setMachField  = (id: string, f: 'machineNameId' | 'dgOpen' | 'dgClose' | 'runHours', v: string) =>
    setMachines(p => p.map(r => r.uid === id ? { ...r, [f]: v } : r))

  const setMat = (key: MatKey, f: keyof MatData, v: string) =>
    setMats(p => {
      const updated = { ...p[key], [f]: v }
      if (f === 'opBal' || f === 'credit' || f === 'consumed') {
        const op = parseFloat(f === 'opBal'    ? v : updated.opBal)    || 0
        const cr = parseFloat(f === 'credit'   ? v : updated.credit)   || 0
        const co = parseFloat(f === 'consumed' ? v : updated.consumed) || 0
        updated.clBal = String(op + cr - co)
      }
      return { ...p, [key]: updated }
    })

  const num = (v: string) => v !== '' ? Number(v) : null

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setFromProjectId(''); setFromProjectText('')
    setSiteNameId('');    setSiteNameText('')
    setReportedBy('');    setReportedByText('')
    setDate(today())
    setAttendance([]); setNoOfLabours(''); setLabours([])
    setPurchases([])
    setOpeningBal(''); setCloseBal('')
    setMats(emptyMats())
    setMachines([])
    setConcreting(''); setConcQty(''); setVisitor('')
    setWorkDone(''); setWorkNext(''); setRequirement(''); setRemark(''); setComment('')
    setError(null); setSuccess(false)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true); setError(null)
    try {
      const m = mats
      // Resolve project/site/reporter — prefer FK id, fall back to custom text
      const finalProjectId  = fromProjectId ? Number(fromProjectId) : null
      const finalSiteNameId = siteNameId    ? Number(siteNameId)    : null
      const finalSiteText   = (!siteNameId && siteNameText.trim()) ? siteNameText.trim() : null
      const finalReportedBy = reportedBy    ? reportedBy            : null

      const { data: rep, error: repErr } = await supabase
        .from('site_reports')
        .insert({
          from_project_id:      finalProjectId,
          site_name_id:         finalSiteNameId,
          site_name:            finalSiteText,
          reported_by:          finalReportedBy,
          date:                 date || null,
          no_of_labours:        num(noOfLabours),
          opening_balance:      num(openingBal),
          close_balance:        num(closeBal),
          // materials
          diesel_op_bal:  num(m.diesel.opBal),  diesel_credit:  num(m.diesel.credit),  diesel_consumed:  num(m.diesel.consumed),  diesel_cl_bal:  num(m.diesel.clBal),  diesel_message:  m.diesel.message  || null,
          cement_op_bal:  num(m.cement.opBal),  cement_credit:  num(m.cement.credit),  cement_consumed:  num(m.cement.consumed),  cement_cl_bal:  num(m.cement.clBal),  cement_message:  m.cement.message  || null,
          agg20_op_bal:   num(m.agg20.opBal),   agg20_credit:   num(m.agg20.credit),   agg20_consumed:   num(m.agg20.consumed),   agg20_cl_bal:   num(m.agg20.clBal),   agg20_message:   m.agg20.message   || null,
          agg10_op_bal:   num(m.agg10.opBal),   agg10_credit:   num(m.agg10.credit),   agg10_consumed:   num(m.agg10.consumed),   agg10_cl_bal:   num(m.agg10.clBal),   agg10_message:   m.agg10.message   || null,
          sand_op_bal:    num(m.sand.opBal),    sand_credit:    num(m.sand.credit),    sand_consumed:    num(m.sand.consumed),    sand_cl_bal:    num(m.sand.clBal),    sand_message:    m.sand.message    || null,
          brick_op_bal:   num(m.brick.opBal),   brick_credit:   num(m.brick.credit),   brick_consumed:   num(m.brick.consumed),   brick_cl_bal:   num(m.brick.clBal),   brick_message:   m.brick.message   || null,
          tmt10_op_bal:   num(m.tmt10.opBal),   tmt10_credit:   num(m.tmt10.credit),   tmt10_consumed:   num(m.tmt10.consumed),   tmt10_cl_bal:   num(m.tmt10.clBal),   tmt10_message:   m.tmt10.message   || null,
          tmt12_op_bal:   num(m.tmt12.opBal),   tmt12_credit:   num(m.tmt12.credit),   tmt12_consumed:   num(m.tmt12.consumed),   tmt12_cl_bal:   num(m.tmt12.clBal),   tmt12_message:   m.tmt12.message   || null,
          tmt16_op_bal:   num(m.tmt16.opBal),   tmt16_credit:   num(m.tmt16.credit),   tmt16_consumed:   num(m.tmt16.consumed),   tmt16_cl_bal:   num(m.tmt16.clBal),   tmt16_message:   m.tmt16.message   || null,
          tmt20_op_bal:   num(m.tmt20.opBal),   tmt20_credit:   num(m.tmt20.credit),   tmt20_consumed:   num(m.tmt20.consumed),   tmt20_cl_bal:   num(m.tmt20.clBal),   tmt20_message:   m.tmt20.message   || null,
          tmt25_op_bal:   num(m.tmt25.opBal),   tmt25_credit:   num(m.tmt25.credit),   tmt25_consumed:   num(m.tmt25.consumed),   tmt25_cl_bal:   num(m.tmt25.clBal),   tmt25_message:   m.tmt25.message   || null,
          tmt32_op_bal:   num(m.tmt32.opBal),   tmt32_credit:   num(m.tmt32.credit),   tmt32_consumed:   num(m.tmt32.consumed),   tmt32_cl_bal:   num(m.tmt32.clBal),   tmt32_message:   m.tmt32.message   || null,
          // activity
          concreting:           concreting  || null,
          concreting_qty:       concQty     || null,
          visitor:              visitor     || null,
          work_done:            workDone    || null,
          work_next_day:        workNext    || null,
          requirement:          requirement || null,
          remark:               remark      || null,
          comment:              comment     || null,
        })
        .select('id')
        .single()

      if (repErr) throw repErr
      const reportId = rep.id

      // Attendance — save employees that have an id FK; custom text ones save as-is if we add a text col
      const attRows = attendance.filter(r => r.employee_id || r.employee_text.trim())
      if (attRows.length > 0) {
        const attInsert = attRows
          .filter(r => r.employee_id)
          .map(r => ({ report_id: reportId, employee_id: Number(r.employee_id) }))
        if (attInsert.length > 0) {
          const { error: e } = await supabase.from('site_report_attendance').insert(attInsert)
          if (e) throw e
        }
      }

      // Labours
      const labRows = labours.filter(r => r.name.trim())
      if (labRows.length > 0) {
        const { error: e } = await supabase.from('site_report_labours').insert(
          labRows.map(r => ({ report_id: reportId, name: r.name.trim(), designation: r.designation.trim() || null }))
        )
        if (e) throw e
      }

      // Purchases
      const purRows = purchases.filter(r => r.item.trim())
      if (purRows.length > 0) {
        const { error: e } = await supabase.from('site_report_purchases').insert(
          purRows.map(r => ({ report_id: reportId, item: r.item.trim(), amount: num(r.amount) }))
        )
        if (e) throw e
      }

      // Machines
      const machRows = machines.filter(r => r.machineNameId)
      if (machRows.length > 0) {
        const { error: e } = await supabase.from('site_report_machines').insert(
          machRows.map(r => ({
            site_report_id:  reportId,
            machine_name_id: Number(r.machineNameId),
            dg_opening:      num(r.dgOpen),
            dg_closing:      num(r.dgClose),
            running_hours:   num(r.runHours),
          }))
        )
        if (e) throw e
      }

      setSuccess(true)
      setTimeout(() => navigate('/dashboard/sites/site-report'), 1800)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  // ── ComboBox option arrays ────────────────────────────────────────────────
  const projectOptions: ComboOption[]  = projects.map(p  => ({ id: String(p.id),  label: p.name }))
  const siteOptions:    ComboOption[]  = (
    role === 'site_manager'
      ? siteNames.filter(s => assignedSiteIds.includes(s.id))
      : siteNames
  ).map(s => ({ id: String(s.id), label: s.name }))
  const profileOptions: ComboOption[]  = profiles.filter(p => p.full_name).map(p => ({ id: p.id, label: p.full_name }))
  const empOptions:     ComboOption[]  = employees.map(e => ({ id: String(e.id), label: e.name }))

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-ink-secondary text-[13px]">Loading form data…</span>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/sites/site-report')}
          className="p-2 rounded-xl bg-bg-elevated border border-border text-ink-muted
            hover:text-ink-primary hover:border-border-bright transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">Add Site Report</h2>
          <p className="text-ink-secondary text-[13px] mt-0.5">Fill in all sections and click Submit.</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-xl px-4 py-3 text-[13px] text-success">
          <CheckCircle2 className="w-4 h-4 shrink-0" />Report saved successfully! Redirecting…
        </div>
      )}

      {/* ── S1: Basic Info ── */}
      <Section title="Basic Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label text="From Project" />
            <ComboBox
              options={projectOptions}
              inputValue={fromProjectText}
              onChangeText={t => { setFromProjectText(t); setFromProjectId('') }}
              onSelect={(id, label) => { setFromProjectId(id); setFromProjectText(label) }}
              placeholder="Type or select project…"
              onAddNew={() => setQuickAdd('project')}
              addNewLabel="Add Project"
            />
          </div>
          <div>
            <Label text="Name of Site" />
            <ComboBox
              options={siteOptions}
              inputValue={siteNameText}
              onChangeText={t => { setSiteNameText(t); setSiteNameId('') }}
              onSelect={(id, label) => { setSiteNameId(id); setSiteNameText(label) }}
              placeholder="Type or select site…"
              onAddNew={() => setQuickAdd('site')}
              addNewLabel="Add Site Name"
            />
          </div>
          <div>
            <Label text="Reported By" />
            <ComboBox
              options={profileOptions}
              inputValue={reportedByText}
              onChangeText={t => { setReportedByText(t); setReportedBy('') }}
              onSelect={(id, label) => { setReportedBy(id); setReportedByText(label) }}
              placeholder="Type or select person…"
              onAddNew={() => setQuickAdd('reporter')}
              addNewLabel="Add Person"
            />
          </div>
          <div>
            <Label text="Date" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
          </div>
        </div>
      </Section>

      {/* ── S2: Attendance ── */}
      <Section title="Attendance of Site">
        <div className="space-y-3">
          {attendance.length > 0 && (
            <div className="rounded-xl border border-border" style={{ overflow: 'visible' }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg-elevated/60 border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Name</th>
                    <th className="w-12 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {attendance.map(row => (
                    <tr key={row.uid} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="relative z-50 px-4 py-2">
                        <ComboBox
                          options={empOptions}
                          inputValue={row.employee_text}
                          onChangeText={t => setAttEmployee(row.uid, '', t)}
                          onSelect={(id, label) => setAttEmployee(row.uid, id, label)}
                          placeholder="Type or select employee…"
                          onAddNew={() => { setQuickAddAttRow(row.uid); setQuickAdd('employee') }}
                          addNewLabel="Add Employee"
                          compact
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <RemoveBtn onClick={() => removeAttendance(row.uid)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AddRowBtn onClick={addAttendance} label="Add Attendance" />
        </div>
      </Section>

      {/* ── S3: Labourers ── */}
      <Section title="Labourers / Mistri / Driver">
        <div className="space-y-4">
          <div className="max-w-xs">
            <Label text="No. of Labours / Mistri / Driver or Others" />
            <input type="number" min="0" value={noOfLabours}
              onChange={e => setNoOfLabours(e.target.value)} placeholder="0" className={inp} />
          </div>
          {labours.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg-elevated/60 border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Name</th>
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Designation Type</th>
                    <th className="w-12 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {labours.map(row => (
                    <tr key={row.uid} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="px-4 py-2">
                        <input value={row.name} onChange={e => setLabField(row.uid, 'name', e.target.value)}
                          placeholder="e.g. Ramu" className={smInp} />
                      </td>
                      <td className="px-4 py-2">
                        <input value={row.designation} onChange={e => setLabField(row.uid, 'designation', e.target.value)}
                          placeholder="e.g. Mason" className={smInp} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <RemoveBtn onClick={() => removeLabour(row.uid)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AddRowBtn onClick={addLabour} label="Add Labours" />
        </div>
      </Section>

      {/* ── S4: Purchase (Expense) ── */}
      <Section title="Purchase (Expense)">
        <div className="space-y-3">
          {purchases.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg-elevated/60 border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Purchase Item</th>
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-40">Amount (₹)</th>
                    <th className="w-12 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {purchases.map(row => (
                    <tr key={row.uid} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="px-4 py-2">
                        <input value={row.item} onChange={e => setPurField(row.uid, 'item', e.target.value)}
                          placeholder="e.g. Steel rods" className={smInp} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" value={row.amount}
                          onChange={e => setPurField(row.uid, 'amount', e.target.value)}
                          placeholder="0" className={smInp} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <RemoveBtn onClick={() => removePurchase(row.uid)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AddRowBtn onClick={addPurchase} label="Add Purchase" />
        </div>
      </Section>

      {/* ── S5: Financial ── */}
      <Section title="Financial">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div>
            <Label text="Opening Balance (₹)" />
            <input type="number" min="0" value={openingBal}
              onChange={e => setOpeningBal(e.target.value)} placeholder="0" className={inp} />
          </div>
          <div>
            <Label text="Close Balance (₹)" />
            <input type="number" min="0" value={closeBal}
              onChange={e => setCloseBal(e.target.value)} placeholder="0" className={inp} />
          </div>
        </div>
      </Section>

      {/* ── S6: Materials ── */}
      <Section title="Materials">
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px] min-w-[600px]">
            <thead>
              <tr className="bg-bg-elevated/60 border-b border-border">
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 min-w-[140px]">Material</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-28">Op. Bal</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-28">Credit</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-28">Consumed</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-28">Cl. Bal</th>
                <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {(Object.keys(MAT_LABELS) as MatKey[]).map((key, i) => (
                <tr key={key} className={`hover:bg-bg-elevated/30 transition-colors ${i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                  <td className="px-4 py-2.5">
                    <span className="text-[13px] font-medium text-ink-primary">{MAT_LABELS[key]}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" value={mats[key].opBal}
                      onChange={e => setMat(key, 'opBal', e.target.value)}
                      placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" value={mats[key].credit}
                      onChange={e => setMat(key, 'credit', e.target.value)}
                      placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" value={mats[key].consumed}
                      onChange={e => setMat(key, 'consumed', e.target.value)}
                      placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" value={mats[key].clBal}
                      onChange={e => setMat(key, 'clBal', e.target.value)}
                      placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={mats[key].message}
                      onChange={e => setMat(key, 'message', e.target.value)}
                      placeholder="Note…" className={smInp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── S4.5: Machine in Operation ── */}
      <Section title="Machine in Operation">
        <div className="space-y-3">
          {machines.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-[13px] min-w-[540px]">
                <thead>
                  <tr className="bg-bg-elevated/60 border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Machine Name</th>
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-32">DG Opening</th>
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-32">DG Closing</th>
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5 w-32">Running Hours</th>
                    <th className="w-12 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {machines.map(row => (
                    <tr key={row.uid} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="px-4 py-2">
                        <select value={row.machineNameId}
                          onChange={e => setMachField(row.uid, 'machineNameId', e.target.value)}
                          className={smSel}>
                          <option value="">Select machine…</option>
                          {machineNames.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" value={row.dgOpen}
                          onChange={e => setMachField(row.uid, 'dgOpen', e.target.value)}
                          placeholder="0" className={smInp} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" value={row.dgClose}
                          onChange={e => setMachField(row.uid, 'dgClose', e.target.value)}
                          placeholder="0" className={smInp} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" value={row.runHours}
                          onChange={e => setMachField(row.uid, 'runHours', e.target.value)}
                          placeholder="0" className={smInp} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <RemoveBtn onClick={() => removeMachine(row.uid)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AddRowBtn onClick={addMachine} label="Add Machine" />
        </div>
      </Section>

      {/* ── S7: Site Activity ── */}
      <Section title="Site Activity">
        <div className="space-y-5">

          {/* Concreting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label text="If Concreting" />
              <input value={concreting} onChange={e => setConcreting(e.target.value)}
                placeholder="e.g. Slab, Column" className={inp} />
            </div>
            <div>
              <Label text="Qty. of Concrete" />
              <input value={concQty} onChange={e => setConcQty(e.target.value)}
                placeholder="e.g. 12 cu.m" className={inp} />
            </div>
          </div>

          {/* Visitor */}
          <div className="max-w-sm">
            <Label text="Visitor" />
            <input value={visitor} onChange={e => setVisitor(e.target.value)}
              placeholder="e.g. Client, Engineer" className={inp} />
          </div>

          {/* Textareas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label text="Work Done" />
              <textarea rows={4} value={workDone} onChange={e => setWorkDone(e.target.value)}
                placeholder="Describe work completed today…" className={area} />
            </div>
            <div>
              <Label text="Work to be Done Next Day" />
              <textarea rows={4} value={workNext} onChange={e => setWorkNext(e.target.value)}
                placeholder="Planned work for tomorrow…" className={area} />
            </div>
            <div>
              <Label text="Requirement" />
              <textarea rows={4} value={requirement} onChange={e => setRequirement(e.target.value)}
                placeholder="Materials, tools, resources needed…" className={area} />
            </div>
            <div>
              <Label text="Remark" />
              <textarea rows={4} value={remark} onChange={e => setRemark(e.target.value)}
                placeholder="Any remarks…" className={area} />
            </div>
          </div>

          {/* Comment */}
          <div>
            <Label text="Comment to be Noted" />
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Important comments to note…" className={area} />
          </div>
        </div>
      </Section>

      {/* ── S8: Actions ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || success}
          className="flex items-center gap-2 px-7 py-3 rounded-xl bg-success hover:bg-success/90
            disabled:opacity-60 text-white text-[14px] font-semibold transition-colors"
          style={{ boxShadow: '0 4px 16px rgba(34,197,94,0.30)' }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Submit'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-7 py-3 rounded-xl bg-danger hover:bg-danger/90
            disabled:opacity-60 text-white text-[14px] font-semibold transition-colors"
          style={{ boxShadow: '0 4px 16px rgba(255,92,106,0.22)' }}
        >
          Reset
        </button>
        <button
          onClick={() => navigate('/dashboard/sites/site-report')}
          disabled={saving}
          className="px-5 py-3 rounded-xl border border-border text-ink-secondary hover:text-ink-primary
            hover:bg-white/[0.04] text-[14px] font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {/* ── Quick-add modals ── */}
      {quickAdd === 'project' && (
        <QuickAddModal
          title="Add Project"
          fieldLabel="Project Name"
          placeholder="e.g. Office Tower Phase 2"
          onClose={() => setQuickAdd(null)}
          onSave={handleAddProject}
        />
      )}
      {quickAdd === 'site' && (
        <QuickAddModal
          title="Add Site Name"
          fieldLabel="Site Name"
          placeholder="e.g. Main Gate Area"
          onClose={() => setQuickAdd(null)}
          onSave={handleAddSite}
        />
      )}
      {quickAdd === 'reporter' && (
        <QuickAddModal
          title="Add Person"
          infoOnly
          infoMessage="New users must be created from the Administration → Manage Users section. Once created, they will appear here automatically."
          onClose={() => setQuickAdd(null)}
        />
      )}
      {quickAdd === 'employee' && (
        <QuickAddModal
          title="Add Employee"
          fieldLabel="Employee Name"
          placeholder="e.g. Ramesh Kumar"
          onClose={() => { setQuickAdd(null); setQuickAddAttRow(null) }}
          onSave={handleAddEmployee}
        />
      )}
    </div>
  )
}
