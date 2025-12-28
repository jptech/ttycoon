import { useMemo } from 'react'
import { useGameStore, useUIStore } from '@/store'
import {
  OfficeUpgradeManager,
  getUpgradesByCategory,
  getUpgradesByLine,
} from '@/core/office'
import type { OfficeUpgradeConfig, OfficeUpgradeCategory, OfficeUpgradeId } from '@/core/types'
import { Coffee, Sparkles, Users, Check, Lock, DollarSign } from 'lucide-react'
import styles from './OfficeUpgradesPanel.module.css'

const CATEGORY_CONFIG: Record<
  OfficeUpgradeCategory,
  { label: string; icon: typeof Coffee; description: string }
> = {
  energy: {
    label: 'Energy & Breaks',
    icon: Coffee,
    description: 'Improve therapist energy recovery',
  },
  quality: {
    label: 'Session Quality',
    icon: Sparkles,
    description: 'Boost session outcomes',
  },
  comfort: {
    label: 'Client Comfort',
    icon: Users,
    description: 'Reduce waiting room dissatisfaction',
  },
}

const CATEGORY_ORDER: OfficeUpgradeCategory[] = ['energy', 'quality', 'comfort']

interface UpgradeLineProps {
  line: string
  upgrades: OfficeUpgradeConfig[]
  balance: number
  onPurchase: (upgradeId: string) => void
}

function UpgradeLine({ line, upgrades, balance, onPurchase }: UpgradeLineProps) {
  const buildingUpgrades = useGameStore((state) => state.buildingUpgrades)

  // Get highest tier in line for display
  const lineName = upgrades[0]?.name.replace(/\s*\d+$/, '') || line

  return (
    <div className={styles.upgradeLine}>
      <div className={styles.lineHeader}>
        <span className={styles.lineName}>{lineName}</span>
      </div>
      <div className={styles.tierButtons}>
        {upgrades.map((upgrade) => {
          const status = OfficeUpgradeManager.getUpgradeStatus(upgrade.id, buildingUpgrades)
          const canPurchase = OfficeUpgradeManager.canPurchase(
            upgrade.id,
            buildingUpgrades,
            balance
          )

          if (status === 'purchased') {
            return (
              <button
                key={upgrade.id}
                className={`${styles.tierButton} ${styles.purchased}`}
                disabled
                title={`${upgrade.name}: ${OfficeUpgradeManager.formatEffect(upgrade)}`}
              >
                <Check className="w-3 h-3" />
                <span>T{upgrade.tier}</span>
              </button>
            )
          }

          if (status === 'locked') {
            return (
              <button
                key={upgrade.id}
                className={`${styles.tierButton} ${styles.locked}`}
                disabled
                title={`Requires previous tier`}
              >
                <Lock className="w-3 h-3" />
                <span>T{upgrade.tier}</span>
              </button>
            )
          }

          return (
            <button
              key={upgrade.id}
              className={`${styles.tierButton} ${styles.available} ${
                !canPurchase.success ? styles.cantAfford : ''
              }`}
              onClick={() => onPurchase(upgrade.id)}
              disabled={!canPurchase.success}
              title={`${upgrade.name}: ${upgrade.description}\n${OfficeUpgradeManager.formatEffect(upgrade)}\nCost: $${upgrade.cost}`}
            >
              <DollarSign className="w-3 h-3" />
              <span>${upgrade.cost}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OfficeUpgradesPanel() {
  const balance = useGameStore((state) => state.balance)
  const buildingUpgrades = useGameStore((state) => state.buildingUpgrades)
  const purchaseUpgrade = useGameStore((state) => state.purchaseUpgrade)
  const addNotification = useUIStore((state) => state.addNotification)

  // Get aggregated effects for summary display
  const effects = useMemo(
    () => OfficeUpgradeManager.getAggregatedEffects(buildingUpgrades),
    [buildingUpgrades]
  )

  const totalInvested = useMemo(
    () => OfficeUpgradeManager.getTotalInvested(buildingUpgrades),
    [buildingUpgrades]
  )

  const handlePurchase = (upgradeId: string) => {
    const result = purchaseUpgrade(upgradeId as OfficeUpgradeId)
    if (result.success) {
      addNotification({
        type: 'success',
        message: 'Upgrade purchased',
      })
    } else {
      addNotification({
        type: 'error',
        message: result.reason || 'Failed to purchase upgrade',
      })
    }
  }

  // Check if any effects are active
  const hasActiveEffects =
    effects.idleEnergyRecoveryMultiplier > 1 ||
    effects.breakEnergyRecoveryMultiplier > 1 ||
    effects.sessionQualityBonus > 0 ||
    effects.waitingSatisfactionDecayReduction > 0

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Office Upgrades</h3>
        {totalInvested > 0 && (
          <span className={styles.invested}>
            ${totalInvested.toLocaleString()} invested
          </span>
        )}
      </div>

      {hasActiveEffects && (
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>Active Bonuses:</span>
          <div className={styles.summaryEffects}>
            {effects.idleEnergyRecoveryMultiplier > 1 && (
              <span className={styles.effectBadge}>
                +{Math.round((effects.idleEnergyRecoveryMultiplier - 1) * 100)}% idle energy
              </span>
            )}
            {effects.breakEnergyRecoveryMultiplier > 1 && (
              <span className={styles.effectBadge}>
                +{Math.round((effects.breakEnergyRecoveryMultiplier - 1) * 100)}% break energy
              </span>
            )}
            {effects.sessionQualityBonus > 0 && (
              <span className={styles.effectBadge}>
                +{Math.round(effects.sessionQualityBonus * 100)}% quality
              </span>
            )}
            {effects.waitingSatisfactionDecayReduction > 0 && (
              <span className={styles.effectBadge}>
                -{effects.waitingSatisfactionDecayReduction} wait decay
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.categories}>
        {CATEGORY_ORDER.map((category) => {
          const config = CATEGORY_CONFIG[category]
          const Icon = config.icon
          const categoryUpgrades = getUpgradesByCategory(category)
          const lines = [...new Set(categoryUpgrades.map((u) => u.line))]

          return (
            <div key={category} className={styles.category}>
              <div className={styles.categoryHeader}>
                <Icon className="w-4 h-4" />
                <span className={styles.categoryName}>{config.label}</span>
              </div>
              <p className={styles.categoryDescription}>{config.description}</p>
              <div className={styles.upgradeLines}>
                {lines.map((line) => (
                  <UpgradeLine
                    key={line}
                    line={line}
                    upgrades={getUpgradesByLine(line)}
                    balance={balance}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className={styles.warning}>
        Note: Upgrades are lost when moving to a new building
      </p>
    </div>
  )
}
