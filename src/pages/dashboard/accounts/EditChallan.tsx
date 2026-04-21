import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, X, Loader2, AlertTriangle,
  CheckCircle2, Upload,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project { id: number; name: string }

interface ItemRow {
  uid:         string
  dbId?:       number   // existing DB row id (undefined for newly added rows)
  particulars: string
  hsn:         string
  unit:        string
  qty:         string
  rate:        string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genUid() { return Math.random().toString(36).slice(2, 9) }
const emptyRow = (): ItemRow => ({
  uid: genUid(), particulars: '', hsn: '', unit: '', qty: '', rate: '',
})
function rowValue(row: ItemRow) {
  return parseFloat(row.qty || '0') * parseFloat(row.rate || '0')
}
function fileName(url: string) {
  try { return decodeURIComponent(url.split('/').pop() ?? url).replace(/^\d+_/, '') }
  catch { return url }
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const labelCls  = 'block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]'
const inputCls  = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`
const selectCls = inputCls + ' appearance-none cursor-pointer'
const thCls     = 'px-3 py-2.5 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]'
const cellInput = `w-full bg-transparent border border-transparent rounded-lg px-2 py-1.5
  text-[13px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/40 focus:bg-bg-elevated
  transition-[border-color,background-color] duration-150`

// ── Component ─────────────────────────────────────────────────────────────────
export default function EditChallan() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Form state
  const [projects,      setProjects]      = useState<Project[]>([])
  const [fromProjectId, setFromProjectId] = useState('')
  const [toProjectId,   setToProjectId]   = useState('')
  const [challanNo,     setChallanNo]     = useState('')
  const [date,          setDate]          = useState('')
  const [items,         setItems]         = useState<ItemRow[]>([emptyRow()])
  const [note,          setNote]          = useState('')
  const [ewayBill,      setEwayBill]      = useState('')
  const [transportMode, setTransportMode] = useState('')
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)
  const [docFile,       setDocFile]       = useState<File | null>(null)
  // keep track of existing URLs so we preserve them if no new file is chosen
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [existingDocUrl,   setExistingDocUrl]   = useState<string | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const photoRef = useRef<HTMLInputElement>(null)
  const docRef   = useRef<HTMLInputElement>(null)

  // ── Load projects + existing challan ──────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!id) return

    const [projRes, challanRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('name'),
      supabase
        .from('challans')
        .select(`
          id, challan_no, date, note, eway_bill_no, transportation_mode,
          photo_url, document_url,
          from_project_id, to_project_id,
          challan_items ( id, sr_no, particulars, hsn, unit, qty, rate, value )
        `)
        .eq('id', id)
        .single(),
    ])

    setProjects(projRes.data ?? [])

    if (challanRes.error) {
      setError(challanRes.error.message)
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = challanRes.data as any
    setFromProjectId(String(c.from_project_id ?? ''))
    setToProjectId(String(c.to_project_id ?? ''))
    setChallanNo(c.challan_no ?? '')
    setDate(c.date ?? '')
    setNote(c.note ?? '')
    setEwayBill(c.eway_bill_no ?? '')
    setTransportMode(c.transportation_mode ?? '')
    setExistingPhotoUrl(c.photo_url ?? null)
    setExistingDocUrl(c.document_url ?? null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadedItems: ItemRow[] = (c.challan_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .slice().sort((a: any, b: any) => a.sr_no - b.sr_no)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        uid:         genUid(),
        dbId:        item.id,
        particulars: item.particulars ?? '',
        hsn:         item.hsn  ?? '',
        unit:        item.unit ?? '',
        qty:         String(item.qty  ?? ''),
        rate:        String(item.rate ?? ''),
      }))

    setItems(loadedItems.length > 0 ? loadedItems : [emptyRow()])
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // ── Item helpers ─────────────────────────────────────────────────────────
  const updateItem = (uid: string, field: keyof ItemRow, value: string) =>
    setItems(prev => prev.map(r => r.uid === uid ? { ...r, [field]: value } : r))

  const removeItem = (uid: string) =>
    setItems(prev => prev.length > 1 ? prev.filter(r => r.uid !== uid) : prev)

  const addItem = () => setItems(prev => [...prev, emptyRow()])

  const grandTotal = items.reduce((s, r) => s + rowValue(r), 0)

  // ── File upload ───────────────────────────────────────────────────────────
  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const path = `${prefix}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage
      .from('challan-attachments')
      .upload(path, file, { upsert: true })
    if (upErr) { console.error('[upload]', upErr.message); return null }
    return supabase.storage.from('challan-attachments').getPublicUrl(path).data.publicUrl
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!fromProjectId || !toProjectId || !challanNo.trim() || !date) {
      setError('From Project, To Project, Challan No, and Date are required.')
      return
    }

    setSaving(true)
    setError(null)

    // Upload new files only if user selected them; otherwise keep existing URLs
    const photoUrl    = photoFile ? await uploadFile(photoFile, 'photos')    : existingPhotoUrl
    const documentUrl = docFile   ? await uploadFile(docFile,   'documents') : existingDocUrl

    // 1. Update challan header
    const { error: challanErr } = await supabase
      .from('challans')
      .update({
        from_project_id:     parseInt(fromProjectId),
        to_project_id:       parseInt(toProjectId),
        challan_no:          challanNo.trim(),
        date,
        note:                note.trim()           || null,
        eway_bill_no:        ewayBill.trim()       || null,
        transportation_mode: transportMode.trim()  || null,
        photo_url:           photoUrl,
        document_url:        documentUrl,
      })
      .eq('id', id!)

    if (challanErr) { setError(challanErr.message); setSaving(false); return }

    // 2. Delete all existing items then re-insert (simplest correct approach)
    const { error: deleteErr } = await supabase
      .from('challan_items')
      .delete()
      .eq('challan_id', id!)

    if (deleteErr) { setError(deleteErr.message); setSaving(false); return }

    // 3. Insert updated items
    const validItems = items.filter(r => r.particulars.trim())
    if (validItems.length > 0) {
      const { error: itemsErr } = await supabase.from('challan_items').insert(
        validItems.map((r, idx) => ({
          challan_id:  parseInt(id!),
          sr_no:       idx + 1,
          particulars: r.particulars.trim(),
          hsn:         r.hsn.trim()  || null,
          unit:        r.unit.trim() || null,
          qty:         parseFloat(r.qty  || '0'),
          rate:        parseFloat(r.rate || '0'),
          value:       rowValue(r),
        }))
      )
      if (itemsErr) { setError(itemsErr.message); setSaving(false); return }
    }

    navigate(`/dashboard/accounts/invoices/${id}`)
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/dashboard/accounts/invoices/${id}`)}
          className="p-2 rounded-xl text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated
            border border-transparent hover:border-border transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
            Edit Challan
          </h2>
          <p className="text-ink-muted text-[13px] mt-0.5">Update the details below</p>
        </div>
      </div>

      {/* Form card */}
      <div
        className="bg-bg-surface border border-border rounded-2xl p-6 space-y-6"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >

        {/* ── Row 1: From / To Project ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelCls}>From Project <span className="text-danger normal-case">*</span></label>
            <select value={fromProjectId} onChange={e => setFromProjectId(e.target.value)} className={selectCls}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>To Project <span className="text-danger normal-case">*</span></label>
            <select value={toProjectId} onChange={e => setToProjectId(e.target.value)} className={selectCls}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── Row 2: Challan No / Date ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelCls}>Challan No <span className="text-danger normal-case">*</span></label>
            <input
              type="text" value={challanNo}
              onChange={e => setChallanNo(e.target.value)}
              placeholder="e.g. CH-2024-001" className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Date <span className="text-danger normal-case">*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="h-px bg-border-subtle" />

        {/* ── Items table ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-ink-secondary uppercase tracking-[0.1em]">Items</p>
            <span className="text-[12px] text-ink-muted">
              Total:&nbsp;
              <span className="text-ink-primary font-semibold">
                ₹&nbsp;{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-elevated/60">
                  <th className={`${thCls} w-10 text-center`}>Sr</th>
                  <th className={thCls}>Particulars</th>
                  <th className={`${thCls} w-28`}>HSN</th>
                  <th className={`${thCls} w-24`}>Unit</th>
                  <th className={`${thCls} w-24`}>Qty</th>
                  <th className={`${thCls} w-28`}>Rate (₹)</th>
                  <th className={`${thCls} w-32 text-right`}>Value (₹)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {items.map((row, idx) => {
                  const val = rowValue(row)
                  return (
                    <tr key={row.uid}>
                      <td className="px-3 py-2 text-center text-ink-muted text-[12px]">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <input value={row.particulars}
                          onChange={e => updateItem(row.uid, 'particulars', e.target.value)}
                          placeholder="Description" className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.hsn}
                          onChange={e => updateItem(row.uid, 'hsn', e.target.value)}
                          placeholder="HSN" className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.unit}
                          onChange={e => updateItem(row.uid, 'unit', e.target.value)}
                          placeholder="Nos" className={cellInput} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={row.qty} min="0"
                          onChange={e => updateItem(row.uid, 'qty', e.target.value)}
                          placeholder="0" className={cellInput + ' text-right'} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={row.rate} min="0" step="0.01"
                          onChange={e => updateItem(row.uid, 'rate', e.target.value)}
                          placeholder="0.00" className={cellInput + ' text-right'} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-ink-primary">
                        {val > 0
                          ? val.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                          : <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeItem(row.uid)} disabled={items.length === 1}
                          className="p-1 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10
                            disabled:opacity-30 transition-colors duration-150" title="Remove row">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={addItem}
            className="flex items-center gap-2 text-primary text-[13px] font-medium px-3 py-2
              rounded-xl hover:bg-primary/10 transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Plus className="w-4 h-4" />
            Add More
          </button>
        </div>

        <div className="h-px bg-border-subtle" />

        {/* ── Bottom fields ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="sm:col-span-2 space-y-2">
            <label className={labelCls}>Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={3} placeholder="Optional note…" className={inputCls + ' resize-none'} />
          </div>

          <div className="space-y-2">
            <label className={labelCls}>E-way Bill No.</label>
            <input type="text" value={ewayBill} onChange={e => setEwayBill(e.target.value)}
              placeholder="e.g. EWB-XXXX" className={inputCls} />
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Transportation Mode</label>
            <input type="text" value={transportMode} onChange={e => setTransportMode(e.target.value)}
              placeholder="e.g. Road, Rail, Air" className={inputCls} />
          </div>

          {/* Attach Photo */}
          <div className="space-y-2">
            <label className={labelCls}>Attach Photo</label>
            {existingPhotoUrl && !photoFile && (
              <p className="text-[11px] text-ink-muted mb-1 truncate">
                Current: {fileName(existingPhotoUrl)}
              </p>
            )}
            <div className="flex items-center gap-3">
              <input ref={photoRef} id="photo-upload-edit" type="file" accept="image/*"
                onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} className="hidden" />
              <label htmlFor="photo-upload-edit"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border
                  bg-bg-elevated hover:bg-bg-floating text-ink-secondary text-[13px] font-medium
                  cursor-pointer transition-colors duration-150 min-w-0 max-w-xs truncate">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {photoFile ? photoFile.name : existingPhotoUrl ? 'Replace photo…' : 'Choose photo…'}
                </span>
              </label>
              {photoFile && (
                <button onClick={() => { setPhotoFile(null); if (photoRef.current) photoRef.current.value = '' }}
                  className="p-1.5 text-ink-muted hover:text-danger transition-colors duration-150 shrink-0" title="Remove">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Attach Document */}
          <div className="space-y-2">
            <label className={labelCls}>Attach Document</label>
            {existingDocUrl && !docFile && (
              <p className="text-[11px] text-ink-muted mb-1 truncate">
                Current: {fileName(existingDocUrl)}
              </p>
            )}
            <div className="flex items-center gap-3">
              <input ref={docRef} id="doc-upload-edit" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="hidden" />
              <label htmlFor="doc-upload-edit"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border
                  bg-bg-elevated hover:bg-bg-floating text-ink-secondary text-[13px] font-medium
                  cursor-pointer transition-colors duration-150 min-w-0 max-w-xs truncate">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {docFile ? docFile.name : existingDocUrl ? 'Replace document…' : 'Choose document…'}
                </span>
              </label>
              {docFile && (
                <button onClick={() => { setDocFile(null); if (docRef.current) docRef.current.value = '' }}
                  className="p-1.5 text-ink-muted hover:text-danger transition-colors duration-150 shrink-0" title="Remove">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
            <span className="text-[13px] text-danger/90 leading-snug">{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-success hover:bg-success/80
              text-white font-semibold text-[14px]
              disabled:opacity-60 disabled:cursor-not-allowed
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50
              transition-colors duration-150"
            style={{ boxShadow: '0 4px 16px rgba(52,211,153,0.25)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          <button onClick={() => navigate(`/dashboard/accounts/invoices/${id}`)} disabled={saving}
            className="px-6 py-3 rounded-xl border border-border text-ink-secondary font-semibold
              text-[14px] hover:bg-white/[0.04] disabled:opacity-60 transition-colors duration-150">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
