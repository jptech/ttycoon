# UI System

Complete documentation of all user interface components and interactions.

## HUD (Top Bar)

Always-visible status bar showing critical game information:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Day 42  2:30 PM │ ⏸ ▶ ▶▶ ▶▶▶ │ In Session: Dr. Smith (45%) │ 💰 $12,500 │
└──────────────────────────────────────────────────────────────────────────┘
```

### Components

**Left Section: Time Display**
- Current day number
- Current time (12-hour format with AM/PM)
- Updates each minute

**Center Section: Playback Controls**
- ⏸ Pause (toggle)
- ▶ Play at 1x speed
- ▶▶ Play at 2x speed
- ▶▶▶ Play at 3x speed
- ⏭ Skip to next session

**Center Section: Active Session** (when player therapist in session)
- Shows therapist name and progress percentage
- Progress bar fills as session advances
- Client name on hover
- Only visible when player's therapist has an in_progress session

**Right Section: Resources**
- 💰 Money display with trend indicator (▲/▼)
- ⭐ Reputation score
- ◆ Practice level badge (Lv. 1-5)

```typescript
interface HUD {
  // Time
  day: number;
  hour: number;
  minute: number;
  time_string: string;  // "2:30 PM"

  // Playback
  is_paused: boolean;
  game_speed: 1 | 2 | 3;
  can_skip_to_next_session: boolean;

  // Resources
  money: number;
  money_trend: 'up' | 'down' | 'neutral';
  reputation: number;
  practice_level: number;
  practice_level_name: string;  // "Established"

  // Action buttons
  pause(): void;
  setSpeed(speed: 1 | 2 | 3): void;
  skipToNextSession(): void;
  openMenu(): void;
}
```

## Schedule View

Grid-based calendar showing all sessions:

```
┌────────────────────────────────────────────────────┐
│ Day 42-48 (Week View)          [◀] [▶]            │
├────────────────────────────────────────────────────┤
│       Mon    Tue    Wed    Thu    Fri    Sat  Sun  │
│  8   Dr. S  ----   Dr. S  Dr. S  ----   --  ----  │
│  9   ----   Dr. J  ----   ----   Dr. J  --  ----  │
│ 10   Dr. J  ----   Dr. J  ----   ----   --  ----  │
│ 11   ----   ----   ----   ----   ----   --  ----  │
│ 12   BREAK  Dr. S  ----   Dr. S  BREAK  --  ----  │
│  1   Dr. S  ----   Dr. J  Dr. J  ----   --  ----  │
│  2   ----   Dr. J  ----   ----   Dr. S  --  ----  │
│  3   Dr. J  ----   Dr. S  ----   ----   --  ----  │
│  4   ----   ----   ----   ----   ----   --  ----  │
│  5   Dr. S  Dr. J  Dr. S  Dr. S  Dr. J  --  ----  │
└────────────────────────────────────────────────────┘

Legend:
  Dr. S = Dr. Smith (therapist)
  ---- = Empty slot (available)
  BREAK = Scheduled break
```

### Interactions

```typescript
interface ScheduleView {
  // Display
  start_day: number;
  end_day: number;
  view_type: 'week' | 'day' | '5-day';
  therapists: Therapist[];
  schedule_cells: ScheduleCell[][];

  // Current display
  selected_client?: Client;
  selected_slot?: ScheduleCell;

  // Actions
  navigate_previous(): void;
  navigate_next(): void;
  view_day(day: number): void;
  click_slot(therapist_id: string, day: number, hour: number): void;
  book_session(client: Client, therapist_id: string, day: number, hour: number): void;
}

interface ScheduleCell {
  therapist_id: string;
  day: number;
  hour: number;
  session_id: string | null;
  is_break: boolean;
  is_occupied: boolean;
  availability: 'available' | 'occupied' | 'unavailable';
  status: 'empty' | 'scheduled' | 'in_progress' | 'completed';
  color: string;  // CSS color
  hover_text: string;
}
```

**Color Coding**:
- Green: Completed session
- Blue: In progress session
- Gray: Scheduled session
- Light Gray: Available slot
- Red: Conflict/unavailable
- Orange: Break

**Session Type Indicators**:
- Virtual sessions: Blue border-left + Video icon
- In-person sessions: Amber border-left + Building icon

The ScheduleView includes a legend showing the session type colors and a breakdown badge (e.g., "3 virtual, 2 in-office").

### Clicking a Slot

```typescript
function onSlotClick(cell: ScheduleCell) {
  // If empty slot and client selected
  if (!cell.session_id && selected_client) {
    showBookSessionConfirm(selected_client, cell.therapist_id, cell.day, cell.hour);
    return;
  }

  // If session, show details
  if (cell.session_id) {
    showSessionDetails(cell.session_id);
    return;
  }

  // If unavailable, explain why
  if (!cell.is_available) {
    showToast(`Unavailable: ${cell.hover_text}`);
    return;
  }
}
```

## Booking Dashboard

Unified split-view for scheduling sessions with waiting and active clients:

```
+------------------+----------------------------------------+
| Waiting Clients  |  Scheduling Area                       |
| (1/3 width)      |  (2/3 width)                          |
|                  |                                        |
| [Client Card]    |  When no client selected:             |
| [Client Card] <- |    "Select a client to begin"         |
| [Client Card]    |                                        |
|                  |  When client selected:                |
| Filters:         |    - Client Preference Summary        |
| [Waiting|Active] |    - Best Matching Therapists         |
|                  |    - Available Slots (grouped)        |
+------------------+----------------------------------------+
```

### Sub-Components

**ClientPreferenceSummary** - Shows selected client's preferences:
- Name, condition, session progress
- Virtual/in-person preference badge
- Time preference (morning/afternoon/evening)
- Frequency (weekly/biweekly/monthly)
- Certification requirements (if any)

**TherapistMatchList** - Therapists sorted by compatibility:
- Uses `ClientManager.calculateMatchScore()` for ranking
- Shows match percentage with color coding (green 70%+, yellow 50-70%, red <50%)
- Filters out therapists missing required certifications
- Highlights specialization matches

**MatchingSlotsList** - Available slots for selected therapist:
- Groups slots by day, then by time period (Morning/Afternoon/Evening)
- Highlights preferred slots (matching client availability + time preference)
- Shows next 5-7 days of availability
- Visual selection state with ring highlight
- Duration selector (50/80/180 min)
- Virtual toggle

### Booking Feedback

The dashboard provides immediate feedback on booking attempts:

```typescript
interface BookingFeedback {
  type: 'success' | 'error'
  message: string
  timestamp: number
}

// Success: "Session booked! Client AB with Dr. Smith on Day 5 at 10 AM"
// Error: "Slot already booked", "Client has conflicting session", etc.
```

Feedback is displayed prominently below the confirm button and auto-clears after 5 seconds.

## Modal Panels

Standardized dialog windows for all major functions:

### Unified Modal Structure

```
┌─────────────────────────────────────────┐
│ 📋 PANEL TITLE                      ✕   │
├─────────────────────────────────────────┤
│                                         │
│    Content area...                      │
│                                         │
├─────────────────────────────────────────┤
│                           [Cancel] [OK] │
└─────────────────────────────────────────┘
```

### Hiring Panel

Browse and hire therapists:

```typescript
interface HiringPanel {
  candidates: HiringCandidate[];

  // Candidate info
  selected_candidate?: HiringCandidate;
  display_info: {
    name: string;
    base_skill: number;
    specializations: string[];
    certifications: string[];
    salary_request: number;
    personality: { warmth, analytical, creativity };
  };

  // Actions
  hire_button: {
    enabled: boolean;
    disabled_reason?: string;
  };
  refresh_button: {
    label: 'Refresh candidates',
    cooldown_days: number;
  };

  // Metrics
  current_staff: number;
  staff_cap: number;
  hiring_cost: number;
}

// Hiring flow
function hireTherapist(candidate: HiringCandidate) {
  if (therapists.length >= staffCap) {
    showError('Staff cap reached');
    return;
  }

  if (!economy.can_afford(candidate.salary * 40)) {
    showError('Cannot afford hiring cost');
    return;
  }

  // Execute hire
  economy.removeMoney(candidate.salary * 40);
  therapists.push(candidate);

  showNotification(`Hired ${candidate.name}!`);
  closePanel();
}
```

### Training Panel

Enroll therapists in development programs:

```typescript
interface TrainingPanel {
  selected_therapist?: Therapist;
  available_programs: TrainingProgram[];
  active_trainings: TrainingInstance[];

  // Filters
  filters: {
    track: 'all' | 'clinical' | 'business';
    show_completed: boolean;
    show_unaffordable: boolean;
  };

  // Program details
  selected_program?: TrainingProgram;
  program_details: {
    name: string;
    description: string;
    duration_hours: number;
    cost: number;
    track: string;
    grants_certification?: string;
    skill_bonus: number;
    prerequisites: string[];
  };

  // Eligibility
  can_enroll: boolean;
  eligibility_failures: string[];

  // Actions
  enroll_button: { enabled: boolean };
  cancel_training_button: { enabled: boolean };
}
```

### Budget Panel

View finances and transactions:

```typescript
interface BudgetPanel {
  // Current status
  current_balance: number;
  balance_trend: 'positive' | 'negative' | 'neutral';
  days_until_negative: number | null;

  // Today's activity
  today_income: Transaction[];
  today_expenses: Transaction[];
  today_net: number;

  // Pending
  pending_payments: InsurancePayment[];
  pending_total: number;
  expected_revenue: number;

  // Historical
  last_7_days_net: number;
  last_30_days_net: number;
  avg_daily_income: number;
  avg_daily_expense: number;

  // Charts (optional)
  daily_trend: number[];  // Last 30 days
  income_by_source: { source: string; amount: number }[];
}
```

### Client Management Panel

View and manage clients:

```typescript
interface ClientManagementPanel {
  // Lists
  waiting_list: {
    count: number;
    clients: ClientSummary[];
    sort_by: 'arrival' | 'days_waiting' | 'engagement';
  };

  active_clients: {
    count: number;
    clients: ClientSummary[];
    sort_by: 'progress' | 'satisfaction' | 'therapist';
  };

  completed_clients: {
    count: number;
    total_cured: number;
    cure_rate: number;
  };

  // Filters
  filters: {
    condition?: string;
    severity_range?: [min: number, max: number];
    insurance_only?: boolean;
    therapy_type?: string;
  };

  // Stats
  stats: {
    total_clients: number;
    active_clients: number;
    avg_satisfaction: number;
    cure_rate: number;
    avg_sessions_to_cure: number;
  };

  // Actions
  book_session_for_selected(): void;
  view_details(client: Client): void;
  drop_client(client: Client): void;
}

interface ClientSummary {
  name: string;
  condition: string;
  severity: number;
  status: string;
  progress?: number;
  satisfaction?: number;
  days_waiting?: number;
  assigned_therapist?: Therapist;
  next_session?: Session;
}
```

### Client Details Panel

Detailed view of individual client:

```typescript
interface ClientDetailsPanel {
  client: Client;

  // Profile
  profile: {
    display_name: string;
    condition_category: string;
    condition_type: string;
    severity: number;
    status: string;
  };

  // Treatment progress
  progress: {
    sessions_completed: number;
    sessions_required: number;
    treatment_progress: number;  // 0.0-1.0
    progress_bar: number;
    estimated_completion_date: number | null;
  };

  // Satisfaction & engagement
  metrics: {
    satisfaction: number;
    engagement: number;
    therapist_match_score: number;
  };

  // Therapy details
  therapy_info: {
    assigned_therapist: Therapist;
    insurance?: string;
    is_virtual: boolean;
    preferred_frequency: string;
    preferred_time: string;
  };

  // Session history
  sessions: {
    count: number;
    list: SessionSummary[];
    next_session?: Session;
  };

  // Actions
  book_next_session(): void;
  change_therapist(): void;
  view_session_details(session: Session): void;
  drop_client(): void;
}
```

### Notifications (Toast System)

Transient messages for events:

```typescript
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration: number;  // milliseconds (0 = permanent)
  icon?: string;
  action?: { label: string; callback: () => void };
}

// Examples:
showToast({
  type: 'success',
  message: 'Session completed! +5 reputation',
  duration: 4000
});

showToast({
  type: 'error',
  title: 'Insufficient funds',
  message: 'Cannot afford therapist salary',
  action: { label: 'View budget', callback: () => openBudgetPanel() }
});

showToast({
  type: 'info',
  message: 'Client cured! +5 reputation',
  duration: 5000,
  icon: '🎉'
});
```

## Session Panel

Displays during active sessions:

```
┌──────────────────────────────┐
│ Session In Progress          │
├──────────────────────────────┤
│ Therapist: Dr. Smith         │
│ Client: Client AB            │
│ Session Type: Clinical       │
│                              │
│ Quality: Good ⭐⭐⭐⭐⭐     │
│ Progress: ████████░░ 82%     │
│                              │
│ Energy: Dr. Smith: 45/100    │
│                              │
│ [Cancel Session]             │
└──────────────────────────────┘
```

## Decision Event Modal

Popup during sessions:

```
┌────────────────────────────────────┐
│ ⚡ Emotional Breakthrough           │
├────────────────────────────────────┤
│ Your client has a profound         │
│ realization. What do you do?       │
│                                    │
│ [A] Process deeply and explore     │
│     (+Quality, -Energy)            │
│                                    │
│ [B] Integrate gently               │
│     (Neutral, -Energy)             │
│                                    │
│ [ ] Remember this choice           │
└────────────────────────────────────┘
```

## Random Event Modal

```
┌────────────────────────────────────┐
│ 📰 Referral Surge                   │
├────────────────────────────────────┤
│ A local therapist refers several   │
│ clients to your practice!          │
│                                    │
│ [A] Accept all referrals           │
│     (+3 clients, +2 rep)           │
│                                    │
│ [B] Accept some, politely decline  │
│     (+1 client, +1 rep)            │
│                                    │
│ [C] Pass on this opportunity       │
│     (neutral)                      │
└────────────────────────────────────┘
```

## Layout Structure

```
┌──────────────────────────────────────────────────────┐
│                   HUD (Top Bar)                      │
├──────────────────────────────────────────────────────┤
│   ┌────────────────────┬──────────────────────────┐  │
│   │                    │                          │  │
│   │  Schedule Grid     │   Side Panel             │  │
│   │  (Main Content)    │   (Context Info)         │  │
│   │                    │                          │  │
│   └────────────────────┴──────────────────────────┘  │
│                                                       │
│   [Modals overlay when open]                         │
│   [Notifications toast at bottom right]              │
└──────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

```
Space       - Toggle pause
1, 2, 3     - Set speed (1x, 2x, 3x)
S           - Skip to next session
H           - Open hiring panel
T           - Open training panel
C           - Open client management
B           - Open budget panel
G           - Open game menu
Esc         - Close current panel
Left/Right  - Navigate week in schedule
```

## Accessibility

- Keyboard navigation throughout UI
- Color contrast WCAG AA compliant
- Descriptive tooltips on hover
- Screen reader support (aria labels)
- Adjustable font sizes

## Testing Strategy

```typescript
test('HUD updates when money changes', () => {
  const listener = vi.fn();
  render(<HUD/>);

  economySystem.addMoney(500);

  expect(screen.getByText('💰 $5,500')).toBeInTheDocument();
});

test('schedule grid shows all therapists and time slots', () => {
  const therapists = [therapist1, therapist2, therapist3];
  render(<ScheduleGrid therapists={therapists} day={1}/>);

  for (const t of therapists) {
    expect(screen.getByText(t.display_name)).toBeInTheDocument();
  }
});

test('modal closes when close button clicked', () => {
  render(<HiringPanel/>);
  const closeBtn = screen.getByRole('button', { name: /close/i });

  fireEvent.click(closeBtn);

  expect(screen.queryByText('Hiring Panel')).not.toBeInTheDocument();
});

test('toast notification displays and auto-dismisses', async () => {
  render(<GameApp/>);

  showToast({ message: 'Test message', duration: 100 });

  expect(screen.getByText('Test message')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  }, { timeout: 200 });
});
```

## Theme & Styling

```typescript
const theme = {
  colors: {
    primary: '#2ecc71',    // Green (cozy feel)
    secondary: '#3498db',  // Blue
    danger: '#e74c3c',     // Red
    warning: '#f39c12',    // Orange
    success: '#27ae60',    // Dark green
    text: '#2c3e50',       // Dark text
    bg: '#ecf0f1',         // Light background
    border: '#bdc3c7'      // Medium gray
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  fonts: {
    body: 'system-ui, sans-serif',
    mono: 'monospace'
  }
};
```
