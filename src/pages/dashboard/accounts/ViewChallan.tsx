import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, AlertTriangle,
  Download, ImageIcon, FileText, Pencil,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChallanItem {
  id:          number
  sr_no:       number
  particulars: string
  hsn:         string | null
  unit:        string | null
  qty:         number
  rate:        number
  value:       number
}

interface Challan {
  id:                  number
  challan_no:          string
  date:                string
  note:                string | null
  eway_bill_no:        string | null
  transportation_mode: string | null
  photo_url:           string | null
  document_url:        string | null
  created_at:          string
  from_project:        { name: string } | null
  to_project:          { name: string } | null
  challan_items:       ChallanItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fieldLabel = 'text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em]'
const fieldValue = 'text-[14px] font-semibold text-ink-primary mt-1'

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <p className={fieldLabel}>{label}</p>
      <p className={fieldValue}>{value}</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ViewChallan() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()

  const [challan,  setChallan]  = useState<Challan | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [downloading,  setDownloading]  = useState<'photo' | 'doc' | null>(null)
  const downloadFile = async (url: string, label: 'photo' | 'doc') => {
    setDownloading(label)
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const burl = URL.createObjectURL(blob)
      const name = decodeURIComponent(url.split('/').pop() ?? 'download').replace(/^\d+_/, '')
      const a    = document.createElement('a')
      a.href     = burl
      a.download = name
      a.click()
      URL.revokeObjectURL(burl)
    } catch {
      console.error('[download] failed for', url)
    } finally {
      setDownloading(null)
    }
  }

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const { data, error: err } = await supabase
      .from('challans')
      .select(`
        id, challan_no, date, note, eway_bill_no, transportation_mode,
        photo_url, document_url, created_at,
        from_project:from_project_id ( name ),
        to_project:to_project_id     ( name ),
        challan_items (
          id, sr_no, particulars, hsn, unit, qty, rate, value
        )
      `)
      .eq('id', id)
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any
    const shaped: Challan = {
      ...raw,
      from_project: Array.isArray(raw.from_project) ? raw.from_project[0] ?? null : raw.from_project,
      to_project:   Array.isArray(raw.to_project)   ? raw.to_project[0]   ?? null : raw.to_project,
      challan_items: (raw.challan_items ?? []).slice().sort(
        (a: ChallanItem, b: ChallanItem) => a.sr_no - b.sr_no
      ),
    }

    setChallan(shaped)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  if (error || !challan) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <AlertTriangle className="w-8 h-8 text-danger" />
      <p className="text-danger text-[13px]">{error ?? 'Challan not found.'}</p>
      <button
        onClick={() => navigate('/dashboard/accounts/invoices')}
        className="text-primary text-[13px] underline"
      >
        Back to Challan List
      </button>
    </div>
  )

  const totalValue = challan.challan_items.reduce(
    (s, item) => s + Number(item.value ?? 0), 0
  )

  const hasExtras = challan.note || challan.eway_bill_no || challan.transportation_mode
  const hasAttachments = challan.photo_url || challan.document_url

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/accounts/invoices')}
            className="p-2 rounded-xl text-ink-muted hover:text-ink-secondary hover:bg-bg-elevated
              border border-transparent hover:border-border transition-colors duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
              Accounts&nbsp;#{challan.challan_no}
            </h2>
            <p className="text-ink-muted text-[13px] mt-0.5">{challan.date}</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/dashboard/accounts/invoices/${id}/edit`)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border
            bg-bg-elevated hover:bg-bg-floating text-ink-secondary text-[13px] font-medium
            transition-colors duration-150"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* Main card */}
      <div
        className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >

        {/* ── Top info strip ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border divide-x divide-border-subtle">
          <InfoCell label="From Project" value={challan.from_project?.name ?? '—'} />
          <InfoCell label="To Project"   value={challan.to_project?.name   ?? '—'} />
          <InfoCell label="Challan No"   value={challan.challan_no} />
          <InfoCell label="Date"         value={challan.date} />
        </div>

        {/* ── Items table ─────────────────────────────────────────────── */}
        <div className="p-5 space-y-3">
          <p className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.08em]">Items</p>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-elevated/60">
                  {['Sr', 'Particulars', 'HSN', 'Unit', 'Qty', 'Rate (₹)', 'Value (₹)'].map(h => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 text-[10px] font-semibold text-ink-muted uppercase
                        tracking-[0.08em] ${h === 'Value (₹)' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border-subtle">
                {challan.challan_items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-ink-muted text-[13px]">
                      No items recorded.
                    </td>
                  </tr>
                ) : (
                  challan.challan_items.map(item => (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 text-ink-muted">{item.sr_no}</td>
                      <td className="px-3 py-2.5 text-ink-primary font-medium">{item.particulars}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{item.hsn  ?? '—'}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{item.unit ?? '—'}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{item.qty}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">
                        {Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-primary font-semibold">
                        ₹&nbsp;{Number(item.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Total row */}
              <tfoot>
                <tr className="border-t border-border bg-bg-elevated/40">
                  <td colSpan={6} className="px-3 py-3 text-right text-[11px] font-bold text-ink-secondary uppercase tracking-wider">
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right text-[15px] font-bold text-ink-primary">
                    ₹&nbsp;{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Extra fields ─────────────────────────────────────────────── */}
        {hasExtras && (
          <div className="border-t border-border p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {challan.note && (
              <div className="sm:col-span-3">
                <p className={fieldLabel}>Note</p>
                <p className="text-[13px] text-ink-secondary mt-1.5 leading-relaxed">{challan.note}</p>
              </div>
            )}
            {challan.eway_bill_no && (
              <div>
                <p className={fieldLabel}>E-way Bill No.</p>
                <p className={fieldValue}>{challan.eway_bill_no}</p>
              </div>
            )}
            {challan.transportation_mode && (
              <div>
                <p className={fieldLabel}>Transportation Mode</p>
                <p className={fieldValue}>{challan.transportation_mode}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Attachments ──────────────────────────────────────────────── */}
        {hasAttachments && (
          <div className="border-t border-border p-5 space-y-3">
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.08em]">
              Attachments
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {challan.photo_url && (
                <button
                  onClick={() => downloadFile(challan.photo_url!, 'photo')}
                  disabled={downloading !== null}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border
                    bg-bg-elevated hover:bg-bg-floating text-ink-secondary text-[13px] font-medium
                    disabled:opacity-60 transition-colors duration-150
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                  Download Photo
                  {downloading === 'photo'
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-muted" />
                    : <Download className="w-3.5 h-3.5 text-ink-muted" />}
                </button>
              )}
              {challan.document_url && (
                <button
                  onClick={() => downloadFile(challan.document_url!, 'doc')}
                  disabled={downloading !== null}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border
                    bg-bg-elevated hover:bg-bg-floating text-ink-secondary text-[13px] font-medium
                    disabled:opacity-60 transition-colors duration-150
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <FileText className="w-4 h-4 text-accent shrink-0" />
                  Download Document
                  {downloading === 'doc'
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-muted" />
                    : <Download className="w-3.5 h-3.5 text-ink-muted" />}
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
