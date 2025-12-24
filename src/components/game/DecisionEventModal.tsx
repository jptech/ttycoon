import type { DecisionEvent } from '@/core/types'
import styles from './DecisionEventModal.module.css'

export interface DecisionEventModalProps {
  event: DecisionEvent
  sessionInfo: {
    therapistName: string
    clientName: string
    sessionProgress: number
  }
  onChoice: (choiceIndex: number) => void
}

export function DecisionEventModal({
  event,
  sessionInfo,
  onChoice,
}: DecisionEventModalProps) {
  const formatEffects = (choice: (typeof event.choices)[0]) => {
    const effects: { label: string; value: string; type: 'positive' | 'negative' | 'neutral' }[] = []

    if (choice.effects.quality !== undefined && choice.effects.quality !== 0) {
      const sign = choice.effects.quality > 0 ? '+' : ''
      const percent = Math.round(choice.effects.quality * 100)
      effects.push({
        label: 'Quality',
        value: `${sign}${percent}%`,
        type: choice.effects.quality > 0 ? 'positive' : 'negative',
      })
    }

    if (choice.effects.energy !== undefined && choice.effects.energy !== 0) {
      const sign = choice.effects.energy > 0 ? '+' : ''
      effects.push({
        label: 'Energy',
        value: `${sign}${choice.effects.energy}`,
        type: choice.effects.energy > 0 ? 'positive' : 'negative',
      })
    }

    if (choice.effects.satisfaction !== undefined && choice.effects.satisfaction !== 0) {
      const sign = choice.effects.satisfaction > 0 ? '+' : ''
      effects.push({
        label: 'Satisfaction',
        value: `${sign}${choice.effects.satisfaction}`,
        type: choice.effects.satisfaction > 0 ? 'positive' : 'negative',
      })
    }

    return effects
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.sessionBadge}>In Session</span>
          <h2 className={styles.title}>{event.title}</h2>
        </div>

        <div className={styles.sessionInfo}>
          <span>{sessionInfo.therapistName} with {sessionInfo.clientName}</span>
          <span className={styles.progress}>
            Session: {Math.round(sessionInfo.sessionProgress * 100)}%
          </span>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>{event.description}</p>
        </div>

        <div className={styles.choices}>
          {event.choices.map((choice, index) => {
            const effects = formatEffects(choice)

            return (
              <button
                key={index}
                className={styles.choiceButton}
                onClick={() => onChoice(index)}
              >
                <span className={styles.choiceText}>{choice.text}</span>
                {effects.length > 0 && (
                  <div className={styles.effects}>
                    {effects.map((effect, i) => (
                      <span
                        key={i}
                        className={`${styles.effectTag} ${
                          effect.type === 'positive'
                            ? styles.effectPositive
                            : effect.type === 'negative'
                              ? styles.effectNegative
                              : styles.effectNeutral
                        }`}
                      >
                        {effect.label}: {effect.value}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            Your choice will affect session quality
          </span>
        </div>
      </div>
    </div>
  )
}
