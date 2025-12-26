# Therapy Tycoon - Issue Report

**Generated**: December 25, 2024
**Audit Scope**: Full codebase audit including core systems, store, events, hooks, components, data files, and tests

---

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 6 | 6 | 0 |
| HIGH | 21 | 14 | 7 |
| MEDIUM | 19 | 0 | 19 |
| LOW | 8 | 0 | 8 (Deferred) |

---

## CRITICAL Issues

### CRIT-001: Schedule Synchronization Bug in Store Actions
**Status**: ✅ Fixed
**Files**: `src/store/gameStore.ts:438-464`
**Impact**: Sessions added/removed don't reflect in schedule, causing UI desynchronization

**Description**:
The `addSession`, `removeSession`, and `updateSession` actions modify `state.sessions` but don't rebuild `state.schedule`. This creates a silent inconsistency where the sessions array and schedule object become out of sync.

**Current Code**:
```typescript
addSession: (session) => {
  set((state) => {
    state.sessions.push(session)  // Updates sessions
    // BUG: Missing schedule rebuild!
  })
}
```

**Fix**: Add `state.schedule = ScheduleManager.buildScheduleFromSessions(state.sessions)` after session mutations.

---

### CRIT-002: EventBus.off() Memory Leak
**Status**: ✅ Fixed (FeedbackOverlay now uses returned cleanup function)
**Files**: `src/core/events/EventBus.ts:70-76`
**Impact**: Memory leak on every component mount/unmount cycle

**Description**:
The `off()` method doesn't properly match wrapped handlers. When `on()` wraps a handler, the wrapped version is subscribed to mitt's emitter. But `off()` tries to unsubscribe the original handler (not the wrapped one), so the listener is never actually removed.

**Current Code**:
```typescript
off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
  const wrapped = this.handlerWrappers.get(handler as unknown as (payload: unknown) => void)
  this.emitter.off(event, (wrapped as unknown as (payload: Events[K]) => void) ?? handler)
}
```

**Fix**: Store mapping from original→wrapped handlers and ensure correct reference is passed to `emitter.off()`.

---

### CRIT-003: Duplicate ID Collision in randomEvents.ts
**Status**: ✅ Fixed (renamed modifier to 'reduced_rates')
**Files**: `src/data/randomEvents.ts:226, :481`
**Impact**: Runtime errors when accessing event/modifier by ID

**Description**:
Two different objects share the ID `'economic_downturn'`:
- Line 226: RandomEvent with title "Economic Concerns"
- Line 481: GameModifier in COMMON_MODIFIERS

When code looks up by ID, one shadows the other causing type mismatches.

**Fix**: Rename the modifier to `'economic_downturn_modifier'` or similar.

---

### CRIT-004: Missing Event Emission in removeSession
**Status**: ✅ Fixed
**Files**: `src/store/gameStore.ts:460-464`
**Impact**: Systems listening for session removal won't be notified

**Description**:
`removeSession` mutates state but never emits an event. Other entity operations (`addClient`, `addTherapist`, `cancelSession`) all emit events, but `removeSession` is silent.

**Fix**: Add `EventBus.emit(GameEvents.SESSION_DELETED, { sessionId })` or similar event.

---

### CRIT-005: Session Payment Doesn't Account for Duration
**Status**: ✅ Fixed
**Files**: `src/core/schedule/ScheduleManager.ts:275`
**Impact**: Inconsistent payment calculations between creation and processing

**Description**:
Sessions are created with `payment: client.sessionRate` regardless of duration (50/80/180 min). Duration multipliers (EXTENDED_SESSION_MULTIPLIER, INTENSIVE_SESSION_MULTIPLIER) are only applied during payment processing in EconomyManager, not at session creation.

**Fix Applied**: Added `calculateSessionPayment()` function to ScheduleManager that applies duration multipliers. Updated `createSession()` and session creation in GameView.tsx to use proper payment calculation.

---

### CRIT-006: Client/Session Creation Without Relationship Validation
**Status**: ✅ Fixed
**Files**: `src/core/clients/ClientManager.ts:380`, `src/core/schedule/ScheduleManager.ts:246`
**Impact**: Can create sessions with unqualified therapists, orphaned references

**Description**:
- `assignClient()` accepts any therapistId without validating the therapist exists or has required certifications
- `createSession()` doesn't validate therapist meets client's `requiredCertification`

**Fix Applied**:
- Added `canTherapistServeClient()` validation function to ClientManager
- Updated `assignClient()` to validate certification requirements (now takes Therapist object instead of ID)
- Added validation check in GameView.tsx before creating sessions

---

## HIGH Severity Issues

### HIGH-001: Modal Resume Logic Flaw
**Status**: ✅ Fixed
**Files**: `src/store/uiStore.ts:124-140`
**Impact**: Game can incorrectly resume before all modals are closed

**Description**:
`closeModal()` emits GAME_RESUMED when closing any modal, even if there are more modals in the stack. Should only resume when `modalStack.length === 0`.

---

### HIGH-002: No EventBus Cleanup on Game Reset
**Status**: ✅ Fixed
**Files**: `src/App.tsx:744-748`
**Impact**: Old listeners persist between game sessions

**Description**:
When starting a new game, `EventBus.clear()` is never called. Listeners from the previous game session remain subscribed.

**Fix Applied**: Added `EventBus.clear()` call in `handleStartGame` before initializing new game.

---

### HIGH-003: ~22 Unused Event Definitions
**Status**: 🟠 Open
**Files**: `src/core/events/GameEvents.ts`
**Impact**: Dead code, cognitive overhead, false expectations

**Description**:
Events like `SESSION_PROGRESS`, `DECISION_EVENT_TRIGGERED`, `THERAPIST_FIRED`, `PAYMENT_RECEIVED`, etc. are defined but never emitted or listened to.

---

### HIGH-004: setTimeout Not Cleaned in NewGameModal
**Status**: ✅ Fixed
**Files**: `src/components/game/NewGameModal.tsx:76-78`
**Impact**: setState on unmounted component

**Description**:
```typescript
setTimeout(() => { startTutorial() }, 500)  // Not stored or cleaned up
```

**Fix Applied**: Added `tutorialTimeoutRef` to track and cleanup timeout on unmount.

---

### HIGH-005: Nested setTimeout Not Cleaned in Toast
**Status**: ✅ Fixed
**Files**: `src/components/ui/Toast.tsx:60`, `src/components/game/AchievementToast.tsx:46`
**Impact**: setState on unmounted component

**Description**:
Nested `setTimeout(onDismiss, 150)` inside another timeout - inner timeout not cleaned.

**Fix Applied**: Added refs (`exitAnimationTimerRef`) to track and cleanup all timeouts in both Toast and AchievementToast components.

---

### HIGH-006: Missing setTimeout Cleanup in App.tsx DAY_ENDED
**Status**: ✅ Fixed
**Files**: `src/App.tsx:368-386`
**Impact**: setState on unmounted component

**Description**:
`setTimeout(() => { setActiveDaySummary(summary) }, 0)` without cleanup.

**Fix Applied**: Added `daySummaryTimeoutRef` to track the timeout and cleanup in effect's return function.

---

### HIGH-007: Energy Cost Calculation Doesn't Cap Level
**Status**: ✅ Fixed
**Files**: `src/core/schedule/ScheduleManager.ts:307-321`
**Impact**: Edge case with therapist level > 50

**Description**:
`THERAPIST_CONFIG.MAX_LEVEL` is 50, but `calculateEnergyCost()` doesn't enforce this cap.

**Fix Applied**: Added `Math.min(therapistLevel, 50)` to cap level at MAX_LEVEL before calculation.

---

### HIGH-008: Practice Level Lookup Off-by-One at Max
**Status**: ✅ Not a Bug (Already Handled)
**Files**: `src/core/reputation/ReputationManager.ts:74-75`
**Impact**: Undefined behavior at max reputation

**Description**:
`nextLevelConfig = PRACTICE_LEVELS[currentLevel]` is undefined when at max level (array index out of bounds).

**Analysis**: Code already handles this with optional chaining (`nextLevelConfig?.minReputation ?? null`) and has explicit max level handling (lines 87-90).

---

### HIGH-009: Crisis Detection Uses Brittle String Matching
**Status**: 🟠 Open
**Files**: `src/core/session/SessionManager.ts:304-310`
**Impact**: Incorrect regression if event naming changes

**Description**:
```typescript
d.eventId.includes('crisis') || d.eventId.includes('trauma')
```
Relies on string patterns in event IDs - fragile.

---

### HIGH-010: Orphaned Training Data Silently Kept
**Status**: 🟠 Open
**Files**: `src/core/training/TrainingProcessor.ts:56-62`
**Impact**: Silent data corruption

**Description**:
When program or therapist not found, training is kept without error logging.

---

### HIGH-011: Cascading Re-subscriptions in useTrainingProcessor
**Status**: 🟠 Open
**Files**: `src/hooks/useTrainingProcessor.ts:42-71`
**Impact**: Performance - unnecessary EventBus re-subscriptions

**Description**:
`insuranceMultiplier` in dependency array causes `applyClinicBonus` → `processTrainings` → `handleDayStart` cascade.

---

### HIGH-012: Stale Closure Risk with pause/resume
**Status**: 🟠 Open
**Files**: `src/hooks/useGameLoop.ts:50-67`
**Impact**: Potential memory leak

**Description**:
Dependency array includes `pause` and `resume` functions which can change identity.

---

### HIGH-013: Therapist Energy Maps Never Cleared on Deletion
**Status**: 🟠 Open
**Files**: `src/hooks/useTherapistEnergyProcessor.ts:47-48`
**Impact**: Memory grows if therapists cycle frequently

**Description**:
`sessionMinutesByTherapistRef` and `remainderUnitsByTherapistRef` Maps persist entries for deleted therapists.

---

### HIGH-014: Keyboard Accessibility Missing Space Key
**Status**: ✅ Fixed
**Files**: `src/components/game/ClientCard.tsx:81`
**Impact**: Accessibility - buttons should respond to both Enter and Space

**Description**:
`onKeyDown` only handles 'Enter' key, not 'Space'.

**Fix Applied**: Updated `onKeyDown` handler to also check for Space key (`' '`) and added `e.preventDefault()` to prevent page scroll.

---

### HIGH-015: Missing ReputationManager Unit Tests
**Status**: 🟠 Open
**Files**: `tests/unit/core/`
**Impact**: Core system lacks test coverage

**Description**:
`getReputationChangeReason()`, `formatReputation()`, `getReputationDisplay()` have no tests.

---

### HIGH-016: Missing DaySummaryManager Tests
**Status**: 🟠 Open
**Files**: `src/core/summary/DaySummaryManager.ts`
**Impact**: Critical end-of-day logic untested

---

### HIGH-017: Missing TutorialManager Tests
**Status**: 🟠 Open
**Files**: `src/core/tutorial/TutorialManager.ts`
**Impact**: New feature untested

---

### HIGH-018: SaveManager Lacks Edge Case Tests
**Status**: 🟠 Open
**Files**: `tests/unit/core/SaveManagerPersistence.test.ts`
**Impact**: No corruption/migration tests

---

### HIGH-019: Insurance Denial Rate Not Validated
**Status**: ✅ Fixed
**Files**: `src/core/economy/EconomyManager.ts:174-177`
**Impact**: Invalid probability if rate > 1 or negative

**Description**:
`denialRate` used without bounds checking.

**Fix Applied**: Added `Math.max(0, Math.min(1, rawDenialRate))` to clamp denial rate to valid probability range [0, 1].

---

### HIGH-020: Quality Modifier Missing Null Check
**Status**: ✅ Fixed
**Files**: `src/core/therapists/TherapistManager.ts:661-690`
**Impact**: Potential NaN in quality calculations

**Description**:
`TherapistManager.getModalityMatchBonus()` could return undefined.

**Fix Applied**: Added null checks for `primaryConfig` and used optional chaining for secondary modality config lookup.

---

### HIGH-021: PendingClaim Foreign Keys Unchecked
**Status**: 🟠 Open
**Files**: `src/core/insurance/InsuranceManager.ts:272-280`
**Impact**: Can create orphaned claims

---

## MEDIUM Severity Issues

### MED-001: Notification Timeout Not Cleaned on Unmount
**Files**: `src/store/uiStore.ts:193-209`

### MED-002: removeFromWaitingList No Event Emission
**Files**: `src/store/gameStore.ts:757-761`

### MED-003: Reputation Log Slicing Duplicated 3x
**Files**: `src/store/gameStore.ts:343, 380, 417`

### MED-004: Therapist Status Preservation Fragile
**Files**: `src/store/gameStore.ts:497-506`

### MED-005: Client Satisfaction Decay Assumes Daily Processing
**Files**: `src/core/clients/ClientManager.ts:405`

### MED-006: Seeded Random Mutates Closure State
**Files**: `src/core/session/SessionManager.ts:289-298`

### MED-007: Session Quality Starts at 0.5 Then Replaced
**Files**: `src/core/schedule/ScheduleManager.ts:273`

### MED-008: Session xpGained Field Semantic Confusion
**Files**: `src/core/types/entities.ts:196`

### MED-009: Missing Dependency Arrays on Ref-Updating Effects
**Files**: Multiple hooks (useGameLoop.ts:26, useClientSpawning.ts:31, useTrainingProcessor.ts:32)

### MED-010: Long Dependency Arrays in BookingModal
**Files**: `src/components/game/BookingModal.tsx:160-174`

### MED-011: Modal Body Scroll Management
**Files**: `src/components/ui/Modal.tsx:60-69`

### MED-012: Legacy decisionEvents.ts Unused
**Files**: `src/data/decisionEvents.ts`

### MED-013: Two Parallel Decision Event Systems
**Files**: `src/data/decisionEvents.ts` vs `src/core/session/decisionEvents.ts`

### MED-014: Client Match Score Can Favor Specialization
**Files**: `src/core/clients/ClientManager.ts:330`

### MED-015: EventBus Error Handling Test False Positive Risk
**Files**: `tests/unit/core/EventBus.test.ts:46-61`

### MED-016: TimeController Multi-Day Skip Logic
**Files**: `tests/unit/core/TimeController.test.ts:74-84`

### MED-017: Component State Update Verification Missing
**Files**: `tests/unit/components/`

### MED-018: RecurringBookingPlanner Shallow Tests
**Files**: `tests/unit/core/RecurringBookingPlanner.test.ts`

### MED-019: setBalance Event on No-Op
**Files**: `src/store/gameStore.ts:298-323`

---

## LOW Severity Issues (Deferred)

- LOW-001: Inconsistent ID generation patterns
- LOW-002: Missing common state selectors
- LOW-003: Type assertions instead of validation
- LOW-004: Tutorial state mutation inconsistency
- LOW-005: XP calculation inflexible
- LOW-006: Magic numbers for player therapist
- LOW-007: Therapist generation calculations lack validation
- LOW-008: unlockTelehealth consistency

---

## Fix Tracking

| Issue | Status | Notes |
|-------|--------|-------|
| CRIT-001 | ✅ Fixed | Schedule rebuild added to session actions |
| CRIT-002 | ✅ Fixed | FeedbackOverlay uses cleanup function |
| CRIT-003 | ✅ Fixed | Renamed modifier to 'reduced_rates' |
| CRIT-004 | ✅ Fixed | Added SESSION_CANCELLED event emission |
| CRIT-005 | ✅ Fixed | Duration multiplier applied at session creation |
| CRIT-006 | ✅ Fixed | Added canTherapistServeClient() validation |
| HIGH-001 | ✅ Fixed | Modal resume only when stack empty |
| HIGH-002 | ✅ Fixed | EventBus.clear() on new game |
| HIGH-004 | ✅ Fixed | Timeout cleanup in NewGameModal |
| HIGH-005 | ✅ Fixed | Timeout cleanup in Toast/AchievementToast |
| HIGH-006 | ✅ Fixed | Timeout cleanup in App.tsx DAY_ENDED |
| HIGH-007 | ✅ Fixed | Level cap added to energy cost calculation |
| HIGH-008 | ✅ N/A | Already handled correctly |
| HIGH-014 | ✅ Fixed | Space key support added |
| HIGH-019 | ✅ Fixed | Denial rate clamped to [0, 1] |
| HIGH-020 | ✅ Fixed | Null checks for modality config |

---

*Last Updated: December 25, 2024*
