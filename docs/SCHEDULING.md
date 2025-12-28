# Scheduling System

Manages the practice calendar, session booking, slot availability, and recurring sessions.

## Schedule Data Structure

Note: `schedule` is a derived occupancy map used for fast lookups/rendering.
It must remain consistent with the source-of-truth `sessions[]` list. On load,
the game defensively rebuilds `schedule` from `sessions` to avoid stale/missing
entries.

```typescript
// schedule[day][hour][therapist_id] = session_id

type Schedule = Record<
  number,  // day
  Record<
    number,  // hour (8-17)
    Record<string, string | null>  // therapist_id -> session_id
  >
>;

const schedule: Schedule = {
  1: {
    8: { 'therapist-1': 'session-001', 'therapist-2': null },
    9: { 'therapist-1': null, 'therapist-2': 'session-002' },
    // ... rest of hours
  },
  2: { /* day 2 */ },
  // ... more days
};
```

## Slot Availability Checking

A time slot is available if all conditions are met:

```typescript
// Core availability (pure occupancy + business hours)
ScheduleManager.isSlotAvailable(schedule, therapistId, day, hour, durationMinutes)

// Additional constraints are enforced at booking time, not inside isSlotAvailable:
// - Not-in-past validation: ScheduleManager.validateNotInPast(currentTime, day, hour)
// - Client conflict checks: ScheduleManager.clientHasConflictingSession(...)
// - Room/telehealth constraints: canBookSessionType(...)
```

## Booking a Session

Complete flow for booking a client to a time slot:

```typescript
interface BookingResult {
  success: boolean
  error?: string
  session?: Session
}

function bookSession(params: {
  clientId: string
  therapistId: string
  day: number
  hour: number
  durationMinutes: SessionDuration
  isVirtual: boolean
}): BookingResult {
  // IMPORTANT: Use getState() for fresh, non-stale data
  const snapshot = useGameStore.getState()

  const client = snapshot.clients.find((c) => c.id === params.clientId)
  const therapist = snapshot.therapists.find((t) => t.id === params.therapistId)
  if (!client) return { success: false, error: 'Client not found' }
  if (!therapist) return { success: false, error: 'Therapist not found' }

  // 0) Not-in-past validation
  // Sessions start on the hour; booking the current hour is only allowed if currentMinute === 0.
  const currentTime = {
    day: snapshot.currentDay,
    hour: snapshot.currentHour,
    minute: snapshot.currentMinute,
  }

  const timeCheck = ScheduleManager.validateNotInPast(currentTime, params.day, params.hour)
  if (!timeCheck.valid) return { success: false, error: timeCheck.reason }

  // 1) Therapist availability (occupancy + business hours)
  if (!ScheduleManager.isSlotAvailable(snapshot.schedule, params.therapistId, params.day, params.hour, params.durationMinutes)) {
    return { success: false, error: 'This time slot is already booked.' }
  }

  // 2) Client overlap prevention
  if (ScheduleManager.clientHasConflictingSession(snapshot.sessions, params.clientId, params.day, params.hour, params.durationMinutes)) {
    return { success: false, error: 'Client already has an overlapping session.' }
  }

  // 3) Room/telehealth constraints (in-person requires room capacity; virtual requires telehealthUnlocked)
  const building = getBuilding(snapshot.currentBuildingId) || BUILDINGS.starter_suite
  const typeCheck = canBookSessionType({
    building,
    sessions: snapshot.sessions,
    telehealthUnlocked: snapshot.telehealthUnlocked,
    isVirtual: params.isVirtual,
    day: params.day,
    hour: params.hour,
    durationMinutes: params.durationMinutes,
  })
  if (!typeCheck.canBook) return { success: false, error: typeCheck.reason }

  // 4) Create + add session (schedule is rebuilt from sessions)
  const session = ScheduleManager.createSession(
    {
      therapistId: params.therapistId,
      clientId: params.clientId,
      day: params.day,
      hour: params.hour,
      duration: params.durationMinutes,
      isVirtual: params.isVirtual,
    },
    therapist,
    client
  )

  useGameStore.getState().addSession(session)
  return { success: true, session }
}
```

## Finding Matching Slots

The booking UI uses `ScheduleManager.findMatchingSlots(...)` to generate candidate slots.

- It searches forward starting at `startDay` for `daysToCheck` days.
- It marks each slot as `isPreferred` when it matches the client’s availability + preferred time.
- It sorts with preferred slots first, then earlier days/hours.

The UI then applies additional filters:
- **Not-in-past**: excludes any slot where `validateNotInPast(currentTime, slot.day, slot.hour)` is invalid.
  - This includes the **current hour once `currentMinute > 0`**.
- **Session type constraints**:
  - Virtual sessions require `telehealthUnlocked`.
  - In-person sessions require available room capacity for every occupied hour slot.

```typescript
const base = ScheduleManager.findMatchingSlots(schedule, therapist, client, startDay, 7, duration)

const futureOnly = base.filter((slot) =>
  ScheduleManager.validateNotInPast(currentTime, slot.day, slot.hour).valid
)

const allowedByType = futureOnly.filter((slot) => {
  if (isVirtual) return telehealthUnlocked
  return canBookSessionType({
    building: currentBuilding,
    sessions,
    telehealthUnlocked,
    isVirtual: false,
    day: slot.day,
    hour: slot.hour,
    durationMinutes: duration,
  }).canBook
})
```

## Recurring Sessions

Schedule multiple sessions at regular intervals:

```typescript
// Recurring series are planned via the pure helper `planRecurringBookings(...)`.
// It applies the same constraints as single-booking, including:
// - Not-in-past validation (including the “current hour only if minute === 0” rule)
// - Therapist slot availability (multi-hour sessions occupy multiple hour slots)
// - Client overlap prevention
// - Daily per-therapist session cap
// - Room/telehealth constraints
//
// Policy note: for occurrences after the first, the planner will try the preferred hour,
// then fall back to the closest available hour on the same day.
```
## Viewing the Schedule

The main schedule UI is implemented in `src/components/game/ScheduleView.tsx`.

Key behaviors:

- **Past slots are not bookable**: slots before the current game time are dimmed and cannot be clicked.
  - The **current hour becomes “past” once `currentMinute > 0`** (an hour already in progress).
- **Availability counts and slot lists** apply the same not-in-past rule via `ScheduleManager.validateNotInPast(...)`.
- **Room capacity messaging** (e.g., “Rooms full”) is shown only for future slots; past slots are simply treated as unavailable.

## Navigation

```typescript
// Move between days in schedule view
function navigateSchedule(direction: 'previous' | 'next') {
  if (direction === 'previous') {
    viewStartDay = Math.max(1, viewStartDay - 7);
  } else {
    viewStartDay += 7;
  }

  refreshScheduleView();
  EventBus.emit('schedule_view_updated', viewStartDay);
}

// Jump to specific day
function jumpToDay(day: number) {
  viewStartDay = Math.max(1, day);
  refreshScheduleView();
}

// Show current week
function viewCurrentWeek() {
  viewStartDay = Math.max(1, currentDay - 3);  // Show current day in middle
  refreshScheduleView();
}
```

## Conflict Resolution

When a conflict is detected:

```typescript
function handleSchedulingConflict(
  therapist: Therapist,
  day: number,
  hour: number,
  requestedSession: Session
): ConflictResolution {
  const existingSession = getSessionAtTime(therapist, day, hour);

  return {
    conflict_type: 'session_overlap',
    existing_session: existingSession,
    requested_session: requestedSession,
    suggestions: [
      { day: day + 1, hour: hour, reason: 'next_day_same_time' },
      { day: day, hour: hour + 1, reason: 'next_hour_same_day' },
      ...findBestAlternativeSlots(therapist, requestedSession.client, 3)
    ]
  };
}
```

## Follow-Up Scheduling

Track when active clients need their next session:

```typescript
interface FollowUpInfo {
  lastSession: Session | null
  lastSessionDay: number | null
  nextDueDay: number | null
  daysUntilDue: number | null
  isOverdue: boolean
  hasUpcomingSession: boolean
  nextScheduledSession: Session | null
  remainingSessions: number
}

const FREQUENCY_DAYS: Record<SessionFrequency, number> = {
  once: 0,      // No recurring
  weekly: 7,
  biweekly: 14,
  monthly: 30,
}

function getFollowUpInfo(client: Client, sessions: Session[], currentDay: number): FollowUpInfo {
  // Find completed sessions for this client, sorted by day
  const clientSessions = sessions
    .filter(s => s.clientId === client.id && s.status === 'completed')
    .sort((a, b) => b.scheduledDay - a.scheduledDay)

  const lastSession = clientSessions[0] || null
  const lastSessionDay = lastSession?.scheduledDay || null

  // Find upcoming scheduled session
  const scheduledSessions = sessions
    .filter(s => s.clientId === client.id && s.status === 'scheduled' && s.scheduledDay >= currentDay)
    .sort((a, b) => a.scheduledDay - b.scheduledDay)

  const nextScheduledSession = scheduledSessions[0] || null
  const hasUpcomingSession = nextScheduledSession !== null

  // Calculate next due date based on frequency
  const frequencyDays = FREQUENCY_DAYS[client.preferredFrequency]
  let nextDueDay: number | null = null
  let daysUntilDue: number | null = null
  let isOverdue = false

  if (lastSessionDay && frequencyDays > 0) {
    nextDueDay = lastSessionDay + frequencyDays
    daysUntilDue = nextDueDay - currentDay
    isOverdue = daysUntilDue < 0 && !hasUpcomingSession
  }

  return {
    lastSession,
    lastSessionDay,
    nextDueDay,
    daysUntilDue,
    isOverdue,
    hasUpcomingSession,
    nextScheduledSession,
    remainingSessions: client.sessionsRequired - client.sessionsCompleted,
  }
}
```

### BookingDashboard Integration

The BookingDashboard shows both waiting clients and active clients needing follow-ups:

- **Waiting tab**: Clients awaiting their first appointment
- **Active tab**: In-treatment clients, sorted by follow-up urgency
  - Overdue clients shown first (red indicator)
  - Due soon shown with warning indicator
  - Already scheduled shown with check mark

Recurring bookings:

- The BookingDashboard and BookingModal provide a **Recurring** toggle to book a series of sessions across weeks.
- Planning is done via the pure helper `planRecurringBookings(...)` in `src/core/schedule/RecurringBookingPlanner.ts`.
- Once a complete plan is available, the UI books sessions by calling the normal single-session booking handler repeatedly.

**Auto-Population (QoL)**:
When selecting a client, the booking UI automatically configures recurring settings:
- If client has >1 remaining sessions: recurring is auto-enabled
- Recurring count is set to `min(remainingSessions, 12)`
- Interval is based on client's `preferredFrequency` (weekly=7, biweekly=14, monthly=30)
- Client cards display "X remaining" and preferred frequency for quick reference

## Booking Suggestions

The system proactively generates booking suggestions for clients who need follow-up appointments. This reduces manual booking overhead in late-game scenarios with many clients.

### Suggestion Generation

```typescript
interface BookingSuggestion {
  id: string
  clientId: string
  therapistId: string
  suggestedDay: number
  suggestedHour: number
  duration: SessionDuration
  isVirtual: boolean
  urgency: 'overdue' | 'due_soon' | 'normal'
  reason: 'overdue_followup' | 'due_soon' | 'good_slot_available' | 'therapist_continuity'
  score: number
  followUpInfo: FollowUpInfo
  isPreferredSlot: boolean
}

// Generate suggestions using the pure function
const result = generateBookingSuggestions({
  clients,
  therapists,
  sessions,
  schedule,
  building,
  telehealthUnlocked,
  currentTime: { day, hour, minute },
  maxSuggestions: 10,  // Optional, default 10
  daysAhead: 14,       // Optional, default 14
})

// Result includes suggestions and any clients that couldn't be scheduled
interface GenerateSuggestionsResult {
  suggestions: BookingSuggestion[]
  unschedulableClients: Array<{ clientId: string; reason: string }>
}
```

### Algorithm

1. **Find clients needing booking**:
   - Active (`in_treatment`) clients with remaining sessions and no upcoming session
   - Waiting clients needing their first session

2. **Prioritize by urgency**:
   - `overdue`: Past their follow-up interval with no session scheduled
   - `due_soon`: Within 3 days of expected follow-up date
   - `normal`: Other clients needing sessions

3. **For each client, find best slot**:
   - Prefer assigned therapist (therapist continuity)
   - Only include therapists with required certifications
   - Use `findMatchingSlots()` to get available time slots
   - Apply all standard constraints (not-in-past, client conflicts, room capacity, etc.)

4. **Holistic Match Scoring**:
   The suggestion system uses a comprehensive scoring algorithm that considers multiple factors:

   | Factor | Points | Description |
   |--------|--------|-------------|
   | Urgency | +1000/500/100 | Overdue/due_soon/normal |
   | Match Quality | +150/100/50 | Excellent/good/fair overall rating |
   | Modality Match | up to +50 | Based on modality bonus (0-15% → 0-50 pts) |
   | Same Therapist | +40 | Continuing care with assigned therapist |
   | Preferred Slot | +30 | Matches client's time preference |
   | Match Score | up to +50 | Therapist-client match (0-100 → 0-50 pts) |
   | Good Energy | +20 | Therapist has capacity (won't burn out) |
   | Timing | -3/day | Prefer sooner slots |

### Match Quality Rating

Each suggestion includes a `matchBreakdown` with a holistic quality rating:

```typescript
interface MatchBreakdown {
  quality: 'excellent' | 'good' | 'fair'
  matchScore: number           // 0-100 therapist-client match
  hasModalityMatch: boolean    // Therapist's modality fits condition
  modalityBonus: number        // 0-0.15 quality bonus
  isContinuingTherapist: boolean  // Same therapist as before
  hasSpecialization: boolean   // Therapist specializes in condition
  hasGoodEnergy: boolean       // Therapist has capacity
  matchReasons: string[]       // Human-readable reasons
}
```

**Quality ratings**:
- `excellent`: High match score (≥75) + at least 2 strong factors
- `good`: Decent match score (≥50) or at least 1 strong factor
- `fair`: Basic match available

**Match reasons** are displayed in the UI to explain why a therapist is recommended:
- "Continuing care" - Same therapist as previous sessions
- "CBT specialty" - Modality matches condition
- "Specializes in condition" - Has relevant specialization
- "Strong personality fit" - High trait match
- "Available capacity" - Won't burn out today

### React Hook

```typescript
const {
  suggestions,           // Filtered suggestions (excludes dismissed)
  unschedulableClients, // Clients with no available slots
  count,                // Number of visible suggestions
  overdueCount,         // Number of overdue suggestions
  dismissedIds,         // Set of dismissed suggestion IDs
  dismissSuggestion,    // Temporarily hide a suggestion
  clearDismissals,      // Reset all dismissals
  getSuggestion,        // Get suggestion by ID
} = useBookingSuggestions({
  maxSuggestions: 5,
  daysAhead: 14,
  enabled: true,
})
```

### UI Integration

The BookingDashboard displays suggestions in a collapsible card at the top:

- Badge shows count (with overdue count highlighted)
- Compact cards show urgency indicator, client name, time, and "Book" button
- "Book" pre-populates the booking form with the suggestion's details
- "Dismiss" hides the suggestion until the next game day

Urgency styling:
- `overdue`: Red background/border, warning icon
- `due_soon`: Yellow/warning background/border
- `normal`: Default surface styling

## Therapist Work Schedules

Each therapist can have custom work hours, allowing for flexible scheduling. This enables late-start schedules, early-end schedules, and optional lunch breaks.

### Work Schedule Data Model

```typescript
interface TherapistWorkSchedule {
  workStartHour: number      // Default: 8 (8 AM)
  workEndHour: number        // Default: 17 (5 PM)
  lunchBreakHour: number | null  // null = no break, e.g., 12 for noon break
}

// Added to Therapist entity
interface Therapist {
  // ... other fields
  workSchedule: TherapistWorkSchedule
}
```

### Default Schedule

New therapists (including the player) start with the default schedule:
- Work hours: 8 AM - 5 PM
- No lunch break

### Work Schedule Utilities

```typescript
import { TherapistManager, DEFAULT_WORK_SCHEDULE } from '@/core/therapists'

// Get therapist's work schedule (with fallback to defaults)
const schedule = TherapistManager.getWorkSchedule(therapist)

// Check if an hour is within work hours
const canWork = TherapistManager.isWithinWorkHours(therapist, 12) // false if on lunch

// Get all available work hours (excluding lunch)
const hours = TherapistManager.getWorkHours(therapist) // [8, 9, 10, 11, 13, 14, 15, 16]

// Get total working hours per day
const hoursPerDay = TherapistManager.getWorkingHoursPerDay(therapist) // 8 (9 - 1 lunch)

// Validate a proposed schedule
const validation = TherapistManager.validateWorkSchedule({
  workStartHour: 6,   // OK: between 6 AM and 10 PM
  workEndHour: 14,    // OK: at least 4 hours after start
  lunchBreakHour: 10, // OK: within work hours
})
// { valid: true } or { valid: false, reason: '...' }
```

### Schedule Constraints Integration

The `ScheduleManager` respects therapist work hours when finding available slots:

```typescript
// When therapist is provided, their work hours are used instead of global business hours
ScheduleManager.isSlotAvailable(schedule, therapistId, day, hour, duration, therapist)

// findMatchingSlots automatically uses therapist work hours
ScheduleManager.findMatchingSlots(schedule, therapist, client, startDay, daysToCheck, duration)

// getAvailableSlotsForDay respects work hours
ScheduleManager.getAvailableSlotsForDay(schedule, therapistId, day, duration, therapist)
```

### Energy Forecasting

The system can predict a therapist's end-of-day energy and warn about burnout risk:

```typescript
interface EnergyForecast {
  predictedEndEnergy: number      // Predicted energy at end of day
  scheduledSessionCount: number   // Number of sessions scheduled
  totalEnergyCost: number         // Sum of all session energy costs
  willBurnOut: boolean            // True if energy will drop below threshold
  burnoutHour: number | null      // Hour when burnout occurs (if applicable)
}

// Get forecast for a specific day
const forecast = TherapistManager.forecastEnergy(therapist, sessions, schedule, currentDay)

// Format for display
const display = TherapistManager.formatEnergyForecast(forecast)
// "3 sessions • ~55 energy EOD" or "6 sessions • BURNOUT RISK"
```

### UI Components

**TherapistScheduleModal** (`src/components/game/TherapistScheduleModal.tsx`):
- Edit work start/end hours via dropdowns
- Toggle lunch break (select hour or "No Break")
- Shows energy forecast for current day
- Validates schedule before saving

**TherapistCard** (updated):
- Shows energy forecast when sessions are scheduled
- Displays warning indicator if burnout is predicted
- "Schedule" button opens the schedule modal

### Store Integration

```typescript
// Update therapist work schedule with validation
const result = gameStore.updateTherapistWorkSchedule(therapistId, {
  workStartHour: 10,
  lunchBreakHour: 13,
})

if (!result.success) {
  console.error(result.reason) // e.g., "End hour must be after start hour"
}
```

### Save Migration

Existing saves are migrated to include default work schedules:

```typescript
// SaveManager v2 → v3 migration
therapists: state.therapists.map((t) => ({
  ...t,
  workSchedule: t.workSchedule ?? { ...DEFAULT_WORK_SCHEDULE },
}))
```

## Events Emitted

```typescript
EventBus.emit('session_scheduled', sessionId);
EventBus.emit('session_cancelled', sessionId);
EventBus.emit('break_scheduled', therapistId, day, hour, duration);
EventBus.emit('recurring_sessions_scheduled', clientId, count, skipped);
EventBus.emit('schedule_conflict', therapistId, day, hour);
EventBus.emit('schedule_view_updated', day);
```

Notes:

- Rescheduling is performed by updating the existing session's scheduled fields and rebuilding the schedule map.
- The current implementation emits `session_scheduled` after a successful reschedule (treating it as a new placement).

## Testing Strategy

```typescript
test('slot is unavailable if occupied', () => {
  schedule[1][8]['therapist-1'] = 'session-001';
  expect(isSlotAvailable(therapist, 1, 8)).toBe(false);
});

test('slot is unavailable if therapist burned out', () => {
  therapist.is_burned_out = true;
  expect(isSlotAvailable(therapist, 1, 8)).toBe(false);
});

test('best slots sorted by score descending', () => {
  const slots = findBestSlots(client);
  for (let i = 1; i < slots.length; i++) {
    expect(slots[i - 1].score).toBeGreaterThanOrEqual(slots[i].score);
  }
});

test('recurring sessions scheduled at correct intervals', () => {
  const result = scheduleRecurringSessions(client, therapist, 'weekly', 4);
  expect(result.sessions).toHaveLength(4);
  for (let i = 1; i < result.sessions.length; i++) {
    const dayDiff = result.sessions[i].scheduled_day - result.sessions[i - 1].scheduled_day;
    expect(dayDiff).toBe(7);
  }
});
```
