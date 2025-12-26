import type { RandomEvent, GameModifier } from '@/core/types'

/**
 * Random events that can trigger at the start of each day.
 * Each event has conditions, cooldowns, and choices with effects.
 */
export const RANDOM_EVENTS: Record<string, RandomEvent> = {
  // ==================== POSITIVE EVENTS ====================

  referral_call: {
    id: 'referral_call',
    title: 'Colleague Referral',
    description:
      "A fellow therapist has a client they think would be a great fit for your practice. They've vouched for you personally, so this client is already eager to start treatment.",
    type: 'positive',
    cooldownDays: 5,
    conditions: {
      minReputation: 30,
    },
    choices: [
      {
        text: 'Accept the referral',
        effects: {
          reputation: 3,
          newClient: true,
        },
      },
      {
        text: 'Politely decline (too busy)',
        effects: {
          reputation: -2,
        },
      },
    ],
  },

  positive_review: {
    id: 'positive_review',
    title: 'Glowing Review',
    description:
      "A former client has left a wonderful review about their experience at your practice. It's already getting attention online.",
    type: 'positive',
    cooldownDays: 7,
    conditions: {
      minReputation: 50,
      minDay: 14,
    },
    choices: [
      {
        text: 'Share it publicly on social media',
        effects: {
          reputation: 5,
          modifier: {
            id: 'reputation_boost',
            name: 'Reputation Boost',
            effect: 'reputation_gain',
            startDay: 0, // Will be set when applied
            duration: 5,
            multiplier: 1.5,
          },
        },
      },
      {
        text: 'Keep it private and thank them personally',
        effects: {
          reputation: 2,
        },
      },
    ],
  },

  networking_opportunity: {
    id: 'networking_opportunity',
    title: 'Networking Event',
    description:
      'You receive an invitation to a local mental health professionals networking event this evening.',
    type: 'positive',
    cooldownDays: 10,
    conditions: {
      minDay: 7,
    },
    choices: [
      {
        text: 'Attend and network',
        effects: {
          playerEnergy: -10,
          reputation: 3,
          modifier: {
            id: 'busy_week',
            name: 'Busy Week',
            effect: 'client_arrival',
            startDay: 0,
            duration: 7,
            multiplier: 1.2,
          },
        },
      },
      {
        text: 'Skip it and rest',
        effects: {
          playerEnergy: 5,
        },
      },
    ],
  },

  grant_opportunity: {
    id: 'grant_opportunity',
    title: 'Grant Opportunity',
    description:
      'You discover a grant program for mental health practices serving underserved communities. The application would take some effort.',
    type: 'positive',
    cooldownDays: 30,
    conditions: {
      minReputation: 100,
      minDay: 30,
    },
    choices: [
      {
        text: 'Apply for the grant',
        effects: {
          playerEnergy: -15,
          money: 2500,
          reputation: 5,
        },
      },
      {
        text: 'Pass on this one',
        effects: {},
      },
    ],
  },

  media_feature: {
    id: 'media_feature',
    title: 'Media Feature',
    description:
      'A local news outlet wants to feature your practice in a segment about mental health awareness.',
    type: 'positive',
    cooldownDays: 21,
    conditions: {
      minReputation: 75,
      minDay: 21,
    },
    choices: [
      {
        text: 'Accept the interview',
        effects: {
          reputation: 8,
          modifier: {
            id: 'media_spotlight',
            name: 'Media Spotlight',
            effect: 'client_arrival',
            startDay: 0,
            duration: 10,
            multiplier: 1.3,
          },
        },
      },
      {
        text: 'Decline politely',
        effects: {
          reputation: 1,
        },
      },
    ],
  },

  // ==================== NEGATIVE EVENTS ====================

  therapist_sick: {
    id: 'therapist_sick',
    title: 'Staff Illness',
    description:
      "One of your therapists has called in sick. They won't be able to see clients today.",
    type: 'negative',
    cooldownDays: 7,
    conditions: {
      minTherapists: 2,
    },
    choices: [
      {
        text: 'Cover their sessions yourself',
        effects: {
          playerEnergy: -25,
          reputation: 2,
        },
      },
      {
        text: 'Cancel their sessions for today',
        effects: {
          cancelTherapistSessions: true,
          reputation: -3,
        },
      },
    ],
  },

  insurance_audit: {
    id: 'insurance_audit',
    title: 'Insurance Audit',
    description:
      'An insurance company is conducting a random audit of your claims. This will require time and attention.',
    type: 'negative',
    cooldownDays: 14,
    conditions: {
      minDay: 21,
    },
    choices: [
      {
        text: 'Handle the audit thoroughly',
        effects: {
          playerEnergy: -15,
          money: -200, // Administrative costs
        },
      },
      {
        text: 'Hire a consultant to manage it',
        effects: {
          money: -500,
        },
      },
    ],
  },

  economic_downturn: {
    id: 'economic_downturn',
    title: 'Economic Concerns',
    description:
      'News of economic uncertainty is causing some clients to reconsider their therapy expenses.',
    type: 'negative',
    cooldownDays: 21,
    conditions: {
      minDay: 14,
    },
    choices: [
      {
        text: 'Offer temporary reduced rates',
        effects: {
          reputation: 3,
          modifier: {
            id: 'reduced_rates',
            name: 'Reduced Rates',
            effect: 'session_fee',
            startDay: 0,
            duration: 14,
            multiplier: 0.8,
          },
        },
      },
      {
        text: 'Maintain standard rates',
        effects: {
          reputation: -2,
        },
      },
    ],
  },

  equipment_failure: {
    id: 'equipment_failure',
    title: 'Equipment Malfunction',
    description:
      'The telehealth system is experiencing technical difficulties this morning.',
    type: 'negative',
    cooldownDays: 10,
    conditions: {
      minDay: 7,
    },
    choices: [
      {
        text: 'Pay for emergency repair',
        effects: {
          money: -300,
        },
      },
      {
        text: 'Switch to phone sessions today',
        effects: {
          reputation: -1,
        },
      },
    ],
  },

  // ==================== NEUTRAL EVENTS ====================

  difficult_session: {
    id: 'difficult_session',
    title: 'Challenging Client Situation',
    description:
      'A client is going through a particularly difficult time and has requested extra support this week.',
    type: 'neutral',
    cooldownDays: 5,
    conditions: {},
    choices: [
      {
        text: 'Provide extra support sessions',
        effects: {
          playerEnergy: -10,
          reputation: 2,
        },
      },
      {
        text: 'Maintain standard session schedule',
        effects: {},
      },
    ],
  },

  scheduling_conflict: {
    id: 'scheduling_conflict',
    title: 'Scheduling Mix-up',
    description:
      "There's been a double-booking for one of your therapy rooms. Two clients are expecting appointments at the same time.",
    type: 'neutral',
    cooldownDays: 7,
    conditions: {
      minDay: 5,
    },
    choices: [
      {
        text: 'Offer one client a virtual session',
        effects: {
          reputation: 1,
        },
      },
      {
        text: 'Reschedule one client',
        effects: {
          reputation: -1,
        },
      },
    ],
  },

  supervision_request: {
    id: 'supervision_request',
    title: 'Supervision Inquiry',
    description:
      'A graduate student is looking for a clinical supervisor. They would pay a supervision fee but require your time.',
    type: 'neutral',
    cooldownDays: 14,
    conditions: {
      minReputation: 60,
      minDay: 14,
    },
    choices: [
      {
        text: 'Accept the supervision role',
        effects: {
          playerEnergy: -5,
          money: 150,
          reputation: 2,
        },
      },
      {
        text: 'Decline due to capacity',
        effects: {},
      },
    ],
  },

  workshop_opportunity: {
    id: 'workshop_opportunity',
    title: 'Workshop Invitation',
    description:
      'A local organization wants you to lead a mental health awareness workshop. It would be unpaid but could build your reputation.',
    type: 'neutral',
    cooldownDays: 14,
    conditions: {
      minReputation: 40,
    },
    choices: [
      {
        text: 'Lead the workshop',
        effects: {
          playerEnergy: -15,
          reputation: 4,
        },
      },
      {
        text: 'Suggest another time',
        effects: {
          reputation: 1,
        },
      },
    ],
  },

  continuing_education: {
    id: 'continuing_education',
    title: 'CE Opportunity',
    description:
      "There's a free continuing education webinar today on a cutting-edge therapy technique.",
    type: 'neutral',
    cooldownDays: 10,
    conditions: {},
    choices: [
      {
        text: 'Attend the webinar',
        effects: {
          playerEnergy: -5,
          reputation: 1,
        },
      },
      {
        text: 'Skip it and focus on clients',
        effects: {},
      },
    ],
  },
}

/**
 * Get a random event by ID
 */
export function getRandomEvent(id: string): RandomEvent | undefined {
  return RANDOM_EVENTS[id]
}

/**
 * Get all random events as an array
 */
export function getAllRandomEvents(): RandomEvent[] {
  return Object.values(RANDOM_EVENTS)
}

/**
 * Get random events by type
 */
export function getRandomEventsByType(
  type: 'positive' | 'negative' | 'neutral'
): RandomEvent[] {
  return Object.values(RANDOM_EVENTS).filter((event) => event.type === type)
}

/**
 * Get random events that meet conditions
 */
export function getEligibleRandomEvents(
  currentDay: number,
  reputation: number,
  therapistCount: number
): RandomEvent[] {
  return Object.values(RANDOM_EVENTS).filter((event) => {
    if (!event.conditions) return true

    if (event.conditions.minReputation !== undefined) {
      if (reputation < event.conditions.minReputation) return false
    }
    if (event.conditions.minTherapists !== undefined) {
      if (therapistCount < event.conditions.minTherapists) return false
    }
    if (event.conditions.minDay !== undefined) {
      if (currentDay < event.conditions.minDay) return false
    }

    return true
  })
}

/**
 * Common modifiers that can be applied by events
 */
export const COMMON_MODIFIERS: Record<string, Omit<GameModifier, 'startDay'>> = {
  busy_week: {
    id: 'busy_week',
    name: 'Busy Week',
    effect: 'client_arrival',
    duration: 7,
    multiplier: 1.2,
  },
  reputation_boost: {
    id: 'reputation_boost',
    name: 'Reputation Boost',
    effect: 'reputation_gain',
    duration: 5,
    multiplier: 1.5,
  },
  // CRIT-003 fix: Renamed from 'economic_downturn' to avoid ID collision with the event
  reduced_rates: {
    id: 'reduced_rates',
    name: 'Reduced Rates',
    effect: 'session_fee',
    duration: 14,
    multiplier: 0.8,
  },
  media_spotlight: {
    id: 'media_spotlight',
    name: 'Media Spotlight',
    effect: 'client_arrival',
    duration: 10,
    multiplier: 1.3,
  },
}

/**
 * Create a modifier instance with a start day
 */
export function createModifierInstance(
  modifierId: string,
  startDay: number
): GameModifier | null {
  const template = COMMON_MODIFIERS[modifierId]
  if (!template) return null

  return {
    ...template,
    startDay,
  }
}
