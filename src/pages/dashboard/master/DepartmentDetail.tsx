import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Users, Search, X, FileSpreadsheet, FileText, Loader2, UserPlus,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

interface SiteName { id: number; name: string }

interface Employee {
  id: number
  name: string
  role: string
  created_at: string
  site_name_id: number | null
  site_names: { name: string } | { name: string }[] | null
}

interface Department {
  id: number
  name: string
}

const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, user } = useAuthStore()
  const userId = user?.id

  const [department, setDepartment] = useState<Department | null>(null)
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [siteNames, setSiteNames]   = useState<SiteName[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')

  // Add modal
  const [addModal, setAddModal]     = useState(false)
  const [formName, setFormName]     = useState('')
  const [formRole, setFormRole]     = useState('')
  const [formSiteId, setFormSiteId] = useState('')
  const [formError, setFormError]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      // For site_manager, fetch assigned site IDs first
      let siteFilter: number[] | null = null
      if (role === 'site_manager' && userId) {
        const { data: assigns } = await supabase
          .from('user_site_assignments')
          .select('site_name_id')
          .eq('user_id', userId)
        siteFilter = (assigns ?? []).map((a: { site_name_id: number }) => a.site_name_id)
        if (siteFilter.length === 0) {
          setDepartment(null)
          setEmployees([])
          setSiteNames([])
          setLoading(false)
          return
        }
      }

      const [deptRes, sitesRes] = await Promise.all([
        supabase.from('departments').select('id, name').eq('id', id).maybeSingle(),
        supabase.from('site_names').select('id, name').order('name'),
      ])
      if (deptRes.error) throw deptRes.error
      setDepartment(deptRes.data as Department)
      setSiteNames((sitesRes.data ?? []) as SiteName[])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let empQ: any = supabase
        .from('employees')
        .select('id, name, role, created_at, site_name_id, site_names(name)')
        .eq('department_id', id)
        .order('name')
      if (siteFilter !== null) empQ = empQ.in('site_name_id', siteFilter)

      const empRes = await empQ
      if (empRes.error) throw empRes.error
      setEmployees((empRes.data ?? []) as Employee[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [id, role, userId])

  useEffect(() => { load() }, [load])

  // Resolve Supabase join (may return object or single-element array)
  const resolveSite = (emp: Employee): string => {
    const s = emp.site_names
    if (!s) return '—'
    const obj = Array.isArray(s) ? s[0] : s
    return obj?.name ?? '—'
  }

  const filtered = useMemo(() => {
    if (!search) return employees
    const q = search.toLowerCase()
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      resolveSite(e).toLowerCase().includes(q)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, search])

  const handleAdd = async () => {
    if (!formName.trim()) { setFormError('Name is required'); return }
    if (!formRole.trim()) { setFormError('Role is required'); return }
    setSaving(true); setFormError(null)
    try {
      const { error: err } = await supabase.from('employees').insert({
        name: formName.trim(),
        role: formRole.trim(),
        department_id: Number(id),
        site_name_id: formSiteId ? Number(formSiteId) : null,
      })
      if (err) throw err
      setAddModal(false); setFormName(''); setFormRole(''); setFormSiteId('')
      await load()
      flash('Employee added')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to add employee')
    } finally { setSaving(false) }
  }

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((e, i) => ({ '#': i + 1, 'Name': e.name, 'Role/Designation': e.role }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Employees')
    XLSX.writeFile(wb, `${department?.name ?? 'department'}_employees.xlsx`)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Rational Construction Pvt. Ltd.', 105, 15, { align: 'center' })
    doc.setFontSize(10); doc.setTextColor(120)
    doc.text(`${department?.name ?? 'Department'} — Employee List`, 105, 23, { align: 'center' })
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 30,
      head: [['#', 'Name', 'Role / Designation']],
      body: filtered.map((e, i) => [i + 1, e.name, e.role]),
      theme: 'striped',
      headStyles: { fillColor: [90, 127, 255] },
      columnStyles: { 0: { cellWidth: 12 } },
    })
    const total = doc.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
      doc.setPage(p)
      doc.setFontSize(8); doc.setTextColor(150)
      doc.text(`Rational Construction Pvt. Ltd.  |  Page ${p} of ${total}`,
        105, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    }
    doc.save(`${department?.name ?? 'department'}_employees.pdf`)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Back + header + Add button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/master/employee-department')}
            className="p-2 rounded-xl bg-bg-elevated border border-border text-ink-muted
              hover:text-ink-primary hover:border-border-bright transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
              {loading ? 'Loading…' : (department?.name ?? 'Department')}
            </h2>
            <p className="text-ink-secondary text-[13px] mt-0.5">
              Employee list
            </p>
          </div>
        </div>
        {role !== 'site_manager' && (
          <button
            onClick={() => { setFormName(''); setFormRole(''); setFormSiteId(''); setFormError(null); setAddModal(true) }}
            className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white
              text-[13px] font-semibold px-4 py-2.5 rounded-xl
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
              transition-colors duration-150"
            style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30), inset 0 1px 0 rgba(255,255,255,0.12)' }}
          >
            <UserPlus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-xl px-4 py-3">
          <span className="text-[13px] text-success">{successMsg}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <span className="text-[13px] text-danger/90">{error}</span>
        </div>
      )}

      {/* Card */}
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
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or role…"
                className="bg-bg-elevated border border-border rounded-xl pl-8 pr-3 py-2
                  text-[13px] text-ink-primary placeholder-ink-muted w-52
                  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                  transition-[border-color,box-shadow] duration-200"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-ink-muted hover:text-ink-secondary transition-colors flex items-center gap-1 text-[12px]"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success
                border border-success/25 px-3 py-1.5 rounded-xl text-[12px] font-medium
                transition-colors duration-150"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 bg-danger/15 hover:bg-danger/25 text-danger
                border border-danger/25 px-3 py-1.5 rounded-xl text-[12px] font-medium
                transition-colors duration-150"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-ink-secondary text-[13px]">Loading employees…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="w-8 h-8 text-ink-muted opacity-40" />
            <p className="text-ink-secondary text-[13px] font-medium">
              {search ? 'No employees match your search' : 'No employees in this department'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['#', 'Employee Name', 'Role / Designation', 'Site'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.08em] first:w-12">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors duration-150
                      ${i % 2 !== 0 ? 'bg-bg-elevated/15' : ''}`}
                  >
                    <td className="px-5 py-3.5 text-[12px] text-ink-muted">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-bold text-primary uppercase shrink-0">
                          {emp.name[0]}
                        </div>
                        <span className="text-[13px] font-medium text-ink-primary">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-md bg-accent/10 text-accent">
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-secondary">
                      {resolveSite(emp) !== '—' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                          {resolveSite(emp)}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Employee Modal ─────────────────────────────────────────────── */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setAddModal(false)}
        >
          <div
            className="w-full max-w-sm bg-bg-surface border border-border rounded-2xl"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle">
              <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">
                Add Employee
              </h3>
              <button
                onClick={() => setAddModal(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className={inputCls}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">
                  Role / Designation
                </label>
                <input
                  type="text"
                  value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                  placeholder="e.g. Site Engineer, Mason"
                  className={inputCls}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">
                  Site
                </label>
                <select
                  value={formSiteId}
                  onChange={e => setFormSiteId(e.target.value)}
                  className={inputCls + ' appearance-none cursor-pointer'}
                >
                  <option value="">None</option>
                  {siteNames.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-[12px] text-danger">{formError}</p>}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setAddModal(false)}
                  className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
                    px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-60
                    text-white font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-colors duration-150"
                  style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30)' }}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving…' : 'Add Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
