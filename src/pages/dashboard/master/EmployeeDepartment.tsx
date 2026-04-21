import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Plus, Pencil, Trash2, Search, X,
  FileSpreadsheet, FileText, Loader2, AlertTriangle, ChevronRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'

interface Department {
  id: number
  name: string
  created_at: string
  employee_count: number
}

export default function EmployeeDepartment() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState('')

  // Modals
  const [addModal, setAddModal]           = useState(false)
  const [editTarget, setEditTarget]       = useState<Department | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<Department | null>(null)
  const [formName, setFormName]           = useState('')
  const [formError, setFormError]         = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [successMsg, setSuccessMsg]       = useState<string | null>(null)

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('departments')
        .select('id, name, created_at, employees(id)')
        .order('name')
      if (err) throw err
      const rows = (data ?? []).map((d: { id: number; name: string; created_at: string; employees: unknown[] }) => ({
        id: d.id,
        name: d.name,
        created_at: d.created_at,
        employee_count: Array.isArray(d.employees) ? d.employees.length : 0,
      }))
      setDepartments(rows)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search) return departments
    const q = search.toLowerCase()
    return departments.filter(d => d.name.toLowerCase().includes(q))
  }, [departments, search])

  // ── Add ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!formName.trim()) { setFormError('Name is required'); return }
    setSaving(true); setFormError(null)
    try {
      const { error: err } = await supabase.from('departments').insert({ name: formName.trim() })
      if (err) throw err
      setAddModal(false); setFormName(''); await load(); flash('Department added')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to add')
    } finally { setSaving(false) }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editTarget || !formName.trim()) { setFormError('Name is required'); return }
    setSaving(true); setFormError(null)
    try {
      const { error: err } = await supabase
        .from('departments').update({ name: formName.trim() }).eq('id', editTarget.id)
      if (err) throw err
      setEditTarget(null); setFormName(''); await load(); flash('Department updated')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to update')
    } finally { setSaving(false) }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.employee_count > 0) {
      setError(`Cannot delete "${deleteTarget.name}" — it has ${deleteTarget.employee_count} employee(s). Reassign them first.`)
      setDeleteTarget(null); return
    }
    setSaving(true)
    try {
      const { error: err } = await supabase.from('departments').delete().eq('id', deleteTarget.id)
      if (err) throw err
      setDeleteTarget(null); await load(); flash('Department deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally { setSaving(false) }
  }

  // ── Exports ──────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((d, i) => ({ '#': i + 1, 'Department': d.name, 'Employees': d.employee_count }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Departments')
    XLSX.writeFile(wb, 'employee_departments.xlsx')
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Rational Construction Pvt. Ltd.', 105, 15, { align: 'center' })
    doc.setFontSize(10); doc.setTextColor(120)
    doc.text('Employee Department List', 105, 23, { align: 'center' })
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 30,
      head: [['#', 'Department', 'Employees']],
      body: filtered.map((d, i) => [i + 1, d.name, d.employee_count]),
      theme: 'striped',
      headStyles: { fillColor: [90, 127, 255] },
      columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 30 } },
    })
    const total = doc.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
      doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150)
      doc.text(`Rational Construction Pvt. Ltd.  |  Page ${p} of ${total}`,
        105, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    }
    doc.save('employee_departments.pdf')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
            Employee Department
          </h2>
          <p className="text-ink-secondary text-[13px] mt-0.5">
            Click a department to view its employees.
          </p>
        </div>
        <button
          onClick={() => { setFormName(''); setFormError(null); setAddModal(true) }}
          className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white
            text-[13px] font-semibold px-4 py-2.5 rounded-xl
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
            transition-colors duration-150"
          style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30), inset 0 1px 0 rgba(255,255,255,0.12)' }}
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-xl px-4 py-3">
          <span className="text-[13px] text-success">{successMsg}</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span className="text-[13px] text-danger/90 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-danger/60 hover:text-danger transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
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
                placeholder="Search departments…"
                className="bg-bg-elevated border border-border rounded-xl pl-8 pr-3 py-2
                  text-[13px] text-ink-primary placeholder-ink-muted w-52
                  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                  transition-[border-color,box-shadow] duration-200"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-ink-muted hover:text-ink-secondary text-[12px] flex items-center gap-1 transition-colors"
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-ink-secondary text-[13px]">Loading departments…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Building2 className="w-8 h-8 text-ink-muted opacity-40" />
            <p className="text-ink-secondary text-[13px] font-medium">
              {search ? 'No departments match your search' : 'No departments yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filtered.map((dept, i) => (
              <div
                key={dept.id}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated/60
                  transition-colors duration-150 cursor-pointer group
                  ${i % 2 !== 0 ? 'bg-bg-elevated/15' : ''}`}
                onClick={() => navigate(`/dashboard/master/employee-department/${dept.id}`)}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0"
                  style={{ boxShadow: '0 2px 8px rgba(90,127,255,0.15)' }}>
                  <Building2 className="w-4 h-4 text-primary" />
                </div>

                {/* Name + count */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink-primary">{dept.name}</p>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    {dept.employee_count} employee{dept.employee_count !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink-secondary transition-colors duration-150 shrink-0 mr-1" />

                {/* Actions — stop propagation so row click doesn't fire */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditTarget(dept); setFormName(dept.name); setFormError(null) }}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent/10
                      transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(dept)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10
                      transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Modal ──────────────────────────────────────────────────────── */}
      {addModal && (
        <ModalBackdrop onClose={() => setAddModal(false)}>
          <ModalCard>
            <ModalHeader title="Add Department" onClose={() => setAddModal(false)} />
            <div className="px-6 py-5 space-y-4">
              <ModalField label="Department Name">
                <ModalInput
                  value={formName}
                  onChange={setFormName}
                  onEnter={handleAdd}
                  placeholder="e.g. Electrical"
                  autoFocus
                />
              </ModalField>
              {formError && <ModalError msg={formError} />}
              <ModalActions onCancel={() => setAddModal(false)} onSave={handleAdd} saving={saving} label="Add" />
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editTarget && (
        <ModalBackdrop onClose={() => setEditTarget(null)}>
          <ModalCard>
            <ModalHeader title="Rename Department" onClose={() => setEditTarget(null)} />
            <div className="px-6 py-5 space-y-4">
              <ModalField label="Department Name">
                <ModalInput
                  value={formName}
                  onChange={setFormName}
                  onEnter={handleEdit}
                  placeholder=""
                  autoFocus
                />
              </ModalField>
              {formError && <ModalError msg={formError} />}
              <ModalActions onCancel={() => setEditTarget(null)} onSave={handleEdit} saving={saving} label="Save" accent="accent" />
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      {deleteTarget && (
        <ModalBackdrop onClose={() => setDeleteTarget(null)}>
          <ModalCard>
            <ModalHeader title="Delete Department" onClose={() => setDeleteTarget(null)} />
            <div className="px-6 py-5 space-y-4">
              <div className="bg-danger/8 border border-danger/20 rounded-xl p-4">
                <p className="text-[13px] text-ink-secondary" style={{ lineHeight: 1.65 }}>
                  Delete <span className="font-semibold text-ink-primary">"{deleteTarget.name}"</span>?
                  {deleteTarget.employee_count > 0
                    ? <span className="text-danger font-medium"> This department has {deleteTarget.employee_count} employee(s) and cannot be deleted.</span>
                    : ' This action cannot be undone.'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
                    px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150"
                >
                  Cancel
                </button>
                {deleteTarget.employee_count === 0 && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="flex items-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-60
                      text-white font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-colors duration-150"
                    style={{ boxShadow: '0 4px 16px rgba(255,92,106,0.28)' }}
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}
    </div>
  )
}

// ── Shared modal primitives ───────────────────────────────────────────────
function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function ModalCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm bg-bg-surface border border-border rounded-2xl"
      style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle">
      <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">{title}</h3>
      <button onClick={onClose}
        className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

function ModalInput({ value, onChange, onEnter, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; onEnter: () => void
  placeholder: string; autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onEnter()}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
        text-[13.5px] text-ink-primary placeholder-ink-muted
        focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
        hover:border-border-bright transition-[border-color,box-shadow] duration-200"
    />
  )
}

function ModalError({ msg }: { msg: string }) {
  return <p className="text-[12px] text-danger">{msg}</p>
}

function ModalActions({ onCancel, onSave, saving, label, accent = 'primary' }: {
  onCancel: () => void; onSave: () => void; saving: boolean; label: string; accent?: string
}) {
  const colorCls = accent === 'accent'
    ? 'bg-accent hover:bg-accent-dark text-bg-base'
    : 'bg-primary hover:bg-primary-dark text-white'
  const shadowCls = accent === 'accent'
    ? '0 4px 16px rgba(255,181,71,0.25)'
    : '0 4px 16px rgba(90,127,255,0.30)'

  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      <button onClick={onCancel}
        className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
          px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150">
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className={`flex items-center gap-2 ${colorCls} disabled:opacity-60
          font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-colors duration-150`}
        style={{ boxShadow: shadowCls }}
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}
