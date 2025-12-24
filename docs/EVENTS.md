# Events System

Manages random daily events and decision events that inject narrative variety and create interesting choices.

## Event Types

### Random Daily Events

Triggered daily (30% chance, scales with game speed), these events have multiple choice outcomes:

```typescript
interface RandomEvent {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  trigger_type: 'daily' | 'weekly' | 'monthly' | 'milestone';

  // Conditions
  conditions?: {
    min_therapists?: number;
    min_reputation?: number;
    min_practice_level?: number;
    max_practice_level?: number;
  };

  // Cooldown prevents spam
  cooldown_days: number;
  last_triggered_day: number | null;

  // Choices
  choices: EventChoice[];

  // Optional: Apply modifiers after choice
  modifiers?: GameModifier[];
}

interface EventChoice {
  text: string;
  flavor?: string;  // Extra descriptive text
  effects: {
    money?: number;
    reputation?: number;
    client_arrivals?: number;
    therapist_effects?: {
      therapist_id?: string;  // null = all
      energy?: number;
      satisfaction?: number;
    };
    client_effects?: {
      satisfaction?: number;
      all_clients?: boolean;
    };
  };
}

interface GameModifier {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  effects: {
    client_arrival_multiplier?: number;
    reputation_multiplier?: number;
    session_fee_multiplier?: number;
    insurance_denial_multiplier?: number;
    therapist_energy_cost_multiplier?: number;
  };
}
```

## Event Triggering

```typescript
function checkForRandomEvent(day: number) {
  // 30% chance per day (not on day 1)
  if (day === 1) return;
  if (Math.random() > 0.30) return;

  // Find eligible events
  const eligible = RANDOM_EVENTS.filter(e => {
    // Check cooldown
    if (e.last_triggered_day && day - e.last_triggered_day < e.cooldown_days) {
      return false;
    }

    // Check conditions
    if (e.conditions?.min_therapists && therapists.length < e.conditions.min_therapists) {
      return false;
    }
    if (e.conditions?.min_reputation && reputation < e.conditions.min_reputation) {
      return false;
    }
    if (e.conditions?.min_practice_level && practiceLevel < e.conditions.min_practice_level) {
      return false;
    }

    return true;
  });

  if (eligible.length === 0) return;

  // Select random event
  const event = eligible[Math.floor(Math.random() * eligible.length)];

  // Pause game and show event
  gameEngine.pause('random_event');
  EventBus.emit('random_event_triggered', event.id);
  showEventModal(event);
}

function resolveRandomEvent(event: RandomEvent, choiceIndex: number) {
  const choice = event.choices[choiceIndex];

  // Apply effects
  if (choice.effects.money) {
    if (choice.effects.money > 0) {
      economySystem.addMoney(choice.effects.money, `event_bonus_${event.id}`);
    } else {
      economySystem.removeMoney(-choice.effects.money, `event_cost_${event.id}`);
    }
  }

  if (choice.effects.reputation) {
    reputationSystem.updateReputation(choice.effects.reputation);
  }

  if (choice.effects.client_arrivals) {
    for (let i = 0; i < choice.effects.client_arrivals; i++) {
      const client = generateClient();
      addClientToWaitingList(client);
    }
  }

  // Apply modifiers if any
  if (event.modifiers) {
    for (const mod of event.modifiers) {
      applyGameModifier(mod);
    }
  }

  event.last_triggered_day = currentDay;
  gameEngine.resume('random_event');
  EventBus.emit('event_resolved', event.id, choiceIndex);
}
```

## Event Catalog

### Positive Events

```typescript
const POSITIVE_EVENTS: RandomEvent[] = [
  {
    id: 'referral_bonus',
    title: 'Referral Surge',
    description: 'A local therapist refers several clients to your practice!',
    type: 'positive',
    trigger_type: 'daily',
    cooldown_days: 5,
    conditions: { min_reputation: 30 },
    choices: [
      {
        text: 'Accept all referrals (gain 3 clients)',
        effects: { client_arrivals: 3, reputation: 2 }
      },
      {
        text: 'Accept some, politely decline others',
        effects: { client_arrivals: 1, reputation: 1 }
      }
    ]
  },
  {
    id: 'grant_opportunity',
    title: 'Grant Opportunity',
    description: 'A local foundation offers a grant to practices serving underserved communities',
    type: 'positive',
    trigger_type: 'monthly',
    cooldown_days: 30,
    conditions: { min_practice_level: 2 },
    choices: [
      {
        text: 'Apply for grant (+$5,000 if awarded)',
        effects: { money: 5000 }
      },
      {
        text: 'Pass, too much paperwork',
        effects: { reputation: -1 }
      }
    ]
  }
];
```

### Negative Events

```typescript
const NEGATIVE_EVENTS: RandomEvent[] = [
  {
    id: 'therapist_sick',
    title: 'Staff Illness',
    description: 'One of your therapists has called in sick today',
    type: 'negative',
    trigger_type: 'daily',
    cooldown_days: 3,
    conditions: { min_therapists: 2 },
    choices: [
      {
        text: 'Cover their sessions yourself',
        effects: {
          therapist_effects: {
            therapist_id: 'player-therapist',
            energy: -20
          },
          reputation: 2
        }
      },
      {
        text: 'Cancel their sessions',
        effects: {
          reputation: -3,
          client_effects: { satisfaction: -10, all_clients: true }
        }
      }
    ]
  },
  {
    id: 'insurance_audit',
    title: 'Insurance Audit',
    description: 'An insurance company is auditing your records',
    type: 'negative',
    trigger_type: 'weekly',
    cooldown_days: 14,
    conditions: { min_reputation: 50 },
    choices: [
      {
        text: 'Cooperate fully',
        effects: { money: -500, reputation: 1 }
      },
      {
        text: 'Minimal cooperation',
        effects: { money: -200, reputation: -2 }
      }
    ]
  }
];
```

### Neutral Events

```typescript
const NEUTRAL_EVENTS: RandomEvent[] = [
  {
    id: 'new_therapy_technique',
    title: 'New Therapy Technique',
    description: 'You read about a new therapeutic approach',
    type: 'neutral',
    trigger_type: 'daily',
    cooldown_days: 3,
    choices: [
      {
        text: 'Research the technique',
        effects: { reputation: 1 }
      },
      {
        text: 'Ignore it, stick with proven methods',
        effects: {}
      }
    ]
  }
];
```

## Milestone Events

Special events triggered by specific achievements:

```typescript
interface MilestoneEvent {
  id: string;
  trigger: string;  // 'first_hire', 'first_cure', 'level_up', 'anniversary'
  title: string;
  description: string;
  effects: {
    money?: number;
    reputation?: number;
    show_celebration: boolean;
  };
}

const MILESTONE_EVENTS: MilestoneEvent[] = [
  {
    id: 'first_hire',
    trigger: 'first_hire',
    title: 'Your First Hire',
    description: 'Congratulations! You\'ve hired your first therapist.',
    effects: { reputation: 2, show_celebration: true }
  },
  {
    id: 'first_cure',
    trigger: 'first_cure',
    title: 'First Success',
    description: 'Your first client has completed treatment!',
    effects: { reputation: 5, show_celebration: true }
  }
];

function checkMilestones() {
  // Called after significant actions
  if (therapists.length === 2) {
    triggerMilestone('first_hire');
  }

  const curedClients = clients.filter(c => c.status === 'completed').length;
  if (curedClients === 1) {
    triggerMilestone('first_cure');
  }
}

function triggerMilestone(milestoneId: string) {
  const milestone = MILESTONE_EVENTS.find(m => m.trigger === milestoneId);
  if (!milestone) return;

  // Apply effects
  if (milestone.effects.reputation) {
    reputationSystem.updateReputation(milestone.effects.reputation);
  }
  if (milestone.effects.money) {
    economySystem.addMoney(milestone.effects.money, `milestone_${milestoneId}`);
  }

  if (milestone.effects.show_celebration) {
    showCelebrationAnimation();
    playMilestoneSound();
  }

  EventBus.emit('milestone_triggered', milestoneId);
}
```

## Decision Events (In-Session)

Triggered during sessions with a small chance per minute:

**Energy effects note (current implementation):** `effects.energy` is an *energy delta* applied directly to the therapist.
Negative values cost energy; positive values restore energy.

```typescript
interface DecisionEventTemplate {
  id: string;
  title: string;
  description: string;
  choices: DecisionChoice[];
  trigger_conditions?: {
    min_severity?: number;
    max_severity?: number;
    condition_category?: string;
  };
  frequency_per_minute: number;  // 0.015 = 1.5% per minute
}

const DECISION_EVENTS: DecisionEventTemplate[] = [
  {
    id: 'client_resistant',
    title: 'Client Resistance',
    description: 'Your client seems reluctant to engage today. How do you respond?',
    choices: [
      {
        text: 'Gently explore the resistance',
        effects: { quality: 0.1, energy: -5 }
      },
      {
        text: 'Push through with the planned approach',
        effects: { quality: -0.1, energy: 0 }
      },
      {
        text: 'Offer to reschedule if they\'re not feeling it',
        effects: { quality: -0.05, energy: 5 }  // Less effective but preserve energy
      }
    ]
  },
  {
    id: 'emotional_breakthrough',
    title: 'Breakthrough Moment',
    description: 'Your client has a profound realization. What do you do?',
    trigger_conditions: { min_severity: 6 },
    choices: [
      {
        text: 'Process deeply and explore thoroughly',
        effects: { quality: 0.2, energy: -15, satisfaction: 20 }
      },
      {
        text: 'Integrate gently and let them process',
        effects: { quality: 0.05, energy: -5, satisfaction: 10 }
      }
    ]
  },
  {
    id: 'crisis_disclosure',
    title: 'Crisis Moment',
    description: 'Your client discloses suicidal ideation. Respond carefully.',
    choices: [
      {
        text: 'Conduct full assessment, extend session if needed',
        effects: { quality: 0.25, energy: -25, safety: true }
      },
      {
        text: 'Provide crisis resources and safety plan',
        effects: { quality: 0.15, energy: -10, safety: true }
      }
    ]
  }
];

// Remembered decisions (auto-resolution)
function rememberDecision(eventId: string, choiceIndex: number) {
  if (autoResolveEnabled) {
    gameStore.setState(s => ({
      remembered_decisions: {
        ...s.remembered_decisions,
        [eventId]: choiceIndex
      }
    }));
  }
}

function getAutoResolveChoice(eventId: string): number | null {
  const stored = gameStore.getState().remembered_decisions[eventId];
  return stored !== undefined ? stored : null;
}
```

## Game Modifiers

Temporary effects applied by events:

```typescript
interface GameModifier {
  id: string;
  name: string;
  description: string;
  start_day: number;
  duration_days: number;
  effects: {
    client_arrival_multiplier?: number;  // 1.2 = +20%
    reputation_multiplier?: number;
    session_fee_multiplier?: number;
    insurance_denial_multiplier?: number;
    therapist_energy_cost_multiplier?: number;
  };
}

function applyGameModifier(mod: GameModifier) {
  gameStore.setState(s => ({
    active_modifiers: [...s.active_modifiers, mod]
  }));

  EventBus.emit('modifier_applied', mod.id, mod.name);
}

function updateModifiers() {
  const active = gameStore.getState().active_modifiers;
  const stillActive = active.filter(m => currentDay < m.start_day + m.duration_days);

  if (stillActive.length < active.length) {
    gameStore.setState(s => ({
      active_modifiers: stillActive
    }));

    for (const expired of active) {
      if (!stillActive.includes(expired)) {
        EventBus.emit('modifier_expired', expired.id);
      }
    }
  }
}

// Apply modifiers to calculations
function getClientArrivalCount(day: number): number {
  let base = calculateBaseArrivals(day);

  for (const mod of getActiveModifiers()) {
    if (mod.effects.client_arrival_multiplier) {
      base *= mod.effects.client_arrival_multiplier;
    }
  }

  return Math.floor(base);
}
```

## Event Modal UI

```typescript
interface EventModal {
  event: RandomEvent | DecisionEventTemplate;
  title: string;
  description: string;
  flavor_text?: string;
  choices: {
    text: string;
    flavor?: string;
    effect_preview?: string;  // "Gain +10 reputation"
  }[];
  show_remember_option?: boolean;  // For decision events
}
```

## Events Emitted

```typescript
EventBus.emit('random_event_triggered', eventId);
EventBus.emit('event_resolved', eventId, choiceIndex);
EventBus.emit('decision_event_triggered', sessionId, eventId);
EventBus.emit('decision_resolved', sessionId, eventId, choiceIndex);
EventBus.emit('milestone_triggered', milestoneId);
EventBus.emit('modifier_applied', modifierId, modifierName);
EventBus.emit('modifier_expired', modifierId);
```

## Testing Strategy

```typescript
test('random event only triggers if conditions met', () => {
  const event = RANDOM_EVENTS.find(e => e.conditions?.min_therapists);
  therapists.length = event.conditions.min_therapists - 1;

  let triggered = false;
  EventBus.on('random_event_triggered', () => { triggered = true; });

  checkForRandomEvent(10);
  expect(triggered).toBe(false);

  therapists.length = event.conditions.min_therapists;
  checkForRandomEvent(10);
  expect(triggered).toBe(true);
});

test('event cooldown prevents repeated triggers', () => {
  const event = RANDOM_EVENTS[0];
  event.last_triggered_day = currentDay - 1;

  let triggeredCount = 0;
  EventBus.on('random_event_triggered', () => { triggeredCount++; });

  checkForRandomEvent(currentDay);
  expect(triggeredCount).toBe(0);

  checkForRandomEvent(currentDay + event.cooldown_days);
  expect(triggeredCount).toBe(1);
});

test('event choice effects applied correctly', () => {
  const initialRep = reputation;
  const choice = RANDOM_EVENTS[0].choices[0];

  resolveRandomEvent(RANDOM_EVENTS[0], 0);

  if (choice.effects.reputation) {
    expect(reputation).toBe(initialRep + choice.effects.reputation);
  }
});
```
