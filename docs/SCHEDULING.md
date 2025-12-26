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
