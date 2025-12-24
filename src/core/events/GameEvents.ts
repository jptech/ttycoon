/**
 * All game event types as a const object for type safety
 */
export const GameEvents = {
  // ==================== Time Events ====================
  DAY_STARTED: 'day_started',
  DAY_ENDED: 'day_ended',
  HOUR_CHANGED: 'hour_changed',
  MINUTE_CHANGED: 'minute_changed',

  // ==================== Session Events ====================
  SESSION_SCHEDULED: 'session_scheduled',
  SESSION_STARTED: 'session_started',
  SESSION_PROGRESS: 'session_progress',
  SESSION_COMPLETED: 'session_completed',
  SESSION_CANCELLED: 'session_cancelled',
  DECISION_EVENT_TRIGGERED: 'decision_event_triggered',
  DECISION_MADE: 'decision_made',

  // ==================== Client Events ====================
  CLIENT_ARRIVED: 'client_arrived',
  CLIENT_SCHEDULED: 'client_scheduled',
  CLIENT_CURED: 'client_cured',
  CLIENT_DROPPED: 'client_dropped',
  CLIENT_PROGRESS_UPDATED: 'client_progress_updated',

  // ==================== Therapist Events ====================
  THERAPIST_HIRED: 'therapist_hired',
  THERAPIST_FIRED: 'therapist_fired',
  THERAPIST_ENERGY_CHANGED: 'therapist_energy_changed',
  THERAPIST_BURNED_OUT: 'therapist_burned_out',
  THERAPIST_RECOVERED: 'therapist_recovered',
  THERAPIST_LEVELED_UP: 'therapist_leveled_up',

  // ==================== Economy Events ====================
  MONEY_CHANGED: 'money_changed',
  PAYMENT_RECEIVED: 'payment_received',
  EXPENSE_PAID: 'expense_paid',
  INSURANCE_CLAIM_SCHEDULED: 'insurance_claim_scheduled',
  INSURANCE_CLAIM_PAID: 'insurance_claim_paid',
  INSURANCE_CLAIM_DENIED: 'insurance_claim_denied',

  // ==================== Reputation Events ====================
  REPUTATION_CHANGED: 'reputation_changed',
  PRACTICE_LEVEL_CHANGED: 'practice_level_changed',

  // ==================== Training Events ====================
  TRAINING_STARTED: 'training_started',
  TRAINING_PROGRESS: 'training_progress',
  TRAINING_COMPLETED: 'training_completed',
  CERTIFICATION_EARNED: 'certification_earned',

  // ==================== Office Events ====================
  BUILDING_UPGRADED: 'building_upgraded',
  TELEHEALTH_UNLOCKED: 'telehealth_unlocked',

  // ==================== Insurance Events ====================
  INSURANCE_PANEL_APPLIED: 'insurance_panel_applied',
  INSURANCE_PANEL_ACCEPTED: 'insurance_panel_accepted',
  INSURANCE_PANEL_REJECTED: 'insurance_panel_rejected',

  // ==================== Random Events ====================
  RANDOM_EVENT_TRIGGERED: 'random_event_triggered',
  RANDOM_EVENT_CHOICE_MADE: 'random_event_choice_made',
  MODIFIER_APPLIED: 'modifier_applied',
  MODIFIER_EXPIRED: 'modifier_expired',

  // ==================== Game State Events ====================
  GAME_PAUSED: 'game_paused',
  GAME_RESUMED: 'game_resumed',
  GAME_SPEED_CHANGED: 'game_speed_changed',
  GAME_SAVED: 'game_saved',
  GAME_LOADED: 'game_loaded',
} as const

export type GameEventType = (typeof GameEvents)[keyof typeof GameEvents]

/**
 * Payload types for each event
 */
export interface GameEventPayloads {
  // Time Events
  [GameEvents.DAY_STARTED]: { dayNumber: number }
  [GameEvents.DAY_ENDED]: { dayNumber: number }
  [GameEvents.HOUR_CHANGED]: { hour: number; isInitial: boolean }
  [GameEvents.MINUTE_CHANGED]: { minute: number }

  // Session Events
  [GameEvents.SESSION_SCHEDULED]: { sessionId: string; therapistId: string; clientId: string; day: number; hour: number }
  [GameEvents.SESSION_STARTED]: { sessionId: string }
  [GameEvents.SESSION_PROGRESS]: { sessionId: string; progress: number }
  [GameEvents.SESSION_COMPLETED]: { sessionId: string; quality: number; payment: number }
  [GameEvents.SESSION_CANCELLED]: { sessionId: string; reason: string }
  [GameEvents.DECISION_EVENT_TRIGGERED]: { sessionId: string; eventId: string }
  [GameEvents.DECISION_MADE]: { sessionId: string; eventId: string; choiceIndex: number }

  // Client Events
  [GameEvents.CLIENT_ARRIVED]: { clientId: string; conditionCategory: string }
  [GameEvents.CLIENT_SCHEDULED]: { clientId: string; sessionId: string }
  [GameEvents.CLIENT_CURED]: { clientId: string; sessionsCompleted: number }
  [GameEvents.CLIENT_DROPPED]: { clientId: string; reason: 'wait_exceeded' | 'low_engagement' | 'dissatisfied' }
  [GameEvents.CLIENT_PROGRESS_UPDATED]: { clientId: string; progress: number }

  // Therapist Events
  [GameEvents.THERAPIST_HIRED]: { therapistId: string; isPlayer: boolean }
  [GameEvents.THERAPIST_FIRED]: { therapistId: string }
  [GameEvents.THERAPIST_ENERGY_CHANGED]: { therapistId: string; oldEnergy: number; newEnergy: number }
  [GameEvents.THERAPIST_BURNED_OUT]: { therapistId: string }
  [GameEvents.THERAPIST_RECOVERED]: { therapistId: string }
  [GameEvents.THERAPIST_LEVELED_UP]: { therapistId: string; newLevel: number }

  // Economy Events
  [GameEvents.MONEY_CHANGED]: { oldBalance: number; newBalance: number; reason: string }
  [GameEvents.PAYMENT_RECEIVED]: { amount: number; source: string }
  [GameEvents.EXPENSE_PAID]: { amount: number; category: string }
  [GameEvents.INSURANCE_CLAIM_SCHEDULED]: { claimId: string; amount: number; insurerId: string; paymentDay: number }
  [GameEvents.INSURANCE_CLAIM_PAID]: { claimId: string; amount: number }
  [GameEvents.INSURANCE_CLAIM_DENIED]: { claimId: string; amount: number; insurerId: string }

  // Reputation Events
  [GameEvents.REPUTATION_CHANGED]: { oldValue: number; newValue: number; reason: string }
  [GameEvents.PRACTICE_LEVEL_CHANGED]: { oldLevel: number; newLevel: number }

  // Training Events
  [GameEvents.TRAINING_STARTED]: { therapistId: string; programId: string }
  [GameEvents.TRAINING_PROGRESS]: { therapistId: string; programId: string; progress: number }
  [GameEvents.TRAINING_COMPLETED]: { therapistId: string; programId: string }
  [GameEvents.CERTIFICATION_EARNED]: { therapistId: string; certification: string }

  // Office Events
  [GameEvents.BUILDING_UPGRADED]: { buildingId: string }
  [GameEvents.TELEHEALTH_UNLOCKED]: Record<string, never>

  // Insurance Events
  [GameEvents.INSURANCE_PANEL_APPLIED]: { panelId: string }
  [GameEvents.INSURANCE_PANEL_ACCEPTED]: { panelId: string }
  [GameEvents.INSURANCE_PANEL_REJECTED]: { panelId: string }

  // Random Events
  [GameEvents.RANDOM_EVENT_TRIGGERED]: { eventId: string }
  [GameEvents.RANDOM_EVENT_CHOICE_MADE]: { eventId: string; choiceIndex: number }
  [GameEvents.MODIFIER_APPLIED]: { modifierId: string; duration: number }
  [GameEvents.MODIFIER_EXPIRED]: { modifierId: string }

  // Game State Events
  [GameEvents.GAME_PAUSED]: { reason: string }
  [GameEvents.GAME_RESUMED]: { reason: string }
  [GameEvents.GAME_SPEED_CHANGED]: { oldSpeed: number; newSpeed: number }
  [GameEvents.GAME_SAVED]: { timestamp: number }
  [GameEvents.GAME_LOADED]: { timestamp: number }
}
