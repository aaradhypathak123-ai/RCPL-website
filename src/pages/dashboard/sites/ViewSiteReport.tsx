import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertTriangle, Pencil } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type MatKey = 'diesel' | 'cement' | 'agg20' | 'agg10' | 'sand' | 'brick' | 'tmt10' | 'tmt12' | 'tmt16' | 'tmt20' | 'tmt25' | 'tmt32'
const MAT_LABELS: Record<MatKey, string> = {
  diesel: 'Diesel', cement: 'Cement',
  agg20: '20mm Aggregate', agg10: '10mm Aggregate', sand: 'Course Sand',
  brick: 'Brick (NOS)',
  tmt10: 'TMT Bar 10mm (TON)', tmt12: 'TMT Bar 12mm (TON)', tmt16: 'TMT Bar 16mm (TON)',
  tmt20: 'TMT Bar 20mm (TON)', tmt25: 'TMT Bar 25mm (TON)', tmt32: 'TMT Bar 32mm (TON)',
}
const OLD_MAT_KEYS: MatKey[] = ['diesel', 'cement', 'agg20', 'agg10', 'sand']
const NEW_MAT_KEYS: MatKey[] = ['brick', 'tmt10', 'tmt12', 'tmt16', 'tmt20', 'tmt25', 'tmt32']
const ALL_MAT_KEYS: MatKey[] = [...OLD_MAT_KEYS, ...NEW_MAT_KEYS]
const NEW_MAT_SET  = new Set<MatKey>(NEW_MAT_KEYS)

interface Report {
  id:                   number
  date:                 string | null
  site_name:            string | null
  no_of_labours:        number | null
  opening_balance:      number | null
  close_balance:        number | null
  concreting:           string | null
  concreting_qty:       string | null
  visitor:              string | null
  work_done:            string | null
  work_next_day:        string | null
  requirement:          string | null
  remark:               string | null
  comment:              string | null
  project_name:         string | null
  reporter_name:        string | null
  attendance:           { employee_name: string }[]
  labours:              { name: string; designation: string | null }[]
  purchases:            { item: string; amount: number | null }[]
  machines:             { machine_name: string; dg_opening: number | null; dg_closing: number | null; running_hours: number | null }[]
  mats:                 Record<MatKey, { credit: number | null; consumed: number | null; stock: number | null; opBal: number | null; clBal: number | null; message: string | null }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtNum(n: number | null) {
  return n !== null && n !== undefined ? String(n) : '—'
}

function fmtCurrency(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted whitespace-nowrap">{title}</p>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1">{label}</p>
      <p className="text-[13.5px] text-ink-primary font-medium" style={{ lineHeight: 1.6 }}>{value ?? '—'}</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ViewSiteReport() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [report,  setReport]  = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)

    const { data, error: err } = await supabase
      .from('site_reports')
      .select(`
        *,
        projects:from_project_id ( name ),
        profiles:reported_by ( full_name ),
        site_report_attendance ( employee_id, employees:employee_id ( name ) ),
        site_report_labours ( name, designation ),
        site_report_purchases ( item, amount ),
        site_report_machines ( dg_opening, dg_closing, running_hours, machine:machine_name_id ( name ) )
      `)
      .eq('id', Number(id))
      .single()

    if (err || !data) { setError(err?.message ?? 'Report not found.'); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any

    const resolve = (v: unknown) =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

    const mapped: Report = {
      id:                   d.id,
      date:                 d.date,
      site_name:            d.site_name,
      no_of_labours:        d.no_of_labours,
      opening_balance:      d.opening_balance,
      close_balance:        d.close_balance,
      concreting:           d.concreting,
      concreting_qty:       d.concreting_qty,
      visitor:              d.visitor,
      work_done:            d.work_done,
      work_next_day:        d.work_next_day,
      requirement:          d.requirement,
      remark:               d.remark,
      comment:              d.comment,
      project_name:  resolve(d.projects)?.name  ?? null,
      reporter_name: resolve(d.profiles)?.full_name ?? null,
      attendance: (d.site_report_attendance ?? []).map((a: any) => ({
        employee_name: resolve(a.employees)?.name ?? `ID ${a.employee_id}`,
      })),
      labours:   (d.site_report_labours   ?? []),
      purchases: (d.site_report_purchases ?? []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      machines: (d.site_report_machines ?? []).map((m: any) => ({
        machine_name:  (Array.isArray(m.machine) ? m.machine[0]?.name : m.machine?.name) ?? '—',
        dg_opening:    m.dg_opening  ?? null,
        dg_closing:    m.dg_closing  ?? null,
        running_hours: m.running_hours ?? null,
      })),
      mats: {
        // Old 5 materials use _stock column
        ...OLD_MAT_KEYS.reduce((acc, k) => {
          acc[k] = {
            credit:   d[`${k}_credit`]   ?? null,
            consumed: d[`${k}_consumed`] ?? null,
            stock:    d[`${k}_stock`]    ?? null,
            opBal:    null,
            clBal:    null,
            message:  d[`${k}_message`]  ?? null,
          }
          return acc
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, {} as any),
        // New 7 materials use _op_bal / _cl_bal columns
        ...NEW_MAT_KEYS.reduce((acc, k) => {
          acc[k] = {
            credit:   d[`${k}_credit`]   ?? null,
            consumed: d[`${k}_consumed`] ?? null,
            stock:    null,
            opBal:    d[`${k}_op_bal`]   ?? null,
            clBal:    d[`${k}_cl_bal`]   ?? null,
            message:  d[`${k}_message`]  ?? null,
          }
          return acc
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, {} as any),
      } as Report['mats'],
    }
    setReport(mapped)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  )

  if (error || !report) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <AlertTriangle className="w-8 h-8 text-danger" />
      <p className="text-danger text-[13px]">{error ?? 'Not found.'}</p>
      <button onClick={() => navigate('/dashboard/sites/site-report')}
        className="text-primary text-[13px] underline">← Back to list</button>
    </div>
  )

  const hasMats = ALL_MAT_KEYS.some(k => {
    const m = report.mats[k]
    return m.credit !== null || m.consumed !== null ||
           m.stock !== null || m.opBal !== null || m.clBal !== null || !!m.message
  })

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/sites/site-report')}
            className="p-2 rounded-xl bg-bg-elevated border border-border text-ink-muted
              hover:text-ink-primary hover:border-border-bright transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em]">
              Site Report
            </h2>
            <p className="text-ink-muted text-[13px] mt-0.5">
              {report.project_name ?? 'Unknown project'} · {fmtDate(report.date)}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/dashboard/sites/site-report/edit/${report.id}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark
            text-white text-[13px] font-semibold transition-colors duration-150"
          style={{ boxShadow: '0 4px 14px rgba(90,127,255,0.30)' }}
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      {/* ── Basic Info ── */}
      <Section title="Basic Information">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5">
          <Field label="From Project"  value={report.project_name} />
          <Field label="Name of Site"  value={report.site_name} />
          <Field label="Reported By"   value={report.reporter_name} />
          <Field label="Date"          value={fmtDate(report.date)} />
        </div>
      </Section>

      {/* ── Attendance ── */}
      {report.attendance.length > 0 && (
        <Section title="Attendance of Site">
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-bg-elevated/60 border-b border-border">
                  <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">#</th>
                  <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Employee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {report.attendance.map((a, i) => (
                  <tr key={i} className={i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}>
                    <td className="px-4 py-2.5 text-ink-muted text-[12px]">{i + 1}</td>
                    <td className="px-4 py-2.5 text-ink-primary font-medium">{a.employee_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Labourers ── */}
      {(report.no_of_labours !== null || report.labours.length > 0) && (
        <Section title="Labourers / Mistri / Driver">
          <div className="space-y-4">
            {report.no_of_labours !== null && (
              <div className="max-w-xs">
                <Field label="No. of Labours / Mistri / Driver or Others" value={fmtNum(report.no_of_labours)} />
              </div>
            )}
            {report.labours.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-bg-elevated/60 border-b border-border">
                      <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">#</th>
                      <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Name</th>
                      <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Designation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {report.labours.map((l, i) => (
                      <tr key={i} className={i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}>
                        <td className="px-4 py-2.5 text-ink-muted text-[12px]">{i + 1}</td>
                        <td className="px-4 py-2.5 text-ink-primary font-medium">{l.name}</td>
                        <td className="px-4 py-2.5 text-ink-secondary">{l.designation ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Purchases ── */}
      {report.purchases.length > 0 && (
        <Section title="Purchase (Expense)">
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-bg-elevated/60 border-b border-border">
                  <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">#</th>
                  <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Item</th>
                  <th className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {report.purchases.map((p, i) => (
                  <tr key={i} className={i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}>
                    <td className="px-4 py-2.5 text-ink-muted text-[12px]">{i + 1}</td>
                    <td className="px-4 py-2.5 text-ink-primary font-medium">{p.item}</td>
                    <td className="px-4 py-2.5 text-ink-secondary">{fmtCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Financial ── */}
      <Section title="Financial">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 max-w-sm">
          <Field label="Opening Balance (₹)" value={fmtCurrency(report.opening_balance)} />
          <Field label="Close Balance (₹)"   value={fmtCurrency(report.close_balance)} />
        </div>
      </Section>

      {/* ── Materials ── */}
      {hasMats && (
        <Section title="Materials">
          <div className="space-y-3">
            {ALL_MAT_KEYS.map((k, i) => {
              const m = report.mats[k]
              const isEmpty = m.credit === null && m.consumed === null &&
                              m.stock === null && m.opBal === null && m.clBal === null && !m.message
              if (isEmpty) return null
              const isNew = NEW_MAT_SET.has(k)
              return (
                <div key={k} className={`rounded-xl border border-border p-4 ${i % 2 !== 0 ? 'bg-bg-elevated/10' : ''}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted mb-3">
                    {MAT_LABELS[k]}
                  </p>
                  {isNew ? (
                    /* New materials: Op. Bal | Credit | Consumed | Cl. Bal | Message */
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Op. Bal</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.opBal)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Credit</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.credit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Consumed</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.consumed)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Cl. Bal</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.clBal)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Message</p>
                        <p className="text-[13.5px] text-ink-secondary">{m.message ?? '—'}</p>
                      </div>
                    </div>
                  ) : (
                    /* Original 5 materials: Credit | Consumed | Stock | Message */
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Credit</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.credit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Consumed</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.consumed)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Stock</p>
                        <p className="text-[13.5px] text-ink-primary font-medium">{fmtNum(m.stock)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted mb-0.5">Message</p>
                        <p className="text-[13.5px] text-ink-secondary">{m.message ?? '—'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Machine in Operation ── */}
      {report.machines.length > 0 && (
        <Section title="Machine in Operation">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[420px]">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Machine Name', 'DG Opening', 'DG Closing', 'Running Hours'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] pb-3 pr-8">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {report.machines.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-8 text-ink-primary font-medium">{m.machine_name}</td>
                    <td className="py-2.5 pr-8 text-ink-secondary">{fmtNum(m.dg_opening)}</td>
                    <td className="py-2.5 pr-8 text-ink-secondary">{fmtNum(m.dg_closing)}</td>
                    <td className="py-2.5 pr-8 text-ink-secondary">{fmtNum(m.running_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Site Activity ── */}
      <Section title="Site Activity">
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5">
            <Field label="If Concreting"    value={report.concreting} />
            <Field label="Qty. of Concrete" value={report.concreting_qty} />
            <Field label="Visitor"          value={report.visitor} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Work Done"                value={report.work_done} />
            <Field label="Work to be Done Next Day" value={report.work_next_day} />
            <Field label="Requirement"              value={report.requirement} />
            <Field label="Remark"                   value={report.remark} />
          </div>
          {report.comment && (
            <Field label="Comment to be Noted" value={report.comment} />
          )}
        </div>
      </Section>
    </div>
  )
}
