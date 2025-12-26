import { useState } from 'react'
import { Users, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Client, Therapist, ActiveTraining } from '@/core/types'
import { WaitingListPanel } from './WaitingListPanel'
import { TherapistPanel } from './TherapistPanel'

export interface PeoplePanelProps {
  clients: Client[]
  therapists: Therapist[]
  activeTrainings: ActiveTraining[]
  currentBalance: number
  practiceLevel: number
  maxTherapists?: number
  onHire?: (therapist: Therapist, cost: number) => void
  onStartTraining?: (therapistId: string) => void
}

type SubTab = 'clients' | 'team'

export function PeoplePanel({
  clients,
  therapists,
  activeTrainings,
  currentBalance,
  practiceLevel,
  maxTherapists,
  onHire,
  onStartTraining,
}: PeoplePanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('clients')

  const waitingCount = clients.filter((c) => c.status === 'waiting').length
  const teamCount = therapists.length

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 mb-4 pb-3 border-b border-border-subtle">
        <button
          onClick={() => setActiveSubTab('clients')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            activeSubTab === 'clients'
              ? 'bg-primary-bg text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Clients</span>
          {waitingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-warning/15 text-warning">
              {waitingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('team')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            activeSubTab === 'team'
              ? 'bg-primary-bg text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          )}
        >
          <UserCheck className="w-4 h-4" />
          <span>Team</span>
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground">
            {teamCount}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden tab-enter">
        {activeSubTab === 'clients' ? (
          <WaitingListPanel clients={clients} therapists={therapists} />
        ) : (
          <TherapistPanel
            therapists={therapists}
            activeTrainings={activeTrainings}
            currentBalance={currentBalance}
            practiceLevel={practiceLevel}
            maxTherapists={maxTherapists}
            onHire={onHire}
            onStartTraining={onStartTraining}
          />
        )}
      </div>
    </div>
  )
}
