import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DesktopSidebar, MobileDrawer } from './Sidebar'
import Header from './Header'

// Map pathname → page title
const TITLE_MAP: Record<string, string> = {
  '/dashboard':            'Dashboard',
  '/dashboard/inventory':  'Inventory',
  '/dashboard/sales':      'Sales',
  '/dashboard/purchases':  'Purchases',
  '/dashboard/finance':    'Finance',
  '/dashboard/hr':         'Human Resources',
  '/dashboard/reports':    'Reports',
  '/dashboard/settings':             'Settings',
  '/dashboard/manage-users':         'Manage Users',
  '/dashboard/sites':                'Sites',
  '/dashboard/sites/projects':       'Projects',
  '/dashboard/sites/site-report':     'Site Report',
  '/dashboard/sites/site-report/add': 'Add Site Report',
  // Note: /site-report/:id and /edit/:id handled by dynamic match below
  '/dashboard/sites/site-names':      'Site Names',
  // Note: /dashboard/sites/site-names/:id handled by dynamic match below
  // Measurement
  '/dashboard/measurement':           'Measurement',
  '/dashboard/measurement/add':       'Add Measurement',
  // Accounts hub + modules
  '/dashboard/accounts':                    'Accounts',
  '/dashboard/accounts/invoices':           'Invoices',
  '/dashboard/accounts/invoices/add':       'Add Invoice',
  '/dashboard/accounts/material-receipt':         'Material Receipt',
  '/dashboard/accounts/material-receipt/add':     'Add Material Receipt',
  // Master section
  '/dashboard/master/employee-department':  'Employee Department',
  '/dashboard/master/employee-type':        'Employee Type',
  '/dashboard/master/employee-designation': 'Employee Designation',
  '/dashboard/master/material-type':        'Material Type',
  '/dashboard/master/material-name':        'Material Name',
  '/dashboard/master/machine-type':         'Machine Type',
  '/dashboard/master/machine-name':         'Machine Name',
  '/dashboard/master/city':                 'City',
  '/dashboard/master/state':                'State',
  '/dashboard/master/materials':            'Materials',
  '/dashboard/master/machines':             'Machines',
  '/dashboard/master/locations':            'Locations',
}

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const title = TITLE_MAP[pathname]
    ?? (pathname.match(/^\/dashboard\/sites\/projects\/\d+$/)             ? 'Project Details' :
        pathname.match(/^\/dashboard\/sites\/site-names\/\d+$/)          ? 'Site Name Details' :
        pathname.match(/^\/dashboard\/sites\/site-report\/edit\/\d+$/)   ? 'Edit Site Report' :
        pathname.match(/^\/dashboard\/sites\/site-report\/\d+$/)         ? 'Site Report Details' :
        pathname.match(/^\/dashboard\/accounts\/invoices\/\d+\/edit$/)   ? 'Edit Invoice' :
        pathname.match(/^\/dashboard\/accounts\/invoices\/\d+$/)         ? 'Invoice Details' :
        pathname.match(/^\/dashboard\/accounts\/material-receipt\/\d+\/edit$/) ? 'Edit Material Receipt' :
        pathname.match(/^\/dashboard\/accounts\/material-receipt\/\d+$/)       ? 'Material Receipt Details' :
        pathname.match(/^\/dashboard\/measurement\/\d+\/edit$/)                ? 'Edit Measurement' :
        pathname.match(/^\/dashboard\/measurement\/\d+$/)                      ? 'Measurement Details' :
        'Dashboard')

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden font-body">
      {/* ── Desktop sidebar ── */}
      <DesktopSidebar />

      {/* ── Mobile drawer ── */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setDrawerOpen(true)}
          title={title}
        />

        {/* Page content */}
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 overflow-y-auto p-4 md:p-6"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}
