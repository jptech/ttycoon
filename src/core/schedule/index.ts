export {
  ScheduleManager,
  SCHEDULE_CONFIG,
  type AvailableSlot,
  type CreateSessionParams,
  type ScheduleConflict,
} from './ScheduleManager'

export {
  planRecurringBookings,
  type PlannedRecurringSlot,
  type PlanRecurringBookingsParams,
  type PlanRecurringBookingsResult,
  type RecurringBookingFailure,
} from './RecurringBookingPlanner'

export {
  generateBookingSuggestions,
  type BookingSuggestion,
  type SuggestionUrgency,
  type SuggestionReason,
  type MatchQuality,
  type MatchBreakdown,
  type GenerateSuggestionsParams,
  type GenerateSuggestionsResult,
} from './BookingSuggestions'

