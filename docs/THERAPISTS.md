# Therapist Management System

Manages therapist hiring, energy, specializations, training, and skill development.

## Therapist Entity

```typescript
interface Therapist {
  // Identity
  id: string;
  display_name: string;
  is_player: boolean;  // true = player's therapist, cannot be fired

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
  hourly_salary: number;        // $0-500/hour (0 for player)
  hired_day: number;

  // Personality
  warmth: number;               // 1-10 (rapport building)
  analytical: number;           // 1-10 (structured approach)
  creativity: number;           // 1-10 (art/play therapy)

  // Status
  is_available: boolean;
  breaks: TherapistBreak[];
}
```

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
      salary_request: Math.floor(random(50, 150) * skillFactor),
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

Therapists have limited energy that affects session quality:

```typescript
interface TherapistEnergy {
  current: number;      // 0-max_energy
  max: number;          // 50-150 (varies by therapist)
  drain_per_session: number;  // 5-25 depending on client severity
  recovery_passive: number;   // 3/hour during business hours (idle)
  recovery_break: number;     // 8/hour during scheduled break
  recovery_overnight: number; // Full restoration
}

function updateTherapistEnergy(therapist: Therapist, deltaTime: number) {
  if (!therapist.is_available) return;

  const deltaHours = deltaTime / 3600;

  // Check if in session
  if (isTherapistInSession(therapist)) {
    // Energy drains during session (handled by SessionSystem)
    return;
  }

  // Check if on break
  if (therapist.breaks.some(b => isInBreakTime(b))) {
    therapist.energy = Math.min(
      therapist.max_energy,
      therapist.energy + 8 * deltaHours
    );
    return;
  }

  // Passive recovery during business hours
  if (isBusinessHours()) {
    therapist.energy = Math.min(
      therapist.max_energy,
      therapist.energy + 3 * deltaHours
    );
    return;
  }

  // After business hours, small passive recovery
  if (isOvernight()) {
    therapist.energy = Math.min(
      therapist.max_energy,
      therapist.energy + 1 * deltaHours
    );
  }
}

// At end of day, full restoration
function restoreTherapistEnergy(therapist: Therapist) {
  therapist.energy = therapist.max_energy;
  therapist.is_burned_out = false;
}

// Session drains energy
function drainTherapistEnergy(therapist: Therapist, client: Client) {
  const baseDrain = 5;
  const severityDrain = client.severity * 2;
  const totalDrain = baseDrain + severityDrain;  // 5-25

  therapist.energy = Math.max(0, therapist.energy - totalDrain);

  if (therapist.energy === 0) {
    therapist.is_burned_out = true;
    EventBus.emit('therapist_burned_out', therapist.id);
  }
}
```

**Energy Penalties**:
- Low energy (<30) reduces session quality by up to 30%
- At 0 energy, therapist is burned out (unavailable)
- Burnout requires recovery to ≥50% before next session

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

Limited by practice level + training bonuses:

```typescript
function getStaffCap(): number {
  const baseCapByLevel = {
    1: 1,
    2: 5,
    3: 5,
    4: 5,
    5: 8
  };

  let cap = baseCapByLevel[practiceLevel];

  // Training bonuses
  const trainingBonus = completedTrainingPrograms
    .filter(t => t.grants_clinic_bonus?.hiring_capacity)
    .reduce((sum, t) => sum + (t.grants_clinic_bonus?.hiring_capacity || 0), 0);

  return cap + trainingBonus;
}
```

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
