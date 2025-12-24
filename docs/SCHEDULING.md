# Scheduling System

Manages the practice calendar, session booking, slot availability, and recurring sessions.

## Schedule Data Structure

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
function isSlotAvailable(
  therapist: Therapist,
  day: number,
  hour: number,
  durationMinutes: number = 50
): boolean {
  // 1. No existing session at that time
  if (schedule[day]?.[hour]?.[therapist.id]) {
    return false;
  }

  // 2. Session fits within business hours (8 AM - 5 PM)
  const endHour = hour + Math.ceil(durationMinutes / 60);
  if (endHour > BUSINESS_END_HOUR) {
    return false;  // Extends past 5 PM
  }

  // 3. No scheduled break at that time
  if (hasBreakAtTime(therapist, day, hour)) {
    return false;
  }

  // 4. Therapist not in offline training
  if (therapist.current_training?.track === 'clinical') {
    return false;  // Offline training makes therapist unavailable
  }

  // 5. Therapist not burned out
  if (therapist.is_burned_out) {
    return false;
  }

  // 6. Check consecutive hour conflicts for multi-hour sessions
  for (let h = hour; h < endHour; h++) {
    if (schedule[day]?.[h]?.[therapist.id]) {
      return false;  // Conflict in middle of session
    }
  }

  // 7. Room available for in-person (if applicable)
  // (depends on client preference)

  return true;
}

function hasBreakAtTime(therapist: Therapist, day: number, hour: number): boolean {
  return therapist.breaks.some(
    b => b.start_day === day && b.start_hour <= hour && hour < b.start_hour + b.duration_hours
  );
}
```

## Booking a Session

Complete flow for booking a client to a time slot:

```typescript
interface BookingResult {
  success: boolean
  error?: string
  session?: Session
}

function bookSession(
  client: Client,
  therapist: Therapist,
  day: number,
  hour: number,
  options?: {
    recurring?: 'weekly' | 'biweekly' | 'monthly';
    count?: number;  // How many recurring sessions
  }
): BookingResult {
  // CRITICAL: Use getState() to get fresh data, avoiding stale closures
  const { sessions: freshSessions, schedule: freshSchedule } = useGameStore.getState()

  // 1. Validate client exists
  if (!client) {
    return { success: false, error: 'Client not found' }
  }

  // 2. Validate therapist exists
  if (!therapist) {
    return { success: false, error: 'Therapist not found' }
  }

  // 3. Check slot already booked (prevent double-booking)
  const existingSessionInSlot = freshSessions.find(
    s => s.scheduledDay === day &&
         s.scheduledHour === hour &&
         s.therapistId === therapist.id &&
         s.status === 'scheduled'
  )
  if (existingSessionInSlot) {
    return { success: false, error: 'Slot already booked' }
  }

  // 4. Check client has no conflicting session
  const clientConflict = freshSessions.find(
    s => s.clientId === client.id &&
         s.scheduledDay === day &&
         s.scheduledHour === hour &&
         s.status === 'scheduled'
  )
  if (clientConflict) {
    return { success: false, error: 'Client has conflicting session' }
  }

  // 5. Validate therapist has required certification
  if (client.required_certification) {
    if (!therapist.certifications.includes(client.required_certification)) {
      return { success: false, error: 'Missing certification' }
    }
  }

  // 6. Create session
  const session = createSession(therapist, client, day, hour, {
    is_virtual: client.prefers_virtual,
    is_insurance: !client.is_private_pay
  });

  if (!session) {
    return { success: false, error: 'Failed to create session' }
  }

  // 7. Update client status
  if (client.status === 'waiting') {
    client.status = 'in_treatment';
    client.assigned_therapist = therapist;
    EventBus.emit('client_scheduled', client.id, session.id);
  }

  // 8. Handle recurring sessions
  if (options?.recurring) {
    const recurringResults = scheduleRecurringSessions(
      client,
      therapist,
      options.recurring,
      options.count || 4
    );
    return {
      success: true,
      session,
      recurring_scheduled: recurringResults.sessions.length,
      recurring_skipped: recurringResults.skipped
    };
  }

  EventBus.emit('session_scheduled', session.id);
  return { success: true, session };
}

function clientAvailableAtTime(client: Client, day: number, hour: number): boolean {
  // Check client's availability dict
  const dayOfWeek = day % 7;  // Assuming week cycle
  const availableHours = client.availability[dayOfWeek];

  if (!availableHours || !availableHours.includes(hour)) {
    return false;
  }

  // Also check for existing sessions (client can't have two sessions at once)
  for (const session of client.sessions) {
    if (session.scheduled_day === day && session.scheduled_hour === hour) {
      return false;
    }
  }

  return true;
}
```

## Smart Slot Recommendation

Suggest best available slots for booking based on various factors:

```typescript
interface SlotRecommendation {
  therapist: Therapist;
  day: number;
  hour: number;
  score: number;  // 0.0-5.0
}

function findBestSlots(
  client: Client,
  limit: number = 5
): SlotRecommendation[] {
  const recommendations: SlotRecommendation[] = [];

  // Search forward up to 30 days
  for (let day = currentDay; day < currentDay + 30; day++) {
    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      for (const therapist of therapists) {
        if (!isSlotAvailable(therapist, day, hour)) continue;
        if (!clientAvailableAtTime(client, day, hour)) continue;

        const score = scoreSlot(therapist, client, day, hour);
        recommendations.push({ therapist, day, hour, score });
      }
    }
  }

  // Sort by score (highest first)
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations.slice(0, limit);
}

function scoreSlot(
  therapist: Therapist,
  client: Client,
  day: number,
  hour: number
): number {
  let score = 1.0;

  // 1. Time Preference Match (+0.5)
  if (client.preferred_time === 'morning' && hour < 12) score += 0.5;
  if (client.preferred_time === 'afternoon' && hour >= 12) score += 0.5;

  // 2. Therapist-Client Match (+0.0 to +1.0)
  const matchScore = calculateTherapistClientMatch(therapist, client);
  score += matchScore;

  // 3. Workload Penalty (-0.8 to -2.0)
  const daySessionCount = countSessionsOnDay(therapist, day);
  if (daySessionCount >= 6) score -= 2.0;
  if (daySessionCount >= 5) score -= 0.8;

  // 4. Back-to-Back Penalty (-0.6 to -1.2)
  const nextSlotHasSession = schedule[day]?.[hour + 1]?.[therapist.id];
  const prevSlotHasSession = schedule[day]?.[hour - 1]?.[therapist.id];
  if (nextSlotHasSession || prevSlotHasSession) {
    score -= 0.6 + (therapist.energy / 100) * 0.6;  // More penalty if tired
  }

  // 5. Proximity Bonus (+0.0 to +1.0)
  const daysFromNow = day - currentDay;
  if (daysFromNow === 1) score += 1.0;    // Next day
  else if (daysFromNow === 2) score += 0.75;
  else if (daysFromNow <= 7) score += 0.5;
  else if (daysFromNow <= 14) score += 0.25;

  // 6. Virtual preference match
  if (therapist.can_do_telehealth && client.prefers_virtual) {
    score += 0.3;
  }

  return score;
}
```

## Recurring Sessions

Schedule multiple sessions at regular intervals:

```typescript
function scheduleRecurringSessions(
  client: Client,
  therapist: Therapist,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  count: number
): { sessions: Session[], skipped: TimeSlot[] } {
  const results = [];
  const skipped = [];

  const daysPerFrequency = {
    weekly: 7,
    biweekly: 14,
    monthly: 30
  };

  const daysToAdd = daysPerFrequency[frequency];

  for (let i = 0; i < count; i++) {
    const targetDay = currentDay + (i * daysToAdd);

    // Try to find a slot at same time as first session (preferred)
    let slot = findSlotNearTime(therapist, client, targetDay, firstSessionHour);

    // If not available, find any available slot
    if (!slot) {
      slot = findBestSlot(therapist, client, targetDay);
    }

    if (slot) {
      const session = createSession(therapist, client, slot.day, slot.hour, {
        is_virtual: client.prefers_virtual
      });
      results.push(session);
    } else {
      skipped.push({ day: targetDay, reason: 'no_available_slot' });
    }
  }

  EventBus.emit('recurring_sessions_scheduled', client.id, results.length, skipped.length);
  return { sessions: results, skipped };
}
```

## Break Management

Therapists can schedule breaks for energy recovery:

```typescript
function scheduleBreak(
  therapist: Therapist,
  day: number,
  hour: number,
  durationHours: number,
  reason: 'lunch' | 'recovery' | 'conference' | 'personal' = 'lunch'
): boolean {
  // Validation
  const endHour = hour + durationHours;
  if (endHour > BUSINESS_END_HOUR) {
    return false;  // Extends past business hours
  }

  // Check for session conflicts
  for (let h = hour; h < endHour; h++) {
    if (schedule[day]?.[h]?.[therapist.id]) {
      return false;  // Session conflict
    }
  }

  // Create break
  const breakRecord: TherapistBreak = {
    id: `break-${Date.now()}`,
    therapist_id: therapist.id,
    start_day: day,
    start_hour: hour,
    duration_hours: durationHours,
    reason
  };

  therapist.breaks.push(breakRecord);

  EventBus.emit('break_scheduled', therapist.id, day, hour, durationHours);
  return true;
}

// Energy recovery during breaks
function updateTherapistEnergyDuringBreak(therapist: Therapist, deltaTime: number) {
  const currentBreak = therapist.breaks.find(
    b => b.start_day === currentDay &&
         b.start_hour <= currentHour &&
         currentHour < b.start_hour + b.duration_hours
  );

  if (currentBreak) {
    therapist.energy += 8 * (deltaTime / 3600);  // 8 energy per hour
    therapist.energy = Math.min(therapist.energy, therapist.max_energy);
  }
}

// Auto-end breaks
function endExpiredBreaks() {
  for (const therapist of therapists) {
    therapist.breaks = therapist.breaks.filter(
      b => !(b.start_day === currentDay && currentHour >= b.start_hour + b.duration_hours)
    );
  }
}
```

## Viewing the Schedule

```typescript
interface ScheduleView {
  // Time period
  start_day: number;
  end_day: number;  // Usually current_day + 7

  // Grid structure
  therapists: Therapist[];
  slots: Record<number, Record<number, ScheduleCell>>;
}

interface ScheduleCell {
  day: number;
  hour: number;
  therapist_id: string;
  session_id: string | null;
  is_break: boolean;
  availability: 'available' | 'occupied' | 'unavailable';
}

function getScheduleView(
  startDay: number,
  endDay: number
): ScheduleView {
  const view: ScheduleView = {
    start_day: startDay,
    end_day: endDay,
    therapists: therapists,
    slots: {}
  };

  for (let day = startDay; day <= endDay; day++) {
    view.slots[day] = {};

    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      view.slots[day][hour] = {};

      for (const therapist of therapists) {
        const sessionId = schedule[day]?.[hour]?.[therapist.id];
        const hasBreak = hasBreakAtTime(therapist, day, hour);
        const isAvailable = isSlotAvailable(therapist, day, hour);

        view.slots[day][hour][therapist.id] = {
          day,
          hour,
          therapist_id: therapist.id,
          session_id: sessionId,
          is_break: hasBreak,
          availability: sessionId ? 'occupied' : hasBreak ? 'unavailable' : isAvailable ? 'available' : 'unavailable'
        };
      }
    }
  }

  return view;
}
```

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

## Events Emitted

```typescript
EventBus.emit('session_scheduled', sessionId);
EventBus.emit('session_rescheduled', sessionId, oldDay, oldHour, newDay, newHour);
EventBus.emit('session_cancelled', sessionId);
EventBus.emit('break_scheduled', therapistId, day, hour, duration);
EventBus.emit('recurring_sessions_scheduled', clientId, count, skipped);
EventBus.emit('schedule_conflict', therapistId, day, hour);
EventBus.emit('schedule_view_updated', day);
```

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
