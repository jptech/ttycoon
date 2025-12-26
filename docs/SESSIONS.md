# Session System

Manages therapy sessions from creation through completion, including quality calculation, decision events, and outcomes.

## Session Lifecycle

```
CREATION
  └─ Session object created, added to schedule

SCHEDULED
  └─ Future session waiting to start

IN_PROGRESS
  └─ Game time reaches session start
  └─ Progress bar advances each frame
  └─ Decision events may trigger
  └─ Decision events may adjust therapist energy (delta)

COMPLETED
  └─ Progress reaches 100%
  └─ Quality calculated
  └─ Therapist energyCost is applied (subtract total)
  └─ Effects applied (reputation, money, client progress)
  └─ Session results displayed

CANCELLED
  └─ Player or system cancels before start
  └─ Reputation penalty (-1 to -2)
  └─ No payment received
```

## Session Creation

Creating a new session involves validation:

```typescript
function createSession(
  therapist: Therapist,
  client: Client,
  day: number,
  hour: number,
  options?: {
    duration_minutes?: number;
    is_virtual?: boolean;
    is_insurance?: boolean;
  }
): Session | null {
  // Validation
  if (!canScheduleSession(therapist, day, hour, options?.duration_minutes || 50)) {
    return null;  // Slot conflict or invalid
  }

  if (client.is_couple && !therapist.certifications.includes('couples_certified')) {
    return null;  // Wrong certification
  }

  if (client.is_minor && !therapist.certifications.includes('children_certified')) {
    return null;  // Wrong certification
  }

  // Create session
  const session: Session = {
    id: `session-${Date.now()}`,
    therapist_id: therapist.id,
    client_id: client.id,
    session_type: 'clinical',
    scheduled_day: day,
    scheduled_hour: hour,
    duration_minutes: options?.duration_minutes || 50,
    is_virtual: options?.is_virtual || client.prefers_virtual,
    is_insurance: options?.is_insurance || !client.is_private_pay,
    status: 'scheduled',
    progress: 0.0,
    quality: 0.0,
    payment: 0,
    energy_cost: 0,
    decision_events: []
  };

  // Add to schedule
  schedule[day][hour][therapist.id] = session.id;
  sessions.push(session);

  EventBus.emit('session_scheduled', session.id);
  return session;
}
```

## Session Progress

When game time reaches a scheduled session, it transitions to in_progress:

```typescript
function updateSessionProgress(session: Session, deltaTime: number) {
  if (session.status !== 'in_progress') return;

  // Progress based on time elapsed and speed
  const sessionDurationMs = session.duration_minutes * 60 * 1000;
  session.progress += deltaTime / sessionDurationMs;

  if (session.progress >= 1.0) {
    completeSession(session);
  }
}

// Sessions are transitioned to in_progress by GameEngine
// when current time matches scheduled_day + scheduled_hour
function checkAndStartSessions() {
  for (const session of sessions) {
    if (
      session.status === 'scheduled' &&
      currentDay === session.scheduled_day &&
      currentHour === session.scheduled_hour
    ) {
      session.status = 'in_progress';
      session.progress = 0.01;  // Immediately show some progress
      EventBus.emit('session_started', session.id);
    }
  }
}
```

### State Transition Guards

**Critical**: Always validate state before transitions to prevent double-starts or double-completes:

```typescript
// Starting a session - use getState() for fresh data
const handleSessionStart = useCallback((sessionId: string) => {
  const { sessions, therapists } = useGameStore.getState()
  const session = sessions.find(s => s.id === sessionId)

  // Guard: session must exist and be scheduled
  if (!session) return
  if (session.status !== 'scheduled') return  // Prevents double-start

  updateSession(sessionId, { status: 'in_progress' })
  updateTherapist(session.therapistId, { status: 'in_session' })
  EventBus.emit(GameEvents.SESSION_STARTED, { sessionId })
}, [updateSession, updateTherapist])

// Completing a session
const handleSessionComplete = useCallback((sessionId: string) => {
  const { sessions, therapists } = useGameStore.getState()
  const session = sessions.find(s => s.id === sessionId)

  // Guard: session must exist and be in_progress
  if (!session) return
  if (session.status !== 'in_progress') return  // Prevents double-complete

  updateSession(sessionId, {
    status: 'completed',
    completedAt: { day: currentDay, hour: currentHour, minute: currentMinute }
  })

  // Only reset therapist if they were in_session
  const therapist = therapists.find(t => t.id === session.therapistId)
  if (therapist?.status === 'in_session') {
    updateTherapist(session.therapistId, { status: 'available' })
  }

  EventBus.emit(GameEvents.SESSION_COMPLETED, { sessionId })
}, [currentDay, currentHour, currentMinute, updateSession, updateTherapist])
```

## Quality Calculation

Session quality determines reputation impact, client satisfaction, and treatment progress. Quality is calculated when a session **starts** (not when created).

### Quality Modifiers

| Modifier | Range | Description |
|----------|-------|-------------|
| Base | 0.50 | Starting baseline |
| Therapist skill | +0.00 to +0.30 | `(skill / 100) * 0.3` |
| Therapist energy | -0.10 to +0.10 | Based on 50% threshold |
| Client engagement | +0.00 to +0.15 | `(engagement / 100) * 0.15` |
| Specialization match | +0.10 | If therapist specialization matches condition |
| Certification match | +0.05 | If required certification held |
| Virtual mismatch | -0.05 | If virtual session but client prefers in-person |
| High severity (7+) | -0.05 to -0.15 | Penalty for difficult cases |
| **Early game buffer** | +0.05 to +0.10 | Days 1-7: +0.10, Days 8-14: +0.05 |
| Decision events | ±0.15 | Applied during session from choices |

### Typical Quality Outcomes

**Early game (days 1-7) with average conditions:**
- Base: 0.50
- Skill (50): +0.15
- Energy (100%): +0.10
- Engagement (60): +0.09
- Early buffer: +0.10
- **Total: 0.94** (Excellent)

**Mid-game without buffers:**
- Base: 0.50
- Skill (60): +0.18
- Energy (70%): +0.04
- Engagement (65): +0.10
- Specialization: +0.10
- **Total: 0.92** (Excellent)

**Stressed therapist, difficult case:**
- Base: 0.50
- Skill (60): +0.18
- Energy (30%): -0.04
- Engagement (50): +0.075
- Severity 8: -0.075
- **Total: 0.63** (Fair → needs decision event boost)

### Implementation

Quality modifiers are calculated in `SessionManager.calculateInitialQualityModifiers()`.

Early game buffer is added in `src/App.tsx` - `handleSessionStart()`.

Decision events modify quality via `SessionManager.applyDecision()`.

## Session Completion

When progress reaches 100%, trigger completion flow:

Implementation notes (current code):

- The pure calculation happens in `SessionManager.completeSession(...)` (updates session outcome, therapist XP/level, and client treatment progress).
- The state mutation and rewards are centralized in the Zustand store action `useGameStore.getState().completeSession(sessionId)`:
  - Updates the `Session`, `Therapist`, and `Client` records
  - Awards money for the session payment
  - Awards reputation based on the final session quality tier
  - Guards against double-completion (prevents double XP/money/reputation)
- Persistence: `SaveManager.save()` serializes the store state, so these updates persist across save/load.

## Non-Linear Treatment Progress

Treatment progress is not purely linear. Sessions can result in different types of progress based on session quality, client state, and random factors:

### Progress Types

| Type | Condition | Effect | Description |
|------|-----------|--------|-------------|
| **Normal** | Default | 1x progress | Steady advancement in treatment |
| **Breakthrough** | Quality ≥90% + 20% chance | 2x progress | Major insight or therapeutic breakthrough |
| **Plateau** | Satisfaction <50 + 15% chance | 0.25x progress | Client struggling to engage |
| **Regression** | Crisis decision + 30% chance | Progress - 2% | Processing difficult material causes setback |

### Configuration

```typescript
// SESSION_CONFIG values
BREAKTHROUGH_QUALITY_THRESHOLD: 0.9,  // Quality must be 90%+ for breakthrough
BREAKTHROUGH_CHANCE: 0.2,              // 20% chance when eligible
BREAKTHROUGH_MULTIPLIER: 2.0,          // Double progress

PLATEAU_SATISFACTION_THRESHOLD: 50,    // Client satisfaction below 50
PLATEAU_CHANCE: 0.15,                  // 15% chance when eligible
PLATEAU_MULTIPLIER: 0.25,              // Only 25% of normal progress

REGRESSION_AMOUNT: 0.02,               // 2% progress penalty
```

### Evaluation Order

Progress type is evaluated in this priority order:

1. **Regression** - Checked first if session had crisis-related decisions
2. **Breakthrough** - Checked if quality meets threshold
3. **Plateau** - Checked if satisfaction is low
4. **Normal** - Default if no special conditions trigger

### UI Feedback

The Session Summary modal displays the progress type with visual indicators:

- **Breakthrough**: Sparkle icon with accent color, celebration message
- **Plateau**: Pause icon with warning color, explanation of stalled progress
- **Regression**: Downward trend icon with error color, setback message

### Implementation

```typescript
// SessionManager.calculateTreatmentProgress()
const progressResult = SessionManager.calculateTreatmentProgress(
  sessionQuality,
  clientSatisfaction,
  hadCrisisDecision,
  optionalSeed  // For deterministic testing
)

// Result contains:
interface TreatmentProgressResult {
  progressGained: number      // Actual progress to apply
  progressType: 'normal' | 'breakthrough' | 'plateau' | 'regression'
  description: string         // Player-facing explanation
}
```

## Decision Events

During a session, random decision events may trigger:

```typescript
interface DecisionEvent {
  id: string;
  title: string;
  description: string;
  choices: DecisionChoice[];
  triggered_minute: number;  // When in session (0-duration)
  resolved: boolean;
  player_choice: string | null;
}

interface DecisionChoice {
  text: string;
  effects: {
    quality?: number;    // ±0.1 to ±0.3
    energy?: number;     // ±5 to ±25
    satisfaction?: number;
  };
}
```

### Decision Event Triggering

Decision events use a **three-phase guaranteed event system** to ensure meaningful player interactions during every session:

#### Phase 1: Early Random Window (25%-50% progress)
- Random chance to trigger first event
- Base 1.5% per minute, scales with game speed
- If triggered, event fires and Phase 2 is skipped

#### Phase 2: Guaranteed Event (65% threshold)
- If no event occurred in Phase 1, a guaranteed event fires at 65% progress
- Ensures at least one decision event per session
- Bypasses random chance entirely

#### Phase 3: Optional Second Event (70%-90% progress)
- 35% chance for a second event in this window
- Only triggers if exactly one event has already occurred
- Provides variety without overwhelming the player

**Configuration** (in `EVENT_CONFIG`):
```typescript
FIRST_EVENT_WINDOW_START: 0.25,  // 25% progress
FIRST_EVENT_WINDOW_END: 0.50,    // 50% progress
GUARANTEED_EVENT_THRESHOLD: 0.65, // Force event if none yet
SECOND_EVENT_WINDOW_START: 0.70,  // 70% progress
SECOND_EVENT_WINDOW_END: 0.90,    // 90% progress
SECOND_EVENT_CHANCE: 0.35,        // 35% chance for second
```

**Implementation** (in `App.tsx` `handleSessionTick`):
```typescript
// Phase 1: Random check in early window
if (eventsOccurred === 0 && progress >= 0.25 && progress < 0.50) {
  const check = EventManager.checkDecisionEventTrigger(...)
  if (check.shouldTrigger) eventToTrigger = check.event
}

// Phase 2: Guaranteed event at 65% if none occurred
if (!eventToTrigger && eventsOccurred === 0 && progress >= 0.65 && progress < 0.70) {
  eventToTrigger = EventManager.selectGuaranteedDecisionEvent(...)
}

// Phase 3: Optional second event in 70%-90% window
if (!eventToTrigger && eventsOccurred === 1 && progress >= 0.70 && progress < 0.90) {
  const check = EventManager.checkSecondDecisionEventTrigger(...)
  if (check.shouldTrigger) eventToTrigger = check.event
}
```

function triggerDecisionEvent(session: Session, eventTemplate: DecisionEventTemplate) {
  const event: DecisionEvent = {
    id: eventTemplate.id,
    title: eventTemplate.title,
    description: eventTemplate.description,
    choices: eventTemplate.choices,
    triggered_minute: Math.floor(session.progress * session.duration_minutes),
    resolved: false,
    player_choice: null
  };

  session.decision_events.push(event);

  // Pause game and show decision popup
  gameEngine.pause('decision_event');
  EventBus.emit('decision_event_triggered', session.id, event.id);
}

function resolveDecisionEvent(session: Session, event: DecisionEvent, choiceIndex: number) {
  const choice = event.choices[choiceIndex];
  event.player_choice = choiceIndex.toString();
  event.resolved = true;

  // Apply effects
  if (choice.effects.quality) {
    session.decision_quality_impact = (session.decision_quality_impact || 0) + choice.effects.quality;
  }
  if (choice.effects.energy) {
    const therapist = getTherapist(session.therapist_id);
    therapist.energy = Math.max(0, therapist.energy + choice.effects.energy);
  }
  if (choice.effects.satisfaction) {
    const client = getClient(session.client_id);
    client.satisfaction += choice.effects.satisfaction;
  }

  // Check for auto-resolution in future
  if (autoResolveDecisions) {
    rememberDecision(event.id, choiceIndex);
  }

  gameEngine.resume('decision_event');
}
```

### Trigger Conditions

Decision events can have **trigger conditions** that restrict when they appear:

```typescript
interface DecisionEvent {
  id: string
  title: string
  description: string
  choices: DecisionChoice[]
  triggerConditions?: {
    minSeverity?: number           // Client severity must be >= this
    conditionCategories?: string[] // Client condition must be in this list
  }
}
```

**Filtering Logic** (in `getEligibleDecisionEvents` and `EventManager.checkDecisionEventTrigger`):

1. Events **without** `triggerConditions` are always eligible (general events)
2. If `minSeverity` is set, client severity must be >= that value
3. If `conditionCategories` is set, client's condition must be in the array

```typescript
// Example: Crisis disclosure only triggers for severe cases
{
  id: 'crisis_disclosure',
  title: 'Crisis Disclosure',
  triggerConditions: {
    minSeverity: 6  // Only for severity 6-10 clients
  },
  // ...
}

// Example: Anxiety spiral only for anxiety clients
{
  id: 'anxiety_spiral',
  title: 'Anxiety Escalation',
  triggerConditions: {
    conditionCategories: ['anxiety']
  },
  // ...
}

// Example: Trauma flashback requires both conditions
{
  id: 'trauma_flashback',
  title: 'Trauma Response',
  triggerConditions: {
    conditionCategories: ['trauma'],
    minSeverity: 5
  },
  // ...
}
```

### Decision Event Catalog

```typescript
const DECISION_EVENTS = [
  {
    id: 'client_resistant',
    title: 'Client Resistance',
    description: 'Your client seems reluctant to engage today...',
    choices: [
      {
        text: 'Gently explore the resistance',
        effects: { quality: 0.1, energy: -5 }
      },
      {
        text: 'Push through with planned approach',
        effects: { quality: -0.1, energy: 0 }
      }
    ]
  },
  {
    id: 'emotional_breakthrough',
    title: 'Emotional Breakthrough',
    description: 'Your client has a deep realization during the session',
    choices: [
      {
        text: 'Process deeply with extended exploration',
        effects: { quality: 0.2, energy: -15, satisfaction: 20 }
      },
      {
        text: 'Stabilize and integrate gently',
        effects: { quality: 0.05, energy: -5, satisfaction: 10 }
      }
    ]
  },
  {
    id: 'boundary_issue',
    title: 'Boundary Concern',
    description: 'The client discloses information about another therapist',
    choices: [
      {
        text: 'Address directly (ethical)',
        effects: { quality: 0.15, energy: -10 }
      },
      {
        text: 'Redirect conversation (safer)',
        effects: { quality: 0, energy: 0 }
      }
    ]
  },
  {
    id: 'crisis_disclosure',
    title: 'Crisis Disclosure',
    description: 'Your client mentions suicidal ideation',
    choices: [
      {
        text: 'Extend session, conduct full assessment',
        effects: { quality: 0.25, energy: -25 }
      },
      {
        text: 'Create immediate safety plan, refer to crisis line',
        effects: { quality: 0.15, energy: -10 }
      }
    ]
  }
];
```

## Supervision Sessions

Special session type for therapist training:

```typescript
interface SupervisionSession extends Session {
  session_type: 'supervision';
  supervisees: Therapist[];  // 1-4 trainees
}

function createSupervisionSession(
  supervisor: Therapist,
  supervisees: Therapist[],
  day: number,
  hour: number
): Session | null {
  // Validation
  if (!supervisor.certifications.includes('supervisor_certified')) {
    return null;
  }

  const session: SupervisionSession = {
    // ... base properties ...
    session_type: 'supervision',
    therapist_id: supervisor.id,
    client_id: '',  // N/A for supervision
    supervisees: supervisees,
    duration_minutes: 50,
    energy_cost: 10 + (supervisees.length * 5),  // 10 base + 5 per supervisee
    // ...
  };

  return session;
}

function completeSupervisionSession(session: SupervisionSession) {
  // Supervisor gains XP
  const supervisor = getTherapist(session.therapist_id);
  supervisor.experience_points += 15 + (session.supervisees.length * 5);

  // Supervisees gain significant XP
  for (const supervisee of session.supervisees) {
    supervisee.experience_points += 40;  // Much higher than regular sessions
  }

  // Energy cost
  supervisor.energy -= 10;
  for (const supervisee of session.supervisees) {
    supervisee.energy -= 5;  // Lighter cost for supervisees
  }

  // No payment, but high development value
  EventBus.emit('supervision_session_completed', session.therapist_id);
}
```

## Session Cancellation

Player can cancel scheduled sessions:

```typescript
function cancelSession(session: Session) {
  if (session.status !== 'scheduled' && session.status !== 'in_progress') {
    return false;  // Can't cancel completed sessions
  }

  session.status = 'cancelled';

  // Remove from schedule
  delete schedule[session.scheduled_day][session.scheduled_hour][session.therapist_id];

  // Reputation penalty
  reputationSystem.updateReputation(-1);

  // Client engagement hit
  const client = getClient(session.client_id);
  client.engagement = Math.max(0, client.engagement - 15);

  // No payment received
  EventBus.emit('session_cancelled', session.id);
  return true;
}
```

## Events Emitted

```typescript
EventBus.emit('session_scheduled', sessionId);
EventBus.emit('session_started', sessionId);
EventBus.emit('session_completed', sessionId, quality);
EventBus.emit('session_cancelled', sessionId);
EventBus.emit('decision_event_triggered', sessionId, eventId);
EventBus.emit('client_cured', clientId);
```

## Testing Strategy

```typescript
test('session quality calculation includes all modifiers', () => {
  const session = createSession(therapist, client, 1, 8);
  const quality = calculateSessionQuality(session);
  expect(quality).toBeGreaterThanOrEqual(0);
  expect(quality).toBeLessThanOrEqual(1);
});

test('low energy therapist has quality penalty', () => {
  therapist.energy = 10;
  const qualityLowEnergy = calculateSessionQuality(session);
  therapist.energy = 100;
  const qualityHighEnergy = calculateSessionQuality(session);
  expect(qualityLowEnergy).toBeLessThan(qualityHighEnergy);
});

test('session completion drains therapist energy', () => {
  const initialEnergy = therapist.energy;
  completeSession(session);
  expect(therapist.energy).toBeLessThan(initialEnergy);
});

test('decision event choice applies effects', () => {
  const initialQuality = session.decision_quality_impact || 0;
  resolveDecisionEvent(session, event, 0);
  expect(session.decision_quality_impact).toBe(
    initialQuality + event.choices[0].effects.quality
  );
});
```
