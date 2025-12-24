# Time & Calendar System

Manages the progression of game time from minutes through days, with speed controls and scheduling infrastructure.

## Time Model

### Basic Units

- **Minute**: Smallest simulation unit
- **Hour**: 60 minutes (business hours: 8 AM - 5 PM = 10 hours)
- **Day**: 10 business hours + overnight rest
- **Game Progression**: Day-based (no real-world time limits)

### Time Constants

```typescript
const BUSINESS_START_HOUR = 8;      // 8 AM
const BUSINESS_END_HOUR = 17;       // 5 PM (exclusive)
const BUSINESS_HOURS_PER_DAY = 10;  // 8 AM to 5 PM

const SESSION_DURATION_STANDARD = 50;    // minutes
const SESSION_DURATION_EXTENDED = 80;    // minutes
const SESSION_DURATION_INTENSIVE = 180;  // minutes
```

## TimeController

The core time simulation engine.

```typescript
interface TimeController {
  day: number;          // 1, 2, 3, ...
  hour: number;         // 8-17 (business hours)
  minute: number;       // 0-59

  speed: number;        // 1.0, 2.0, 3.0 (multiplier)
  isPaused: boolean;

  // Methods
  tick(deltaTime: number): void;
  getCurrentMinuteOfDay(): number;
  getTimeString(): string;         // "Day 42, 2:30 PM"
  skipToNextSession(): boolean;    // Advance to next scheduled session
}
```

### Tick Mechanism

Called every frame (~16ms at 60 FPS):

```typescript
tick(deltaTime: number) {
  if (this.isPaused) return;

  // Advance by deltaTime * speed
  const timeToAdd = deltaTime * (this.speed / 1000);  // ms to seconds
  this.minute += timeToAdd;

  // Handle minute overflow
  if (this.minute >= 60) {
    this.minute = 0;
    this.onHourChange();
  }

  // Handle hour overflow
  if (this.hour >= BUSINESS_END_HOUR) {
    this.hour = BUSINESS_START_HOUR;
    this.day++;
    this.onDayChange();
  }
}

private onHourChange() {
  EventBus.emit('hour_changed', this.hour, false);
  // Systems listen and process hourly updates
}

private onDayChange() {
  EventBus.emit('day_started', this.day);
  // Reset therapist energy, process daily expenses, etc.
}
```

### Time Display

```typescript
getTimeString(): string {
  const ampm = this.hour < 12 ? 'AM' : 'PM';
  const displayHour = this.hour > 12 ? this.hour - 12 : this.hour;
  return `Day ${this.day}, ${displayHour}:${String(Math.floor(this.minute)).padStart(2, '0')} ${ampm}`;
}

// Example outputs:
// "Day 1, 8:00 AM"
// "Day 42, 2:30 PM"
// "Day 100, 5:00 PM"
```

## Speed Controls

Players can adjust game speed while running:

```typescript
setSpeed(multiplier: number) {
  if (![1.0, 2.0, 3.0].includes(multiplier)) {
    throw new Error('Invalid speed multiplier');
  }
  this.speed = multiplier;
  EventBus.emit('speed_changed', multiplier);
}

// 1x (Normal): Real-time feel
// 2x (Fast): Sessions run at 2x speed
// 3x (Faster): Quick progression for downtime
// Pause: 0x (game frozen)
```

## Pause System

Stack-based pause to prevent conflicts between multiple systems:

```typescript
interface PauseSystem {
  pauseStack: Set<string>;
  isPaused: boolean;

  pause(reason: string) {
    this.pauseStack.add(reason);
    this.isPaused = true;
    EventBus.emit('game_paused');
  }

  resume(reason: string) {
    this.pauseStack.delete(reason);
    if (this.pauseStack.size === 0) {
      this.isPaused = false;
      EventBus.emit('game_resumed');
    }
  }

  clear() {
    this.pauseStack.clear();
    this.isPaused = false;
  }
}
```

**Use Cases**:
- Opening a modal panel: `pause('hiring_panel')`
- Decision event during session: `pause('decision_event')`
- Game menu open: `pause('main_menu')`
- Automatically resumes when all reasons removed

**Example Flow**:
```
User clicks "Hire therapist"
  → HiringPanel calls pause('hiring_panel')
  → Game pauses
  → During hiring flow, decision event triggers
    → UI calls pause('decision_event')
    → (Game already paused, stack size = 2)
  → Player resolves decision event
    → UI calls resume('decision_event')
    → (pauseStack size = 1, still paused)
  → Player closes hiring panel
    → UI calls resume('hiring_panel')
    → (pauseStack size = 0, game resumes)
```

## Skip Functionality

"Skip to next session" button advances time to the next scheduled session.

```typescript
// Implemented in GameEngine:
// - src/core/engine/GameEngine.ts
//
// Behavior:
// - If any session is currently in_progress, skip is blocked.
// - If a session is scheduled to start right now (minute === 0), skip does not advance time
//   (but it does trigger session start).
// - If there are no sessions remaining today, skip advances to the start of the next day
//   (and will not skip multiple days ahead).
// - Skip will never jump past the next scheduled session start.
// - When time lands exactly on a session start time, the session is started immediately.
skipToNextSession(): boolean
skipTo(targetTime: GameTime): TimeAdvanceResult | null
```

## Daily Cycle

### Start of Day (8 AM)

When hour changes from 17 (previous day) to 8 (new day):

```typescript
private onDayStart() {
  EventBus.emit('day_started', this.day);

  // Listening systems:
  // 1. TherapistSystem: Restore all therapists to 100% energy
  // 2. EconomySystem: Deduct daily operating costs
  //    - Salaries: sum of (therapist.hourly_salary * hours)
  //    - Rent: building.monthly_rent / 30
  // 3. TrainingSystem: Update active trainings, complete if done
  // 4. ClientSystem: Decay waiting client engagement
  // 5. EventsSystem: 30% chance to trigger random event
  // 6. SchedulingSystem: Generate new client arrivals
  // 7. HistorySystem: Prune old sessions (keep last 14 days)
}
```

### Business Hours (8 AM - 5 PM)

```typescript
// Sessions run according to schedule
// Player can:
// - Book new sessions
// - Pause game to open panels
// - Observe sessions in progress
// - Make decisions during sessions
// - Monitor time, money, reputation in HUD
```

### End of Day (5 PM)

When time reaches 17:00 (5 PM), no new sessions start:

```typescript
// Last sessions conclude
// Then:
// 1. All therapists recover to 100% energy overnight
// 2. Insurance claims settle if due
// 3. Summary screen shows:
//    - Money earned/spent
//    - Sessions completed
//    - Clients treated
//    - Reputation changes
```

## Session Timing

### Session Duration

Sessions have fixed durations:

```typescript
const SESSION_DURATIONS = {
  standard: 50,      // Standard therapy session
  extended: 80,      // Extended for complex cases
  intensive: 180     // Multi-hour intensive work
};

// Sessions consume these times:
// 50-min session scheduled at 2 PM:
//   - Starts: 2:00 PM
//   - Ends: 2:50 PM
//   - Next slot available: 3:00 PM

// 80-min session scheduled at 1 PM:
//   - Starts: 1:00 PM
//   - Ends: 2:20 PM
//   - Next slot available: 2:30 PM (rounding up)
```

### Session Overlap Checking

```typescript
function canScheduleSession(
  therapist: Therapist,
  day: number,
  startHour: number,
  durationMinutes: number
): boolean {
  const startMinute = startHour * 60;
  const endMinute = startMinute + durationMinutes;

  // Check for conflicts
  const daySchedule = schedule[day][therapist.id];
  for (const session of daySchedule) {
    const sessionStart = session.scheduled_hour * 60;
    const sessionEnd = sessionStart + session.duration_minutes;

    // Ranges overlap if: start < otherEnd && end > otherStart
    if (startMinute < sessionEnd && endMinute > sessionStart) {
      return false;  // Conflict
    }
  }

  return true;
}
```

## Calendar Data Structure

Schedule stored as nested dictionary:

```typescript
// schedule[day][hour][therapist_id] = session_id

const schedule: Record<number, Record<number, Record<string, string>>> = {
  1: {  // Day 1
    8: {   // 8 AM
      'therapist-1': 'session-001',
      'therapist-2': null
    },
    9: {
      'therapist-1': null,
      'therapist-2': 'session-002'
    },
    // ... rest of hours
  },
  2: { /* Day 2 */ },
  // ... rest of days
};
```

Alternative using time slots:

```typescript
interface TimeSlot {
  day: number;
  hour: number;
  minute: number;
  therapist_id: string;
  session_id: string | null;
  is_break: boolean;
}

// More flexible but heavier
const slots: TimeSlot[] = [];
```

## Recurring Sessions

Schedule multiple sessions at regular intervals:

```typescript
function scheduleRecurringSessions(
  client: Client,
  therapist: Therapist,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  count: number
): { sessions: Session[], skipped: number } {
  const results = [];
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    const daysToAdd = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
    const targetDay = currentDay + (i * daysToAdd);

    // Find available slot on target day matching preferences
    const slot = findBestSlot(targetDay, client, therapist);

    if (slot) {
      results.push(createSession(therapist, client, slot));
    } else {
      skipped++;
    }
  }

  return { sessions: results, skipped };
}
```

## Break Scheduling

Therapists can schedule breaks for energy recovery:

```typescript
interface TherapistBreak {
  id: string;
  therapist_id: string;
  start_day: number;
  start_hour: number;
  duration_hours: number;
  reason: 'lunch' | 'recovery' | 'conference' | 'personal';
}

function scheduleBreak(
  therapist: Therapist,
  day: number,
  hour: number,
  durationHours: number,
  reason: string
): boolean {
  // Validation
  if (hour + durationHours > BUSINESS_END_HOUR) {
    return false;  // Break extends past business hours
  }

  // Check for session conflicts
  for (let h = hour; h < hour + durationHours; h++) {
    if (schedule[day][h][therapist.id]) {
      return false;  // Session conflict
    }
  }

  // Create break
  therapist.breaks.push({
    start_day: day,
    start_hour: hour,
    duration_hours: durationHours,
    reason
  });

  EventBus.emit('break_scheduled', therapist.id, day, hour);
  return true;
}

// Energy recovery during break
function updateTherapistEnergy(therapist: Therapist, deltaTime: number) {
  if (isOnBreak(therapist, currentTime)) {
    therapist.energy += 8 * (deltaTime / 3600);  // 8 per hour
    // NOTE: This section is legacy pseudocode.
    // In current code, therapist energy recovery is handled by
    // `src/hooks/useTherapistEnergyProcessor.ts`, which:
    // - recovers energy only for idle minutes (not in-session minutes)
    // - applies large recharge at DAY_ENDED and DAY_STARTED
    // - uses `THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR`
  }
}
```

## Events Emitted

```typescript
// Time progression
EventBus.emit('minute_changed', minute);     // Every minute
EventBus.emit('hour_changed', hour, isInitial);  // When hour changes
EventBus.emit('day_started', day);           // When new day begins

// Speed changes
EventBus.emit('speed_changed', multiplier);  // When user changes speed

// Pause/resume
EventBus.emit('game_paused', reason);
EventBus.emit('game_resumed', reason);

// Navigation
EventBus.emit('skipped_to_session', sessionId);
```

## Time-Based Triggers

Systems listen to time events:

```typescript
// Example: Insurance System
EventBus.on('day_started', (day) => {
  for (const payment of pendingPayments) {
    if (payment.due_day === day) {
      // Process payment
      settleInsuranceClaim(payment);
    }
  }
});

// Example: Training System
EventBus.on('hour_changed', (hour) => {
  for (const training of activeTrainings) {
    // Increment progress by 1 hour
    training.hours_completed++;

    if (training.hours_completed >= training.duration_hours) {
      completeTraining(training);
    }
  }
});

// Example: Client System
EventBus.on('day_started', (day) => {
  for (const client of waitingClients) {
    // Decrease engagement
    client.engagement -= random(3, 5);

    // Check max wait exceeded
    if (client.days_waiting > client.max_wait_days) {
      dropClient(client, 'max_wait_exceeded');
    }
  }
});
```

## Performance Considerations

1. **Throttle Time Updates**: Only update UI when minute changes (not every frame)
2. **Batch Daily Processing**: Collect changes during day start, apply all at once
3. **Lazy Schedule Queries**: Only check schedule when booking, not constantly
4. **Prune Old Data**: Remove sessions older than 14 days weekly

## Testing Strategy

```typescript
// Unit: TimeController
test('tick advances time correctly', () => {
  const tc = new TimeController();
  tc.tick(60000);  // 60 seconds
  expect(tc.minute).toBe(1);
});

test('skip to next session advances to correct time', () => {
  const tc = new TimeController();
  const foundSession = tc.skipToNextSession();
  expect(foundSession).toBe(true);
  expect(tc.hour).toBe(nextSessionHour);
});

// Integration: Time triggers events
test('day start triggers all daily systems', () => {
  const listener = vi.fn();
  EventBus.on('day_started', listener);
  tc.tick(10 * 3600000);  // Advance to next day
  expect(listener).toHaveBeenCalledWith(2);
});
```
