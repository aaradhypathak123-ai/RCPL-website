import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { canAccess, pathToSegment } from './lib/roles'
import { useAuthStore } from './store/authStore'

// ── Eagerly loaded (critical path) ───────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage'
import ChangePassword from './pages/auth/ChangePassword'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/dashboard/DashboardPage'

// ── Lazy-loaded route chunks ──────────────────────────────────────────────────
const ManageUsers           = lazy(() => import('./pages/dashboard/ManageUsers'))

const SitesHub              = lazy(() => import('./pages/dashboard/sites/SitesHub'))
const ProjectsList          = lazy(() => import('./pages/dashboard/sites/ProjectsList'))
const ProjectDetail         = lazy(() => import('./pages/dashboard/sites/ProjectDetail'))
const SiteReportList        = lazy(() => import('./pages/dashboard/sites/SiteReportList'))
const AddSiteReport         = lazy(() => import('./pages/dashboard/sites/AddSiteReport'))
const ViewSiteReport        = lazy(() => import('./pages/dashboard/sites/ViewSiteReport'))
const EditSiteReport        = lazy(() => import('./pages/dashboard/sites/EditSiteReport'))
const SiteNames             = lazy(() => import('./pages/dashboard/sites/SiteNames'))
const SiteNameDetail        = lazy(() => import('./pages/dashboard/sites/SiteNameDetail'))

const AccountsHub           = lazy(() => import('./pages/dashboard/accounts/AccountsHub'))
const ChallanList           = lazy(() => import('./pages/dashboard/accounts/ChallanList'))
const AddChallan            = lazy(() => import('./pages/dashboard/accounts/AddChallan'))
const ViewChallan           = lazy(() => import('./pages/dashboard/accounts/ViewChallan'))
const EditChallan           = lazy(() => import('./pages/dashboard/accounts/EditChallan'))
const MaterialReceiptList   = lazy(() => import('./pages/dashboard/accounts/MaterialReceiptList'))
const AddMaterialReceipt    = lazy(() => import('./pages/dashboard/accounts/AddMaterialReceipt'))
const MaterialReceiptDetail = lazy(() => import('./pages/dashboard/accounts/MaterialReceiptDetail'))

const MeasurementList       = lazy(() => import('./pages/dashboard/measurement/MeasurementList'))
const AddMeasurement        = lazy(() => import('./pages/dashboard/measurement/AddMeasurement'))
const ViewMeasurement       = lazy(() => import('./pages/dashboard/measurement/ViewMeasurement'))

const MasterEmployeeDepartment = lazy(() => import('./pages/dashboard/master/EmployeeDepartment'))
const DepartmentDetail         = lazy(() => import('./pages/dashboard/master/DepartmentDetail'))
const EmployeeType             = lazy(() => import('./pages/dashboard/master/EmployeeType'))
const EmployeeDesignation      = lazy(() => import('./pages/dashboard/master/EmployeeDesignation'))
const MaterialType             = lazy(() => import('./pages/dashboard/master/MaterialType'))
const MaterialName             = lazy(() => import('./pages/dashboard/master/MaterialName'))
const MachineType              = lazy(() => import('./pages/dashboard/master/MachineType'))
const MachineName              = lazy(() => import('./pages/dashboard/master/MachineName'))
const CityPage                 = lazy(() => import('./pages/dashboard/master/City'))
const StatePage                = lazy(() => import('./pages/dashboard/master/State'))
const Materials                = lazy(() => import('./pages/dashboard/master/Materials'))
const Machines                 = lazy(() => import('./pages/dashboard/master/Machines'))
const Locations                = lazy(() => import('./pages/dashboard/master/Locations'))

// ── Page-level loading fallback ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  )
}

// ── Full-screen spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  )
}

// ── Requires valid session ────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return <Spinner />
  return session ? <>{children}</> : <Navigate to="/login" replace />
}

// ── Role-gated route — redirects to /dashboard if role lacks access ───────
function RoleRoute({ path, children }: { path?: string; children: React.ReactNode }) {
  const { role } = useAuthStore()
  // If no path provided (catch-all wrapper), or role is not yet loaded, let through
  if (!path || role === null) return <>{children}</>
  const segment = pathToSegment(path)
  return canAccess(role, segment) ? <>{children}</> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />

          <Route path="inventory"  element={<RoleRoute path="/dashboard/inventory"><ComingSoon title="Inventory" /></RoleRoute>} />
          <Route path="sales"      element={<RoleRoute path="/dashboard/sales"><ComingSoon title="Sales" /></RoleRoute>} />
          <Route path="purchases"  element={<RoleRoute path="/dashboard/purchases"><ComingSoon title="Purchases" /></RoleRoute>} />
          <Route path="finance"    element={<RoleRoute path="/dashboard/finance"><ComingSoon title="Finance" /></RoleRoute>} />
          <Route path="hr"         element={<RoleRoute path="/dashboard/hr"><ComingSoon title="Human Resources" /></RoleRoute>} />
          <Route path="reports"    element={<RoleRoute path="/dashboard/reports"><ComingSoon title="Reports" /></RoleRoute>} />
          <Route path="settings"   element={<RoleRoute path="/dashboard/settings"><ComingSoon title="Settings" /></RoleRoute>} />

          <Route path="manage-users" element={
            <Suspense fallback={<PageLoader />}>
              <RoleRoute path="/dashboard/manage-users"><ManageUsers /></RoleRoute>
            </Suspense>
          } />

          {/* Sites section */}
          <Route path="sites"              element={<Suspense fallback={<PageLoader />}><SitesHub /></Suspense>} />
          <Route path="sites/projects"     element={<Suspense fallback={<PageLoader />}><ProjectsList /></Suspense>} />
          <Route path="sites/projects/:id" element={<Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense>} />
          <Route path="sites/site-report"          element={<Suspense fallback={<PageLoader />}><SiteReportList /></Suspense>} />
          <Route path="sites/site-report/add"      element={<Suspense fallback={<PageLoader />}><AddSiteReport /></Suspense>} />
          <Route path="sites/site-report/:id"      element={<Suspense fallback={<PageLoader />}><ViewSiteReport /></Suspense>} />
          <Route path="sites/site-report/edit/:id" element={<Suspense fallback={<PageLoader />}><EditSiteReport /></Suspense>} />
          <Route path="sites/site-names"    element={<Suspense fallback={<PageLoader />}><SiteNames /></Suspense>} />
          <Route path="sites/site-names/:id" element={<Suspense fallback={<PageLoader />}><SiteNameDetail /></Suspense>} />

          {/* Master section */}
          <Route path="master/employee-department" element={
            <Suspense fallback={<PageLoader />}>
              <RoleRoute path="/dashboard/master/employee-department"><MasterEmployeeDepartment /></RoleRoute>
            </Suspense>
          } />
          <Route path="master/employee-department/:id" element={
            <Suspense fallback={<PageLoader />}>
              <RoleRoute path="/dashboard/master/employee-department"><DepartmentDetail /></RoleRoute>
            </Suspense>
          } />
          <Route path="master/employee-type"        element={<Suspense fallback={<PageLoader />}><EmployeeType /></Suspense>} />
          <Route path="master/employee-designation" element={<Suspense fallback={<PageLoader />}><EmployeeDesignation /></Suspense>} />
          <Route path="master/material-type"        element={<Suspense fallback={<PageLoader />}><MaterialType /></Suspense>} />
          <Route path="master/material-name"        element={<Suspense fallback={<PageLoader />}><MaterialName /></Suspense>} />
          <Route path="master/machine-type"         element={<Suspense fallback={<PageLoader />}><MachineType /></Suspense>} />
          <Route path="master/machine-name"         element={<Suspense fallback={<PageLoader />}><MachineName /></Suspense>} />
          <Route path="master/city"                 element={<Suspense fallback={<PageLoader />}><CityPage /></Suspense>} />
          <Route path="master/state"                element={<Suspense fallback={<PageLoader />}><StatePage /></Suspense>} />
          <Route path="master/materials"            element={<Suspense fallback={<PageLoader />}><Materials /></Suspense>} />
          <Route path="master/machines"             element={<Suspense fallback={<PageLoader />}><Machines /></Suspense>} />
          <Route path="master/locations"            element={<Suspense fallback={<PageLoader />}><Locations /></Suspense>} />

          {/* Accounts hub */}
          <Route path="accounts"               element={<Suspense fallback={<PageLoader />}><AccountsHub /></Suspense>} />
          <Route path="accounts/invoices"      element={<Suspense fallback={<PageLoader />}><ChallanList /></Suspense>} />
          <Route path="accounts/invoices/add"  element={<Suspense fallback={<PageLoader />}><AddChallan /></Suspense>} />
          <Route path="accounts/invoices/:id"       element={<Suspense fallback={<PageLoader />}><ViewChallan /></Suspense>} />
          <Route path="accounts/invoices/:id/edit"  element={<Suspense fallback={<PageLoader />}><EditChallan /></Suspense>} />

          {/* Material Receipt */}
          <Route path="accounts/material-receipt"      element={<Suspense fallback={<PageLoader />}><MaterialReceiptList /></Suspense>} />
          <Route path="accounts/material-receipt/add"  element={<Suspense fallback={<PageLoader />}><AddMaterialReceipt /></Suspense>} />
          <Route path="accounts/material-receipt/:id"  element={<Suspense fallback={<PageLoader />}><MaterialReceiptDetail /></Suspense>} />

          {/* Measurement */}
          <Route path="measurement"          element={<Suspense fallback={<PageLoader />}><MeasurementList /></Suspense>} />
          <Route path="measurement/add"      element={<Suspense fallback={<PageLoader />}><AddMeasurement /></Suspense>} />
          <Route path="measurement/:id"      element={<Suspense fallback={<PageLoader />}><ViewMeasurement /></Suspense>} />
          <Route path="measurement/:id/edit" element={<Suspense fallback={<PageLoader />}><AddMeasurement /></Suspense>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center"
        style={{ boxShadow: '0 0 0 1px rgba(90,127,255,0.15)' }}>
        <span className="text-primary text-2xl">⚙</span>
      </div>
      <h2 className="font-display text-xl font-bold text-ink-primary tracking-[-0.03em]">{title}</h2>
      <p className="text-ink-muted text-sm">This module is coming in the next phase.</p>
    </div>
  )
}
