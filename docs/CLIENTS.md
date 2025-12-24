# Client Management System

Manages client arrivals, their journey through treatment, waiting list dynamics, and client lifecycle.

## Client Lifecycle

```
ARRIVE → WAITING → IN_TREATMENT → CURED/DROPPED
            ↓
     (max_wait exceeded → DROP)
```

## Client Generation

Implementation note (source of truth): clients are generated in `src/core/clients/ClientManager.ts` and spawned via `src/hooks/useClientSpawning.ts`.

### Starting Clients (Day 1)

- When a new game starts, the game seeds **2–3 initial clients** on **Day 1**.
- These seeded clients are forced to have **no credential requirements** so they are compatible with the starting player therapist (who begins with no certifications).
- Concretely, seeded clients have:
  - `requiredCertification: null`
  - `isMinor: false`
  - `isCouple: false`

### Progressive Credential Requirements

As the player progresses, a growing fraction of newly arriving clients will require credentials (certifications).

- Each generated client rolls a probability from **0% → MAX** based on **practice level** and **time**.
- The chance is computed by `getCredentialRequirementChance(currentDay, practiceLevel)`.
- The maximum fraction is `CLIENT_CONFIG.MAX_CREDENTIAL_REQUIRED_RATE`.

When a client is flagged as requiring credentials, `requiredCertification` is guaranteed to be **non-null** (including for categories that do not have a dedicated mapping), which makes the “% of clients requiring credentials” meaningful.

New clients arrive daily based on reputation and modifiers:

```typescript
function generateClientArrivals(day: number) {
  // Base rate from reputation
  let arrivalRate = 0.5 + (reputation / 500) * 2.5;  // 0.5 to 3 clients

  // Random variation
  arrivalRate += random(-0.5, 0.5);

  // Early game bonus (Days 1-7)
  if (day <= 7) {
    arrivalRate *= 2;  // Generous early game
  }

  // Apply modifiers
  if (hasModifier('busy_week')) {
    arrivalRate *= 1.2;
  }
  if (hasModifier('economic_downturn')) {
    arrivalRate *= 0.8;
  }

  // Generate clients
  const count = Math.floor(arrivalRate);
  for (let i = 0; i < count; i++) {
    const client = generateClient();
    addClientToWaitingList(client);
    EventBus.emit('client_arrived', client.id);
  }
}

function generateClient(): Client {
  // Condition
  const conditions = [
    'anxiety', 'depression', 'trauma', 'stress',
    'relationship', 'behavioral'
  ];
  const category = conditions[Math.floor(Math.random() * conditions.length)];

  // Severity
  const severity = random(1, 10);

  // Sessions needed (more for severe)
  const sessionsRequired = Math.floor(4 + severity * 1.5);

  // Preferences
  const client: Client = {
    id: `client-${Date.now()}-${Math.random()}`,
    display_name: generateAnonymousName(),  // e.g., \"Client AB\"
    condition_category: category,
    condition_type: getSubtype(category),
    severity: severity,
    sessions_required: sessionsRequired,
    sessions_completed: 0,
    treatment_progress: 0,
    status: 'waiting',
    satisfaction: 50,
    engagement: 75,
    arrival_day: currentDay,
    days_waiting: 0,
    max_wait_days: calculateMaxWait(reputation),
    insurance_provider: selectInsuranceProvider(),
    is_private_pay: !insurance_provider,
    insurance_rate: insurance_provider ? random(80, 150) : 0,
    prefers_virtual: random(0, 1) < 0.3,  // 30% prefer virtual
    preferred_frequency: ['weekly', 'biweekly', 'monthly'][Math.floor(Math.random() * 3)],
    preferred_time: ['morning', 'afternoon', 'evening', 'any'][Math.floor(Math.random() * 4)],
    availability: generateAvailability(),
    is_minor: random(0, 1) < 0.15,  // 15% are minors
    is_couple: random(0, 1) < 0.1,  // 10% are couples
    required_certification: getRequiredCertification(isMinor, isCouple),
    assigned_therapist: null,
    sessions: []
  };

  return client;
}

function calculateMaxWait(reputation: number): number {
  // Higher reputation = less patient clients
  // They'll leave if you can't see them soon
  const maxWait = 14 - Math.floor(reputation / 100);
  return Math.max(3, maxWait);  // At least 3 days, at most 14
}
```

## Waiting List Management

Clients arrive at practice and must be scheduled:

```typescript
interface WaitingList {
  clients: Client[];  // Sorted by arrival (FIFO)

  add(client: Client): void;
  remove(clientId: string): void;
  getNextAvailable(certification?: string): Client | null;
}

function addClientToWaitingList(client: Client) {
  waitingList.push(client);
  client.status = 'waiting';
  EventBus.emit('client_added_to_waiting_list', client.id);
}

function updateWaitingListEngagement(day: number) {
  for (const client of waitingList) {
    // Engagement decays each day
    const decay = random(3, 5);
    client.engagement -= decay;

    // Check max wait tolerance
    client.days_waiting++;
    if (client.days_waiting > client.max_wait_days) {
      removeClientFromWaitingList(client, 'max_wait_exceeded');
      EventBus.emit('client_dropped', client.id, 'max_wait_exceeded');
    }

    // Check for dropout from low engagement
    if (client.engagement < 20) {
      removeClientFromWaitingList(client, 'low_engagement');
      EventBus.emit('client_dropped', client.id, 'low_engagement');
    }
  }
}
```

## Scheduling a Waiting Client

```typescript
function scheduleWaitingClient(
  client: Client,
  therapist: Therapist,
  day: number,
  hour: number
): boolean {
  // Remove from waiting list
  waitingList.splice(waitingList.indexOf(client), 1);

  // Create session
  const session = createSession(therapist, client, day, hour, {
    is_virtual: client.prefers_virtual,
    is_insurance: !client.is_private_pay
  });

  if (!session) {
    waitingList.push(client);  // Restore to waiting list
    return false;
  }

  // Update client
  client.status = 'in_treatment';
  client.assigned_therapist = therapist;
  client.sessions.push(session);

  EventBus.emit('client_scheduled', client.id, session.id);
  return true;
}
```

## Treatment Progress

As sessions complete, clients progress toward cure:

```typescript
function updateClientProgress(session: Session) {
  const client = getClient(session.client_id);

  // Progress based on session quality
  const qualityFactor = session.quality;  // 0.0-1.0

  // Sessions completed
  client.sessions_completed++;

  // Treatment progress increments
  const progressPerSession = 1.0 / client.sessions_required;
  const actualProgress = progressPerSession * qualityFactor;
  client.treatment_progress = Math.min(1.0, client.treatment_progress + actualProgress);

  // Satisfaction and engagement
  client.satisfaction = Math.min(100, client.satisfaction + qualityFactor * 20);
  client.engagement = Math.min(100, client.engagement + qualityFactor * 10);

  // Check for cure
  if (client.treatment_progress >= 1.0 || client.sessions_completed >= client.sessions_required) {
    cureClient(client);
  }
}

function cureClient(client: Client) {
  client.status = 'completed';
  client.treatment_progress = 1.0;

  reputationSystem.updateReputation(5);  // Bonus for successful treatment

  // Remove from active list
  activeClients.splice(activeClients.indexOf(client), 1);

  EventBus.emit('client_cured', client.id);
  showNotification(`${client.display_name} completed treatment!`);
}
```

## Client Dropout

Clients can drop out for several reasons:

```typescript
function dropClient(client: Client, reason: string) {
  client.status = 'dropped';

  // Remove from lists
  if (waitingList.includes(client)) {
    waitingList.splice(waitingList.indexOf(client), 1);
  }
  if (activeClients.includes(client)) {
    activeClients.splice(activeClients.indexOf(client), 1);
  }

  // Reputation penalty
  reputationSystem.updateReputation(-3);

  // Cancel remaining sessions
  for (const session of client.sessions) {
    if (session.status === 'scheduled') {
      session.status = 'cancelled';
    }
  }

  EventBus.emit('client_dropped', client.id, reason);
  showNotification(`${client.display_name} dropped out (${reason})`);
}

// Dropout reasons:
// - 'max_wait_exceeded': Too long without first session
// - 'low_engagement': Engagement dropped to <20
// - 'low_satisfaction': Satisfaction dropped to <20 during treatment
// - 'manual': Player cancelled sessions repeatedly
// - 'moved_away': Random event
```

## Client Satisfaction

Tracking client happiness with therapy:

```typescript
interface ClientSatisfaction {
  baseline: number;      // 50 (neutral)
  session_quality: number;  // +5 to +20 per session
  session_frequency: number; // +2 if seeing often enough
  therapist_fit: number;    // +5 if good match
  progress_visible: number; // +10 if notable improvement
}

function calculateClientSatisfaction(client: Client) {
  let score = client.satisfaction;

  // Recent sessions
  const recentSessions = client.sessions.slice(-5);
  const avgQuality = recentSessions.reduce((sum, s) => sum + s.quality, 0) / recentSessions.length;
  score += avgQuality * 20;

  // Progress
  if (client.treatment_progress > 0.3) score += 10;
  if (client.treatment_progress > 0.6) score += 10;

  // Time between sessions (if longer than preferred, decrease)
  const timeSinceLastSession = currentDay - (client.sessions[client.sessions.length - 1]?.scheduled_day || currentDay);
  if (timeSinceLastSession > 10 && client.preferred_frequency === 'weekly') {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
```

## Client Details Panel

UI panel showing client information:

```typescript
interface ClientDetailsPanel {
  client: Client;
  display_info: {
    name: string;
    condition: string;
    severity: number;
    status: string;
  };
  progress: {
    sessions_completed: number;
    sessions_required: number;
    percentage: number;
    progress_bar: number;  // 0.0-1.0
  };
  metrics: {
    satisfaction: number;
    engagement: number;
    therapist_match_score: number;
  };
  sessions: {
    count: number;
    list: SessionSummary[];
  };
  next_session: Session | null;
  actions: {
    can_schedule: boolean;
    can_reassign: boolean;
    can_cancel: boolean;
  };
}
```

## Client Management Panel

Unified view for managing client list:

```typescript
interface ClientManagementPanel {
  waiting_list: {
    count: number;
    clients: ClientListItem[];
    sort_options: ['arrival', 'days_waiting', 'engagement'];
  };
  active_clients: {
    count: number;
    clients: ClientListItem[];
    sort_options: ['progress', 'satisfaction', 'assigned_therapist'];
  };
  filters: {
    condition_category?: string;
    severity_range?: [min: number, max: number];
    requires_certification?: string;
    insurance_only?: boolean;
  };
  stats: {
    total_clients: number;
    active_clients: number;
    waiting_clients: number;
    avg_satisfaction: number;
    cure_rate: number;
  };
}
```

## Compatibility Matching

Find best therapist-client matches:

```typescript
interface ClientTherapistMatch {
  therapist: Therapist;
  score: number;  // 0.0-1.0
  factors: {
    certification_match: boolean;
    specialization_score: number;
    personality_fit: number;
    availability_match: number;
    virtual_preference_match: boolean;
  };
}

function findBestTherapistForClient(client: Client): ClientTherapistMatch[] {
  const matches: ClientTherapistMatch[] = [];

  for (const therapist of therapists) {
    // Certification check (required)
    if (client.required_certification) {
      if (!therapist.certifications.includes(client.required_certification)) {
        continue;  // Skip, not qualified
      }
    }

    // Score calculation
    let score = 0.5;  // Base score

    // Specialization match
    const specialtyMatches = therapist.specializations.filter(
      s => s === client.condition_category || s === client.condition_type
    ).length;
    score += Math.min(0.25, specialtyMatches * 0.125);

    // Personality fit (simplified)
    const therapistWarmth = therapist.warmth || 5;
    const clientNeedsSoftness = client.severity < 5;
    if (clientNeedsSoftness && therapistWarmth > 7) score += 0.1;
    if (!clientNeedsSoftness && therapistWarmth > 5) score += 0.05;

    // Virtual preference
    if (client.prefers_virtual && therapist.can_do_telehealth) score += 0.1;

    matches.push({
      therapist,
      score: Math.min(1.0, score),
      factors: {
        certification_match: !client.required_certification ||
          therapist.certifications.includes(client.required_certification),
        specialization_score: specialtyMatches / 2,
        personality_fit: (therapistWarmth / 10),
        availability_match: countAvailableSlots(therapist) > 3 ? 0.2 : 0,
        virtual_preference_match: client.prefers_virtual && therapist.can_do_telehealth
      }
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}
```

## Anonymous Names

Clients are identified by anonymous names for privacy:

```typescript
function generateAnonymousName(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = letters[Math.floor(Math.random() * letters.length)];
  const l2 = letters[Math.floor(Math.random() * letters.length)];
  return `Client ${l1}${l2}`;
}
```

## Events Emitted

```typescript
EventBus.emit('client_arrived', clientId);
EventBus.emit('client_added_to_waiting_list', clientId);
EventBus.emit('client_scheduled', clientId, sessionId);
EventBus.emit('client_cured', clientId);
EventBus.emit('client_dropped', clientId, reason);
EventBus.emit('client_satisfaction_changed', clientId, oldScore, newScore);
```

## Testing Strategy

```typescript
test('client drops if max_wait exceeded', () => {
  const client = generateClient();
  client.max_wait_days = 3;
  addClientToWaitingList(client);

  for (let i = 0; i < 5; i++) {
    updateWaitingListEngagement(i);
  }

  expect(client.status).toBe('dropped');
});

test('client cured when progress reaches 1.0', () => {
  const client = createClient({ sessions_required: 4 });
  const listener = vi.fn();
  EventBus.on('client_cured', listener);

  for (let i = 0; i < 4; i++) {
    const session = createSession(therapist, client, i + 1, 8);
    session.quality = 1.0;  // Perfect sessions
    updateClientProgress(session);
  }

  expect(listener).toHaveBeenCalledWith(client.id);
  expect(client.status).toBe('completed');
});

test('therapist matching prioritizes required certification', () => {
  const client = createClient({
    required_certification: 'trauma_certified'
  });
  const t1 = createTherapist({ certifications: ['trauma_certified'] });
  const t2 = createTherapist({ certifications: [] });

  const matches = findBestTherapistForClient(client);
  expect(matches[0].therapist).toBe(t1);
});
```
