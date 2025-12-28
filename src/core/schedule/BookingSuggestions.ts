import type {
  Client,
  Therapist,
  Session,
  Schedule,
  SessionDuration,
  Building,
  GameTime,
} from '@/core/types'
import { ClientManager, type FollowUpInfo, FREQUENCY_DAYS } from '@/core/clients'
import { TherapistManager } from '@/core/therapists'
import { ScheduleManager, SCHEDULE_CONFIG } from './ScheduleManager'

/**
 * Urgency level for booking suggestions
 */
export type SuggestionUrgency = 'overdue' | 'due_soon' | 'normal'

/**
 * Reason for suggesting this booking
 */
export type SuggestionReason =
  | 'overdue_followup' // Client is past their frequency interval
  | 'due_soon' // Within 3 days of expected next session
  | 'good_slot_available' // Strong preference match available
  | 'therapist_continuity' // Same therapist as previous sessions

/**
 * Match quality rating for holistic recommendation display
 */
export type MatchQuality = 'excellent' | 'good' | 'fair'

/**
 * Detailed match breakdown for UI display
 */
export interface MatchBreakdown {
  /** Overall match quality rating */
  quality: MatchQuality
  /** Therapist-client match score (0-100) */
  matchScore: number
  /** Has modality match for client's condition */
  hasModalityMatch: boolean
  /** Modality bonus percentage (0-15) */
  modalityBonus: number
  /** Is the assigned/continuing therapist */
  isContinuingTherapist: boolean
  /** Has required specialization */
  hasSpecialization: boolean
  /** Therapist has good energy for session */
  hasGoodEnergy: boolean
  /** Human-readable match reasons */
  matchReasons: string[]
}

/**
 * A booking suggestion for a client
 */
export interface BookingSuggestion {
  /** Unique ID for this suggestion */
  id: string
  /** Client needing a session */
  clientId: string
  /** Suggested therapist */
  therapistId: string
  /** Suggested day */
  suggestedDay: number
  /** Suggested hour */
  suggestedHour: number
  /** Suggested duration */
  duration: SessionDuration
  /** Whether virtual */
  isVirtual: boolean
  /** Urgency level */
  urgency: SuggestionUrgency
  /** Primary reason for suggestion */
  reason: SuggestionReason
  /** Score for sorting (higher = more urgent/better fit) */
  score: number
  /** Follow-up info for display */
  followUpInfo: FollowUpInfo
  /** Whether slot is a preferred match */
  isPreferredSlot: boolean
  /** Recommended recurring session count (based on remaining sessions, max 20) */
  suggestedRecurringCount: number
  /** Recommended interval in days (based on client's preferred frequency) */
  suggestedIntervalDays: number
  /** Detailed match breakdown for holistic recommendation */
  matchBreakdown: MatchBreakdown
}

/**
 * Parameters for generating suggestions
 */
export interface GenerateSuggestionsParams {
  clients: Client[]
  therapists: Therapist[]
  sessions: Session[]
  schedule: Schedule
  building: Building
  telehealthUnlocked: boolean
  currentTime: GameTime
  /** Maximum suggestions to return */
  maxSuggestions?: number
  /** Days ahead to look for slots */
  daysAhead?: number
}

/**
 * Result of generating suggestions
 */
export interface GenerateSuggestionsResult {
  suggestions: BookingSuggestion[]
  /** Clients that need booking but no suitable slot found */
  unschedulableClients: Array<{
    clientId: string
    reason: string
  }>
}

/**
 * Generate booking suggestions for clients needing follow-ups
 */
export function generateBookingSuggestions(
  params: GenerateSuggestionsParams
): GenerateSuggestionsResult {
  const {
    clients,
    therapists,
    sessions,
    schedule,
    building,
    telehealthUnlocked,
    currentTime,
    maxSuggestions = 10,
    daysAhead = 14,
  } = params

  const suggestions: BookingSuggestion[] = []
  const unschedulableClients: GenerateSuggestionsResult['unschedulableClients'] = []

  // Get active clients sorted by follow-up urgency
  const activeClientsWithFollowUp = ClientManager.getActiveClientsByFollowUpUrgency(
    clients,
    sessions,
    currentTime.day
  )

  // Also get waiting clients (they need initial booking)
  const waitingClients = clients
    .filter((c) => c.status === 'waiting')
    .map((client) => ({
      client,
      followUp: ClientManager.getFollowUpInfo(client, sessions, currentTime.day),
    }))

  // Combine and prioritize: overdue first, then due soon, then waiting
  const clientsNeedingBooking = [
    ...activeClientsWithFollowUp.filter(
      (c) => !c.followUp.hasUpcomingSession && c.followUp.remainingSessions > 0
    ),
    ...waitingClients,
  ]

  for (const { client, followUp } of clientsNeedingBooking) {
    if (suggestions.length >= maxSuggestions) break

    // Skip if client already has upcoming session
    if (followUp.hasUpcomingSession) continue

    // Skip if no remaining sessions
    if (followUp.remainingSessions <= 0) continue

    // Determine urgency
    const urgency = determineUrgency(followUp, currentTime.day)

    // Skip normal urgency if we already have enough urgent suggestions
    if (urgency === 'normal' && suggestions.length >= maxSuggestions / 2) continue

    // Find best therapist and slot
    const suggestion = findBestSlotForClient({
      client,
      followUp,
      therapists,
      sessions,
      schedule,
      building,
      telehealthUnlocked,
      currentTime,
      daysAhead,
      urgency,
    })

    if (suggestion) {
      suggestions.push(suggestion)
    } else {
      unschedulableClients.push({
        clientId: client.id,
        reason: 'No available slots matching preferences',
      })
    }
  }

  // Sort by score (descending)
  suggestions.sort((a, b) => b.score - a.score)

  return {
    suggestions: suggestions.slice(0, maxSuggestions),
    unschedulableClients,
  }
}

/**
 * Determine urgency level for a client
 */
function determineUrgency(followUp: FollowUpInfo, currentDay: number): SuggestionUrgency {
  if (followUp.isOverdue) {
    return 'overdue'
  }

  if (followUp.daysUntilDue !== null && followUp.daysUntilDue <= 3) {
    return 'due_soon'
  }

  return 'normal'
}

interface FindBestSlotParams {
  client: Client
  followUp: FollowUpInfo
  therapists: Therapist[]
  sessions: Session[]
  schedule: Schedule
  building: Building
  telehealthUnlocked: boolean
  currentTime: GameTime
  daysAhead: number
  urgency: SuggestionUrgency
}

/**
 * Find the best slot for a client
 */
function findBestSlotForClient(params: FindBestSlotParams): BookingSuggestion | null {
  const {
    client,
    followUp,
    therapists,
    sessions,
    schedule,
    building,
    telehealthUnlocked,
    currentTime,
    daysAhead,
    urgency,
  } = params

  // Prefer assigned therapist if they exist
  const assignedTherapist = client.assignedTherapistId
    ? therapists.find((t) => t.id === client.assignedTherapistId)
    : null

  // Get therapists who can treat this client (have required certifications)
  const eligibleTherapists = therapists.filter((t) => {
    // Check required certifications
    if (client.requiredCertification) {
      if (!t.certifications.includes(client.requiredCertification)) {
        return false
      }
    }
    return true
  })

  if (eligibleTherapists.length === 0) {
    return null
  }

  // Sort therapists: assigned first, then by match score
  const sortedTherapists = [...eligibleTherapists].sort((a, b) => {
    // Assigned therapist first
    if (a.id === client.assignedTherapistId) return -1
    if (b.id === client.assignedTherapistId) return 1

    // Then by match score
    const scoreA = ClientManager.calculateMatchScore(client, a)
    const scoreB = ClientManager.calculateMatchScore(client, b)
    return scoreB - scoreA
  })

  // Determine if virtual
  const isVirtual = client.prefersVirtual && telehealthUnlocked

  // Check room capacity for in-person
  const canDoInPerson = !isVirtual || !client.prefersVirtual

  // Duration preference (default 50)
  const duration: SessionDuration = 50

  // Find best slot
  for (const therapist of sortedTherapists) {
    const slots = ScheduleManager.findMatchingSlots(
      schedule,
      therapist,
      client,
      currentTime.day,
      daysAhead,
      duration
    )

    // Filter out past slots and slots where client has conflict
    const validSlots = slots.filter((slot) => {
      // Check not in past
      const validation = ScheduleManager.validateNotInPast(currentTime, slot.day, slot.hour)
      if (!validation.valid) return false

      // Check client doesn't have conflicting session
      if (
        ScheduleManager.clientHasConflictingSession(
          sessions,
          client.id,
          slot.day,
          slot.hour,
          duration
        )
      ) {
        return false
      }

      // Check therapist hasn't hit daily limit
      if (!ScheduleManager.canScheduleMoreToday(schedule, sessions, therapist.id, slot.day)) {
        return false
      }

      // For in-person, check room capacity
      if (!isVirtual) {
        const daySchedule = schedule[slot.day]
        let occupiedRooms = 0
        if (daySchedule && daySchedule[slot.hour]) {
          occupiedRooms = Object.keys(daySchedule[slot.hour]).length
        }
        if (occupiedRooms >= building.rooms) {
          return false
        }
      }

      return true
    })

    if (validSlots.length > 0) {
      // Pick best slot (preferred first, then soonest)
      const bestSlot = validSlots[0]

      // Calculate holistic match breakdown
      const matchBreakdown = calculateMatchBreakdown(
        client,
        therapist,
        sessions,
        schedule,
        currentTime.day
      )

      // Determine reason
      let reason: SuggestionReason = 'good_slot_available'
      if (urgency === 'overdue') {
        reason = 'overdue_followup'
      } else if (urgency === 'due_soon') {
        reason = 'due_soon'
      } else if (therapist.id === client.assignedTherapistId) {
        reason = 'therapist_continuity'
      }

      // Calculate score using holistic match breakdown
      const score = calculateSuggestionScore({
        urgency,
        isPreferred: bestSlot.isPreferred,
        matchBreakdown,
        daysUntilSlot: bestSlot.day - currentTime.day,
      })

      // Calculate recurring recommendation
      const remainingSessions = followUp.remainingSessions
      const suggestedRecurringCount = Math.min(remainingSessions, 20)
      const suggestedIntervalDays = FREQUENCY_DAYS[client.preferredFrequency] || 7

      return {
        id: crypto.randomUUID(),
        clientId: client.id,
        therapistId: therapist.id,
        suggestedDay: bestSlot.day,
        suggestedHour: bestSlot.hour,
        duration,
        isVirtual,
        urgency,
        reason,
        score,
        followUpInfo: followUp,
        isPreferredSlot: bestSlot.isPreferred,
        suggestedRecurringCount,
        suggestedIntervalDays,
        matchBreakdown,
      }
    }
  }

  return null
}

interface ScoreParams {
  urgency: SuggestionUrgency
  isPreferred: boolean
  matchBreakdown: MatchBreakdown
  daysUntilSlot: number
}

/**
 * Calculate a score for sorting suggestions
 * Higher score = more important/better suggestion
 *
 * Scoring breakdown:
 * - Urgency: 1000 (overdue), 500 (due_soon), 100 (normal)
 * - Match quality: 150 (excellent), 100 (good), 50 (fair)
 * - Modality match: up to 50 points based on bonus percentage
 * - Same therapist: 40 points
 * - Preferred time slot: 30 points
 * - Therapist match score: up to 50 points (0-100 -> 0-50)
 * - Good energy: 20 points
 * - Sooner scheduling: -3 per day (prefer sooner)
 */
function calculateSuggestionScore(params: ScoreParams): number {
  const { urgency, isPreferred, matchBreakdown, daysUntilSlot } = params

  let score = 0

  // Urgency is most important
  switch (urgency) {
    case 'overdue':
      score += 1000
      break
    case 'due_soon':
      score += 500
      break
    case 'normal':
      score += 100
      break
  }

  // Match quality rating (holistic assessment)
  switch (matchBreakdown.quality) {
    case 'excellent':
      score += 150
      break
    case 'good':
      score += 100
      break
    case 'fair':
      score += 50
      break
  }

  // Modality match bonus (0-15% bonus -> 0-50 points)
  if (matchBreakdown.hasModalityMatch) {
    score += Math.round(matchBreakdown.modalityBonus * 100 * 0.33)
  }

  // Continuing therapist bonus (relationship continuity)
  if (matchBreakdown.isContinuingTherapist) {
    score += 40
  }

  // Preferred slot bonus
  if (isPreferred) {
    score += 30
  }

  // Therapist-client match score (0-100 -> 0-50)
  score += matchBreakdown.matchScore * 0.5

  // Good energy bonus (therapist not overloaded)
  if (matchBreakdown.hasGoodEnergy) {
    score += 20
  }

  // Sooner is better (subtract days, but less aggressively)
  score -= daysUntilSlot * 3

  return Math.round(score)
}

/**
 * Calculate detailed match breakdown for a therapist-client pairing
 */
function calculateMatchBreakdown(
  client: Client,
  therapist: Therapist,
  sessions: Session[],
  schedule: Schedule,
  currentDay: number
): MatchBreakdown {
  const matchResult = ClientManager.calculateMatchScore(client, therapist)
  const matchScore = matchResult.score

  // Get modality match
  const modalityBonus = TherapistManager.getModalityMatchBonus(therapist, client.conditionCategory)
  const hasModalityMatch = modalityBonus > 0

  // Check if continuing therapist
  const isContinuingTherapist = client.assignedTherapistId === therapist.id

  // Check specialization match
  const relevantSpecs = getRelevantSpecializationsForCondition(client.conditionCategory)
  const hasSpecialization = therapist.specializations.some((s) => relevantSpecs.includes(s))

  // Check therapist energy forecast
  const energyForecast = TherapistManager.forecastEnergy(therapist, sessions, schedule, currentDay)
  const hasGoodEnergy = !energyForecast.willBurnOut && energyForecast.predictedEndEnergy >= 30

  // Build match reasons
  const matchReasons: string[] = []

  if (isContinuingTherapist) {
    matchReasons.push('Continuing care')
  }

  if (hasModalityMatch) {
    const modalityInfo = TherapistManager.getModalityInfo(therapist.primaryModality)
    matchReasons.push(`${modalityInfo.name} specialty`)
  }

  if (hasSpecialization) {
    matchReasons.push('Specializes in condition')
  }

  if (matchResult.breakdown.traitMatch >= 70) {
    matchReasons.push('Strong personality fit')
  }

  if (hasGoodEnergy) {
    matchReasons.push('Available capacity')
  } else if (energyForecast.willBurnOut) {
    matchReasons.push('High workload today')
  }

  // Calculate overall quality
  let quality: MatchQuality = 'fair'

  // Excellent: high match score + at least 2 strong factors
  const strongFactors = [
    matchScore >= 70,
    hasModalityMatch && modalityBonus >= 0.1,
    isContinuingTherapist,
    hasSpecialization,
  ].filter(Boolean).length

  if (matchScore >= 75 && strongFactors >= 2) {
    quality = 'excellent'
  } else if (matchScore >= 50 || strongFactors >= 1) {
    quality = 'good'
  }

  return {
    quality,
    matchScore,
    hasModalityMatch,
    modalityBonus,
    isContinuingTherapist,
    hasSpecialization,
    hasGoodEnergy,
    matchReasons,
  }
}

/**
 * Get relevant specializations for a condition category
 */
function getRelevantSpecializationsForCondition(conditionCategory: string): string[] {
  const mapping: Record<string, string[]> = {
    anxiety: ['anxiety_disorders', 'anxiety', 'stress_management', 'OCD'],
    depression: ['depression', 'mood_disorders'],
    trauma: ['trauma', 'PTSD', 'crisis'],
    behavioral: ['behavioral', 'children', 'adolescents'],
    relationship: ['couples', 'family', 'relationship'],
    stress: ['stress_management', 'anxiety', 'burnout'],
  }
  return mapping[conditionCategory] || []
}
