import { lazy, Suspense } from 'react'
import type { Building, Session } from '@/core/types'
import { OfficeManager, OFFICE_CONFIG } from '@/core/office'
import { OfficeUpgradesPanel } from './OfficeUpgradesPanel'
import styles from './OfficePanel.module.css'

// Lazy load OfficeCanvas for better initial load time
const OfficeCanvas = lazy(() =>
  import('@/game').then((m) => ({ default: m.OfficeCanvas }))
)

export interface OfficePanelProps {
  currentBuilding: Building
  availableBuildings: Building[]
  sessions: Session[]
  currentDay: number
  currentBalance: number
  practiceLevel: number
  telehealthUnlocked: boolean
  onUpgrade?: (buildingId: string) => void
  onUnlockTelehealth?: () => void
}

export function OfficePanel({
  currentBuilding,
  availableBuildings,
  sessions,
  currentDay,
  currentBalance,
  practiceLevel,
  telehealthUnlocked,
  onUpgrade,
  onUnlockTelehealth,
}: OfficePanelProps) {
  const buildingInfo = OfficeManager.getBuildingInfo(currentBuilding)
  const roomStats = OfficeManager.getRoomStats(currentBuilding, sessions, currentDay)
  const telehealthCheck = OfficeManager.canUnlockTelehealth(currentBalance, telehealthUnlocked)

  const upgradeOptions = availableBuildings.filter(
    (b) =>
      b.id !== currentBuilding.id &&
      b.rooms > currentBuilding.rooms &&
      b.requiredLevel <= practiceLevel
  )

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Office & Facilities</h2>
      </div>

      {/* Floor Plan Visualization */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Floor Plan</h3>
        <div className={styles.canvasWrapper}>
          <Suspense fallback={<div className={styles.canvasLoading}>Loading floor plan...</div>}>
            <OfficeCanvas buildingId={currentBuilding.id} />
          </Suspense>
        </div>
      </div>

      {/* Current Building */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Current Location</h3>
        <div className={styles.buildingCard}>
          <div className={styles.buildingHeader}>
            <span className={styles.buildingName}>{buildingInfo.name}</span>
            <span className={styles.tierBadge}>Tier {buildingInfo.tier}</span>
          </div>
          <div className={styles.buildingStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Rooms</span>
              <span className={styles.statValue}>{buildingInfo.rooms}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Monthly Rent</span>
              <span className={styles.statValue}>${buildingInfo.monthlyRent.toLocaleString()}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Daily Cost</span>
              <span className={styles.statValue}>${buildingInfo.dailyRent}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Room Utilization */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Room Utilization (Last 7 Days)</h3>
        <div className={styles.utilizationCard}>
          <div className={styles.utilizationBar}>
            <div
              className={styles.utilizationFill}
              style={{ width: `${Math.min(100, roomStats.averageUtilization)}%` }}
            />
          </div>
          <div className={styles.utilizationStats}>
            <span>{Math.round(roomStats.averageUtilization)}% average</span>
            <span>Peak: {Math.round(roomStats.peakUtilization)}%</span>
          </div>
          <div className={styles.sessionCounts}>
            <span>In-person: {roomStats.totalInPersonSessions}</span>
            <span>Virtual: {roomStats.totalVirtualSessions}</span>
          </div>
        </div>
      </div>

      {/* Office Upgrades */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Upgrades</h3>
        <OfficeUpgradesPanel />
      </div>

      {/* Telehealth */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Telehealth</h3>
        {telehealthUnlocked ? (
          <div className={styles.telehealthStatus}>
            <span className={styles.unlockedBadge}>Unlocked</span>
            <p className={styles.telehealthInfo}>
              Virtual sessions available - no room required
            </p>
          </div>
        ) : (
          <div className={styles.telehealthLocked}>
            <p className={styles.telehealthInfo}>
              Unlock telehealth to offer virtual sessions without using rooms
            </p>
            <button
              className={`${styles.unlockButton} ${!telehealthCheck.canUnlock ? styles.disabled : ''}`}
              onClick={onUnlockTelehealth}
              disabled={!telehealthCheck.canUnlock}
            >
              {telehealthCheck.canUnlock
                ? `Unlock for $${OFFICE_CONFIG.TELEHEALTH_UNLOCK_COST}`
                : telehealthCheck.reason}
            </button>
          </div>
        )}
      </div>

      {/* Upgrade Options */}
      {upgradeOptions.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Available Upgrades</h3>
          <div className={styles.upgradeList}>
            {upgradeOptions.map((building) => {
              const check = OfficeManager.canUpgradeBuilding(
                currentBuilding,
                building,
                currentBalance,
                practiceLevel
              )

              return (
                <div key={building.id} className={styles.upgradeCard}>
                  <div className={styles.upgradeHeader}>
                    <span className={styles.upgradeName}>{building.name}</span>
                    <span className={styles.tierBadge}>Tier {building.tier}</span>
                  </div>
                  <div className={styles.upgradeDetails}>
                    <span>{building.rooms} rooms</span>
                    <span>${building.monthlyRent.toLocaleString()}/mo</span>
                  </div>
                  <div className={styles.upgradeCost}>
                    Upgrade cost: ${building.upgradeCost.toLocaleString()}
                  </div>
                  <button
                    className={`${styles.upgradeButton} ${!check.canUpgrade ? styles.disabled : ''}`}
                    onClick={() => onUpgrade?.(building.id)}
                    disabled={!check.canUpgrade}
                  >
                    {check.canUpgrade ? 'Upgrade' : check.reason}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Locked Buildings */}
      {availableBuildings.some((b) => b.requiredLevel > practiceLevel) && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Locked Buildings</h3>
          <div className={styles.lockedList}>
            {availableBuildings
              .filter((b) => b.requiredLevel > practiceLevel)
              .map((building) => (
                <div key={building.id} className={styles.lockedCard}>
                  <span className={styles.lockedName}>{building.name}</span>
                  <span className={styles.lockedRequirement}>
                    Requires Level {building.requiredLevel}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
