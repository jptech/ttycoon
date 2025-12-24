# Reputation System

Tracks practice reputation and progression through practice levels, unlocking features and expansion opportunities.

## Reputation Score (0-500)

```typescript
interface ReputationSystem {
  reputation: number;           // 0-500 (clamped)
  practice_level: number;       // 1-5
  clinic_certifications_total: number;

  updateReputation(delta: number): void;
  levelUp(): void;
}
```

**Starting**: 20 reputation at Level 1

**Range**: 0-500 (clamped to this range)

## Practice Levels

Levels unlock features and staff capacity:

| Level | Name | Rep Required | Staff Cap | Key Unlocks |
|-------|------|--------------|-----------|-------------|
| 1 | Starting Practice | 0 | 1 | Base gameplay (solo only) |
| 2 | Established | 50 | 2-5 | Hiring, Training programs |
| 3 | Growing | 125 | 3-5 | Better hiring pool, Advanced training |
| 4 | Respected | 250 | 4-5 | Large office access, Premium features |
| 5 | Premier | 400 | 5+ | All features unlocked, highest prestige |

```typescript
const PRACTICE_LEVELS = [
  {
    level: 1,
    name: 'Starting Practice',
    rep_threshold: 0,
    staff_cap: 1,
    unlocks: {
      can_hire: false,
      can_train: false,
      hiring_pool_quality: 'basic'
    }
  },
  {
    level: 2,
    name: 'Established',
    rep_threshold: 50,
    staff_cap: 5,
    unlocks: {
      can_hire: true,
      can_train: true,
      hiring_pool_quality: 'standard',
      advanced_training: false
    }
  },
  {
    level: 3,
    name: 'Growing',
    rep_threshold: 125,
    staff_cap: 5,
    unlocks: {
      can_hire: true,
      can_train: true,
      hiring_pool_quality: 'good',
      advanced_training: true,
      supervision_sessions: true
    }
  },
  {
    level: 4,
    name: 'Respected',
    rep_threshold: 250,
    staff_cap: 5,
    unlocks: {
      large_office: true,
      premium_clients: true,
      research_opportunities: true
    }
  },
  {
    level: 5,
    name: 'Premier',
    rep_threshold: 400,
    staff_cap: 8,
    unlocks: {
      all_features: true,
      prestige_milestone: true
    }
  }
];

function checkLevelUp() {
  for (let i = practiceLevel; i < PRACTICE_LEVELS.length; i++) {
    if (reputation >= PRACTICE_LEVELS[i].rep_threshold) {
      practiceLevel = PRACTICE_LEVELS[i].level;
      EventBus.emit('practice_level_changed', practiceLevel);
      showLevelUpNotification(PRACTICE_LEVELS[i]);
    } else {
      break;
    }
  }
}
```

## Reputation Gains

### Session Quality

Based on session outcome:

```typescript
const REPUTATION_BY_QUALITY = {
  excellent: 5,      // 0.8+ quality
  good: 1,           // 0.6-0.8
  fair: 0,           // 0.4-0.6
  poor: -2,          // 0.2-0.4
  very_poor: -5      // 0.0-0.2
};

function applySessionQualityReputation(session: Session) {
  const tier = session.quality_tier;
  const reputation = REPUTATION_BY_QUALITY[tier];
  updateReputation(reputation);
}
```

### Client Outcomes

```typescript
// Excellent outcome (all sessions completed perfectly)
function cureClient(client: Client) {
  updateReputation(5);  // Bonus for successful treatment
}

// Client drops out
function dropClient(client: Client, reason: string) {
  updateReputation(-3);  // Penalty for dropout
}
```

### Training Completion

```typescript
// Each completed training grants +1 reputation
function completeTraining(training: TrainingProgram) {
  // ... apply rewards ...
  updateReputation(1);
}
```

### Certification Bonuses

```typescript
// Every 5 clinic certifications → +1 reputation daily (passive)
function calculateClinicCertificationBonus() {
  const totalCertifications = therapists.reduce(
    (sum, t) => sum + t.certifications.length,
    0
  );

  const bonus = Math.floor(totalCertifications / 5);
  return bonus;
}

// Called during day start
function applyDailyPassiveBonuses() {
  const certBonus = calculateClinicCertificationBonus();
  if (certBonus > 0) {
    updateReputation(certBonus);
    EventBus.emit('certification_bonus_earned', certBonus);
  }
}
```

### Milestone Events

```typescript
// First successful hire
function onFirstHire(therapist: Therapist) {
  updateReputation(2);
  showSpecialEvent('first_hire');
}

// First client cured
function onFirstCure(client: Client) {
  updateReputation(5);
  showSpecialEvent('first_cure');
}

// Practice anniversary
function onAnniversary(year: number) {
  updateReputation(10);
  showSpecialEvent('anniversary', year);
}
```

## Reputation Losses

### Session Cancellations

```typescript
function cancelSession(session: Session) {
  // Cancelling a scheduled session damages reputation
  updateReputation(-1 to -2);  // Random or based on how late
}
```

### Client Dissatisfaction

```typescript
function trackClientDissatisfaction() {
  for (const client of clients) {
    if (client.satisfaction < 20) {
      // Very dissatisfied clients damage rep if they drop
      updateReputation(-2);
    }
  }
}
```

### Poor Practice Management

```typescript
// Multiple sessions with very poor quality
function checkQualityTrend() {
  const last10Sessions = getRecentSessions(10);
  const poorCount = last10Sessions.filter(s => s.quality < 0.2).length;

  if (poorCount >= 7) {
    // Pattern of very poor outcomes
    updateReputation(-3);
    EventBus.emit('quality_concern_warning', poorCount);
  }
}
```

## Reputation Visualization

```typescript
interface ReputationDisplay {
  score: number;           // 0-500
  level: number;           // 1-5
  level_name: string;      // "Established"
  progress_to_next: number; // 0.0-1.0 (% of way to next level)
  certifications: number;  // Total clinic certifications

  // Recent activity
  today_gains: number;
  today_losses: number;
  trend: 'rising' | 'falling' | 'stable';
}

function getReputationDisplay(): ReputationDisplay {
  const currentLevel = PRACTICE_LEVELS[practiceLevel - 1];
  const nextLevel = PRACTICE_LEVELS[practiceLevel];

  const progress = nextLevel
    ? (reputation - currentLevel.rep_threshold) /
      (nextLevel.rep_threshold - currentLevel.rep_threshold)
    : 1.0;

  return {
    score: reputation,
    level: practiceLevel,
    level_name: currentLevel.name,
    progress_to_next: Math.min(1.0, progress),
    certifications: calculateClinicCertifications(),
    today_gains: transactionsToday.filter(t => t.type === 'income').sum(),
    today_losses: transactionsToday.filter(t => t.type === 'expense').sum(),
    trend: calculateReputationTrend()
  };
}
```

## Client Arrival Scaling

Reputation affects how many clients arrive:

```typescript
function generateClientArrivals(day: number): number {
  // Base arrival rate
  let arrivalCount = 0.5 + (reputation / 500) * 2.5;  // 0.5 to 3 clients

  // Random variation
  arrivalCount += random(-0.5, 0.5);

  // Early game bonus
  if (day <= 7) {
    arrivalCount *= 2;  // Extra clients early on
  }

  // Modifiers
  if (hasActiveModifier('busy_week')) {
    arrivalCount *= 1.2;
  }

  if (hasActiveModifier('economic_downturn')) {
    arrivalCount *= 0.8;
  }

  return Math.floor(arrivalCount);
}
```

## Hiring Pool Quality

Better reputation = better hiring candidates:

```typescript
interface HireCandidate {
  therapist: Therapist;
  salary_asking: number;
  base_skill: number;
  specializations: string[];
}

function generateHiringCandidates(): HireCandidate[] {
  const poolSize = 3 + Math.floor(practiceLevel / 2);
  const candidates = [];

  for (let i = 0; i < poolSize; i++) {
    // Quality increases with reputation
    const skillMultiplier = 0.5 + (reputation / 500) * 0.5;  // 0.5x to 1.0x

    const candidate: HireCandidate = {
      therapist: createTherapist({
        base_skill: random(30, 80) * skillMultiplier,
        specializations: randomSpecializations(2 + Math.floor(reputation / 100))
      }),
      salary_asking: random(50, 150) * skillMultiplier,
      // ...
    };

    candidates.push(candidate);
  }

  return candidates;
}
```

## Reputation Panel

UI panel showing detailed reputation info:

```typescript
interface ReputationPanel {
  current_reputation: number;
  practice_level: number;
  progress_bar: {
    current: number;
    next_threshold: number;
    progress_percent: number;
  };

  // Breakdown
  reputation_sources: {
    sessions: number;
    training: number;
    milestones: number;
    certifications: number;
  };

  recent_changes: {
    day: number;
    amount: number;
    reason: string;
  }[];

  // Level unlocks
  current_unlocks: string[];
  next_level_unlocks: string[];

  // Trend
  last_7_days_net: number;
  trend_direction: 'up' | 'down' | 'stable';
}
```

## Certification Score

Independent metric for practice breadth:

```typescript
interface CertificationScore {
  total_certifications: number;
  by_therapist: Record<string, string[]>;  // therapist -> certs
  bonus_reputation_per_5: number;  // +1 rep per 5 total certs

  calculate(): number {
    return therapists.reduce(
      (sum, t) => sum + t.certifications.length,
      0
    );
  }
}

function calculateCertificationScore(): number {
  return therapists.reduce(
    (sum, t) => sum + t.certifications.length,
    0
  );
}

// Generates passive reputation
function applyClinicCertificationBonus() {
  const score = calculateCertificationScore();
  const bonus = Math.floor(score / 5);
  if (bonus > 0) {
    updateReputation(bonus);
  }
}
```

## Events Emitted

```typescript
EventBus.emit('reputation_changed', oldRep, newRep, reason);
EventBus.emit('practice_level_changed', newLevel);
EventBus.emit('certification_bonus_earned', amount);
EventBus.emit('quality_concern_warning', poorSessionCount);
```

## Testing Strategy

```typescript
test('reputation clamped between 0 and 500', () => {
  updateReputation(600);
  expect(reputation).toBe(500);
  updateReputation(-600);
  expect(reputation).toBe(0);
});

test('level up triggered at threshold', () => {
  reputation = 49;
  checkLevelUp();
  expect(practiceLevel).toBe(1);

  reputation = 50;
  checkLevelUp();
  expect(practiceLevel).toBe(2);
});

test('clinic certification bonus calculated correctly', () => {
  therapists[0].certifications = ['cert1', 'cert2'];
  therapists[1].certifications = ['cert3', 'cert4', 'cert5'];
  const bonus = calculateClinicCertificationBonus();
  expect(bonus).toBe(1);  // 5 certs / 5 = 1
});

test('client arrivals scale with reputation', () => {
  reputation = 0;
  const arrivals0 = generateClientArrivals(10);

  reputation = 500;
  const arrivals500 = generateClientArrivals(10);

  expect(arrivals500).toBeGreaterThan(arrivals0);
});
```
