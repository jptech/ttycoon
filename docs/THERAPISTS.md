# Therapist Management System

Manages therapist hiring, energy, specializations, training, and skill development.

## Therapist Entity

```typescript
interface Therapist {
  // Identity
  id: string;
  display_name: string;
  is_player: boolean;  // true = player's therapist, cannot be fired

  // Professional Identity
  credential: CredentialType;           // e.g., 'LMFT', 'PsyD', 'PhD'
  primaryModality: TherapeuticModality; // e.g., 'CBT', 'EMDR'
  secondaryModalities: TherapeuticModality[];

  // Energy System
  energy: number;      // 0-100 (current)
  max_energy: number;  // 50-150 (individual capacity)
  is_burned_out: boolean;

  // Competency
  base_skill: number;  // 1-100 (core therapy competency)
  level: number;       // 1-50 (experience level)
  experience_points: number;

  // Training & Development
  certifications: string[];     // e.g., ['trauma_certified', 'couples_certified']
  specializations: string[];    // e.g., ['trauma', 'PTSD', 'anxiety']
  current_training: Training | null;

  // Employment
  hourly_salary: number;        // $25-65/hour (credential-adjusted)
  hired_day: number;

  // Personality
  warmth: number;               // 1-10 (rapport building)
  analytical: number;           // 1-10 (structured approach)
  creativity: number;           // 1-10 (art/play therapy)

  // Status
  is_available: boolean;
  breaks: TherapistBreak[];
  workSchedule: TherapistWorkSchedule;  // Custom work hours
}
```

## Credential Types

Professional credentials determine salary range, supervision eligibility, and prestige:

| Credential | Full Name | Salary Multiplier | Can Supervise | Min Practice Level |
|------------|-----------|-------------------|---------------|-------------------|
| LPC | Licensed Professional Counselor | 0.95x | No | 1 |
| LMFT | Licensed Marriage & Family Therapist | 1.0x | No | 1 |
| LCSW | Licensed Clinical Social Worker | 1.0x | No | 1 |
| LPCC | Licensed Professional Clinical Counselor | 1.05x | Yes | 2 |
| PsyD | Doctor of Psychology | 1.25x | Yes | 3 |
| PhD | Doctor of Philosophy (Psychology) | 1.30x | Yes | 4 |

**Hiring Pool**: Available credentials depend on practice level:
- Level 1: LPC, LMFT, LCSW
- Level 2: +LPCC
- Level 3: +PsyD
- Level 4+: +PhD

**Name Display**: Doctoral credentials (PsyD, PhD) display "Dr." prefix.

## Therapeutic Modalities

Each therapist has a primary therapeutic modality (and optionally secondary modalities) that affects session quality based on condition matching:

| Modality | Strong Match Conditions | Match Bonus |
|----------|------------------------|-------------|
| CBT (Cognitive Behavioral) | anxiety, depression, behavioral | +10% |
| DBT (Dialectical Behavior) | behavioral, stress | +12% |
| Psychodynamic | depression, relationship | +8% |
| Humanistic | stress, depression | +8% |
| EMDR | trauma | +15% |
| Somatic | trauma, stress | +12% |
| Family Systems | relationship | +12% |
| Integrative | (all conditions) | +5% |

**Modality Match Bonus Calculation**:
```typescript
function getModalityMatchBonus(therapist, conditionCategory): number {
  // Check primary modality
  if (primaryModality.strongMatch.includes(conditionCategory)) {
    return primaryModality.matchBonus // Full bonus
  }

  // Check secondary modalities
  for (const secondary of therapist.secondaryModalities) {
    if (secondary.strongMatch.includes(conditionCategory)) {
      return secondary.matchBonus * 0.5 // Half bonus
    }
  }

  // Integrative gets small bonus for everything
  if (therapist.primaryModality === 'Integrative') {
    return 0.05
  }

  return 0
}
```

The modality match bonus is applied during session quality calculation.

## Starting Therapist

The player's therapist (cannot be fired):

```typescript
function createPlayerTherapist(): Therapist {
  return {
    id: 'player-therapist',
    display_name: 'You',
    is_player: true,
    energy: 100,
    max_energy: 100,
    is_burned_out: false,
    base_skill: 50,          // Starting at mid-skill
    level: 1,
    experience_points: 0,
    certifications: [],
    specializations: [],
    current_training: null,
    hourly_salary: 0,        // Player doesn't earn salary
    hired_day: 1,
    warmth: 6,
    analytical: 5,
    creativity: 5,
    is_available: true,
    breaks: []
  };
}
```

## Hiring

Player can hire additional therapists starting at Level 2:

```typescript
interface HiringCandidate {
  id: string;
  display_name: string;
  base_skill: number;
  specializations: string[];
  certifications: string[];
  personality: {
    warmth: number;
    analytical: number;
    creativity: number;
  };
  salary_request: number;
  reason_for_practice: string;  // Flavor text
}

function generateHiringPool(count: number = 3): HiringCandidate[] {
  const candidates: HiringCandidate[] = [];

  for (let i = 0; i < count; i++) {
    // Quality scales with reputation
    const skillFactor = 0.5 + (reputation / 500) * 0.5;

    const candidate: HiringCandidate = {
      id: `candidate-${Date.now()}-${i}`,
      display_name: generateTherapistName(),
      base_skill: Math.floor(random(30, 80) * skillFactor),
      specializations: randomSubarray(
        ['anxiety', 'depression', 'trauma', 'PTSD', 'couples', 'children'],
        2 + Math.floor(reputation / 100)
      ),
      certifications: [],
      personality: {
        warmth: random(3, 10),
        analytical: random(3, 10),
        creativity: random(3, 10)
      },
      // Roughly correlates to skill/experience with some noise
      salary_request: Math.floor(clamp(30 + (base_skill - 50) * 0.3 + random(-3, 3), 25, 50)),
      reason_for_practice: generateFlavorText()
    };

    candidates.push(candidate);
  }

  return candidates;
}

function hireTherapist(candidate: HiringCandidate): boolean {
  // Check staff cap
  const currentStaff = therapists.length;
  const staffCap = getStaffCapForLevel(practiceLevel);

  if (currentStaff >= staffCap) {
    EventBus.emit('hiring_failed', 'Staff cap reached');
    return false;
  }

  // Check affordability (1 week salary upfront)
  const oneWeekSalary = candidate.salary_request * 40;  // 40 hours/week
  if (!economySystem.can_afford(oneWeekSalary)) {
    EventBus.emit('hiring_failed', 'Cannot afford');
    return false;
  }

  // Deduct hiring cost
  economySystem.removeMoney(oneWeekSalary, `hiring_cost_${candidate.id}`);

  // Create therapist
  const therapist: Therapist = {
    id: `therapist-${Date.now()}`,
    display_name: candidate.display_name,
    is_player: false,
    energy: 100,
    max_energy: 80 + random(0, 30),  // 80-110
    is_burned_out: false,
    base_skill: candidate.base_skill,
    level: 1,
    experience_points: 0,
    certifications: candidate.certifications,
    specializations: candidate.specializations,
    current_training: null,
    hourly_salary: candidate.salary_request,
    hired_day: currentDay,
    warmth: candidate.personality.warmth,
    analytical: candidate.personality.analytical,
    creativity: candidate.personality.creativity,
    is_available: true,
    breaks: []
  };

  therapists.push(therapist);
  EventBus.emit('therapist_hired', therapist.id);
  showNotification(`${therapist.display_name} hired!`);

  // Milestone
  if (therapists.length === 2) {
    EventBus.emit('milestone_first_hire', therapist.id);
  }

  return true;
}
```

## Energy System

Therapist energy is treated as an integer clamped to $[0,\text{maxEnergy}]$.

### Runtime Rules (Current Implementation)

- **Session drain**: energy is reduced when a session completes by subtracting the session's `energyCost`.
- **Decision events**: decision `effects.energy` is an *energy delta* (negative = costs energy, positive = restores energy) applied immediately during the session.
- **Idle recovery**: when a therapist is *not* `in_session`, they recover energy over time at `THERAPIST_CONFIG.ENERGY_RECOVERY_PER_HOUR`.
- **Day recharge**: a large recharge is applied at **DAY_ENDED** (overnight rest) and **DAY_STARTED** (start the day well-rested).

Relevant code:

- `src/App.tsx` (session completion drain + decision-event energy delta application)
- `src/hooks/useTherapistEnergyProcessor.ts` (idle-minute recovery + day boundary recharge)
- `src/core/therapists/TherapistManager.ts` (config + overnight rest/burnout recovery rules)
- `src/core/therapists/energyRecovery.ts` (deterministic idle recovery math)

**Energy Penalties**:
- Low energy (<30) reduces session quality by up to 30%
- At 0 energy, therapist is burned out (unavailable)
- Burnout requires recovery to ≥50% before next session

## Work Schedules

Each therapist has a customizable work schedule that determines when they're available for sessions.

```typescript
interface TherapistWorkSchedule {
  workStartHour: number      // Default: 8 (8 AM)
  workEndHour: number        // Default: 17 (5 PM)
  lunchBreakHour: number | null  // null = no lunch break
}
```

### Schedule Constraints

- **Work hours**: Must be between 6 AM and 10 PM
- **Minimum work day**: At least 4 hours (workEndHour - workStartHour ≥ 4)
- **Lunch break**: Optional; if set, must be within work hours

### Scheduling Integration

When booking sessions, the scheduler respects therapist work hours:

```typescript
// Check if hour is within work schedule
TherapistManager.isWithinWorkHours(therapist, hour)

// Get all available work hours (excludes lunch)
TherapistManager.getWorkHours(therapist) // [8, 9, 10, 11, 13, 14, 15, 16]

// ScheduleManager uses work hours when finding slots
ScheduleManager.isSlotAvailable(schedule, therapistId, day, hour, duration, therapist)
```

### Energy Forecasting

The system predicts end-of-day energy based on scheduled sessions:

```typescript
interface EnergyForecast {
  predictedEndEnergy: number      // Predicted energy at day's end
  scheduledSessionCount: number   // Sessions scheduled today
  totalEnergyCost: number         // Sum of session energy costs
  willBurnOut: boolean            // True if energy drops below burnout threshold
  burnoutHour: number | null      // Hour when burnout occurs (if applicable)
}

// Get forecast for current day
const forecast = TherapistManager.forecastEnergy(therapist, sessions, schedule, currentDay)
```

The TherapistCard displays this forecast when sessions are scheduled, showing a warning if burnout is predicted.

### UI

- **TherapistScheduleModal**: Edit work hours and lunch break
- **TherapistCard**: Shows energy forecast with burnout warning

See [SCHEDULING.md](./SCHEDULING.md#therapist-work-schedules) for complete details.

## Leveling & Experience

Therapists gain XP and levels:

```typescript
function addTherapistXP(therapist: Therapist, amount: number) {
  therapist.experience_points += amount;

  // Check for level up
  const xpPerLevel = 100;
  const newLevel = Math.floor(therapist.experience_points / xpPerLevel) + 1;

  if (newLevel > therapist.level) {
    therapist.level = newLevel;
    therapist.base_skill = Math.min(100, therapist.base_skill + 3);  // Skill increase
    therapist.max_energy = Math.min(150, therapist.max_energy + 5);  // Stamina increase
    EventBus.emit('therapist_level_up', therapist.id, newLevel);
    showNotification(`${therapist.display_name} reached level ${newLevel}!`);
  }
}

// XP Gained from:
function getSessionXP(session: Session): number {
  const baseXP = 10;
  const qualityBonus = session.quality * 10;
  return baseXP + qualityBonus;  // 10-20 per session
}

function getSupervisionXP(session: SupervisionSession, isSuperviser: boolean): number {
  if (isSuperviser) {
    return 15 + (session.supervisees.length * 5);  // 15-35
  } else {
    return 40;  // Much higher for supervisees (training benefit)
  }
}

function getTrainingXP(training: TrainingProgram): number {
  return training.skill_bonus * 5;  // 50-125
}
```

### XP Progress Visualization

The TherapistCard displays a visual XP progress bar:

**Display Elements**:
- Level badge with gradient background
- XP progress bar (current XP / XP needed for next level)
- Smooth animated fill on XP gain

**Level Calculation**:
```typescript
// Level formula: floor(sqrt(xp / 10)) + 1
// Level 1: 0 XP, Level 2: 10 XP, Level 3: 40 XP, Level 4: 90 XP...
calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 10)) + 1;
}
```

### Level-Up Celebration

When a therapist levels up, a celebratory toast appears:

**Toast Elements**:
- Animated entrance from bottom
- Gradient purple/indigo background
- Bounce animation on level icon
- Sparkle decorations
- Shows therapist name and new level
- "+1 Skill Bonus" note

**Trigger**: `GameEvents.THERAPIST_LEVELED_UP` event emitted on session completion when XP crosses level threshold.

**Implementation**:
- Component: `src/components/game/LevelUpToast.tsx`
- Event listener in: `src/App.tsx`
- Auto-dismisses after 5 seconds

## Specializations

Therapists can develop expertise in specific areas:

```typescript
const SPECIALIZATIONS = [
  'anxiety_disorders',
  'depression',
  'PTSD',
  'trauma',
  'couples',
  'children',
  'adolescents',
  'grief',
  'eating_disorders',
  'OCD',
  'personality_disorders',
  'substance_abuse',
  'stress_management'
];

// Gained through:
// 1. Initial hiring pool (random selection)
// 2. Training programs
// 3. Handling many clients with same condition

function addSpecialization(therapist: Therapist, spec: string) {
  if (!therapist.specializations.includes(spec)) {
    therapist.specializations.push(spec);
    EventBus.emit('specialization_gained', therapist.id, spec);
  }
}

// Track specialization experience
interface SpecializationExperience {
  specialization: string;
  clients_treated: number;
  sessions_completed: number;
}

function trackSpecializationExperience(therapist: Therapist, client: Client) {
  const spec = client.condition_category;
  // Increment counter...

  // Unlock specialization after 10 clients
  if (completedCount >= 10) {
    addSpecialization(therapist, spec);
  }
}
```

## Certifications

Acquired through training programs:

```typescript
const CERTIFICATIONS = [
  'trauma_certified',
  'couples_certified',
  'children_certified',
  'supervisor_certified',
  'telehealth_certified',
  'substance_certified',
  'crisis_certified'
];

// Required to treat specific client types
const CERTIFICATION_REQUIREMENTS = {
  'minor': 'children_certified',
  'couple': 'couples_certified',
  'trauma': 'trauma_certified',
  'couples': 'couples_certified',
  'substance_abuse': 'substance_certified'
};

// Gained through TrainingSystem
function grantCertification(therapist: Therapist, cert: string) {
  if (!therapist.certifications.includes(cert)) {
    therapist.certifications.push(cert);
    EventBus.emit('certification_granted', therapist.id, cert);

    // Counts toward clinic certification score
    EventBus.emit('clinic_certification_count_increased', cert);
  }
}
```

## Firing a Therapist

Cannot fire the player, but can fire hired staff:

```typescript
function fireTherapist(therapist: Therapist): boolean {
  if (therapist.is_player) {
    return false;  // Cannot fire player therapist
  }

  // Cancel remaining sessions
  for (const session of getSessions()) {
    if (session.therapist_id === therapist.id && session.status === 'scheduled') {
      session.status = 'cancelled';
      const client = getClient(session.client_id);
      client.engagement -= 15;  // Client disappointed
    }
  }

  // Remove from therapists list
  therapists.splice(therapists.indexOf(therapist), 1);

  EventBus.emit('therapist_fired', therapist.id);
  showNotification(`${therapist.display_name} has left the practice.`);

  return true;
}
```

## Therapist Panel

UI for managing individual therapist:

```typescript
interface TherapistPanel {
  therapist: Therapist;

  // Current status
  energy: {
    current: number;
    max: number;
    percentage: number;
    burned_out: boolean;
  };

  // Development
  level: number;
  experience_progress: {
    current: number;
    needed_for_next: number;
    percentage: number;
  };

  // Qualifications
  certifications: string[];
  specializations: string[];

  // Work history
  sessions_completed: number;
  avg_quality: number;
  client_satisfaction_avg: number;

  // Schedule
  upcoming_sessions: Session[];
  scheduled_breaks: Break[];

  // Actions
  can_schedule: boolean;
  can_fire: boolean;
  can_enroll_training: boolean;
  can_schedule_break: boolean;
}
```

## Staff Capacity

Limited by practice level + training bonuses. **Hiring is blocked when capacity is reached.**

### Base Caps by Practice Level

| Level | Base Staff Cap |
|-------|---------------|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |

### Implementation

```typescript
function getMaxTherapists(): number {
  const levelConfig = getPracticeLevelConfig(practiceLevel)
  return levelConfig.staffCap + hiringCapacityBonus
}

// Hiring enforcement (in GameView.tsx handleHire)
const maxTherapists = levelConfig.staffCap + hiringCapacityBonus

if (therapists.length >= maxTherapists) {
  addNotification({
    type: 'error',
    title: 'Cannot Hire',
    message: `Staff capacity reached (${therapists.length}/${maxTherapists}). Increase reputation or complete Leadership training.`,
  })
  return
}
```

### State

- `hiringCapacityBonus: number` — Stored in `GameState`, increased by Leadership training
- Displayed in UI: "Staff: 3/5 (At capacity)" in TherapistPanel hiring view

### Increasing Capacity

1. **Level up practice** — Reach higher reputation milestones (Level 2 unlocks hiring, Level 5 increases cap to 8)
2. **Complete Leadership training** — Business track training grants `hiring_capacity` bonus

## Events Emitted

```typescript
EventBus.emit('therapist_hired', therapistId);
EventBus.emit('therapist_fired', therapistId);
EventBus.emit('therapist_burned_out', therapistId);
EventBus.emit('therapist_level_up', therapistId, newLevel);
EventBus.emit('certification_granted', therapistId, certName);
EventBus.emit('specialization_gained', therapistId, specName);
```

## Testing Strategy

```typescript
test('hired therapist costs 1 week salary upfront', () => {
  const candidate = generateCandidate({ salary: 100 });
  const initialBalance = economy.balance;
  hireTherapist(candidate);
  const spent = initialBalance - economy.balance;
  expect(spent).toBe(100 * 40);  // 40 hours/week
});

test('therapist burned out at 0 energy', () => {
  therapist.energy = 10;
  const client = createClient({ severity: 5 });
  drainTherapistEnergy(therapist, client);
  expect(therapist.is_burned_out).toBe(true);
});

test('therapist energy restored at end of day', () => {
  therapist.energy = 10;
  restoreTherapistEnergy(therapist);
  expect(therapist.energy).toBe(therapist.max_energy);
});

test('cannot hire therapist if staff cap reached', () => {
  for (let i = 0; i < staffCap; i++) {
    hireTherapist(generateCandidate());
  }
  const result = hireTherapist(generateCandidate());
  expect(result).toBe(false);
});
```
