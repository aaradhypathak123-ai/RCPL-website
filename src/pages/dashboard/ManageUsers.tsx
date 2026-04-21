import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  UserPlus, Pencil, Trash2, Search, X,
  FileSpreadsheet, FileText, Loader2, AlertTriangle,
  Users, ShieldCheck, ShieldOff, ChevronLeft, ChevronRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Department { id: number; name: string }
interface SiteName   { id: number; name: string }
interface SiteAssignment { site_name_id: number; name: string }

interface Profile {
  id: string
  full_name: string
  email: string | null
  role: string
  department_id: number | null
  status: string
  must_change_password: boolean
  last_login: string | null
  created_at: string
  departments: { name: string } | null
}

interface UserForm {
  full_name: string
  email: string
  temp_password: string
  role: string
  department_id: string
  status: string
}

const EMPTY_FORM: UserForm = {
  full_name: '', email: '', temp_password: '',
  role: 'office_staff', department_id: '', status: 'active',
}

const ROLES = [
  { value: 'admin',        label: 'Admin' },
  { value: 'site_manager', label: 'Site Manager' },
  { value: 'office_staff', label: 'Office Staff' },
]

const PAGE_SIZE = 10

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = `w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5
  text-[13.5px] text-ink-primary placeholder-ink-muted
  focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
  hover:border-border-bright transition-[border-color,box-shadow] duration-200`

const selectCls = inputCls + ' appearance-none cursor-pointer'

// ── Badge components ──────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin:        'bg-primary/20 text-primary border-primary/30',
    site_manager: 'bg-accent/20 text-accent border-accent/30',
    office_staff: 'bg-success/20 text-success border-success/30',
  }
  const labels: Record<string, string> = {
    admin: 'Admin', site_manager: 'Site Manager', office_staff: 'Office Staff',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${map[role] ?? 'bg-white/10 text-ink-muted border-border'}`}>
      {labels[role] ?? role}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider
      ${status === 'active'
        ? 'bg-success/15 text-success border-success/30'
        : 'bg-danger/15 text-danger border-danger/30'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-success' : 'bg-danger'}`} />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Modal primitives ──────────────────────────────────────────────────────────
function ModalBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {children}
    </div>
  )
}

function ModalCard({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`bg-bg-surface border border-border rounded-2xl w-full shadow-2xl ${wide ? 'max-w-lg' : 'max-w-md'}`}
      style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)' }}>
      {children}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatLastLogin(ts: string | null) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ManageUsers() {
  const [users, setUsers]           = useState<Profile[]>([])
  const [departments, setDepts]     = useState<Department[]>([])
  const [siteNames, setSiteNames]   = useState<SiteName[]>([])
  const [siteAssignments, setSiteAssignments] = useState<Record<string, SiteAssignment[]>>({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [successMsg, setSuccess]    = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)

  const [addModal, setAddModal]           = useState(false)
  const [editTarget, setEditTarget]       = useState<Profile | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<Profile | null>(null)
  const [form, setForm]                   = useState<UserForm>(EMPTY_FORM)
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([])
  const [formError, setFormError]         = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [toggling, setToggling]           = useState<string | null>(null) // userId being toggled

  const flash = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3500)
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [usersRes, deptsRes, sitesRes, assignRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role, department_id, status, must_change_password, last_login, created_at, departments(name)')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('site_names').select('id, name').order('name'),
      supabase.from('user_site_assignments').select('user_id, site_name_id, site_names(name)'),
    ])
    if (usersRes.error) { setError(usersRes.error.message); setLoading(false); return }
    setUsers((usersRes.data as unknown as Profile[]) ?? [])
    setDepts((deptsRes.data as Department[]) ?? [])
    setSiteNames((sitesRes.data as SiteName[]) ?? [])

    // Build map: userId → [{ site_name_id, name }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, SiteAssignment[]> = {}
    for (const row of (assignRes.data ?? []) as any[]) {
      const uid  = row.user_id as string
      const name = Array.isArray(row.site_names) ? row.site_names[0]?.name : row.site_names?.name
      if (!map[uid]) map[uid] = []
      map[uid].push({ site_name_id: row.site_name_id, name: name ?? '' })
    }
    setSiteAssignments(map)

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Search + pagination ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  }, [users, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  // ── Form helpers ───────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM)
    setSelectedSiteIds([])
    setFormError(null)
    setAddModal(true)
  }
  function openEdit(u: Profile) {
    setForm({
      full_name: u.full_name,
      email: u.email ?? '',
      temp_password: '',
      role: u.role,
      department_id: u.department_id ? String(u.department_id) : '',
      status: u.status,
    })
    setSelectedSiteIds((siteAssignments[u.id] ?? []).map(a => a.site_name_id))
    setFormError(null)
    setEditTarget(u)
  }
  const field = (k: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // ── Create user ────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return }
    if (!form.email.trim())     { setFormError('Email is required.'); return }
    if (form.temp_password.length < 6) { setFormError('Password must be at least 6 characters.'); return }
    setSaving(true); setFormError(null)

    // Create Supabase auth account via signUp
    // ⚠️  Requires "Email Confirmation" to be DISABLED in Supabase Auth settings
    //     (or the user confirms email before first login).
    //     Using signUp() because auth.admin.createUser() requires service role key
    //     which cannot be used from the browser client.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.temp_password,
      options: { data: { full_name: form.full_name.trim() } },
    })

    if (authError) { setFormError(authError.message); setSaving(false); return }
    if (!authData.user) { setFormError('User creation failed — no user returned.'); setSaving(false); return }

    // If a session came back, email confirmation is disabled and we just got logged out of admin
    if (authData.session) {
      // Sign out the new user session immediately — admin will need to re-login
      await supabase.auth.signOut()
      setFormError('Warning: Email confirmation is disabled. New user was created but you have been signed out. Please re-login.')
      setSaving(false)
      return
    }

    // Insert profile row
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: authData.user.id,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      role: form.role,
      department_id: form.department_id ? Number(form.department_id) : null,
      status: form.status,
      must_change_password: true,
    })

    if (profileErr) { setFormError(profileErr.message); setSaving(false); return }

    // Save site assignments for Site Manager
    if (form.role === 'site_manager' && selectedSiteIds.length > 0 && authData.user) {
      await supabase.from('user_site_assignments').insert(
        selectedSiteIds.map(sid => ({ user_id: authData.user!.id, site_name_id: sid }))
      )
    }

    setAddModal(false)
    flash('User created. A confirmation email has been sent.')
    fetchData()
    setSaving(false)
  }

  // ── Edit user ──────────────────────────────────────────────────────────────
  async function handleEdit() {
    if (!editTarget) return
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return }
    setSaving(true); setFormError(null)

    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        role: form.role,
        department_id: form.department_id ? Number(form.department_id) : null,
        status: form.status,
      })
      .eq('id', editTarget.id)

    if (err) { setFormError(err.message); setSaving(false); return }

    // Replace site assignments — delete all then re-insert
    await supabase.from('user_site_assignments').delete().eq('user_id', editTarget.id)
    if (form.role === 'site_manager' && selectedSiteIds.length > 0) {
      await supabase.from('user_site_assignments').insert(
        selectedSiteIds.map(sid => ({ user_id: editTarget.id, site_name_id: sid }))
      )
    }

    setEditTarget(null)
    flash('User updated successfully.')
    fetchData()
    setSaving(false)
  }

  // ── Delete user ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)

    // Delete profile row (removes access via RLS)
    const { error: profileErr } = await supabase.from('profiles').delete().eq('id', deleteTarget.id)
    if (profileErr) {
      setError(profileErr.message)
      setSaving(false)
      setDeleteTarget(null)
      return
    }

    // Note: auth.users record remains (requires service role to delete).
    // Without a profile, the user cannot access any protected resource.
    setDeleteTarget(null)
    flash('User deleted. Auth account deactivated via profile removal.')
    fetchData()
    setSaving(false)
  }

  // ── Quick admin toggle ─────────────────────────────────────────────────────
  async function toggleAdmin(u: Profile) {
    setToggling(u.id)
    const newRole = u.role === 'admin' ? 'office_staff' : 'admin'
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', u.id)
    if (err) {
      flash(`Failed to update role: ${err.message}`)
    } else {
      // Optimistic update — instant table reflect before refetch
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: newRole } : p))
      flash(`${u.full_name} is now ${newRole === 'admin' ? 'Admin' : 'Office Staff'}.`)
      await fetchData()
    }
    setToggling(null)
  }

  // ── Export helpers ─────────────────────────────────────────────────────────
  function exportExcel() {
    const rows = filtered.map((u, i) => ({
      '#': i + 1,
      'Name': u.full_name,
      'Email': u.email ?? '',
      'Role': u.role,
      'Department': u.departments?.name ?? '—',
      'Status': u.status,
      'Last Login': formatLastLogin(u.last_login),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Users')
    XLSX.writeFile(wb, 'manage-users.xlsx')
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Rational Construction Pvt. Ltd. — Manage Users', 14, 14)
    autoTable(doc, {
      startY: 22,
      head: [['#', 'Name', 'Email', 'Role', 'Department', 'Status', 'Last Login']],
      body: filtered.map((u, i) => [
        i + 1, u.full_name, u.email ?? '', u.role,
        u.departments?.name ?? '—', u.status, formatLastLogin(u.last_login),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [90, 127, 255] },
    })
    doc.save('manage-users.pdf')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display text-[20px] font-bold text-ink-primary tracking-[-0.03em] leading-tight">
            Manage Users
          </h2>
          <p className="text-ink-muted text-[13px] mt-0.5">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated border border-border text-ink-secondary
              hover:bg-white/[0.06] hover:text-ink-primary text-[12px] font-medium
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150">
            <FileSpreadsheet className="w-3.5 h-3.5 text-success" /> Excel
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated border border-border text-ink-secondary
              hover:bg-white/[0.06] hover:text-ink-primary text-[12px] font-medium
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              transition-colors duration-150">
            <FileText className="w-3.5 h-3.5 text-danger" /> PDF
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white
              text-[13px] font-semibold
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
              transition-[background-color] duration-150"
            style={{ boxShadow: '0 4px 14px rgba(90,127,255,0.35)' }}>
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* ── Flash / Error ── */}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-success/10 border border-success/25 rounded-xl px-4 py-3 text-[13px] text-success">
          <span className="w-2 h-2 rounded-full bg-success shrink-0" /> {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or role…"
          className={`${inputCls} pl-10 pr-10`}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[13px]">Loading users…</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users className="w-10 h-10 text-ink-muted/40" />
            <p className="text-ink-muted text-[13px]">
              {search ? 'No users match your search.' : 'No users yet. Add your first user.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-elevated/50">
                  {['#', 'Name', 'Email', 'Role', 'Assigned Sites', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-ink-muted uppercase tracking-[0.08em] px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginated.map((u, i) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors duration-100">
                    <td className="px-4 py-3 text-ink-muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-ink-primary whitespace-nowrap">{u.full_name}</td>
                    <td className="px-4 py-3 text-ink-secondary">{u.email ?? '—'}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3">
                      {u.role === 'site_manager' && (siteAssignments[u.id] ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(siteAssignments[u.id] ?? []).map(a => (
                            <span key={a.site_name_id}
                              className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold bg-accent/15 text-accent border-accent/25">
                              {a.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{u.departments?.name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatLastLogin(u.last_login)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Quick admin toggle */}
                        <button
                          onClick={() => toggleAdmin(u)}
                          disabled={toggling === u.id}
                          title={u.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                          className={`p-1.5 rounded-lg transition-colors duration-150
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                            ${u.role === 'admin'
                              ? 'text-primary bg-primary/10 hover:bg-primary/20'
                              : 'text-ink-muted hover:text-primary hover:bg-primary/10'}`}>
                          {toggling === u.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : u.role === 'admin'
                              ? <ShieldCheck className="w-3.5 h-3.5" />
                              : <ShieldOff className="w-3.5 h-3.5" />}
                        </button>
                        {/* Edit */}
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-accent/80 hover:text-accent hover:bg-accent/10
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40
                            transition-colors duration-150">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        <button onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded-lg text-danger/70 hover:text-danger hover:bg-danger/10
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40
                            transition-colors duration-150">
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

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-ink-muted">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-40 transition-colors duration-150">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-[12px] font-medium transition-colors duration-150
                  ${n === page ? 'bg-primary text-white' : 'hover:bg-white/[0.06] text-ink-secondary'}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-40 transition-colors duration-150">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══ ADD MODAL ══════════════════════════════════════════════════════════ */}
      {addModal && (
        <ModalBackdrop>
          <ModalCard wide>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h3 className="font-display text-[16px] font-bold text-ink-primary tracking-[-0.02em]">Add New User</h3>
              <button onClick={() => setAddModal(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06] transition-colors duration-150">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Full Name *</label>
                <input value={form.full_name} onChange={field('full_name')} placeholder="e.g. Ramesh Kumar" className={inputCls} />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Email *</label>
                <input type="email" value={form.email} onChange={field('email')} placeholder="user@company.com" className={inputCls} />
              </div>

              {/* Temp Password */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Temporary Password * (min. 6 chars)</label>
                <input type="text" value={form.temp_password} onChange={field('temp_password')} placeholder="Temp password" className={inputCls} />
              </div>

              {/* Role + Department side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Role</label>
                  <select value={form.role} onChange={e => { field('role')(e); if (e.target.value !== 'site_manager') setSelectedSiteIds([]) }} className={selectCls}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Department</label>
                  <select value={form.department_id} onChange={field('department_id')} className={selectCls}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Assigned Sites — only for Site Manager */}
              {form.role === 'site_manager' && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Assigned Sites</label>
                  {selectedSiteIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedSiteIds.map(id => {
                        const site = siteNames.find(s => s.id === id)
                        return (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/15 border border-accent/25 text-accent text-[12px] font-medium">
                            {site?.name}
                            <button type="button" onClick={() => setSelectedSiteIds(p => p.filter(x => x !== id))}
                              className="hover:text-white transition-colors duration-150">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <select
                    value=""
                    onChange={e => {
                      const v = Number(e.target.value)
                      if (v && !selectedSiteIds.includes(v)) setSelectedSiteIds(p => [...p, v])
                    }}
                    className={selectCls}
                  >
                    <option value="">Add a site…</option>
                    {siteNames.filter(s => !selectedSiteIds.includes(s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Status</label>
                <select value={form.status} onChange={field('status')} className={selectCls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Info note */}
              <p className="text-[11px] text-ink-muted leading-relaxed bg-bg-elevated border border-border rounded-xl px-3 py-2">
                A confirmation email will be sent. User must confirm before first login, then will be prompted to set a new password.
              </p>

              {formError && (
                <div className="flex items-start gap-2 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {formError}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2.5">
              <button onClick={() => setAddModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-ink-secondary hover:bg-white/[0.05] text-[13px] font-medium transition-colors duration-150">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60
                  text-white text-[13px] font-semibold transition-[background-color] duration-150">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ══ EDIT MODAL ══════════════════════════════════════════════════════════ */}
      {editTarget && (
        <ModalBackdrop>
          <ModalCard wide>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
              <h3 className="font-display text-[16px] font-bold text-ink-primary tracking-[-0.02em]">Edit User</h3>
              <button onClick={() => setEditTarget(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-white/[0.06] transition-colors duration-150">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Full Name *</label>
                <input value={form.full_name} onChange={field('full_name')} placeholder="Full name" className={inputCls} />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Email (cannot change)</label>
                <input value={editTarget.email ?? ''} disabled
                  className={`${inputCls} opacity-50 cursor-not-allowed`} />
              </div>

              {/* Role + Department */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Role</label>
                  <select value={form.role} onChange={e => { field('role')(e); if (e.target.value !== 'site_manager') setSelectedSiteIds([]) }} className={selectCls}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Department</label>
                  <select value={form.department_id} onChange={field('department_id')} className={selectCls}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Assigned Sites — only for Site Manager */}
              {form.role === 'site_manager' && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Assigned Sites</label>
                  {selectedSiteIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedSiteIds.map(id => {
                        const site = siteNames.find(s => s.id === id)
                        return (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/15 border border-accent/25 text-accent text-[12px] font-medium">
                            {site?.name}
                            <button type="button" onClick={() => setSelectedSiteIds(p => p.filter(x => x !== id))}
                              className="hover:text-white transition-colors duration-150">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <select
                    value=""
                    onChange={e => {
                      const v = Number(e.target.value)
                      if (v && !selectedSiteIds.includes(v)) setSelectedSiteIds(p => [...p, v])
                    }}
                    className={selectCls}
                  >
                    <option value="">Add a site…</option>
                    {siteNames.filter(s => !selectedSiteIds.includes(s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">Status</label>
                <select value={form.status} onChange={field('status')} className={selectCls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {formError && (
                <div className="flex items-start gap-2 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-[13px] text-danger">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {formError}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2.5">
              <button onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-border text-ink-secondary hover:bg-white/[0.05] text-[13px] font-medium transition-colors duration-150">
                Cancel
              </button>
              <button onClick={handleEdit} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-60
                  text-bg-base text-[13px] font-semibold transition-[background-color] duration-150">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ══ DELETE MODAL ════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <ModalBackdrop>
          <ModalCard>
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-12 h-12 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <h3 className="font-display text-[16px] font-bold text-ink-primary mb-1">Delete User?</h3>
              <p className="text-ink-muted text-[13px] leading-relaxed">
                This will permanently remove <span className="text-ink-primary font-medium">{deleteTarget.full_name}</span>'s profile
                and revoke all access. The action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-2.5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-xl border border-border text-ink-secondary hover:bg-white/[0.05] text-[13px] font-medium transition-colors duration-150">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 disabled:opacity-60 text-white text-[13px] font-semibold transition-[background-color] duration-150">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Deleting…' : 'Delete User'}
              </button>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}
    </div>
  )
}
