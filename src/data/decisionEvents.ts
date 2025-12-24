import type { DecisionEvent, ConditionCategory } from '@/core/types'

/**
 * Decision events that can trigger during therapy sessions.
 * These require player choice and affect session quality/energy/satisfaction.
 */
export const DECISION_EVENTS: Record<string, DecisionEvent> = {
  // ==================== GENERAL EVENTS (No conditions) ====================

  client_resistant: {
    id: 'client_resistant',
    title: 'Client Resistance',
    description:
      'Your client seems reluctant to engage today. They keep deflecting questions and seem distracted.',
    choices: [
      {
        text: 'Gently explore the resistance',
        effects: {
          quality: 0.1,
          energy: -5,
        },
      },
      {
        text: 'Push through with the planned approach',
        effects: {
          quality: -0.1,
          energy: 0,
        },
      },
    ],
  },

  emotional_breakthrough: {
    id: 'emotional_breakthrough',
    title: 'Emotional Breakthrough',
    description:
      'Your client has just made a significant emotional connection. This is a pivotal moment in their therapy.',
    choices: [
      {
        text: 'Process deeply and hold space',
        effects: {
          quality: 0.15,
          energy: -8,
          satisfaction: 10,
        },
      },
      {
        text: 'Stabilize and continue with session structure',
        effects: {
          quality: 0.05,
          energy: -2,
        },
      },
    ],
  },

  boundary_issue: {
    id: 'boundary_issue',
    title: 'Boundary Concern',
    description:
      'Your client is asking personal questions about your life or trying to shift the therapeutic relationship.',
    choices: [
      {
        text: 'Address the boundary directly but warmly',
        effects: {
          quality: 0.1,
          energy: -3,
        },
      },
      {
        text: 'Redirect the conversation back to their concerns',
        effects: {
          quality: 0,
          energy: 0,
        },
      },
    ],
  },

  transference: {
    id: 'transference',
    title: 'Therapeutic Relationship',
    description:
      'Your client seems to be projecting feelings from another relationship onto your therapeutic work together.',
    choices: [
      {
        text: 'Explore this therapeutically',
        effects: {
          quality: 0.12,
          energy: -6,
        },
      },
      {
        text: 'Maintain clear professional boundaries',
        effects: {
          quality: 0.03,
          energy: -2,
        },
      },
    ],
  },

  silence_moment: {
    id: 'silence_moment',
    title: 'Extended Silence',
    description:
      "Your client has fallen into a long silence. They seem to be processing something internally.",
    choices: [
      {
        text: 'Wait patiently and hold the space',
        effects: {
          quality: 0.08,
          energy: -2,
        },
      },
      {
        text: 'Gently prompt them to share their thoughts',
        effects: {
          quality: 0.02,
          energy: 0,
        },
      },
    ],
  },

  insight_moment: {
    id: 'insight_moment',
    title: 'Client Insight',
    description:
      'Your client just made an important connection about their patterns. Their eyes light up with understanding.',
    choices: [
      {
        text: 'Reinforce and explore the insight deeply',
        effects: {
          quality: 0.12,
          energy: -4,
          satisfaction: 8,
        },
      },
      {
        text: 'Acknowledge and move forward',
        effects: {
          quality: 0.05,
          energy: 0,
        },
      },
    ],
  },

  // ==================== SEVERITY-BASED EVENTS ====================

  crisis_disclosure: {
    id: 'crisis_disclosure',
    title: 'Crisis Disclosure',
    description:
      'Your client has just disclosed something that suggests they may be in crisis. This requires careful handling.',
    triggerConditions: {
      minSeverity: 6,
    },
    choices: [
      {
        text: 'Extend the session to create a safety plan',
        effects: {
          quality: 0.15,
          energy: -12,
          satisfaction: 15,
        },
      },
      {
        text: 'Address immediate safety and schedule follow-up',
        effects: {
          quality: 0.08,
          energy: -5,
          satisfaction: 5,
        },
      },
    ],
  },

  difficult_emotions: {
    id: 'difficult_emotions',
    title: 'Intense Emotions',
    description:
      'Your client is experiencing overwhelming emotions that are difficult to contain in the session.',
    triggerConditions: {
      minSeverity: 5,
    },
    choices: [
      {
        text: 'Help them regulate using grounding techniques',
        effects: {
          quality: 0.1,
          energy: -6,
          satisfaction: 5,
        },
      },
      {
        text: 'Give them space to express freely',
        effects: {
          quality: 0.05,
          energy: -3,
        },
      },
    ],
  },

  // ==================== CONDITION-SPECIFIC EVENTS ====================

  anxiety_spiral: {
    id: 'anxiety_spiral',
    title: 'Anxiety Escalation',
    description:
      'You notice your client starting to spiral into anxious thoughts during the session.',
    triggerConditions: {
      conditionCategories: ['anxiety'],
    },
    choices: [
      {
        text: 'Introduce a breathing exercise',
        effects: {
          quality: 0.1,
          energy: -3,
          satisfaction: 5,
        },
      },
      {
        text: 'Explore the anxiety thoughts cognitively',
        effects: {
          quality: 0.08,
          energy: -5,
        },
      },
    ],
  },

  depressive_hopelessness: {
    id: 'depressive_hopelessness',
    title: 'Expressions of Hopelessness',
    description:
      "Your client is expressing deep hopelessness about their situation. They're questioning if things can improve.",
    triggerConditions: {
      conditionCategories: ['depression'],
    },
    choices: [
      {
        text: 'Validate and explore their feelings',
        effects: {
          quality: 0.1,
          energy: -5,
          satisfaction: 8,
        },
      },
      {
        text: 'Gently challenge negative thought patterns',
        effects: {
          quality: 0.06,
          energy: -3,
        },
      },
    ],
  },

  trauma_flashback: {
    id: 'trauma_flashback',
    title: 'Trauma Response',
    description:
      'Your client appears to be experiencing trauma-related distress. They seem disconnected from the present moment.',
    triggerConditions: {
      conditionCategories: ['trauma'],
      minSeverity: 5,
    },
    choices: [
      {
        text: 'Use grounding techniques to bring them back',
        effects: {
          quality: 0.12,
          energy: -8,
          satisfaction: 10,
        },
      },
      {
        text: 'Slow down and provide gentle reassurance',
        effects: {
          quality: 0.06,
          energy: -4,
          satisfaction: 5,
        },
      },
    ],
  },

  relationship_conflict: {
    id: 'relationship_conflict',
    title: 'Relationship Dilemma',
    description:
      'Your client is torn about a significant relationship decision and is looking for guidance.',
    triggerConditions: {
      conditionCategories: ['relationship'],
    },
    choices: [
      {
        text: 'Help them explore their own values and needs',
        effects: {
          quality: 0.1,
          energy: -4,
          satisfaction: 6,
        },
      },
      {
        text: 'Offer perspective on relationship dynamics',
        effects: {
          quality: 0.05,
          energy: -2,
        },
      },
    ],
  },

  stress_overwhelm: {
    id: 'stress_overwhelm',
    title: 'Overwhelming Stress',
    description:
      'Your client is describing an accumulation of stressors that feel unmanageable.',
    triggerConditions: {
      conditionCategories: ['stress'],
    },
    choices: [
      {
        text: 'Work on prioritization and coping strategies',
        effects: {
          quality: 0.1,
          energy: -4,
          satisfaction: 5,
        },
      },
      {
        text: 'Focus on stress reduction in the moment',
        effects: {
          quality: 0.06,
          energy: -2,
        },
      },
    ],
  },

  behavioral_setback: {
    id: 'behavioral_setback',
    title: 'Behavioral Setback',
    description:
      'Your client is reporting a setback in their progress with changing problematic behaviors.',
    triggerConditions: {
      conditionCategories: ['behavioral'],
    },
    choices: [
      {
        text: 'Normalize setbacks and explore triggers',
        effects: {
          quality: 0.1,
          energy: -4,
          satisfaction: 6,
        },
      },
      {
        text: 'Reinforce their overall progress',
        effects: {
          quality: 0.05,
          energy: -2,
        },
      },
    ],
  },

  // ==================== ENDING SESSION EVENTS ====================

  session_running_late: {
    id: 'session_running_late',
    title: 'Session Timing',
    description:
      'The session is nearing its end, but your client is in the middle of processing something important.',
    choices: [
      {
        text: 'Extend the session slightly',
        effects: {
          quality: 0.08,
          energy: -5,
          satisfaction: 5,
        },
      },
      {
        text: 'Gently wrap up and schedule a follow-up',
        effects: {
          quality: 0.02,
          energy: 0,
        },
      },
    ],
  },

  homework_resistance: {
    id: 'homework_resistance',
    title: 'Practice Resistance',
    description:
      "Your client admits they haven't been doing the between-session practices you discussed.",
    choices: [
      {
        text: 'Explore the barriers non-judgmentally',
        effects: {
          quality: 0.08,
          energy: -3,
          satisfaction: 3,
        },
      },
      {
        text: 'Simplify the homework and move on',
        effects: {
          quality: 0.02,
          energy: 0,
        },
      },
    ],
  },
}

/**
 * Get a decision event by ID
 */
export function getDecisionEvent(id: string): DecisionEvent | undefined {
  return DECISION_EVENTS[id]
}

/**
 * Get all decision events as an array
 */
export function getAllDecisionEvents(): DecisionEvent[] {
  return Object.values(DECISION_EVENTS)
}

/**
 * Get decision events that can trigger for given conditions
 */
export function getEligibleDecisionEvents(
  clientSeverity: number,
  conditionCategory: ConditionCategory
): DecisionEvent[] {
  return Object.values(DECISION_EVENTS).filter((event) => {
    if (!event.triggerConditions) return true

    // Check severity requirement
    if (event.triggerConditions.minSeverity !== undefined) {
      if (clientSeverity < event.triggerConditions.minSeverity) {
        return false
      }
    }

    // Check condition category requirement
    if (event.triggerConditions.conditionCategories !== undefined) {
      if (!event.triggerConditions.conditionCategories.includes(conditionCategory)) {
        return false
      }
    }

    return true
  })
}

/**
 * Get decision events without any conditions (always eligible)
 */
export function getGeneralDecisionEvents(): DecisionEvent[] {
  return Object.values(DECISION_EVENTS).filter(
    (event) => !event.triggerConditions
  )
}

/**
 * Get decision events for a specific condition category
 */
export function getDecisionEventsForCondition(
  category: ConditionCategory
): DecisionEvent[] {
  return Object.values(DECISION_EVENTS).filter((event) => {
    if (!event.triggerConditions?.conditionCategories) return false
    return event.triggerConditions.conditionCategories.includes(category)
  })
}

/**
 * Get the average quality impact of optimal choices
 */
export function getAverageOptimalQualityGain(): number {
  const events = Object.values(DECISION_EVENTS)
  let totalQuality = 0
  let count = 0

  for (const event of events) {
    // Find the best quality choice
    const bestChoice = event.choices.reduce((best, choice) => {
      const quality = choice.effects.quality ?? 0
      const bestQuality = best.effects.quality ?? 0
      return quality > bestQuality ? choice : best
    }, event.choices[0])

    if (bestChoice.effects.quality) {
      totalQuality += bestChoice.effects.quality
      count++
    }
  }

  return count > 0 ? totalQuality / count : 0
}
