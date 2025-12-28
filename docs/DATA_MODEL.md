# Data Model

Complete definition of all entities and their relationships in Therapy Tycoon.

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Therapist                                 │
│  ─────────────────────────────────────────────────────────  │
│  - id: string                                                │
│  - display_name: string                                      │
│  - is_player: boolean                                        │
│  - energy: 0-100                                             │
│  - base_skill: 1-100                                         │
│  - certifications: string[]                                  │
│  - specializations: string[]                                 │
│  - current_training: Training | null                        │
└─────────────────────────────────────────────────────────────┘
           ↑        ↑         ↓           ↓
      manages   trains    conducts    assigned
           │        │         │           │
┌──────────┴────────┴─────────┴───────────┴──────────┐
│                                                      │
└──────────────────┬─────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
   ┌────────┐  ┌────────┐  ┌──────┐
   │Session │  │Client  │  │Break │
   └────────┘  └────────┘  └──────┘
   (therapy)   (treatment) (recovery)
```

## Core Entities

### Therapist

The foundation of the practice - player's therapists who conduct sessions.

```typescript
interface Therapist {
  id: string;                          // Unique identifier
  display_name: string;                // "Dr. Smith"
  is_player: boolean;                  // true = player's therapist, cannot fire

  // Energy System
  energy: number;                      // 0-100 (current)
  max_energy: number;                  // 50-150 (individual capacity)
  is_burned_out: boolean;              // true = unavailable until recovery

  // Competency
  base_skill: number;                  // 1-100 (core therapy competency)
  level: number;                       // 1-50 (experience level)

  // Training & Certifications
  certifications: string[];            // ["trauma_certified", "couples_certified"]
  specializations: string[];           // ["trauma", "PTSD", "anxiety_disorders"]
  experience_points: number;           // XP for level up

  // Employment
  hourly_salary: number;               // $0-500 (0 for player)
  hired_day: number;                   // Day of hire (for tracking employment)

  // Personality Traits (Optional)
  warmth: number;                      // 1-10 (rapport ability)
  analytical: number;                  // 1-10 (structured approach)
  creativity: number;                  // 1-10 (art/play therapy skill)

  // Status
  is_available: boolean;               // Can take new sessions
  current_training: Training | null;   // null or active training

  // Schedule
  breaks: Break[];                     // Scheduled breaks
  workSchedule: TherapistWorkSchedule; // Custom work hours
}

interface TherapistWorkSchedule {
  workStartHour: number;               // 6-22, default 8 (8 AM)
  workEndHour: number;                 // 6-22, default 17 (5 PM)
  lunchBreakHour: number | null;       // null = no break
}

interface Break {
  start_day: number;
  start_hour: number;
  duration_hours: number;
  reason: string;  // "lunch", "recovery", "conference"
}
```

**Energy System**:
- **Drain**: Sessions consume 5-25 energy (based on client severity)
- **Passive Recovery**: 3 energy/hour when idle during business hours
- **Break Recovery**: 8+ energy per hour during scheduled breaks
- **Overnight**: Full restoration at end of day
- **Burnout**: At 0 energy, therapist unavailable until ≥50% recovered

**Certifications** (examples):
- `trauma_certified` - Can treat trauma clients
- `couples_certified` - Can conduct couples therapy
- `supervisor_certified` - Can conduct supervision sessions
- `telehealth_certified` - Can conduct virtual sessions
- `children_certified` - Can treat minors
- `substance_certified` - Addiction treatment

### Client

Represents a person seeking therapy.

```typescript
interface Client {
  id: string;                          // Unique identifier
  display_name: string;                // "Client AB" (abstracted for privacy)

  // Clinical Properties
  condition_category: string;          // "anxiety", "depression", "trauma", "stress", "relationship", "behavioral"
  condition_type: string;              // "generalized_anxiety", "major_depression", "PTSD", etc.
  severity: number;                    // 1-10 (treatment difficulty)
  sessions_required: number;           // 4-20 (total sessions to cure)
  sessions_completed: number;          // Progress (0-N)
  treatment_progress: number;          // 0.0-1.0 (percentage)
  status: 'waiting' | 'in_treatment' | 'completed' | 'dropped';

  // Satisfaction & Engagement
  satisfaction: number;                // 0-100 (happiness with therapy)
  engagement: number;                  // 0-100 (likelihood to continue)

  // Insurance
  insurance_provider: string | null;   // "BlueCross", "Medicaid", null
  is_private_pay: boolean;             // true = no insurance
  insurance_rate: number;              // Reimbursement per session ($80-150)

  // Scheduling Preferences
  prefers_virtual: boolean;            // Telehealth preference
  preferred_frequency: string;         // "once", "weekly", "biweekly", "monthly"
  preferred_time: string;              // "morning", "afternoon", "evening", "any"
  availability: Record<string, number[]>;  // Day of week → hours available
  is_minor: boolean;                   // Requires children certification
  is_couple: boolean;                  // Couples therapy (needs couples certification)
  required_certification: string | null;

  // Waiting & Arrival
  arrival_day: number;                 // Day client first arrived
  days_waiting: number;                // Days before first session
  max_wait_days: number;               // Tolerance (3-14 days, varies by reputation)

  // Session History
  assigned_therapist: Therapist | null;
  sessions: Session[];
}

interface ClientCompatibility {
  therapist: Therapist;
  score: number;                       // 0.0-1.0 (match quality)
  factors: {
    certification_match: boolean;
    specialization_match: number;
    time_preference_match: boolean;
    virtual_preference_match: boolean;
  };
}
```

**Lifecycle**:
1. **Arrival**: New client appears in waiting list
2. **Waiting**: Engagement decays 3-5 points/day, max_wait tolerance check
3. **In Treatment**: Scheduled sessions, treatment progress accumulates
4. **Completion**: progress ≥ 1.0 OR sessions_completed ≥ sessions_required
5. **Dropout**: Engagement too low, wait time exceeded, or dissatisfaction

### Session

Represents a single therapy session.

```typescript
interface Session {
  id: string;

  // Participants
  therapist_id: string;
  client_id: string;

  // Session Details
  session_type: 'clinical' | 'supervision';  // Clinical = 1 therapist + client
  is_virtual: boolean;                       // Telehealth vs in-person
  is_insurance: boolean;                     // Insurance-paid vs private-pay

  // Scheduling
  scheduled_day: number;
  scheduled_hour: number;                    // 8-17 (business hours)
  scheduled_minute: number;                  // 0 usually, can vary
  duration_minutes: number;                  // 50 (standard), 80, 180 (intensive)

  // Status
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'conflict';

  // Progress & Outcome
  progress: number;                          // 0.0-1.0 (how far through session)
  quality: number;                           // 0.0-1.0 (session effectiveness)
  quality_tier: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';

  // Financial
  payment: number;                           // Amount earned ($0-200)

  // Energy
  energy_cost: number;                       // Therapist energy consumed (5-25)

  // Decision Events
  decision_events: DecisionEvent[];
  remembered_decisions: Record<string, string>;  // Auto-apply past choices
}

interface SupervisionSession extends Session {
  session_type: 'supervision';
  supervisees: Therapist[];  // 1-4 supervisees
  // Different energy costs and XP gain
}

interface DecisionEvent {
  id: string;
  title: string;
  description: string;
  choices: DecisionChoice[];
  triggered_minute: number;
  resolved: boolean;
}

interface DecisionChoice {
  text: string;
  effects: {
    quality?: number;  // ±0.1 to ±0.3
    energy?: number;   // ±5 to ±25
    reputation?: number;
  };
}
```

**Quality Calculation**:
```
Base Quality = therapist.base_skill / 100 (0.0-1.0)

Modifiers:
  + Therapist-Client Match (0.0 to +0.4)
    - Certification match
    - Specialization match
    - Personality fit

  + Decision Event Choices (±0.1 to ±0.3 per choice)

  - Low Energy Penalty (up to -0.3)
    - If therapist energy < 30, apply penalty

  - Time Mismatch (up to -0.2)
    - If session time doesn't match client preference

Final Quality = clamp(0.0, Base + Modifiers, 1.0)
```

**Quality Tiers**:
| Range | Tier | Reputation Impact | Payment Multiplier |
|-------|------|-------------------|--------------------|
| 0.8+ | Excellent | +2 to +5 | 1.0x |
| 0.6-0.8 | Good | +1 | 0.9x |
| 0.4-0.6 | Fair | 0 | 0.7x |
| 0.2-0.4 | Poor | -2 | 0.5x |
| 0.0-0.2 | Very Poor | -3 to -5 | 0.3x |

### Training Program

Represents a certification or skill development course.

```typescript
interface TrainingProgram {
  id: string;
  name: string;                        // "CBT Fundamentals"
  description: string;
  track: 'clinical' | 'business';      // Clinical = offline, Business = night school

  // Cost & Duration
  cost: number;                        // $500-5000
  duration_hours: number;              // 5-100
  hours_completed: number;             // Progress (0 to duration)

  // Requirements
  prerequisites: string[];             // ["skill_40+", "level_2+"]

  // Rewards
  grants_certification: string | null; // e.g., "trauma_certified"
  skill_bonus: number;                 // +10, +15, +20
  clinic_bonus: {
    hiring_capacity?: number;
    insurance_multiplier?: number;
  };

  // Therapist
  therapist_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_day: number;
  completed_day: number | null;
}

interface TrainingCatalog {
  id: string;
  name: string;
  cost: number;
  duration_hours: number;
  track: 'clinical' | 'business';
  description: string;
  prerequisites: TrainingRequirement[];
  rewards: TrainingReward;
}

interface TrainingRequirement {
  type: 'skill' | 'level' | 'certification' | 'reputation';
  value: number | string;  // 40 for skill_40+, "supervisor_certified"
}

interface TrainingReward {
  certification?: string;
  skill_bonus?: number;
  clinic_bonus?: object;
  reputation?: number;
}
```

### Insurance Panel

Represents an insurance provider the practice accepts.

```typescript
interface InsurancePanel {
  id: string;
  name: string;                        // "BlueCross", "Medicaid"
  reimbursement_rate: number;          // $80-150 per session
  claim_delay_days: number;            // 3-8 days before payment
  denial_rate: number;                 // 5-15% of claims
  application_fee: number;             // $0-75

  // Status
  status: 'pending' | 'active' | 'rejected';
  applied_day: number;
  activated_day: number | null;
}
```

### Game Resources

Global resources managed by systems.

```typescript
interface GameResources {
  // Money
  balance: number;                     // Starting: $5,000

  // Reputation
  reputation: number;                  // 0-500 (starting 20)
  practice_level: number;              // 1-5 (starting 1)

  // Clinic Certification Score
  clinic_certifications_total: number; // Sum of all therapist certifications

  // Practice Metadata
  practice_name: string;
  established_day: number;

  // Pending Insurance Payments
  pending_payments: PendingPayment[];
}

interface PendingPayment {
  id: string;
  amount: number;
  insurer: string;
  due_day: number;
  status: 'pending' | 'received' | 'denied';
}
```

### Office & Building

```typescript
interface Office {
  current_building: string;            // "starter_suite", "small_clinic", "professional_center"
  telehealth_unlocked: boolean;

  // Room tracking
  total_rooms: number;                 // Depends on building
  rooms_occupied: number;              // Count of in-person sessions today
}

// Office upgrades - per-building improvements
interface BuildingUpgradeState {
  purchasedUpgrades: OfficeUpgradeId[];  // Array of purchased upgrade IDs
}

type OfficeUpgradeId =
  // Energy/Breaks
  | 'coffee_machine_1' | 'coffee_machine_2' | 'coffee_machine_3'
  | 'kitchenette_1' | 'kitchenette_2' | 'kitchenette_3'
  // Session Quality
  | 'artwork_1' | 'artwork_2' | 'artwork_3'
  | 'sound_system_1' | 'sound_system_2' | 'sound_system_3'
  // Client Comfort
  | 'waiting_comfort_1' | 'waiting_comfort_2' | 'waiting_comfort_3'
  | 'refreshments_1' | 'refreshments_2' | 'refreshments_3'

type OfficeUpgradeCategory = 'energy' | 'quality' | 'comfort'

interface OfficeUpgradeConfig {
  id: OfficeUpgradeId;
  name: string;                        // "Coffee Maker", "Espresso Machine"
  description: string;                 // UI tooltip text
  category: OfficeUpgradeCategory;
  tier: 1 | 2 | 3;
  line: string;                        // e.g., 'coffee_machine', 'kitchenette'
  cost: number;                        // $150 - $4,000
  prerequisite?: OfficeUpgradeId;      // Previous tier required
  effects: OfficeUpgradeEffects;
}

interface OfficeUpgradeEffects {
  // Energy effects (multipliers, 1.0 = no change)
  idleEnergyRecoveryMultiplier?: number;     // During work hours (1.1-1.3)
  breakEnergyRecoveryMultiplier?: number;    // During breaks (1.15-1.5)

  // Session quality (additive bonus, 0-1 scale)
  sessionQualityBonus?: number;              // 0.01-0.07

  // Client comfort (reduction in waiting decay per day)
  waitingSatisfactionDecayReduction?: number;  // 0.2-1.0
}

interface AggregatedUpgradeEffects {
  idleEnergyRecoveryMultiplier: number;       // Combined from coffee_machine line
  breakEnergyRecoveryMultiplier: number;      // Combined from kitchenette line
  sessionQualityBonus: number;                // Sum from artwork + sound_system
  waitingSatisfactionDecayReduction: number;  // Sum from waiting_comfort + refreshments
}

interface Building {
  id: string;
  name: string;
  tier: number;                        // 1, 2, 3
  rooms: number;
  monthly_rent: number;
  upgrade_cost: number;
  required_level: number;
}

const BUILDINGS: Building[] = [
  {
    id: "starter_suite",
    name: "Starter Suite",
    tier: 1,
    rooms: 1,
    monthly_rent: 50,
    upgrade_cost: 0,
    required_level: 1
  },
  {
    id: "small_clinic",
    name: "Small Clinic",
    tier: 2,
    rooms: 3,
    monthly_rent: 250,
    upgrade_cost: 2500,
    required_level: 2
  },
  {
    id: "professional_center",
    name: "Professional Center",
    tier: 3,
    rooms: 8,
    monthly_rent: 1000,
    upgrade_cost: 15000,
    required_level: 4
  }
];
```

### Random Event

```typescript
interface RandomEvent {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';

  // Triggering
  trigger_type: 'daily' | 'weekly' | 'monthly' | 'milestone';
  conditions?: {
    min_therapists?: number;
    min_reputation?: number;
    min_practice_level?: number;
  };
  cooldown_days: number;
  last_triggered: number | null;

  // Choices
  choices: EventChoice[];

  // Modifiers (after selection)
  modifiers?: GameModifier[];
}

interface EventChoice {
  text: string;
  effects: {
    money?: number;
    reputation?: number;
    client_arrivals?: number;
    therapist_effects?: Record<string, any>;
  };
}

interface GameModifier {
  id: string;
  name: string;                        // "busy_week", "economic_downturn"
  duration_days: number;
  effects: {
    client_arrival_multiplier?: number;  // 1.2 for +20%
    reputation_multiplier?: number;
    session_fee_multiplier?: number;
  };
}
```

## Key Relationships

```
Therapist
  └─ Has many: Session (as therapist)
  └─ Has one: TrainingProgram (current)
  └─ Has many: TrainingProgram (completed)

Client
  └─ Has many: Session
  └─ Has one: Therapist (assigned)
  └─ Has one: InsurancePanel (optional)

Session
  └─ Belongs to: Therapist
  └─ Belongs to: Client
  └─ Has many: DecisionEvent

Office
  └─ Has many: Therapist
  └─ Has many: Client
  └─ Has many: Session

Practice (Game State)
  └─ Has many: Therapist
  └─ Has many: Client
  └─ Has many: Session
  └─ Has many: InsurancePanel
  └─ Has one: Office
  └─ Has one: Resources
```

## Validation Rules

- **Therapist**: Cannot fire player therapist (is_player = true)
- **Client**: Can't be assigned to therapist without required certification
- **Session**: Can't book if therapist unavailable or burned out
- **Training**: Can't enroll without prerequisites met
- **Insurance**: Can't submit claim denial, just lose payment
- **Office**: Can't book in-person sessions if rooms full

## Serialization Notes

All entities must be serializable to JSON for save/load:
- Use string IDs instead of object references
- Store only primitive types and arrays
- Timestamps as integers (game days)
- Reconstruct object graphs when loading (hydrate)
