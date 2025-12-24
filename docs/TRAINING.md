# Training System

Manages therapist professional development through certifications and skill-building programs.

## Training Tracks

Two types of training with different impacts:

### Clinical Track (Offline)

- Therapist unavailable during training
- Takes 5-100 hours
- Grants certifications and skill bonuses
- Costs $500-5,000
- Must have prerequisites met

### Business Track (Night School)

- Therapist available for sessions (no downtime)
- Takes 5-20 hours
- Grants clinic-wide bonuses
- Costs $500-2,000
- No prerequisites

```typescript
interface TrainingProgram {
  id: string;
  name: string;
  description: string;
  track: 'clinical' | 'business';

  // Cost & Duration
  cost: number;                // $500-5000
  duration_hours: number;      // 5-100

  // Requirements
  prerequisites: {
    min_skill?: number;
    min_level?: number;
    required_certifications?: string[];
  };

  // Rewards
  grants_certification?: string;
  skill_bonus: number;         // +10, +15, +20
  clinic_bonus?: {
    hiring_capacity?: number;
    insurance_multiplier?: number;
  };
}
```

## Training Catalog

Complete list of available programs:

```typescript
const TRAINING_PROGRAMS: TrainingProgram[] = [
  // Clinical Track
  {
    id: 'cbt_fundamentals',
    name: 'CBT Fundamentals',
    description: 'Learn cognitive behavioral therapy techniques',
    track: 'clinical',
    cost: 500,
    duration_hours: 8,
    prerequisites: {},
    skill_bonus: 10,
    grants_certification: null
  },
  {
    id: 'trauma_informed_care',
    name: 'Trauma-Informed Care',
    description: 'Specialized training for trauma clients',
    track: 'clinical',
    cost: 1000,
    duration_hours: 16,
    prerequisites: { min_skill: 40 },
    skill_bonus: 15,
    grants_certification: 'trauma_certified'
  },
  {
    id: 'emdr_certification',
    name: 'EMDR Certification',
    description: 'Eye Movement Desensitization and Reprocessing',
    track: 'clinical',
    cost: 2000,
    duration_hours: 40,
    prerequisites: { min_skill: 60, required_certifications: ['trauma_certified'] },
    skill_bonus: 20,
    grants_certification: 'emdr_certified'
  },
  {
    id: 'couples_therapy',
    name: 'Couples & Family Therapy',
    description: 'Treat relationships and family dynamics',
    track: 'clinical',
    cost: 1500,
    duration_hours: 20,
    prerequisites: { min_skill: 50 },
    skill_bonus: 15,
    grants_certification: 'couples_certified'
  },
  {
    id: 'child_psychology',
    name: 'Child & Adolescent Psychology',
    description: 'Work with minors effectively',
    track: 'clinical',
    cost: 1200,
    duration_hours: 24,
    prerequisites: { min_skill: 45 },
    skill_bonus: 12,
    grants_certification: 'children_certified'
  },
  {
    id: 'substance_abuse',
    name: 'Substance Abuse Treatment',
    description: 'Specialize in addiction recovery',
    track: 'clinical',
    cost: 1800,
    duration_hours: 30,
    prerequisites: { min_skill: 55 },
    skill_bonus: 18,
    grants_certification: 'substance_certified'
  },
  {
    id: 'clinical_supervision',
    name: 'Clinical Supervision Certification',
    description: 'Train other therapists',
    track: 'clinical',
    cost: 3000,
    duration_hours: 60,
    prerequisites: { min_skill: 80, min_level: 10 },
    skill_bonus: 25,
    grants_certification: 'supervisor_certified'
  },
  {
    id: 'telehealth_certification',
    name: 'Telehealth Competency',
    description: 'Virtual session best practices',
    track: 'clinical',
    cost: 800,
    duration_hours: 12,
    prerequisites: { min_skill: 40 },
    skill_bonus: 8,
    grants_certification: 'telehealth_certified'
  },

  // Business Track
  {
    id: 'marketing_essentials',
    name: 'Marketing Essentials',
    description: 'Grow your practice with marketing',
    track: 'business',
    cost: 500,
    duration_hours: 8,
    prerequisites: {},
    skill_bonus: 0,
    clinic_bonus: { hiring_capacity: 1 }
  },
  {
    id: 'insurance_negotiation',
    name: 'Insurance Negotiation',
    description: 'Better insurance panel rates',
    track: 'business',
    cost: 1000,
    duration_hours: 12,
    prerequisites: { min_skill: 50 },
    skill_bonus: 0,
    clinic_bonus: { insurance_multiplier: 0.1 }  // +10% all rates
  },
  {
    id: 'business_fundamentals',
    name: 'Practice Management Fundamentals',
    description: 'Run your practice profitably',
    track: 'business',
    cost: 700,
    duration_hours: 10,
    prerequisites: {},
    skill_bonus: 0,
    clinic_bonus: { hiring_capacity: 1 }
  }
];
```

## Enrollment

```typescript
function enrollInTraining(therapist: Therapist, program: TrainingProgram): boolean {
  // Check prerequisites
  if (program.prerequisites.min_skill && therapist.base_skill < program.prerequisites.min_skill) {
    EventBus.emit('training_enrollment_failed', 'Insufficient skill level');
    return false;
  }

  if (program.prerequisites.min_level && therapist.level < program.prerequisites.min_level) {
    EventBus.emit('training_enrollment_failed', 'Insufficient experience level');
    return false;
  }

  if (program.prerequisites.required_certifications) {
    for (const cert of program.prerequisites.required_certifications) {
      if (!therapist.certifications.includes(cert)) {
        EventBus.emit('training_enrollment_failed', 'Missing required certification');
        return false;
      }
    }
  }

  // Check affordability
  if (!economySystem.can_afford(program.cost)) {
    EventBus.emit('training_enrollment_failed', 'Cannot afford');
    return false;
  }

  // Deduct cost
  economySystem.removeMoney(program.cost, `training_enrollment_${program.id}`);

  // Create active training instance
  const activeTraining: TrainingInstance = {
    id: `training-${Date.now()}`,
    program_id: program.id,
    therapist_id: therapist.id,
    hours_completed: 0,
    started_day: currentDay,
    status: 'in_progress'
  };

  therapist.current_training = activeTraining;
  activeTrainings.push(activeTraining);

  EventBus.emit('training_started', therapist.id, program.id);
  showNotification(`${therapist.display_name} started ${program.name}`);

  return true;
}
```

## Progress Tracking

Training progresses automatically at **8 hours per day** via the `TrainingProcessor` and `useTrainingProcessor` hook.

### Training Instance

```typescript
interface ActiveTraining {
  id: string;
  programId: string;
  therapistId: string;
  therapistName: string;
  programName: string;
  hoursCompleted: number;
  hoursRequired: number;
  startedDay: number;
  status: 'in_progress' | 'completed';
}
```

### TrainingProcessor (Pure Functions)

Located in `src/core/training/TrainingProcessor.ts`:

```typescript
const TRAINING_CONFIG = {
  HOURS_PER_DAY: 8,  // Training progresses 8 hours per day
};

// Process all trainings at day start
function processDailyTraining(
  activeTrainings: ActiveTraining[],
  therapists: Therapist[],
  programs: TrainingProgram[],
  currentDay: number
): TrainingProgressResult {
  // Returns updated trainings, completed trainings, and therapist updates
}

// Helper functions
function getTrainingProgress(training: ActiveTraining): number;  // 0-100%
function getDaysRemaining(training: ActiveTraining): number;
function isTrainingComplete(training: ActiveTraining): boolean;
```

### useTrainingProcessor Hook

Located in `src/hooks/useTrainingProcessor.ts`:

```typescript
// Subscribes to DAY_STARTED event and processes training automatically
const { startTraining, getTrainingStats } = useTrainingProcessor({
  enabled: hasStartedGame,
  onTrainingCompleted: (completed) => {
    console.log(`Training completed: ${completed.programName}`);
  },
});
```

The hook:
1. Listens to `DAY_STARTED` events
2. Applies 8 hours of progress to each active training
3. Completes trainings when hours are met
4. Grants certifications and skill bonuses
5. Updates therapist status from 'in_training' to 'available'

### Training Progress UI

The `TherapistCard` component displays active training status:

```typescript
{therapist.status === 'in_training' && activeTraining && (
  <div className={styles.trainingProgress}>
    <div className={styles.trainingHeader}>
      <span>Training Progress</span>
      <span>{trainingProgram.name}</span>
    </div>
    <div className={styles.trainingBar}>
      <div style={{ width: `${TrainingProcessor.getTrainingProgress(activeTraining)}%` }} />
    </div>
    <div className={styles.trainingStats}>
      <span>{progress}% complete</span>
      <span>{daysRemaining} day(s) remaining</span>
    </div>
  </div>
)}
```
```

## Completion

When training finishes:

```typescript
function completeTraining(training: TrainingInstance) {
  training.status = 'completed';

  const therapist = getTherapist(training.therapist_id);
  const program = getProgram(training.program_id);

  // 1. Restore availability (if clinical)
  therapist.is_available = true;
  therapist.current_training = null;

  // 2. Award certification
  if (program.grants_certification) {
    therapist.certifications.push(program.grants_certification);
    EventBus.emit('certification_granted', therapist.id, program.grants_certification);
  }

  // 3. Apply skill bonus
  if (program.skill_bonus > 0) {
    therapist.base_skill = Math.min(100, therapist.base_skill + program.skill_bonus);
  }

  // 4. Apply clinic bonuses
  if (program.clinic_bonus) {
    if (program.clinic_bonus.hiring_capacity) {
      // Update staff cap
      EventBus.emit('staff_cap_increased', program.clinic_bonus.hiring_capacity);
    }
    if (program.clinic_bonus.insurance_multiplier) {
      // Update insurance rates
      economySystem.insurance_multiplier += program.clinic_bonus.insurance_multiplier;
    }
  }

  // 5. Add reputation
  reputationSystem.updateReputation(1);

  // 6. Add XP
  therapist.experience_points += program.skill_bonus * 5;

  // Remove from active trainings
  activeTrainings.splice(activeTrainings.indexOf(training), 1);

  EventBus.emit('training_completed', therapist.id, program.id);
  showNotification(`${therapist.display_name} completed ${program.name}!`);
}
```

## Clinical Track Unavailability

Therapists in clinical training are offline:

```typescript
function isTherapistAvailable(therapist: Therapist, day: number, hour: number): boolean {
  // Check if in clinical training
  if (therapist.current_training?.track === 'clinical') {
    return false;  // Offline, cannot schedule
  }

  // Check other availability factors
  if (therapist.is_burned_out) return false;
  if (therapist.is_on_break(day, hour)) return false;

  return true;
}

// Cannot book sessions for therapist in clinical training
function validateSessionBooking(therapist: Therapist) {
  if (therapist.current_training?.track === 'clinical') {
    throw new Error('Therapist is in offline training');
  }
}
```

## Training Panel

UI for browsing and enrolling in training:

```typescript
interface TrainingPanel {
  available_programs: TrainingProgram[];
  active_trainings: TrainingProgress[];
  filters: {
    track: 'clinical' | 'business' | 'all';
    therapist_id: string | 'all';
    only_affordable: boolean;
  };
}

interface TrainingProgress {
  therapist: Therapist;
  program: TrainingProgram;
  hours_completed: number;
  hours_remaining: number;
  percentage: number;
  can_enroll: boolean;
  reason_cannot_enroll?: string;
}

function checkEnrollmentEligibility(
  therapist: Therapist,
  program: TrainingProgram
): { can_enroll: boolean; reason?: string } {
  if (therapist.current_training) {
    return { can_enroll: false, reason: 'Already in training' };
  }

  if (program.prerequisites.min_skill && therapist.base_skill < program.prerequisites.min_skill) {
    return { can_enroll: false, reason: `Requires skill ${program.prerequisites.min_skill}+` };
  }

  if (!economySystem.can_afford(program.cost)) {
    return { can_enroll: false, reason: 'Cannot afford' };
  }

  return { can_enroll: true };
}
```

## Recommended Training Path

Suggest training based on therapist and practice needs:

```typescript
function getRecommendedTraining(therapist: Therapist): TrainingProgram[] {
  const recommendations: TrainingProgram[] = [];

  // 1. Check for gaps in certifications needed by clients
  const clientConditions = clients.map(c => c.condition_category);
  const neededCerts = getRequiredCertificationsForConditions(clientConditions);

  for (const cert of neededCerts) {
    const program = TRAINING_PROGRAMS.find(p => p.grants_certification === cert);
    if (program && !therapist.certifications.includes(cert)) {
      recommendations.push(program);
    }
  }

  // 2. Suggest skill progression
  if (therapist.base_skill < 50) {
    const skillProgram = TRAINING_PROGRAMS.find(p => p.id === 'cbt_fundamentals');
    if (skillProgram && checkEnrollmentEligibility(therapist, skillProgram).can_enroll) {
      recommendations.push(skillProgram);
    }
  }

  // 3. Suggest business training for hiring capacity if needed
  if (
    therapists.length === getStaffCapForLevel(practiceLevel) &&
    practiceLevel < 5
  ) {
    const marketingProgram = TRAINING_PROGRAMS.find(p => p.id === 'marketing_essentials');
    if (marketingProgram) {
      recommendations.push(marketingProgram);
    }
  }

  return recommendations;
}
```

## Events Emitted

```typescript
EventBus.emit('training_started', therapistId, programId);
EventBus.emit('training_completed', therapistId, programId);
EventBus.emit('certification_granted', therapistId, certificationName);
EventBus.emit('staff_cap_increased', amount);
EventBus.emit('training_enrollment_failed', reason);
```

## Testing Strategy

```typescript
test('training enrollment costs money', () => {
  const initialBalance = economy.balance;
  enrollInTraining(therapist, TRAINING_PROGRAMS[0]);
  expect(economy.balance).toBeLessThan(initialBalance);
});

test('clinical training makes therapist unavailable', () => {
  enrollInTraining(therapist, TRAINING_PROGRAMS.find(p => p.track === 'clinical'));
  expect(therapist.is_available).toBe(false);
});

test('training completion awards certification', () => {
  const program = TRAINING_PROGRAMS.find(p => p.grants_certification);
  enrollInTraining(therapist, program);

  // Fast-forward training hours
  const training = therapist.current_training;
  training.hours_completed = program.duration_hours;
  completeTraining(training);

  expect(therapist.certifications).toContain(program.grants_certification);
});

test('training with prerequisites cannot enroll if unmet', () => {
  const program = TRAINING_PROGRAMS.find(p => p.prerequisites.min_skill && p.prerequisites.min_skill > 50);
  therapist.base_skill = 40;

  const result = enrollInTraining(therapist, program);
  expect(result).toBe(false);
});
```
