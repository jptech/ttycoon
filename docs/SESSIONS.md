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
  └─ Therapist energy drains

COMPLETED
  └─ Progress reaches 100%
  └─ Quality calculated
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

Session quality determines payments, reputation impact, and client satisfaction:

```typescript
function calculateSessionQuality(session: Session): number {
  const therapist = getTherapist(session.therapist_id);
  const client = getClient(session.client_id);

  // Base quality from therapist skill
  let quality = therapist.base_skill / 100;  // 0.0-1.0

  // Modifiers
  let modifiers = 0;

  // 1. Therapist-Client Match
  const matchBonus = calculateTherapistClientMatch(therapist, client);
  modifiers += matchBonus;  // 0.0 to +0.4

  // 2. Therapist Energy Penalty
  if (therapist.energy < 30) {
    const energyPenalty = (1 - therapist.energy / 100) * 0.3;
    modifiers -= energyPenalty;  // up to -0.3
  }

  // 3. Client Severity Effect
  const severityMalus = (client.severity / 10) * 0.1;
  modifiers -= severityMalus;  // 0 to -0.1

  // 4. Therapist Specialization Match
  if (therapist.specializations.includes(client.condition_category)) {
    modifiers += 0.15;
  }

  // 5. Decision Events (applied during session)
  // This is added as choices are made
  // We track accumulated decision_quality_impact in session
  if (session.decision_quality_impact) {
    modifiers += session.decision_quality_impact;  // ±0.3 total
  }

  // Final calculation
  const finalQuality = Math.max(0.0, Math.min(1.0, quality + modifiers));

  session.quality = finalQuality;
  session.quality_tier = getQualityTier(finalQuality);

  return finalQuality;
}

function calculateTherapistClientMatch(therapist: Therapist, client: Client): number {
  let bonus = 0;

  // Certification match (required)
  if (client.required_certification) {
    if (therapist.certifications.includes(client.required_certification)) {
      bonus += 0.1;
    } else {
      return -0.5;  // No session without certification
    }
  }

  // Specialization match
  const matchCount = therapist.specializations.filter(s =>
    s === client.condition_category || s === client.condition_type
  ).length;
  bonus += Math.min(0.2, matchCount * 0.1);

  // Virtual preference match
  if (therapist.can_do_telehealth && client.prefers_virtual) {
    bonus += 0.05;
  }

  // Personality fit (simplified)
  if (therapist.warmth > 7 && client.severity < 5) {
    bonus += 0.05;  // Good match for lighter cases
  }

  return bonus;
}

function getQualityTier(quality: number): string {
  if (quality >= 0.8) return 'excellent';
  if (quality >= 0.6) return 'good';
  if (quality >= 0.4) return 'fair';
  if (quality >= 0.2) return 'poor';
  return 'very_poor';
}
```

## Session Completion

When progress reaches 100%, trigger completion flow:

```typescript
function completeSession(session: Session) {
  session.status = 'completed';
  session.progress = 1.0;

  // 1. Calculate quality
  const quality = calculateSessionQuality(session);

  // 2. Therapist energy cost
  const therapist = getTherapist(session.therapist_id);
  const energyCost = 5 + (getClient(session.client_id).severity * 2);
  therapist.energy = Math.max(0, therapist.energy - energyCost);

  // 3. Client treatment progress
  const client = getClient(session.client_id);
  const progressGain = (1 / client.sessions_required) * (quality / 0.5);
  client.treatment_progress += progressGain;
  client.sessions_completed++;
  client.satisfaction = Math.min(100, client.satisfaction + quality * 20);
  client.engagement = Math.min(100, client.engagement + quality * 10);

  // 4. Payment processing
  if (session.is_insurance) {
    economySystem.processInsuranceSession(session);
  } else {
    const payment = Math.round(150 * getPaymentMultiplier(quality));
    session.payment = payment;
    economySystem.addMoney(payment, `session_payment_${client.id}`);
  }

  // 5. Reputation effects
  const tierReputation: Record<string, number> = {
    excellent: 5,
    good: 1,
    fair: 0,
    poor: -2,
    very_poor: -5
  };
  reputationSystem.updateReputation(tierReputation[session.quality_tier]);

  // 6. Check for client cure
  if (client.treatment_progress >= 1.0) {
    cureClient(client);
  }

  // 7. Therapist XP gain
  therapist.experience_points += 10 + quality * 10;
  checkLevelUp(therapist);

  // 8. Emit events
  EventBus.emit('session_completed', session.id, quality);
  EventBus.emit('money_changed', oldBalance, newBalance, 'session_payment');

  // 9. Show results to player
  displaySessionResults(session);
}

function getPaymentMultiplier(quality: number): number {
  if (quality >= 0.8) return 1.0;
  if (quality >= 0.6) return 0.9;
  if (quality >= 0.4) return 0.7;
  if (quality >= 0.2) return 0.5;
  return 0.3;
}

function cureClient(client: Client) {
  client.status = 'completed';
  reputationSystem.updateReputation(5);  // Bonus for cure
  EventBus.emit('client_cured', client.id);
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

```typescript
function updateSessionProgress(session: Session, deltaTime: number) {
  if (session.status !== 'in_progress') return;

  // ... progress update ...

  // Check for decision event trigger
  // Base 1.5% per minute, scales with game speed
  const triggerChance = 0.015 * gameSpeed * (deltaTime / 1000);
  if (Math.random() < triggerChance) {
    const event = selectDecisionEvent(session);
    if (event) {
      triggerDecisionEvent(session, event);
    }
  }
}

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
