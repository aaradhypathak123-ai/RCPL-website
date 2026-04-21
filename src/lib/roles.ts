// ── Role definitions — single source of truth ─────────────────────────────
// All role keys are lowercase to match what the database stores.

export type UserRole = 'admin' | 'site_manager' | 'office_staff' | 'manager'

/**
 * Maps each role to the route segments it may access.
 * Segment = the last part of the path, e.g. 'sales' for /dashboard/sales.
 * The root dashboard segment is 'dashboard'.
 */
export const ROLE_ACCESS: Record<string, string[]> = {
  admin: [
    'dashboard',
    'inventory',
    'sales',
    'purchases',
    'finance',
    'hr',
    'reports',
    'settings',
    'manage-users',
    'employee-department',
    'employee-type',
    'employee-designation',
    'material-type',
    'material-name',
    'machine-type',
    'machine-name',
    'city',
    'state',
    'materials',
    'machines',
    'locations',
    'sites',
    'projects',
    'site-report',
    'accounts',
    'invoices',
    'material-receipt',
    'site-names',
    'measurement',
  ],
  site_manager: [
    'dashboard',
    'sites',
    'projects',
    'site-report',
    'reports',
  ],
  office_staff: [
    'dashboard',
    'reports',
  ],
  manager: [
    'dashboard',
    'sales',
    'purchases',
    'reports',
  ],
}

/** Returns true if the given role may access the given route segment.
 *  Case-insensitive — normalises the role to lowercase before lookup. */
export function canAccess(role: string | null | undefined, segment: string): boolean {
  if (!role) return false
  const normalised = role.toLowerCase()
  console.log(`[RoleRoute] role="${normalised}" segment="${segment}"`)
  const allowed = ROLE_ACCESS[normalised] ?? []
  return allowed.includes(segment)
}

/** Extracts the route segment from a full path string. */
export function pathToSegment(path: string): string {
  if (path === '/dashboard') return 'dashboard'
  return path.split('/').filter(Boolean).pop() ?? 'dashboard'
}
