# Training System

Manages therapist professional development through training programs that grant **certifications**, **skill bonuses**, and (for business track) **clinic-wide bonuses**.

## Where the Source of Truth Lives

- **Types**: `src/core/types/entities.ts`
  - `TrainingProgram`, `ActiveTraining`, `TrainingPrerequisites`, `TrainingGrants`, `ClinicBonus`
- **Catalog / static data**: `src/data/trainingPrograms.ts`
  - `TRAINING_PROGRAMS: Record<string, TrainingProgram>`
  - helpers: `getTrainingProgramsByTrack()`, `getTrainingProgramsSorted()`, `formatTrainingDuration()`
- **Pure progression logic**: `src/core/training/TrainingProcessor.ts`
- **Runtime orchestration + store updates**: `src/hooks/useTrainingProcessor.ts`
- **UI**:
  - Entry point: Team tab (`src/components/game/TherapistPanel.tsx` / `TherapistCard.tsx`)
  - Modal: `src/components/game/TrainingModal.tsx`
  - Wiring: `src/components/game/GameView.tsx`

## Training Tracks

Programs are split into two tracks:

- **Clinical**: certifications and/or therapist skill bonuses.
- **Business**: clinic-wide bonuses (e.g. reputation bonus, insurance multiplier).

Implementation note: today, *any* active training sets `therapist.status = 'in_training'` and makes the therapist unavailable for scheduling while the program runs.

## Data Model

### TrainingProgram

```ts
export interface TrainingProgram {
  id: string
  name: string
  description: string
  track: 'clinical' | 'business'
  cost: number
  durationHours: number
  prerequisites: {
    minSkill?: number
    certifications?: Certification[]
  }
  grants: {
    skillBonus?: number
    certification?: Certification
    clinicBonus?: {
      type: 'hiring_capacity' | 'insurance_multiplier' | 'reputation_bonus'
      value: number
    }
  }
}
```

### ActiveTraining

```ts
export interface ActiveTraining {
  programId: string
  therapistId: string
  startDay: number
  hoursCompleted: number
  totalHours: number
}
```

## Player Flow (UI)

1. Go to **Team** tab.
2. On a therapist card, click **Start Training**.
3. Pick a program in the **TrainingModal**.
4. On enrollment:
   - funds are deducted
   - therapist status becomes `in_training`
   - an `ActiveTraining` entry is created
5. Each **day start** advances training by **8 hours/day** until completion.

## Enrollment (Runtime)

Enrollment is performed via `useTrainingProcessor().startTraining(therapistId, programId)`.

Key validations:

- `TrainingProcessor.canStartTraining(...)`:
  - therapist not already in training
  - sufficient funds
  - prerequisite checks delegated to `TherapistManager.canStartTraining(therapist, program)`

Store mutations:

- `removeMoney(program.cost, ...)`
- `updateTherapist(therapistId, { status: 'in_training' })`
- `addActiveTraining({ programId, therapistId, startDay, hoursCompleted: 0, totalHours: program.durationHours })`

## Daily Progression

`useTrainingProcessor` subscribes to `GameEvents.DAY_STARTED` and calls:

- `TrainingProcessor.processDailyTraining(activeTrainings, therapists, TRAINING_PROGRAMS)`

This:

- increments `hoursCompleted` by `TRAINING_CONFIG.HOURS_PER_DAY` (**8**) for each active training
- completes trainings whose `hoursCompleted >= totalHours`
- produces a `therapistUpdates` map (certifications, skill increases, and `status: 'available'`)

Store updates are applied using the pair key `(therapistId, programId)` so **multiple therapists can run the same program concurrently**.

## Events Emitted

Events are emitted from the store/hook layer:

- `GameEvents.TRAINING_STARTED` `{ therapistId, programId }`
- `GameEvents.TRAINING_PROGRESS` `{ therapistId, programId, progress }`
- `GameEvents.TRAINING_COMPLETED` `{ therapistId, programId }`
- `GameEvents.CERTIFICATION_EARNED` `{ therapistId, certification }`

## Testing

- Unit/component coverage:
  - `tests/unit/core/TrainingFlow.test.tsx`
  - `tests/unit/components/TrainingModal.test.tsx`
- E2E coverage:
  - `tests/e2e/training-flow.spec.ts`
