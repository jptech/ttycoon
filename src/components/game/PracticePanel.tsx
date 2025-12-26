import { useState } from 'react'
import { DollarSign, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Therapist, Transaction, PendingClaim, InsurerId } from '@/core/types'
import { INSURANCE_PANELS } from '@/data'
import { EconomyPanel } from './EconomyPanel'
import { InsurancePanelView } from './InsurancePanelView'

export interface PracticePanelProps {
  balance: number
  pendingClaims: PendingClaim[]
  therapists: Therapist[]
  transactions: Transaction[]
  currentBuildingId: string
  currentDay: number
  activePanels: InsurerId[]
  reputation: number
  insuranceMultiplier: number
  onApplyToPanel?: (panelId: InsurerId) => void
  onDropPanel?: (panelId: InsurerId) => void
}

type SubTab = 'finances' | 'insurance'

export function PracticePanel({
  balance,
  pendingClaims,
  therapists,
  transactions,
  currentBuildingId,
  currentDay,
  activePanels,
  reputation,
  insuranceMultiplier,
  onApplyToPanel,
  onDropPanel,
}: PracticePanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('finances')

  const pendingClaimsCount = pendingClaims.length
  const activePanelsCount = activePanels.length

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 mb-4 pb-3 border-b border-border-subtle">
        <button
          onClick={() => setActiveSubTab('finances')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            activeSubTab === 'finances'
              ? 'bg-primary-bg text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          )}
        >
          <DollarSign className="w-4 h-4" />
          <span>Finances</span>
        </button>
        <button
          onClick={() => setActiveSubTab('insurance')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            activeSubTab === 'insurance'
              ? 'bg-primary-bg text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          )}
        >
          <Shield className="w-4 h-4" />
          <span>Insurance</span>
          {pendingClaimsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-accent/15 text-accent">
              {pendingClaimsCount}
            </span>
          )}
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground">
            {activePanelsCount} panels
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden tab-enter">
        {activeSubTab === 'finances' ? (
          <EconomyPanel
            balance={balance}
            pendingClaims={pendingClaims}
            therapists={therapists}
            transactions={transactions}
            currentBuildingId={currentBuildingId}
            currentDay={currentDay}
          />
        ) : (
          <InsurancePanelView
            panels={INSURANCE_PANELS}
            activePanels={activePanels}
            pendingApplications={[]}
            pendingClaims={pendingClaims}
            reputation={reputation}
            currentBalance={balance}
            insuranceMultiplier={insuranceMultiplier}
            currentDay={currentDay}
            onApply={onApplyToPanel}
            onDrop={onDropPanel}
          />
        )}
      </div>
    </div>
  )
}
