import { useState } from 'react'
import type { Client, Therapist } from '@/core/types'
import { ClientManager } from '@/core/clients'
import { ClientCard } from './ClientCard'
import styles from './WaitingListPanel.module.css'

export interface WaitingListPanelProps {
  clients: Client[]
  therapists: Therapist[]
  onAssignClient?: (clientId: string, therapistId: string) => void
  onViewClient?: (clientId: string) => void
}

type ViewMode = 'waiting' | 'active' | 'history' | 'at_risk'
type SortBy = 'priority' | 'arrival' | 'severity' | 'name'

export function WaitingListPanel({
  clients,
  therapists,
  onAssignClient,
  onViewClient,
}: WaitingListPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('waiting')
  const [sortBy, setSortBy] = useState<SortBy>('priority')
  const [showCompact, setShowCompact] = useState(false)

  const stats = ClientManager.getClientStats(clients)
  const atRiskClients = ClientManager.getAtRiskClients(clients)

  const getFilteredClients = (): Client[] => {
    let filtered: Client[]

    switch (viewMode) {
      case 'waiting':
        filtered = clients.filter((c) => c.status === 'waiting')
        break
      case 'active':
        filtered = clients.filter((c) => c.status === 'in_treatment')
        break
      case 'history':
        filtered = clients.filter((c) => c.status === 'completed' || c.status === 'dropped')
        break
      case 'at_risk':
        filtered = atRiskClients
        break
    }

    // Sort
    switch (sortBy) {
      case 'priority':
        if (viewMode === 'waiting' || viewMode === 'at_risk') {
          return ClientManager.getWaitingClientsPrioritized(filtered)
        }
        return filtered.sort((a, b) => b.satisfaction - a.satisfaction)
      case 'arrival':
        return filtered.sort((a, b) => a.arrivalDay - b.arrivalDay)
      case 'severity':
        return filtered.sort((a, b) => b.severity - a.severity)
      case 'name':
        return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName))
    }
  }

  const filteredClients = getFilteredClients()

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Client Management</h2>
        <button
          className={styles.compactToggle}
          onClick={() => setShowCompact(!showCompact)}
          title={showCompact ? 'Show full cards' : 'Show compact view'}
        >
          {showCompact ? 'Full View' : 'Compact'}
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.waiting}</span>
          <span className={styles.statLabel}>Waiting</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.inTreatment}</span>
          <span className={styles.statLabel}>In Treatment</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.completed}</span>
          <span className={styles.statLabel}>Completed</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.dropped}</span>
          <span className={styles.statLabel}>Dropped</span>
        </div>
        {atRiskClients.length > 0 && (
          <button
            className={`${styles.stat} ${styles.statWarning} ${styles.statClickable} ${viewMode === 'at_risk' ? styles.statActive : ''}`}
            onClick={() => setViewMode(viewMode === 'at_risk' ? 'waiting' : 'at_risk')}
            title="Click to filter at-risk clients"
          >
            <span className={styles.statValue}>{atRiskClients.length}</span>
            <span className={styles.statLabel}>At Risk</span>
          </button>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${viewMode === 'waiting' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('waiting')}
          >
            Waiting ({stats.waiting})
          </button>
          <button
            className={`${styles.tab} ${viewMode === 'active' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('active')}
          >
            Active ({stats.inTreatment})
          </button>
          <button
            className={`${styles.tab} ${viewMode === 'history' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('history')}
          >
            History ({stats.completed + stats.dropped})
          </button>
        </div>

        <div className={styles.sortControl}>
          <label htmlFor="sort-select">Sort by:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={styles.sortSelect}
          >
            <option value="priority">Priority</option>
            <option value="arrival">Arrival Date</option>
            <option value="severity">Severity</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className={styles.clientList}>
        {filteredClients.length === 0 ? (
          <div className={styles.emptyState}>
            {viewMode === 'waiting' && 'No clients waiting'}
            {viewMode === 'active' && 'No active clients'}
            {viewMode === 'history' && 'No client history'}
            {viewMode === 'at_risk' && 'No at-risk clients'}
          </div>
        ) : (
          filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              therapists={(viewMode === 'waiting' || viewMode === 'at_risk') ? therapists : []}
              onAssign={(viewMode === 'waiting' || viewMode === 'at_risk') ? onAssignClient : undefined}
              onViewDetails={onViewClient}
              compact={showCompact}
            />
          ))
        )}
      </div>

      {viewMode === 'active' && stats.avgProgress > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>Average Treatment Progress</span>
            <span>{stats.avgProgress}%</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Average Satisfaction</span>
            <span>{stats.avgSatisfaction}%</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Expected Revenue</span>
            <span>${ClientManager.calculateExpectedRevenue(clients).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
