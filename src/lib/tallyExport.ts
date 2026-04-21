/**
 * Tally ERP 9 / TallyPrime XML export helpers
 * Company: Rational Construction Pvt. Ltd.
 */

const COMPANY = 'Rational Construction Pvt. Ltd.'

// ── Envelope wrapper ──────────────────────────────────────────────────────
function envelope(reportName: string, requestData: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${reportName}</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${requestData}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Ledger master (employees, users) ─────────────────────────────────────
function ledger(name: string, group = 'Employees'): string {
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${esc(name)}" ACTION="Create">
            <NAME>${esc(name)}</NAME>
            <PARENT>${esc(group)}</PARENT>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          </LEDGER>
        </TALLYMESSAGE>`
}

// ── Cost centre (projects, departments, locations) ────────────────────────
function costCentre(name: string, parent = 'Primary Cost Centre'): string {
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <COSTCENTRE NAME="${esc(name)}" ACTION="Create">
            <NAME>${esc(name)}</NAME>
            <PARENT>${esc(parent)}</PARENT>
          </COSTCENTRE>
        </TALLYMESSAGE>`
}

// ── Stock group ───────────────────────────────────────────────────────────
function stockGroup(name: string, parent = 'Primary'): string {
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKGROUP NAME="${esc(name)}" ACTION="Create">
            <NAME>${esc(name)}</NAME>
            <PARENT>${esc(parent)}</PARENT>
            <ISADDABLE>Yes</ISADDABLE>
          </STOCKGROUP>
        </TALLYMESSAGE>`
}

// ── Stock item ────────────────────────────────────────────────────────────
function stockItem(name: string, group: string, unit = 'Nos'): string {
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${esc(name)}" ACTION="Create">
            <NAME>${esc(name)}</NAME>
            <PARENT>${esc(group)}</PARENT>
            <BASEUNITS>${esc(unit)}</BASEUNITS>
          </STOCKITEM>
        </TALLYMESSAGE>`
}

// ── Payment voucher ───────────────────────────────────────────────────────
function paymentVoucher(narration: string, date: string, amount: number, ledgerName: string): string {
  const tallyDate = date.replace(/-/g, '')   // YYYYMMDD
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Payment" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <NARRATION>${esc(narration)}</NARRATION>
            <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`
}

// ── Download helper ───────────────────────────────────────────────────────
export function downloadXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ══════════════════════════════════════════════════════════════════════════
// Per-page export functions
// ══════════════════════════════════════════════════════════════════════════

/** Generic name-only list → Ledger masters */
export function exportTallyNameList(
  items: { name: string }[],
  group: string,
  filename: string,
): void {
  const body = items.map(i => ledger(i.name, group)).join('\n')
  downloadXml(envelope('All Masters', body), filename)
}

/** Generic name-only list → Cost Centres */
export function exportTallyCostCentres(
  items: { name: string }[],
  parent: string,
  filename: string,
): void {
  const body = items.map(i => costCentre(i.name, parent)).join('\n')
  downloadXml(envelope('Cost Centres', body), filename)
}

/** Material/Machine names with their type group → Stock Items */
export function exportTallyStockItems(
  items: { name: string; groupName: string | null }[],
  filename: string,
): void {
  // Collect unique groups first
  const groups = [...new Set(items.map(i => i.groupName ?? 'General'))]
  const groupXml  = groups.map(g => stockGroup(g)).join('\n')
  const itemsXml  = items.map(i => stockItem(i.name, i.groupName ?? 'General')).join('\n')
  downloadXml(envelope('All Masters', groupXml + '\n' + itemsXml), filename)
}

/** Projects → Cost Centres */
export function exportTallyProjects(
  items: { name: string; cities?: { name: string } | null }[],
  filename: string,
): void {
  const body = items.map(i =>
    costCentre(i.name, i.cities?.name ? `Projects - ${i.cities.name}` : 'Projects')
  ).join('\n')
  downloadXml(envelope('Cost Centres', body), filename)
}

/** Manage Users → Ledger entries under Employees */
export function exportTallyUsers(
  items: { full_name: string; role: string }[],
  filename: string,
): void {
  const body = items.map(i => ledger(i.full_name, 'Employees')).join('\n')
  downloadXml(envelope('All Masters', body), filename)
}

/** Site Reports → Payment vouchers */
export function exportTallySiteReports(
  items: {
    projects?: { name: string } | null
    site_name?: string | null
    date?: string | null
    opening_balance?: number | null
    close_balance?: number | null
  }[],
  filename: string,
): void {
  const vouchers = items
    .filter(r => r.opening_balance || r.close_balance)
    .map(r => {
      const amount = r.opening_balance ?? r.close_balance ?? 0
      const project = r.projects?.name ?? 'Site Report'
      const site    = r.site_name ?? ''
      const narration = `${project}${site ? ' — ' + site : ''}`
      const date = r.date ?? new Date().toISOString().split('T')[0]
      return paymentVoucher(narration, date, Number(amount), project)
    })
    .join('\n')
  downloadXml(envelope('Vouchers', vouchers || '<!-- No financial data -->'), filename)
}

/** Employee Department → Ledger groups */
export function exportTallyDepartments(
  items: { name: string }[],
  filename: string,
): void {
  const body = items.map(i => ledger(i.name, 'Indirect Expenses')).join('\n')
  downloadXml(envelope('All Masters', body), filename)
}
