# Architecture Overview

## System Design Philosophy

Therapy Tycoon uses a **modular, event-driven architecture** where independent systems communicate through a central EventBus. This ensures loose coupling, testability, and easy parallelization of game logic.

### Core Principles

1. **Separation of Concerns** - Game logic in `/src/core/` has zero React dependencies
2. **Event-Driven** - Systems communicate via signals, not direct references
3. **Immutable State** - Zustand store is the single source of truth
4. **Testable Design** - Pure functions with dependency injection
5. **Hybrid Rendering** - DOM for UI, PixiJS canvas for visual world

## Data Flow

```
User Input (Button Click, Keyboard)
    ↓
React Component
    ↓
Zustand Store Action (dispatch event)
    ↓
EventBus.emit(eventName, data)
    ↓
Listening Game System processes event
    ↓
System modifies store (setState)
    ↓
Zustand notifies subscribers
    ↓
React components re-render with new state
    ↓
UI updates + PixiJS canvas updates
```

## Project Structure

```
src/
├── main.tsx                      # Entry point
├── App.tsx                       # Root component
│
├── core/                         # Pure game logic (testable, no React)
│   ├── engine/
│   │   ├── GameEngine.ts         # Main orchestration loop
│   │   ├── TimeController.ts     # Time simulation (day/hour/minute)
│   │   └── SaveManager.ts        # Persistence, load/save games
│   │
│   ├── systems/                  # 8 independent game systems
│   │   ├── EconomySystem.ts      # Money, income, expenses
│   │   ├── SessionSystem.ts      # Sessions, quality, outcomes
│   │   ├── SchedulingSystem.ts   # Calendar, slot availability
│   │   ├── ReputationSystem.ts   # Rep score, practice levels
│   │   ├── TrainingSystem.ts     # Certifications, skill growth
│   │   ├── EventsSystem.ts       # Random events, decisions
│   │   ├── OfficeSystem.ts       # Buildings, rooms, infrastructure
│   │   └── InsuranceSystem.ts    # Panels, claims, reimbursement
│   │
│   ├── entities/                 # Factory functions for entities
│   │   ├── therapistFactory.ts
│   │   ├── clientFactory.ts
│   │   ├── sessionFactory.ts
│   │   └── ...
│   │
│   ├── events/
│   │   ├── EventBus.ts           # Central event hub (signals)
│   │   └── types.ts              # Event type definitions
│   │
│   └── types/
│       ├── entities.ts           # Therapist, Client, Session, etc.
│       ├── systems.ts            # System interfaces
│       └── events.ts             # Event type definitions
│
├── store/                        # Zustand state management
│   ├── gameStore.ts              # Main game state + actions
│   ├── uiStore.ts                # UI state (modals, selections)
│   └── slices/                   # Per-domain store slices
│       ├── therapists.ts
│       ├── clients.ts
│       ├── sessions.ts
│       └── ...
│
├── game/                         # PixiJS rendering layer
│   ├── GameCanvas.tsx            # React wrapper for canvas
│   ├── scenes/
│   │   ├── OfficeScene.ts        # Main office visualization
│   │   └── transitions.ts        # Day transitions, animations
│   └── objects/
│       ├── sprites.ts            # Sprite definitions
│       └── animations.ts         # Animation helpers
│
├── components/                   # React UI components
│   ├── layout/
│   │   ├── GameLayout.tsx        # Main layout
│   │   ├── HUD.tsx               # Top bar (time, money, rep)
│   │   └── SidePanel.tsx         # Side navigation
│   │
│   ├── schedule/
│   │   ├── ScheduleGrid.tsx      # Calendar grid
│   │   ├── SessionCard.tsx       # Session display
│   │   └── TimeSlot.tsx          # Individual slot
│   │
│   ├── sessions/
│   │   ├── SessionPanel.tsx      # Active session display
│   │   └── DecisionEvent.tsx     # Decision popup
│   │
│   ├── panels/                   # 11+ modal panels
│   │   ├── HiringPanel.tsx
│   │   ├── TrainingPanel.tsx
│   │   ├── BudgetPanel.tsx
│   │   ├── ClientManagementPanel.tsx
│   │   ├── OfficePanel.tsx
│   │   └── ...
│   │
│   ├── notifications/
│   │   └── ToastNotification.tsx  # Toast system
│   │
│   └── shared/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       └── ProgressBar.tsx
│
├── hooks/                        # Custom React hooks
│   ├── useGameTime.ts
│   ├── useGameState.ts
│   └── ...
│
├── data/                         # Static game data
│   ├── events.ts                 # Event catalog
│   ├── training.ts               # Training programs
│   ├── therapists.ts             # Initial therapist pool
│   └── ...
│
└── utils/                        # Shared utilities
    ├── validators.ts
    ├── calculations.ts
    └── helpers.ts

tests/
├── unit/                         # Core system unit tests
├── integration/                  # System interaction tests
├── components/                   # Component tests
└── e2e/                          # Playwright E2E tests
```

## Core Systems

### EventBus (Foundation)

The EventBus is a signal emitter that allows systems to communicate without direct references:

```typescript
// Define events
EventBus.on('session_completed', (sessionId, quality) => {
  // Reputation system listens and updates rep
  // Economy system listens and processes payment
  // UI updates with notification
});

// Emit from a system
EventBus.emit('session_completed', sessionId, quality);
```

**Key Events**:
- Time: `day_started`, `hour_changed`, `minute_changed`
- Sessions: `session_started`, `session_completed`, `session_cancelled`
- Clients: `client_arrived`, `client_cured`, `client_dropped`
- Economy: `money_changed`, `insurance_claim_scheduled`, `insurance_claim_denied`
- Reputation: `reputation_changed`, `practice_level_changed`
- Training: `training_started`, `training_completed`
- Events: `random_event_triggered`, `decision_event_triggered`

### GameEngine (Orchestrator)

The main game loop that drives time forward:

```typescript
class GameEngine {
  // Runs at 60 FPS
  update(deltaTime: number) {
    this.timeController.tick(deltaTime);
    // EventBus emits time changes
    // All listening systems process updates
    // Store is updated with new state
  }

  pause(reason: string) { /* Stack-based pause */ }
  resume(reason: string) { /* Unpauses when stack empty */ }
  setSpeed(multiplier: number) { /* 1x, 2x, 3x */ }
}
```

### TimeController (Time Simulation)

Manages game time with speed controls:

```typescript
class TimeController {
  day: number = 1;
  hour: number = 8;      // 8 AM = business start
  minute: number = 0;
  speed: number = 1.0;   // 1x, 2x, 3x

  tick(deltaTime: number) {
    // Advance minute based on speed
    // Emit hour_changed when hour increments
    // Emit day_started at start of new day
    // Business hours: 8 AM (8) - 5 PM (17)
  }
}
```

### Zustand Store (State)

Central immutable state with actions:

```typescript
interface GameState {
  // Entities
  therapists: Therapist[];
  clients: Client[];
  sessions: Session[];

  // Resources
  money: number;
  reputation: number;
  practiceLevel: number;

  // Time
  day: number;
  hour: number;
  minute: number;

  // UI
  selectedClient: Client | null;
  openPanels: Set<string>;

  // Actions
  addMoney(amount: number, reason: string): void;
  removeMoney(amount: number, reason: string): boolean;
  updateReputation(delta: number): void;
  // ... many more
}
```

### Avoiding Stale Closures in Callbacks

React callbacks created with `useCallback` capture values at creation time. For state that changes frequently (sessions, clients, therapists), **always use `getState()` at execution time** to get fresh data:

```typescript
// ❌ BAD: Uses stale closure data
const handleSessionStart = useCallback((sessionId: string) => {
  const session = sessions.find(s => s.id === sessionId) // sessions is stale!
  if (session) {
    updateSession(sessionId, { status: 'in_progress' })
  }
}, [sessions, updateSession])

// ✅ GOOD: Gets fresh state at execution time
const handleSessionStart = useCallback((sessionId: string) => {
  const { sessions: freshSessions } = useGameStore.getState()
  const session = freshSessions.find(s => s.id === sessionId)
  if (!session) return
  if (session.status !== 'scheduled') return // Guard check

  updateSession(sessionId, { status: 'in_progress' })
  updateTherapist(session.therapistId, { status: 'in_session' })
  EventBus.emit(GameEvents.SESSION_STARTED, { sessionId })
}, [updateSession, updateTherapist])
```

This pattern is critical for:
- Session state transitions (start, complete, cancel)
- Booking operations (checking slot availability)
- Any callback that needs current entity state

## System Interaction Patterns

### 1. Session Completion Flow

```
SessionSystem.completeSession(sessionId)
  ├─ Calculate session quality (therapist skill, client match, energy)
  ├─ Emit: session_completed(sessionId, quality)
  ├─ ReputationSystem listens → Add/remove reputation based on quality
  ├─ EconomySystem listens → Add payment to balance
  ├─ ClientSystem listens → Update client treatment progress
  └─ UI listens → Show notification with quality tier
```

### 2. Client Arrival Flow

```
EventsSystem or SchedulingSystem generates new client
  ├─ Emit: client_arrived(clientId)
  ├─ SchedulingSystem listens → Add to waiting list
  ├─ ReputationSystem listens → Adjust arrivals based on rep
  ├─ UI listens → Show in client panel
  └─ Store updated with new client
```

### 3. Daily Expenses Flow

```
GameEngine emits: day_started(day)
  ├─ TrainingSystem listens → Update training progress, complete if done
  ├─ EconomySystem listens → Deduct salaries, rent
  ├─ EventsSystem listens → Trigger 30% chance of random event
  ├─ ClientSystem listens → Decay waiting client engagement
  └─ Schedule cleanup → Remove completed sessions from history
```

## Save/Load System

### Save Format

```json
{
  "save_version": 2,
  "game_manager": {
    "practice_name": "My Practice",
    "current_day": 42,
    "current_hour": 14,
    "current_minute": 30,
    "game_speed": 1.0
  },
  "economy": {
    "balance": 12500,
    "pending_payments": [
      { "amount": 300, "insurer": "BlueCross", "due_day": 45 }
    ]
  },
  "reputation": {
    "reputation": 145,
    "practice_level": 3
  },
  "therapists": [ /* ... */ ],
  "clients": [ /* ... */ ],
  "sessions": { "active": [], "history": [] },
  "scheduling": { "schedule": {}, "waiting_list": [] },
  "training": { "active_trainings": {} },
  "office": { "current_building": "small_clinic", "telehealth_unlocked": true },
  "insurance": { "active_panels": [] }
}
```

### Save Manager

```typescript
class SaveManager {
  // Automatic save on significant events
  autoSave() {
    const snapshot = gameStore.getState();
    localStorage.setItem('therapy-tycoon-save', JSON.stringify(snapshot));
  }

  // Manual save (when player uses "Save" button)
  save(slotName: string) {
    const snapshot = gameStore.getState();
    localStorage.setItem(`therapy-tycoon-${slotName}`, JSON.stringify(snapshot));
  }

  // Load with schema migration
  load(slotName: string) {
    const data = JSON.parse(localStorage.getItem(`therapy-tycoon-${slotName}`));
    return migrateIfNeeded(data); // v1 → v2, v2 → v3, etc.
  }
}
```

### Schema Versioning

When the game structure changes:

1. Increment `save_version` in the save file
2. Implement migration logic in `SaveManager.migrateIfNeeded()`
3. Apply sensible defaults for new fields
4. Test migration with old save files

## Pause Stack System

Prevents conflicts when multiple systems want to pause:

```typescript
class GameEngine {
  pauseStack: Set<string> = new Set();

  pause(reason: string) {
    this.pauseStack.add(reason);  // "hiring_panel", "decision_event"
    this.isPaused = true;
  }

  resume(reason: string) {
    this.pauseStack.delete(reason);
    if (this.pauseStack.size === 0) {
      this.isPaused = false;  // Only unpause when stack is empty
    }
  }
}
```

This ensures that:
- Opening a hiring panel pauses the game
- A decision event triggered during a session keeps it paused
- When the event closes, the game stays paused until the hiring panel closes
- Only when all reasons are removed does the game resume

## Testing Strategy

The test suite includes 600+ tests covering all systems.

### Unit Tests (Core Systems)
- Test each system in isolation with mocked dependencies
- Example: `EconomySystem.addMoney()` doesn't emit events, just updates state
- State transition tests for session lifecycle

### Integration Tests
- Test system interactions through EventBus
- Example: Complete a session → reputation changes → practice level updates
- Booking validation with slot/client conflict detection
- State consistency tests (getState() pattern)

### Component Tests
- Test React components with mocked store
- Verify button clicks dispatch correct actions
- Booking feedback display

### E2E Tests
- Full user flows from new game to completing a day
- Verify save/load works correctly
- Test critical gameplay loops

### Key Test Files
- `tests/unit/core/SessionStateTransitions.test.ts` - Session lifecycle, state guards
- `tests/unit/core/SessionBookingIntegration.test.ts` - Booking validation, conflict detection

## Performance Considerations

1. **Time Updates** - Throttled to once per frame (~16ms)
2. **Session Simulation** - Cached quality calculations
3. **Store Subscriptions** - Selectors used to avoid unnecessary re-renders
4. **Canvas Rendering** - Only re-render when needed (dirty flag system)
5. **Waiting List Decay** - Batched daily, not per-client per-update

## Future Extensions

- WebWorker for background time simulation
- IndexedDB for larger save files
- Multiplayer (shared practice management)
- Mod system via EventBus extensions
