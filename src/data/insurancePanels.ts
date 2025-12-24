import type { InsurancePanel, InsurerId } from '@/core/types'

/**
 * Available insurance panels with their properties
 */
export const INSURANCE_PANELS: Record<InsurerId, InsurancePanel> = {
  aetna: {
    id: 'aetna',
    name: 'Aetna',
    reimbursement: 120,
    delayDays: 21,
    denialRate: 0.08,
    applicationFee: 200,
    minReputation: 30,
  },
  bluecross: {
    id: 'bluecross',
    name: 'Blue Cross Blue Shield',
    reimbursement: 130,
    delayDays: 28,
    denialRate: 0.05,
    applicationFee: 250,
    minReputation: 50,
  },
  cigna: {
    id: 'cigna',
    name: 'Cigna',
    reimbursement: 115,
    delayDays: 14,
    denialRate: 0.1,
    applicationFee: 150,
    minReputation: 20,
  },
  united: {
    id: 'united',
    name: 'United Healthcare',
    reimbursement: 125,
    delayDays: 30,
    denialRate: 0.07,
    applicationFee: 300,
    minReputation: 75,
  },
  medicaid: {
    id: 'medicaid',
    name: 'Medicaid',
    reimbursement: 85,
    delayDays: 45,
    denialRate: 0.15,
    applicationFee: 0,
    minReputation: 0,
  },
}

/**
 * Get insurance panel by ID
 */
export function getInsurancePanel(id: InsurerId): InsurancePanel {
  return INSURANCE_PANELS[id]
}

/**
 * Get all insurance panels sorted by reputation requirement
 */
export function getInsurancePanelsSortedByReputation(): InsurancePanel[] {
  return Object.values(INSURANCE_PANELS).sort((a, b) => a.minReputation - b.minReputation)
}

/**
 * Get available panels for a given reputation level
 */
export function getAvailablePanels(reputation: number): InsurancePanel[] {
  return Object.values(INSURANCE_PANELS).filter((p) => p.minReputation <= reputation)
}

/**
 * Get denial rates as a record for claim processing
 */
export function getDenialRates(): Record<InsurerId, number> {
  const rates: Record<InsurerId, number> = {} as Record<InsurerId, number>
  for (const panel of Object.values(INSURANCE_PANELS)) {
    rates[panel.id] = panel.denialRate
  }
  return rates
}
