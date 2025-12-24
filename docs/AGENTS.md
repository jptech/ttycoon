# AGENTS.md - Project Overview & Operating Guide

**Quick Reference for developers and AI agents working on Therapy Tycoon.**

## Project Summary

Therapy Tycoon is a cozy React-based management/tycoon game where players build and operate a therapy private practice. Players manage therapists, schedule clients, handle finances, and expand their reputation through training and specialization.

**Tech Stack**: Bun + Vite + React 19 + TypeScript + Zustand + PixiJS + Tailwind CSS + shadcn/ui

**Key Design Philosophy**: Event-driven architecture with pure game logic separated from UI. All systems communicate via EventBus (no direct references).

## Repository Structure

```
tt2/
├── src/
│   ├── core/                    # Pure game logic (testable, no React)
│   │   ├── engine/              # GameEngine, TimeController, SaveManager
│   │   ├── systems/             # 8 independent game systems
│   │   ├── entities/            # Factory functions for game objects
│   │   ├── events/              # EventBus (central signal hub)
│   │   └── types/               # TypeScript interfaces
│   │
│   ├── store/                   # Zustand state management
│   │   ├── gameStore.ts         # Main game state + actions
│   │   ├── uiStore.ts           # UI state (modals, selections)
│   │   └── slices/              # Per-domain store slices
│   │
│   ├── components/              # React UI components
│   │   ├── layout/              # GameLayout, HUD, SidePanel
│   │   ├── schedule/            # ScheduleGrid, SessionCard
│   │   ├── panels/              # 11+ modal panels
│   │   └── shared/              # Reusable components
│   │
│   ├── game/                    # PixiJS rendering layer
│   ├── hooks/                   # Custom React hooks
│   ├── data/                    # Static game data (events, training)
│   └── utils/                   # Shared utilities
│
├── docs/                        # System documentation
│   ├── README.md                # Doc index and navigation
│   ├── ARCHITECTURE.md          # System design and data flow
│   ├── DATA_MODEL.md            # Complete entity definitions
│   ├── AGENTS.md                # This file
│   └── [SYSTEM].md              # Individual system docs
│
├── tests/                       # Test suites
│   ├── unit/                    # Core system tests
│   ├── integration/             # System interaction tests
│   ├── components/              # React component tests
│   └── e2e/                     # End-to-end tests
│
└── package.json, vite.config.ts, etc.
```

## Core Concepts at a Glance

### The 8 Core Systems

| System | Purpose | Key Class | Files |
|--------|---------|-----------|-------|
| **Economy** | Money, income, expenses | `EconomySystem` | `src/core/systems/EconomySystem.ts` |
| **Session** | Therapy sessions, quality | `SessionSystem` | `src/core/systems/SessionSystem.ts` |
| **Scheduling** | Calendar, slot availability | `SchedulingSystem` | `src/core/systems/SchedulingSystem.ts` |
| **Reputation** | Rep score, practice levels | `ReputationSystem` | `src/core/systems/ReputationSystem.ts` |
| **Training** | Certifications, skill growth | `TrainingSystem` | `src/core/systems/TrainingSystem.ts` |
| **Events** | Random & decision events | `EventsSystem` | `src/core/systems/EventsSystem.ts` |
| **Office** | Buildings, rooms, telehealth | `OfficeSystem` | `src/core/systems/OfficeSystem.ts` |
| **Insurance** | Panels, claims, payments | `InsuranceSystem` | `src/core/systems/InsuranceSystem.ts` |

### The 4 Main Entities

| Entity | Purpose | TypeScript File | Details |
|--------|---------|-----------------|---------|
| **Therapist** | Staff member conducting sessions | `src/core/types/entities.ts` | See [THERAPISTS.md](./THERAPISTS.md) |
| **Client** | Patient seeking therapy | `src/core/types/entities.ts` | See [CLIENTS.md](./CLIENTS.md) |
| **Session** | Single therapy appointment | `src/core/types/entities.ts` | See [SESSIONS.md](./SESSIONS.md) |
| **Building** | Practice office with rooms | `src/core/types/entities.ts` | See [OFFICE.md](./OFFICE.md) |

### Event-Driven Communication

All systems communicate via a central **EventBus**:

```typescript
// Emit from a system
EventBus.emit('session_completed', sessionId, quality);

// Other systems listen
EventBus.on('session_completed', (sessionId, quality) => {
  // EconomySystem: Process payment
  // ReputationSystem: Update rep
  // UISystem: Show notification
});
```

**Key Events**:
- Time: `day_started`, `hour_changed`, `minute_changed`
- Sessions: `session_completed`, `session_started`, `session_cancelled`
- Clients: `client_arrived`, `client_cured`, `client_dropped`
- Economy: `money_changed`, `insurance_claim_scheduled`
- Reputation: `reputation_changed`, `practice_level_changed`

See [ARCHITECTURE.md](./ARCHITECTURE.md#eventbus-foundation) for complete event list.

## State Management (Zustand)

All game state lives in a single immutable store:

```typescript
// src/store/gameStore.ts
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

  // Actions
  addMoney(amount: number, reason: string): void;
  updateReputation(delta: number): void;
  // ... many more
}

// In components
const money = gameStore((state) => state.money);
const addMoney = gameStore((state) => state.addMoney);
```

**Key Files**:
- `src/store/gameStore.ts` - Main state + actions
- `src/store/slices/` - Per-domain slices (therapists, clients, etc.)

## Common Development Tasks

### 1. Modify Game Logic

Game logic lives in `src/core/systems/`. Pure functions, no React.

```
Want to change: Session quality calculation
File: src/core/systems/SessionSystem.ts
Function: calculateSessionQuality()
Docs: SESSIONS.md → "Quality Calculation"
```

**Steps**:
1. Understand current behavior (read system docs)
2. Modify the system function
3. Update store to reflect changes (via EventBus)
4. Write unit test in `tests/unit/`

### 2. Add a New UI Component

UI components live in `src/components/`.

```
Want to add: New report panel
Files:
  - src/components/panels/ReportPanel.tsx
  - src/hooks/useReport.ts (if needed)
Docs: UI.md → "Modal Panels"
```

**Steps**:
1. Create component file in appropriate subdirectory
2. Use Zustand hooks to read/dispatch state
3. Add to routing in `src/components/layout/GameLayout.tsx`
4. Style with Tailwind CSS

### 3. Add a New Game Feature

**Example: "Therapist Reviews" Feature**

1. **Define data model** → Add `reviews: Review[]` to `Therapist` type in `src/core/types/entities.ts`
2. **Add system logic** → Create or extend system in `src/core/systems/`
3. **Emit events** → Have system emit relevant events
4. **Update store** → Handle events in `src/store/gameStore.ts`
5. **Create UI** → Add panel in `src/components/panels/`
6. **Document** → Update relevant `.md` file in `docs/`

See [ARCHITECTURE.md](./ARCHITECTURE.md#system-interaction-patterns) for patterns.

### 4. Debug State Issues

```typescript
// In browser console
window.gameStore.getState()  // View entire state
window.gameStore.getState().money  // View specific value

// Listen to state changes
gameStore.subscribe((state) => console.log('State changed:', state));

// Watch specific value
gameStore.subscribe(
  (state) => state.money,
  (money) => console.log('Money changed to:', money)
);
```

## Key Workflows

### Session Completion Flow

```
SessionSystem.completeSession(sessionId)
  ├─ Calculate quality (therapist skill + modifiers)
  ├─ Emit: session_completed(sessionId, quality)
  └─ Systems listening:
      ├─ ReputationSystem: Update rep based on quality
      ├─ EconomySystem: Process payment
      ├─ ClientSystem: Update treatment progress
      └─ UI: Show notification with results
```

See [SESSIONS.md](./SESSIONS.md#session-completion) for details.

### Daily Processing

```
TimeController: Day boundary detected
  └─ Emit: day_started(day)
      ├─ TrainingSystem: Update training progress
      ├─ EconomySystem: Deduct salaries & rent
      ├─ ClientSystem: Decay waiting engagement
      ├─ EventsSystem: 30% chance for random event
      └─ SchedulingSystem: Generate client arrivals
```

See [TIME_CALENDAR.md](./TIME_CALENDAR.md#daily-cycle) for details.

## Testing Strategy

### Unit Tests (Pure Functions)

```bash
bun test src/core/systems/*.test.ts
```

Test individual systems in isolation:

```typescript
test('addMoney increases balance', () => {
  economy.balance = 1000;
  economy.addMoney(500, 'test');
  expect(economy.balance).toBe(1500);
});
```

**Location**: `tests/unit/`

### Integration Tests (System Interaction)

```bash
bun test tests/integration/*.test.ts
```

Test cross-system effects via EventBus:

```typescript
test('session completion updates reputation', () => {
  const listener = vi.fn();
  EventBus.on('reputation_changed', listener);
  sessionSystem.completeSession(sessionId);
  expect(listener).toHaveBeenCalled();
});
```

### Component Tests

```bash
bun test tests/components/*.test.ts
```

Test React components with mocked store:

```typescript
test('HUD displays current balance', () => {
  render(<HUD/>);
  expect(screen.getByText('$5000')).toBeInTheDocument();
});
```

### E2E Tests

```bash
bun run test:e2e
```

Full user flows with Playwright:

```typescript
test('new game flow', async ({ page }) => {
  await page.goto('/');
  await page.click('button[aria-label="New Game"]');
  // ... verify game starts
});
```

## File Location Guide

**"Where do I put..."**

| What | Where | Docs |
|------|-------|------|
| New system logic | `src/core/systems/NewSystem.ts` | [ARCHITECTURE.md](./ARCHITECTURE.md#core-systems) |
| New entity type | `src/core/types/entities.ts` | [DATA_MODEL.md](./DATA_MODEL.md) |
| New React panel | `src/components/panels/NewPanel.tsx` | [UI.md](./UI.md#modal-panels) |
| New hook | `src/hooks/useNewHook.ts` | [ARCHITECTURE.md](./ARCHITECTURE.md#project-structure) |
| Static data (events, training) | `src/data/` | Individual system docs |
| Tests | `tests/unit/`, `tests/integration/`, `tests/components/` | [ARCHITECTURE.md](./ARCHITECTURE.md#testing-strategy) |
| Styles | Inline Tailwind in components | N/A |

## Quick Reference: System Responsibilities

### EconomySystem
- Manages balance (add/remove money)
- Tracks transactions
- Processes insurance claims
- Handles daily expenses
- **File**: `src/core/systems/EconomySystem.ts`
- **Docs**: [ECONOMY.md](./ECONOMY.md)

### SessionSystem
- Creates and manages sessions
- Calculates session quality
- Handles decision events
- Processes session completion
- **File**: `src/core/systems/SessionSystem.ts`
- **Docs**: [SESSIONS.md](./SESSIONS.md)

### SchedulingSystem
- Books sessions to calendar
- Checks slot availability
- Manages recurring sessions
- Schedules therapist breaks
- **File**: `src/core/systems/SchedulingSystem.ts`
- **Docs**: [SCHEDULING.md](./SCHEDULING.md)

### ReputationSystem
- Tracks reputation (0-500)
- Manages practice levels (1-5)
- Unlocks features at thresholds
- **File**: `src/core/systems/ReputationSystem.ts`
- **Docs**: [REPUTATION.md](./REPUTATION.md)

### TrainingSystem
- Enrolls therapists in programs
- Tracks training progress
- Grants certifications
- Applies skill bonuses
- **File**: `src/core/systems/TrainingSystem.ts`
- **Docs**: [TRAINING.md](./TRAINING.md)

### EventsSystem
- Generates random daily events
- Decision events during sessions
- Applies game modifiers
- **File**: `src/core/systems/EventsSystem.ts`
- **Docs**: [EVENTS.md](./EVENTS.md)

### OfficeSystem
- Manages building upgrades
- Tracks room capacity
- Unlocks telehealth
- **File**: `src/core/systems/OfficeSystem.ts`
- **Docs**: [OFFICE.md](./OFFICE.md)

### InsuranceSystem
- Manages insurance panels
- Processes claims
- Tracks pending payments
- **File**: `src/core/systems/InsuranceSystem.ts`
- **Docs**: [INSURANCE.md](./INSURANCE.md)

## Commands

```bash
# Development
bun run dev              # Start dev server
bun run build            # Build for production
bun run preview          # Preview production build

# Testing
bun test                 # Run all unit tests
bun test:watch          # Watch mode
bun run test:e2e        # Run E2E tests
bun run test:coverage   # Coverage report

# Linting
bun run lint            # Run ESLint
bun run lint:fix        # Fix issues

# Type Checking
bun run typecheck       # Run TypeScript check
```

## Common Patterns

### Dispatching an Action

```typescript
// In a component
const addMoney = gameStore((s) => s.addMoney);
addMoney(500, 'session_payment');
```

### Listening to Events

```typescript
// In a system
EventBus.on('session_completed', (sessionId, quality) => {
  // Respond to event
});
```

### Updating State in Response to Event

```typescript
// System A emits
EventBus.emit('session_completed', sessionId, quality);

// System B listens and updates store
EventBus.on('session_completed', (sessionId, quality) => {
  gameStore.setState(s => ({
    money: s.money + payment,
    // ... other changes
  }));
});
```

### Creating an Entity

```typescript
// Factory function
const client = createClient({
  condition_category: 'anxiety',
  severity: 5,
  // ... other props
});

// Add to store
gameStore.setState(s => ({
  clients: [...s.clients, client]
}));

// Emit event
EventBus.emit('client_arrived', client.id);
```

## Documentation Quick Links

**Start Here**:
- [README.md](./README.md) - Documentation index
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design overview

**Deep Dives**:
- Systems: [SESSIONS.md](./SESSIONS.md), [SCHEDULING.md](./SCHEDULING.md), [ECONOMY.md](./ECONOMY.md), etc.
- Entities: [DATA_MODEL.md](./DATA_MODEL.md)
- UI: [UI.md](./UI.md)

**Implementation Details**:
- Time simulation: [TIME_CALENDAR.md](./TIME_CALENDAR.md)
- Client management: [CLIENTS.md](./CLIENTS.md)
- Therapist management: [THERAPISTS.md](./THERAPISTS.md)

## Key Design Principles

1. **Separation of Concerns** - Game logic (`/core/`) has zero React dependencies
2. **Event-Driven** - Systems communicate via EventBus, not direct calls
3. **Immutable State** - Zustand store is single source of truth
4. **Testable** - Pure functions with dependency injection
5. **Modular** - Each system independent and replaceable
6. **Hybrid Rendering** - DOM for UI, PixiJS for visual polish

## Troubleshooting

**State not updating?**
- Check that action is calling `setState()` or emitting event
- Verify component is subscribed to correct store slice
- Look for missing event listener

**Session not completing?**
- Verify `SessionSystem.completeSession()` is being called
- Check that event is being emitted
- Ensure listeners are registered before event fires

**Balance incorrect?**
- Check all `addMoney()` and `removeMoney()` calls
- Verify daily expenses are being processed
- Look for missing insurance payment processing

**UI not responsive?**
- Ensure store subscription is using selector (not whole state)
- Check that state update is in `setState()` call
- Verify component is re-rendering (check React DevTools)

## Architecture Decision Records

See [ARCHITECTURE.md](./ARCHITECTURE.md#design-decisions) for rationale behind:
- Why Zustand over Redux/Jotai
- Why PixiJS over Phaser
- Why hybrid rendering (DOM + Canvas)
- Why shadcn/ui

## When to Reference Docs

| Question | Reference |
|----------|-----------|
| "How does the entire system work?" | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| "What properties does Therapist have?" | [DATA_MODEL.md](./DATA_MODEL.md) |
| "How do sessions calculate quality?" | [SESSIONS.md](./SESSIONS.md) |
| "How does scheduling work?" | [SCHEDULING.md](./SCHEDULING.md) |
| "What are all the insurance rules?" | [INSURANCE.md](./INSURANCE.md) |
| "When do clients arrive?" | [CLIENTS.md](./CLIENTS.md) |
| "How does time progress?" | [TIME_CALENDAR.md](./TIME_CALENDAR.md) |
| "What UI components exist?" | [UI.md](./UI.md) |

---

**Last Updated**: December 24, 2025
**For questions about this guide**: See README.md or ARCHITECTURE.md
