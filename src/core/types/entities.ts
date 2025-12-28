// ================== THERAPIST ==================

/**
 * Professional credential/license type
 * Affects salary ranges, client preferences, and supervision eligibility
 */
export type CredentialType =
  | 'LMFT'   // Licensed Marriage & Family Therapist
  | 'LCSW'   // Licensed Clinical Social Worker
  | 'LPC'    // Licensed Professional Counselor
  | 'LPCC'   // Licensed Professional Clinical Counselor
  | 'PsyD'   // Doctor of Psychology
  | 'PhD'    // Doctor of Philosophy (Psychology)

/**
 * Primary therapeutic modality/approach
 * Affects session quality based on condition matching
 */
export type TherapeuticModality =
  | 'CBT'           // Cognitive Behavioral Therapy
  | 'DBT'           // Dialectical Behavior Therapy
  | 'Psychodynamic' // Insight-oriented therapy
  | 'Humanistic'    // Person-centered/Rogerian
  | 'EMDR'          // Eye Movement Desensitization & Reprocessing
  | 'Somatic'       // Body-based trauma therapy
  | 'FamilySystems' // Systemic/family therapy
  | 'Integrative'   // Eclectic/mixed approach

/**
 * Custom work schedule for a therapist
 */
export interface TherapistWorkSchedule {
  /** Hour to start work (default: 8) */
  workStartHour: number
  /** Hour to end work (default: 17) */
  workEndHour: number
  /** Array of break hours (max 3), empty array means no breaks */
  breakHours: number[]
}

export interface Therapist {
  id: string
  displayName: string
  isPlayer: boolean

  // Professional Identity
  credential: CredentialType
  primaryModality: TherapeuticModality
  secondaryModalities: TherapeuticModality[]

  // Stats
  energy: number
  maxEnergy: number
  baseSkill: number // 1-100
  level: number // 1-50
  xp: number

  // Employment
  hourlySalary: number // 0 for player
  hireDay: number

  // Qualifications
  certifications: Certification[]
  specializations: Specialization[]

  // Status
  status: TherapistStatus
  burnoutRecoveryProgress: number // 0-100

  // Personality (for client matching)
  traits: TherapistTraits

  // Work Schedule (custom hours per therapist)
  workSchedule: TherapistWorkSchedule
}

export interface TherapistTraits {
  warmth: number // 1-10
  analytical: number // 1-10
  creativity: number // 1-10
}

export type TherapistStatus =
  | 'available'
  | 'in_session'
  | 'on_break'
  | 'in_training'
  | 'burned_out'

export type Certification =
  | 'trauma_certified'
  | 'couples_certified'
  | 'supervisor_certified'
  | 'telehealth_certified'
  | 'children_certified'
  | 'substance_certified'
  | 'emdr_certified'
  | 'cbt_certified'
  | 'dbt_certified'

export type Specialization =
  | 'children'
  | 'couples'
  | 'trauma'
  | 'ptsd'
  | 'anxiety_disorders'
  | 'depression'
  | 'grief'
  | 'eating_disorders'
  | 'ocd'
  | 'personality_disorders'
  | 'substance_abuse'
  | 'stress_management'

// ================== CLIENT ==================

export interface Client {
  id: string
  displayName: string // Anonymized: "Client AB"

  // Condition
  conditionCategory: ConditionCategory
  conditionType: string
  severity: number // 1-10

  // Treatment Progress
  sessionsRequired: number // 4-20
  sessionsCompleted: number
  treatmentProgress: number // 0.0-1.0

  // Status
  status: ClientStatus
  satisfaction: number // 0-100
  engagement: number // 0-100

  // Financial
  isPrivatePay: boolean
  insuranceProvider: InsurerId | null
  sessionRate: number // Base rate for this client

  // Scheduling
  prefersVirtual: boolean
  preferredFrequency: SessionFrequency
  preferredTime: TimePreference
  availability: DayAvailability

  // Requirements
  requiredCertification: Certification | null
  isMinor: boolean
  isCouple: boolean

  // Waiting
  arrivalDay: number
  daysWaiting: number
  maxWaitDays: number

  // Assignment
  assignedTherapistId: string | null

  // Source tracking
  referralSource?: 'organic' | 'colleague' | 'marketing' | 'insurance'
}

export type ClientStatus = 'waiting' | 'in_treatment' | 'completed' | 'dropped'

export type ConditionCategory =
  | 'anxiety'
  | 'depression'
  | 'trauma'
  | 'stress'
  | 'relationship'
  | 'behavioral'

export type SessionFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly'

export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'any'

export interface DayAvailability {
  monday: number[] // Available hours, e.g., [9, 10, 11, 14, 15]
  tuesday: number[]
  wednesday: number[]
  thursday: number[]
  friday: number[]
}

// ================== SESSION ==================

export interface Session {
  id: string

  // Participants
  therapistId: string
  clientId: string

  // Type
  sessionType: SessionType
  isVirtual: boolean
  isInsurance: boolean

  // Scheduling
  scheduledDay: number
  scheduledHour: number
  durationMinutes: SessionDuration

  // Execution
  status: SessionStatus
  progress: number // 0.0-1.0
  quality: number // 0.0-1.0
  qualityModifiers: QualityModifier[]

  // Outcome
  payment: number
  energyCost: number
  xpGained: number

  // History (for completed sessions)
  completedAt?: GameTime
  decisionsMade: DecisionChoice[]

  // Cached names for history display
  therapistName: string
  clientName: string
}

export type SessionType = 'clinical' | 'supervision'
export type SessionDuration = 50 | 80 | 180
export type SessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'conflict'

export interface QualityModifier {
  source: string
  value: number
  description: string
}

export interface DecisionChoice {
  eventId: string
  choiceIndex: number
  effects: DecisionEffects
}

export interface DecisionEffects {
  quality?: number
  energy?: number
  satisfaction?: number
}

export interface GameTime {
  day: number
  hour: number
  minute: number
}

// ================== INSURANCE ==================

export type InsurerId = 'aetna' | 'bluecross' | 'cigna' | 'united' | 'medicaid'

export interface InsurancePanel {
  id: InsurerId
  name: string
  reimbursement: number
  delayDays: number
  denialRate: number
  applicationFee: number
  minReputation: number
}

/**
 * Reasons why an insurance claim may be denied
 */
export type DenialReason =
  | 'insufficient_documentation'
  | 'medical_necessity'
  | 'session_limit_exceeded'
  | 'coding_error'
  | 'prior_auth_required'
  | 'out_of_network'

export interface PendingClaim {
  id: string
  sessionId: string
  insurerId: InsurerId
  amount: number
  scheduledPaymentDay: number
  status: 'pending' | 'paid' | 'denied' | 'appealed'
  denialReason?: DenialReason
  appealDeadlineDay?: number
  appealSubmittedDay?: number
}

// ================== TRAINING ==================

export interface TrainingProgram {
  id: string
  name: string
  description: string
  track: 'clinical' | 'business'
  cost: number
  durationHours: number
  prerequisites: TrainingPrerequisites
  grants: TrainingGrants
}

export interface TrainingPrerequisites {
  minSkill?: number
  certifications?: Certification[]
  /** Required credential types (any of these qualifies) */
  requiredCredentials?: CredentialType[]
}

export interface TrainingGrants {
  skillBonus?: number
  certification?: Certification
  clinicBonus?: ClinicBonus
}

export interface ActiveTraining {
  programId: string
  therapistId: string
  startDay: number
  hoursCompleted: number
  totalHours: number
}

export interface ClinicBonus {
  type: 'hiring_capacity' | 'insurance_multiplier' | 'reputation_bonus'
  value: number
}

// ================== OFFICE ==================

export interface Building {
  id: string
  name: string
  tier: 1 | 2 | 3
  rooms: number
  monthlyRent: number
  upgradeCost: number
  requiredLevel: number
}

// ================== EVENTS ==================

export interface DecisionEvent {
  id: string
  title: string
  description: string
  triggerConditions?: DecisionEventConditions
  choices: DecisionEventChoice[]
}

export interface DecisionEventConditions {
  minSeverity?: number
  conditionCategories?: ConditionCategory[]
}

export interface DecisionEventChoice {
  text: string
  effects: DecisionEffects
}

export interface RandomEvent {
  id: string
  title: string
  description: string
  type: 'positive' | 'negative' | 'neutral'
  cooldownDays: number
  conditions?: RandomEventConditions
  choices: RandomEventChoice[]
}

export interface RandomEventConditions {
  minReputation?: number
  minTherapists?: number
  minDay?: number
}

export interface RandomEventChoice {
  text: string
  effects: RandomEventEffects
}

export interface RandomEventEffects {
  money?: number
  reputation?: number
  playerEnergy?: number
  cancelTherapistSessions?: boolean
  newClient?: boolean
  modifier?: GameModifier
}

export interface GameModifier {
  id: string
  name: string
  effect: string
  startDay: number
  duration: number
  multiplier: number
}

// ================== TRANSACTION ==================

export interface Transaction {
  id: string
  day: number
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string
}

// ================== SCHEDULE ==================

export interface ScheduleSlot {
  therapistId: string
  day: number
  hour: number
  type: 'session' | 'break' | 'training' | 'empty'
  sessionId?: string
}

// Type for the schedule data structure
// schedule[day][hour][therapistId] = sessionId | 'break' | 'training' | undefined
export type Schedule = Record<number, Record<number, Record<string, string | undefined>>>
