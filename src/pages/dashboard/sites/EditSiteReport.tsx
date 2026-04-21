import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, X, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project  { id: number; name: string }
interface Profile  { id: string; full_name: string }
interface Employee { id: number; name: string }
interface SiteName { id: number; name: string }

interface AttendanceRow { uid: string; employee_id: string }
interface LabourRow     { uid: string; name: string; designation: string }
interface PurchaseRow   { uid: string; item: string; amount: string }
interface MachineName   { id: number; name: string }
interface MachineRow    { uid: string; machineNameId: string; dgOpen: string; dgClose: string; runHours: string }
interface MatData       { opBal: string; credit: string; consumed: string; clBal: string; message: string }
type MatKey = 'diesel' | 'cement' | 'agg20' | 'agg10' | 'sand' | 'brick' | 'tmt10' | 'tmt12' | 'tmt16' | 'tmt20' | 'tmt25' | 'tmt32'

const MAT_LABELS: Record<MatKey, string> = {
  diesel: 'Diesel',          cement: 'Cement',
  agg20:  '20mm Aggregate',  agg10:  '10mm Aggregate', sand: 'Course Sand',
  brick:  'Brick (NOS)',
  tmt10:  'TMT Bar 10mm',    tmt12:  'TMT Bar 12mm',   tmt16: 'TMT Bar 16mm',
  tmt20:  'TMT Bar 20mm',    tmt25:  'TMT Bar 25mm',   tmt32: 'TMT Bar 32mm',
}
const MAT_KEYS: MatKey[] = ['diesel', 'cement', 'agg20', 'agg10', 'sand', 'brick', 'tmt10', 'tmt12', 'tmt16', 'tmt20', 'tmt25', 'tmt32']
const MAT_EMPTY: MatData = { opBal: '', credit: '', consumed: '', clBal: '', message: '' }
const emptyMats = (): Record<MatKey, MatData> => MAT_KEYS.reduce((acc, k) => {
  acc[k] = { ...MAT_EMPTY }; return acc
}, {} as Record<MatKey, MatData>)

// ── CSS helpers ───────────────────────────────────────────────────────────────
const inp  = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-[13.5px] text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const sel  = inp + ' appearance-none cursor-pointer'
const area = inp + ' resize-none'
const smInp = `bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-ink-primary placeholder-ink-muted focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15 hover:border-border-bright transition-[border-color,box-shadow] duration-200 w-full`
const smSel = smInp + ' appearance-none cursor-pointer'

function ruid() { return Math.random().toString(36).slice(2, 9) }
const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : '')

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
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border-bright
        text-ink-secondary hover:text-ink-primary hover:border-primary/40 text-[12px] font-medium
        transition-colors duration-150">
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="p-1.5 rounded-lg text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors">
      <X className="w-3.5 h-3.5" />
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EditSiteReport() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Dropdown data
  const [projects,    setProjects]    = useState<Project[]>([])
  const [siteNames,   setSiteNames]   = useState<SiteName[]>([])
  const [profiles,    setProfiles]    = useState<Profile[]>([])
  const [employees,   setEmployees]   = useState<Employee[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // S1 — Basic info
  const [fromProjectId, setFromProjectId] = useState('')
  const [siteNameId,    setSiteNameId]    = useState('')
  const [siteNameVal,   setSiteNameVal]   = useState('')
  const [reportedBy,    setReportedBy]    = useState('')
  const [date,          setDate]          = useState('')

  // S2 — Attendance
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])

  // S3 — Labours
  const [noOfLabours, setNoOfLabours] = useState('')
  const [labours,     setLabours]     = useState<LabourRow[]>([])

  // S4 — Purchases
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])

  // S4.5 — Machines
  const [machineNames, setMachineNames] = useState<MachineName[]>([])
  const [machines,     setMachines]     = useState<MachineRow[]>([])

  // S5 — Financial
  const [openingBal, setOpeningBal] = useState('')
  const [closeBal,   setCloseBal]   = useState('')

  // S6 — Materials
  const [mats, setMats] = useState<Record<MatKey, MatData>>(emptyMats())

  // S7 — Site Activity
  const [concreting,  setConcreting]  = useState('')
  const [concQty,     setConcQty]     = useState('')
  const [visitor,     setVisitor]     = useState('')
  const [workDone,    setWorkDone]    = useState('')
  const [workNext,    setWorkNext]    = useState('')
  const [requirement, setRequirement] = useState('')
  const [remark,      setRemark]      = useState('')
  const [comment,     setComment]     = useState('')

  // Submit
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Load dropdown data + existing report ────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoadingData(true)
    const [projRes, siteNamesRes, profilesRes, deptRes, reportRes, machRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('site_names').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('departments').select('id').ilike('name', '%site%').maybeSingle(),
      supabase
        .from('site_reports')
        .select(`*, site_report_attendance(employee_id), site_report_labours(name, designation), site_report_purchases(item, amount), site_report_machines(machine_name_id, dg_opening, dg_closing, running_hours)`)
        .eq('id', Number(id))
        .single(),
      supabase.from('machines').select('id, name').order('name'),
    ])

    if (!projRes.error)      setProjects(projRes.data as Project[] ?? [])
    if (!siteNamesRes.error) setSiteNames(siteNamesRes.data as SiteName[] ?? [])
    if (!profilesRes.error)  setProfiles(profilesRes.data as Profile[] ?? [])
    if (!machRes.error)      setMachineNames(machRes.data as MachineName[] ?? [])

    // Load site department employees
    if (!deptRes.error && deptRes.data) {
      const { data: empData } = await supabase
        .from('employees').select('id, name').eq('department_id', deptRes.data.id).order('name')
      if (empData) setEmployees(empData as Employee[])
    } else {
      const { data: empData } = await supabase.from('employees').select('id, name').order('name')
      if (empData) setEmployees(empData as Employee[])
    }

    // Pre-fill form from existing report
    if (!reportRes.error && reportRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = reportRes.data as any
      setFromProjectId(r.from_project_id ? String(r.from_project_id) : '')
      setSiteNameId(r.site_name_id ? String(r.site_name_id) : '')
      setSiteNameVal(r.site_name ?? '')
      setReportedBy(r.reported_by ?? '')
      setDate(r.date ?? '')
      setNoOfLabours(str(r.no_of_labours))
      setOpeningBal(str(r.opening_balance))
      setCloseBal(str(r.close_balance))
      setConcreting(r.concreting ?? '')
      setConcQty(r.concreting_qty ?? '')
      setVisitor(r.visitor ?? '')
      setWorkDone(r.work_done ?? '')
      setWorkNext(r.work_next_day ?? '')
      setRequirement(r.requirement ?? '')
      setRemark(r.remark ?? '')
      setComment(r.comment ?? '')

      // All 12 materials — op_bal, credit, consumed, cl_bal, message
      setMats(MAT_KEYS.reduce((acc, k) => {
        acc[k] = {
          opBal:    str(r[`${k}_op_bal`]),
          credit:   str(r[`${k}_credit`]),
          consumed: str(r[`${k}_consumed`]),
          clBal:    str(r[`${k}_cl_bal`]),
          message:  r[`${k}_message`] ?? '',
        }
        return acc
      }, {} as Record<MatKey, MatData>))

      // Attendance
      setAttendance((r.site_report_attendance ?? []).map((a: any) => ({
        uid: ruid(), employee_id: String(a.employee_id),
      })))

      // Labours
      setLabours((r.site_report_labours ?? []).map((l: any) => ({
        uid: ruid(), name: l.name, designation: l.designation ?? '',
      })))

      // Purchases
      setPurchases((r.site_report_purchases ?? []).map((p: any) => ({
        uid: ruid(), item: p.item, amount: str(p.amount),
      })))

      // Machines
      setMachines((r.site_report_machines ?? []).map((m: any) => ({
        uid: ruid(), machineNameId: String(m.machine_name_id),
        dgOpen: str(m.dg_opening), dgClose: str(m.dg_closing), runHours: str(m.running_hours),
      })))
    }

    setLoadingData(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Row helpers ──────────────────────────────────────────────────────────────
  const addAttendance    = () => setAttendance(p => [...p, { uid: ruid(), employee_id: '' }])
  const removeAttendance = (uid: string) => setAttendance(p => p.filter(r => r.uid !== uid))
  const setAttEmp        = (uid: string, v: string) => setAttendance(p => p.map(r => r.uid === uid ? { ...r, employee_id: v } : r))

  const addLabour    = () => setLabours(p => [...p, { uid: ruid(), name: '', designation: '' }])
  const removeLabour = (uid: string) => setLabours(p => p.filter(r => r.uid !== uid))
  const setLabField  = (uid: string, f: 'name' | 'designation', v: string) =>
    setLabours(p => p.map(r => r.uid === uid ? { ...r, [f]: v } : r))

  const addPurchase    = () => setPurchases(p => [...p, { uid: ruid(), item: '', amount: '' }])
  const removePurchase = (uid: string) => setPurchases(p => p.filter(r => r.uid !== uid))
  const setPurField    = (uid: string, f: 'item' | 'amount', v: string) =>
    setPurchases(p => p.map(r => r.uid === uid ? { ...r, [f]: v } : r))

  const addMachine    = () => setMachines(p => [...p, { uid: ruid(), machineNameId: '', dgOpen: '', dgClose: '', runHours: '' }])
  const removeMachine = (u: string) => setMachines(p => p.filter(r => r.uid !== u))
  const setMachField  = (u: string, f: 'machineNameId' | 'dgOpen' | 'dgClose' | 'runHours', v: string) =>
    setMachines(p => p.map(r => r.uid === u ? { ...r, [f]: v } : r))

  const setMat = (key: MatKey, f: keyof MatData, v: string) =>
    setMats(p => {
      const updated = { ...p[key], [f]: v }
      if (f === 'opBal' || f === 'credit' || f === 'consumed') {
        const op = Number(f === 'opBal'    ? v : updated.opBal)    || 0
        const cr = Number(f === 'credit'   ? v : updated.credit)   || 0
        const co = Number(f === 'consumed' ? v : updated.consumed) || 0
        updated.clBal = String(op + cr - co)
      }
      return { ...p, [key]: updated }
    })

  const num = (v: string) => v !== '' ? Number(v) : null

  // ── Submit (UPDATE) ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true); setError(null)
    try {
      const m = mats
      // Build all 12 material columns dynamically
      const matCols = MAT_KEYS.reduce((acc, k) => {
        acc[`${k}_op_bal`]  = num(m[k].opBal)
        acc[`${k}_credit`]  = num(m[k].credit)
        acc[`${k}_consumed`]= num(m[k].consumed)
        acc[`${k}_cl_bal`]  = num(m[k].clBal)
        acc[`${k}_message`] = m[k].message || null
        return acc
      }, {} as Record<string, number | string | null>)

      // Resolve site name from ID for storage
      const selectedSite = siteNames.find(s => String(s.id) === siteNameId)
      const { error: repErr } = await supabase
        .from('site_reports')
        .update({
          from_project_id:      fromProjectId ? Number(fromProjectId) : null,
          site_name_id:         siteNameId    ? Number(siteNameId)    : null,
          site_name:            selectedSite?.name ?? siteNameVal     ?? null,
          reported_by:          reportedBy  || null,
          date:                 date        || null,
          no_of_labours:        num(noOfLabours),
          opening_balance:      num(openingBal),
          close_balance:        num(closeBal),
          ...matCols,
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
        .eq('id', Number(id))
      if (repErr) throw repErr

      // Replace attendance
      await supabase.from('site_report_attendance').delete().eq('report_id', Number(id))
      const attRows = attendance.filter(r => r.employee_id)
      if (attRows.length > 0) {
        const { error: e } = await supabase.from('site_report_attendance').insert(
          attRows.map(r => ({ report_id: Number(id), employee_id: Number(r.employee_id) }))
        )
        if (e) throw e
      }

      // Replace labours
      await supabase.from('site_report_labours').delete().eq('report_id', Number(id))
      const labRows = labours.filter(r => r.name.trim())
      if (labRows.length > 0) {
        const { error: e } = await supabase.from('site_report_labours').insert(
          labRows.map(r => ({ report_id: Number(id), name: r.name.trim(), designation: r.designation.trim() || null }))
        )
        if (e) throw e
      }

      // Replace purchases
      await supabase.from('site_report_purchases').delete().eq('report_id', Number(id))
      const purRows = purchases.filter(r => r.item.trim())
      if (purRows.length > 0) {
        const { error: e } = await supabase.from('site_report_purchases').insert(
          purRows.map(r => ({ report_id: Number(id), item: r.item.trim(), amount: num(r.amount) }))
        )
        if (e) throw e
      }

      // Replace machines
      await supabase.from('site_report_machines').delete().eq('site_report_id', Number(id))
      const machRows = machines.filter(r => r.machineNameId)
      if (machRows.length > 0) {
        const { error: e } = await supabase.from('site_report_machines').insert(
          machRows.map(r => ({
            site_report_id:  Number(id),
            machine_name_id: Number(r.machineNameId),
            dg_opening:      num(r.dgOpen),
            dg_closing:      num(r.dgClose),
            running_hours:   num(r.runHours),
          }))
        )
        if (e) throw e
      }

      setSuccess(true)
      setTimeout(() => navigate(`/dashboard/sites/site-report/${id}`), 1400)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update report')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-ink-secondary text-[13px]">Loading report…</span>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/dashboard/sites/site-report/${id}`)}
          className="p-2 rounded-xl bg-bg-elevated border border-border text-ink-muted
            hover:text-ink-primary hover:border-border-bright transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">Edit Site Report</h2>
          <p className="text-ink-secondary text-[13px] mt-0.5">Update the fields below and click Save.</p>
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
          <CheckCircle2 className="w-4 h-4 shrink-0" />Report updated! Redirecting…
        </div>
      )}

      {/* ── S1: Basic Info ── */}
      <Section title="Basic Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label text="From Project" />
            <select value={fromProjectId} onChange={e => setFromProjectId(e.target.value)} className={sel}>
              <option value="">Select project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label text="Name of Site" />
            <select value={siteNameId} onChange={e => {
              setSiteNameId(e.target.value)
              setSiteNameVal(siteNames.find(s => String(s.id) === e.target.value)?.name ?? '')
            }} className={sel}>
              <option value="">Select site</option>
              {siteNames.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label text="Reported By" />
            <select value={reportedBy} onChange={e => setReportedBy(e.target.value)} className={sel}>
              <option value="">Select person</option>
              {profiles.filter(p => p.full_name).map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
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
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg-elevated/60 border-b border-border">
                    <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Name</th>
                    <th className="w-12 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {attendance.map(row => (
                    <tr key={row.uid} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="px-4 py-2">
                        <select value={row.employee_id} onChange={e => setAttEmp(row.uid, e.target.value)} className={smSel}>
                          <option value="">Select employee</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
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
                    <th className="w-12 px-2 py-2.5" />
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
                    <th className="w-12 px-2 py-2.5" />
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
          <table className="w-full text-[13px] min-w-[700px]">
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
              {MAT_KEYS.map((key, i) => (
                <tr key={key} className={`hover:bg-bg-elevated/30 transition-colors ${i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-ink-primary">{MAT_LABELS[key]}</td>
                  <td className="px-4 py-2.5">
                    <input type="number" min="0" value={mats[key].opBal}
                      onChange={e => setMat(key, 'opBal', e.target.value)} placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" min="0" value={mats[key].credit}
                      onChange={e => setMat(key, 'credit', e.target.value)} placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" min="0" value={mats[key].consumed}
                      onChange={e => setMat(key, 'consumed', e.target.value)} placeholder="0" className={smInp} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input type="number" value={mats[key].clBal} readOnly
                      placeholder="auto" className={smInp + ' bg-bg-base/60 text-ink-secondary cursor-not-allowed'} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input value={mats[key].message}
                      onChange={e => setMat(key, 'message', e.target.value)} placeholder="Note…" className={smInp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── S7: Site Activity ── */}
      <Section title="Site Activity">
        <div className="space-y-5">
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
          <div className="max-w-sm">
            <Label text="Visitor" />
            <input value={visitor} onChange={e => setVisitor(e.target.value)}
              placeholder="e.g. Client, Engineer" className={inp} />
          </div>
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
          <div>
            <Label text="Comment to be Noted" />
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Important comments to note…" className={area} />
          </div>
        </div>
      </Section>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || success}
          className="flex items-center gap-2 px-7 py-3 rounded-xl bg-primary hover:bg-primary-dark
            disabled:opacity-60 text-white text-[14px] font-semibold transition-colors"
          style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30)' }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={() => navigate(`/dashboard/sites/site-report/${id}`)}
          disabled={saving}
          className="px-5 py-3 rounded-xl border border-border text-ink-secondary hover:text-ink-primary
            hover:bg-white/[0.04] text-[14px] font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
