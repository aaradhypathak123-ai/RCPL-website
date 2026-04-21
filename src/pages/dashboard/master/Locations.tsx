import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MapPin, Plus, Pencil, Trash2, Search, X,
  FileSpreadsheet, FileText, Loader2, AlertTriangle,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../lib/supabase'

interface State {
  id: number
  name: string
}

interface City {
  id: number
  name: string
  state_id: number
  states: { name: string } | null
}

interface LocationForm {
  city: string
  state_id: string
  new_state: string
  creating_state: boolean
}

const EMPTY_FORM: LocationForm = { city: '', state_id: '', new_state: '', creating_state: false }

const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`

export default function Locations() {
  const [cities, setCities]         = useState<City[]>([])
  const [states, setStates]         = useState<State[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search, setSearch]         = useState('')

  const [addModal, setAddModal]         = useState(false)
  const [editTarget, setEditTarget]     = useState<City | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<City | null>(null)
  const [form, setForm]                 = useState<LocationForm>(EMPTY_FORM)
  const [formError, setFormError]       = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cityRes, stateRes] = await Promise.all([
        supabase.from('cities').select('id, name, state_id, states(name)').order('name'),
        supabase.from('states').select('id, name').order('name'),
      ])
      if (cityRes.error)  throw cityRes.error
      if (stateRes.error) throw stateRes.error
      setCities((cityRes.data ?? []) as unknown as City[])
      setStates((stateRes.data ?? []) as State[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search) return cities
    const q = search.toLowerCase()
    return cities.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.states?.name ?? '').toLowerCase().includes(q)
    )
  }, [cities, search])

  // Resolve state_id — creates new state if user typed one
  const resolveStateId = async (): Promise<number | null> => {
    if (form.creating_state) {
      if (!form.new_state.trim()) { setFormError('State name is required'); return null }
      const { data, error: err } = await supabase
        .from('states')
        .insert({ name: form.new_state.trim() })
        .select('id')
        .single()
      if (err) { setFormError(err.message); return null }
      await load() // refresh states list
      return data.id as number
    }
    if (!form.state_id) { setFormError('State is required'); return null }
    return Number(form.state_id)
  }

  const handleAdd = async () => {
    if (!form.city.trim()) { setFormError('City name is required'); return }
    setSaving(true); setFormError(null)
    try {
      const stateId = await resolveStateId()
      if (stateId === null) { setSaving(false); return }
      const { error: err } = await supabase.from('cities').insert({
        name: form.city.trim(),
        state_id: stateId,
      })
      if (err) throw err
      setAddModal(false); setForm(EMPTY_FORM); await load(); flash('Location added')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to add')
    } finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!editTarget)         return
    if (!form.city.trim())   { setFormError('City name is required'); return }
    setSaving(true); setFormError(null)
    try {
      const stateId = await resolveStateId()
      if (stateId === null) { setSaving(false); return }
      const { error: err } = await supabase.from('cities').update({
        name: form.city.trim(),
        state_id: stateId,
      }).eq('id', editTarget.id)
      if (err) throw err
      setEditTarget(null); setForm(EMPTY_FORM); await load(); flash('Location updated')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to update')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { error: err } = await supabase.from('cities').delete().eq('id', deleteTarget.id)
      if (err) throw err
      setDeleteTarget(null); await load(); flash('Location deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
      setDeleteTarget(null)
    } finally { setSaving(false) }
  }

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((c, i) => ({ '#': i + 1, 'City': c.name, 'State': c.states?.name ?? '—' }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Locations')
    XLSX.writeFile(wb, 'locations.xlsx')
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Rational Construction Pvt. Ltd.', 105, 15, { align: 'center' })
    doc.setFontSize(10); doc.setTextColor(120)
    doc.text('Locations List', 105, 23, { align: 'center' })
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 30,
      head: [['#', 'City', 'State']],
      body: filtered.map((c, i) => [i + 1, c.name, c.states?.name ?? '—']),
      theme: 'striped',
      headStyles: { fillColor: [90, 127, 255] },
      columnStyles: { 0: { cellWidth: 12 } },
    })
    const total = doc.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
      doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150)
      doc.text(`Rational Construction Pvt. Ltd.  |  Page ${p} of ${total}`,
        105, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    }
    doc.save('locations.pdf')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
            Locations
          </h2>
          <p className="text-ink-secondary text-[13px] mt-0.5">
            Manage operational cities and states.
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(null); setAddModal(true) }}
          className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white
            text-[13px] font-semibold px-4 py-2.5 rounded-xl
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
            transition-colors duration-150"
          style={{ boxShadow: '0 4px 16px rgba(90,127,255,0.30), inset 0 1px 0 rgba(255,255,255,0.12)' }}
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
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
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search city or state…"
                className="bg-bg-elevated border border-border rounded-xl pl-8 pr-3 py-2
                  text-[13px] text-ink-primary placeholder-ink-muted w-56
                  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                  transition-[border-color,box-shadow] duration-200"
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')}
                className="text-ink-muted hover:text-ink-secondary text-[12px] flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success
                border border-success/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 bg-danger/15 hover:bg-danger/25 text-danger
                border border-danger/25 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-ink-secondary text-[13px]">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <MapPin className="w-8 h-8 text-ink-muted opacity-40" />
            <p className="text-ink-secondary text-[13px] font-medium">
              {search ? 'No locations match your search' : 'No locations yet — add one above'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.08em] w-12">#</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.08em]">City</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.08em]">State</th>
                  <th className="px-5 py-3 w-px" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((city, i) => (
                  <tr key={city.id}
                    className={`border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors duration-150
                      ${i % 2 !== 0 ? 'bg-bg-elevated/15' : ''}`}>
                    <td className="px-5 py-3.5 text-[12px] text-ink-muted">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-[13px] font-medium text-ink-primary">{city.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-md bg-accent/10 text-accent">
                        {city.states?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditTarget(city)
                            setForm({ city: city.name, state_id: String(city.state_id), new_state: '', creating_state: false })
                            setFormError(null)
                          }}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent/10
                            transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(city)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10
                            transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
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
        )}
      </div>

      {/* Add Modal */}
      {addModal && (
        <Modal onClose={() => setAddModal(false)} title="Add Location">
          <LocationFormFields form={form} setForm={setForm} states={states} />
          {formError && <p className="text-[12px] text-danger">{formError}</p>}
          <ModalActions onCancel={() => setAddModal(false)} onSave={handleAdd} saving={saving} label="Add" />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal onClose={() => setEditTarget(null)} title="Edit Location">
          <LocationFormFields form={form} setForm={setForm} states={states} />
          {formError && <p className="text-[12px] text-danger">{formError}</p>}
          <ModalActions onCancel={() => setEditTarget(null)} onSave={handleEdit} saving={saving} label="Save" accent="accent" />
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} title="Delete Location">
          <div className="bg-danger/8 border border-danger/20 rounded-xl p-4">
            <p className="text-[13px] text-ink-secondary" style={{ lineHeight: 1.65 }}>
              Delete <span className="font-semibold text-ink-primary">"{deleteTarget.name}"</span>?
              This action cannot be undone.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={() => setDeleteTarget(null)}
              className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
                px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={saving}
              className="flex items-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-60
                text-white font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-colors duration-150"
              style={{ boxShadow: '0 4px 16px rgba(255,92,106,0.28)' }}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Location form fields ──────────────────────────────────────────────────
function LocationFormFields({ form, setForm, states }: {
  form: LocationForm
  setForm: React.Dispatch<React.SetStateAction<LocationForm>>
  states: State[]
}) {
  return (
    <>
      <div>
        <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em] mb-2">
          City Name
        </label>
        <input
          type="text" value={form.city}
          onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          placeholder="e.g. Prayagraj"
          className={inputCls} autoFocus
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
            State
          </label>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, creating_state: !f.creating_state, state_id: '', new_state: '' }))}
            className="text-[11px] text-primary hover:text-primary-light transition-colors"
          >
            {form.creating_state ? '← Select existing' : '+ New state'}
          </button>
        </div>
        {form.creating_state ? (
          <input
            type="text" value={form.new_state}
            onChange={e => setForm(f => ({ ...f, new_state: e.target.value }))}
            placeholder="e.g. Rajasthan"
            className={inputCls}
          />
        ) : (
          <select
            value={form.state_id}
            onChange={e => setForm(f => ({ ...f, state_id: e.target.value }))}
            className={`${inputCls} cursor-pointer appearance-none`}
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748B\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            <option value="">— Select State —</option>
            {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
    </>
  )
}

// ── Modal primitives ──────────────────────────────────────────────────────
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full max-w-sm bg-bg-surface border border-border rounded-2xl"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-subtle">
          <h3 className="font-display text-[15px] font-bold text-ink-primary tracking-[-0.02em]">{title}</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onSave, saving, label, accent = 'primary' }: {
  onCancel: () => void; onSave: () => void; saving: boolean; label: string; accent?: string
}) {
  const colorCls = accent === 'accent' ? 'bg-accent hover:bg-accent-dark text-bg-base' : 'bg-primary hover:bg-primary-dark text-white'
  const shadow   = accent === 'accent' ? '0 4px 16px rgba(255,181,71,0.25)' : '0 4px 16px rgba(90,127,255,0.30)'
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      <button onClick={onCancel}
        className="text-[13px] font-medium text-ink-secondary hover:text-ink-primary
          px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors duration-150">
        Cancel
      </button>
      <button onClick={onSave} disabled={saving}
        className={`flex items-center gap-2 ${colorCls} disabled:opacity-60
          font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-colors duration-150`}
        style={{ boxShadow: shadow }}>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}
