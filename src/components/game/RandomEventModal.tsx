import type { RandomEvent } from '@/core/types'
import styles from './RandomEventModal.module.css'

export interface RandomEventModalProps {
  event: RandomEvent
  currentBalance: number
  onChoice: (choiceIndex: number) => void
}

export function RandomEventModal({
  event,
  currentBalance,
  onChoice,
}: RandomEventModalProps) {
  const getEventTypeClass = () => {
    switch (event.type) {
      case 'positive':
        return styles.typePositive
      case 'negative':
        return styles.typeNegative
      case 'neutral':
        return styles.typeNeutral
      default:
        return ''
    }
  }

  const getEventTypeLabel = () => {
    switch (event.type) {
      case 'positive':
        return 'Opportunity'
      case 'negative':
        return 'Challenge'
      case 'neutral':
        return 'Situation'
      default:
        return 'Event'
    }
  }

  const formatEffects = (choice: (typeof event.choices)[0]) => {
    const effects: string[] = []

    if (choice.effects.money) {
      const sign = choice.effects.money > 0 ? '+' : ''
      effects.push(`${sign}$${choice.effects.money.toLocaleString()}`)
    }

    if (choice.effects.reputation) {
      const sign = choice.effects.reputation > 0 ? '+' : ''
      effects.push(`${sign}${choice.effects.reputation} reputation`)
    }

    if (choice.effects.playerEnergy) {
      const sign = choice.effects.playerEnergy > 0 ? '+' : ''
      effects.push(`${sign}${choice.effects.playerEnergy} energy`)
    }

    if (choice.effects.newClient) {
      effects.push('New client arrives')
    }

    if (choice.effects.cancelTherapistSessions) {
      effects.push('Sessions cancelled')
    }

    if (choice.effects.modifier) {
      effects.push(`${choice.effects.modifier.name} (${choice.effects.modifier.duration} days)`)
    }

    return effects
  }

  const canAffordChoice = (choice: (typeof event.choices)[0]) => {
    const moneyCost = choice.effects.money ?? 0
    if (moneyCost < 0) {
      return currentBalance >= Math.abs(moneyCost)
    }
    return true
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={`${styles.typeBadge} ${getEventTypeClass()}`}>
            {getEventTypeLabel()}
          </span>
          <h2 className={styles.title}>{event.title}</h2>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>{event.description}</p>
        </div>

        <div className={styles.choices}>
          {event.choices.map((choice, index) => {
            const effects = formatEffects(choice)
            const affordable = canAffordChoice(choice)

            return (
              <button
                key={index}
                className={`${styles.choiceButton} ${!affordable ? styles.disabled : ''}`}
                onClick={() => onChoice(index)}
                disabled={!affordable}
              >
                <span className={styles.choiceText}>{choice.text}</span>
                {effects.length > 0 && (
                  <div className={styles.effects}>
                    {effects.map((effect, i) => (
                      <span
                        key={i}
                        className={`${styles.effectTag} ${
                          effect.startsWith('+') || effect.includes('New') || effect.includes('Boost')
                            ? styles.effectPositive
                            : effect.startsWith('-') || effect.includes('cancelled')
                              ? styles.effectNegative
                              : styles.effectNeutral
                        }`}
                      >
                        {effect}
                      </span>
                    ))}
                  </div>
                )}
                {!affordable && (
                  <span className={styles.cantAfford}>Not enough money</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
