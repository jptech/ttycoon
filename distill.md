# Therapy Practice Management Game - Design Document

> A comprehensive game design document for implementing a therapy private practice management/tycoon game.

---

## Executive Summary

A cozy management game where players build and operate a therapy private practice. Starting as a solo practitioner, players hire therapists, schedule clients, manage finances, handle in-session decisions, and expand through training, reputation growth, and office upgrades.

**Core Fantasy**: Build a thriving therapy practice from the ground up, making meaningful decisions about client care while managing the business side of mental health services.

**Genre**: Management/Tycoon (cozy, low-stress)

**Platform**: Desktop (Godot 4.x recommended, but adaptable)

---

## 1. Core Gameplay Loop

```
┌─────────────────────────────────────────────────────────────┐
│                      START OF DAY                           │
│  • New clients may arrive (based on reputation)             │
│  • Random events may trigger (30% daily chance)             │
│  • Therapists start with refreshed energy                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS HOURS (8 AM - 5 PM)              │
│  • Player manages schedule (books clients into slots)       │
│  • Sessions run in real-time with progress bars             │
│  • Decision events trigger during sessions                  │
│  • Therapists gain/lose energy based on workload            │
│  • Money flows in from completed sessions                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       END OF DAY                            │
│  • Operating costs deducted (salaries, rent)                │
│  • Training progress updated                                │
│  • Client treatment progress saved                          │
│  • Daily financial summary shown                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                         NEXT DAY
```

### Player Goals (Implicit)

1. **Survive**: Maintain positive cash flow
2. **Grow**: Expand from solo to multi-therapist practice (1→5+ staff)
3. **Develop**: Train therapists, unlock specializations and certifications
4. **Thrive**: Reach highest practice level with maximum reputation
5. **Optimize**: Build sustainable, profitable operations

---

## 2. Time & Calendar System

### Time Units

- **Business Day**: 10 hours (8 AM - 5 PM)
- **Session Duration**: 50 minutes (standard), 80 minutes (extended), 180 minutes (intensive)
- **Game Progression**: Day-based (no real-world time limits)

### Speed Controls

| Speed | Label | Description |
|-------|-------|-------------|
| 1x | Normal | Base simulation speed |
| 2x | Fast | Double speed |
| 3x | Faster | Triple speed |
| Pause | Stopped | Game pauses (for decision events, menus) |

### Skip Functionality

- "Skip to next session" button advances time to next scheduled session
- Cannot skip while sessions are in progress
- Validates that upcoming session is actually startable (therapist available, not on break)

---

## 3. Primary Resources

### 3.1 Money (Cash Flow)

| Aspect | Details |
|--------|---------|
| **Starting Balance** | $5,000 |
| **Display** | Always visible in HUD with trend indicator (▲/▼) |

**Income Sources**:
- Clinical sessions: $100-200 per session (quality-dependent)
- Insurance reimbursements: $80-120 per session (3-8 day delay)
- Random event bonuses: Variable

**Expenses**:
- Therapist salaries: $50/hour (end of day)
- Building rent: Daily prorated (monthly rent ÷ 30)
- Training enrollment: $500-5,000 per course
- Hiring cost: 1 week salary upfront
- Insurance panel applications: $0-75

### 3.2 Reputation (0-500)

| Aspect | Details |
|--------|---------|
| **Starting Value** | 20 |
| **Range** | 0-500 (clamped) |
| **Purpose** | Unlocks features, affects client arrival rate, hiring quality |

**Reputation Gains**:
- Excellent session: +2 to +5
- Good session: +1
- Client cured: +5
- Training completed: +1
- Certification bonus: +1 per 5 clinic certifications (daily passive)

**Reputation Losses**:
- Poor/very poor session: -2 to -5
- Client drops out: -3
- Cancelled session: -1 to -2

### 3.3 Practice Level (1-5)

| Level | Name | Rep Required | Staff Cap | Key Unlocks |
|-------|------|--------------|-----------|-------------|
| 1 | Starting Practice | 0 | 1 | Base gameplay (solo only) |
| 2 | Established | 50 | 2-5 | Hiring + Training |
| 3 | Growing | 125 | 3-5 | Better hiring pool |
| 4 | Respected | 250 | 4-5 | Large office access |
| 5 | Premier | 400 | 5+ | All features unlocked |

---

## 4. Entity Types

### 4.1 Therapist

The player's first therapist represents themselves. Additional therapists are hired.

#### Core Properties

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| display_name | String | - | Therapist's name |
| is_player | Boolean | - | True for player's therapist (cannot be fired) |
| energy | Integer | 0-100 | Current energy (affects session quality) |
| max_energy | Integer | 50-150 | Individual capacity |
| hourly_salary | Integer | 0-500 | Cost per hour (0 for player) |
| base_skill | Integer | 1-100 | Core therapy competency |
| level | Integer | 1-50 | Experience level |
| certifications | Array | - | Earned qualifications |
| specializations | Array | - | Population expertise |
| is_available | Boolean | - | Can take sessions |
| is_burned_out | Boolean | - | Needs recovery |

#### Personality Traits (Optional, for matching)

| Trait | Range | Description |
|-------|-------|-------------|
| warmth | 1-10 | Rapport building ability |
| analytical | 1-10 | Structured approach |
| creativity | 1-10 | Art/play therapy skill |

#### Energy System

- **Drain**: Sessions consume 5-25 energy (based on client severity)
- **Recovery**:
  - Scheduled breaks: 8+ energy per hour
  - Passive recovery: 3 energy/hour when idle during business hours
  - Overnight rest: Full restoration
- **Burnout**: At 0 energy, therapist unavailable until 50%+ recovered

#### Certifications (Examples)

- `trauma_certified`: Treat trauma clients
- `couples_certified`: Treat couples
- `supervisor_certified`: Conduct supervision sessions
- `telehealth_certified`: Virtual sessions
- `children_certified`: Treat minors
- `substance_certified`: Addiction treatment

#### Specializations (Examples)

- children, couples, trauma, PTSD
- anxiety_disorders, depression, grief
- eating_disorders, OCD, personality_disorders

### 4.2 Client

Clients arrive seeking therapy and must be scheduled with compatible therapists.

#### Core Properties

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| display_name | String | - | Abstracted name (e.g., "Client AB") |
| condition_category | String | - | anxiety, depression, trauma, stress, relationship, behavioral |
| condition_type | String | - | Specific diagnosis |
| severity | Integer | 1-10 | Treatment difficulty |
| sessions_required | Integer | 4-20 | Total sessions for cure |
| sessions_completed | Integer | 0-N | Progress toward cure |
| treatment_progress | Float | 0.0-1.0 | Completion percentage |
| status | String | - | waiting, in_treatment, completed, dropped |
| satisfaction | Integer | 0-100 | Happiness with therapy |
| engagement | Integer | 0-100 | Likelihood to continue |

#### Financial Properties

| Property | Type | Description |
|----------|------|-------------|
| insurance_provider | String | Insurer name (if applicable) |
| is_private_pay | Boolean | No insurance |
| insurance_rate | Integer | Reimbursement per session ($80-150) |

#### Scheduling Properties

| Property | Type | Description |
|----------|------|-------------|
| prefers_virtual | Boolean | Telehealth preference |
| preferred_frequency | String | once, weekly, biweekly, monthly |
| preferred_time | String | morning, afternoon, evening, any |
| availability | Dictionary | Day → [hours available] |
| required_certification | String | Certification needed to treat |
| is_minor | Boolean | Child/adolescent (needs children certification) |
| is_couple | Boolean | Couples therapy (needs couples certification) |

#### Waiting Properties

| Property | Type | Description |
|----------|------|-------------|
| arrival_day | Integer | Day client first arrived |
| days_waiting | Integer | Time before first session |
| max_wait_days | Integer | Tolerance (3-14 days, varies by reputation) |

#### Client Lifecycle

```
ARRIVE → WAITING → IN TREATMENT → CURED/DROPPED
              ↓
    (max_wait exceeded → DROP OUT)
```

- **Waiting List Decay**: Engagement decreases 3-5 points daily
- **Treatment Progress**: Each session adds (1/sessions_required) × quality_modifier
- **Completion**: When progress ≥ 1.0 or sessions_completed ≥ sessions_required
- **Drop Out**: Low engagement, dissatisfaction, or exceeded wait time

### 4.3 Session

Sessions are the core gameplay unit where therapy happens.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| therapist_id | String | Assigned therapist |
| client_id | String | Client being served |
| session_type | String | clinical or supervision |
| is_virtual | Boolean | Telehealth session |
| is_insurance | Boolean | Insurance-paid |
| scheduled_day | Integer | Day number |
| scheduled_hour | Integer | Start hour (8-17) |
| duration_minutes | Integer | 50 (standard), 80, 180 |
| status | String | scheduled, in_progress, completed, cancelled, conflict |
| progress | Float | 0.0-1.0 completion |
| quality | Float | 0.0-1.0 outcome score |
| payment | Integer | Earned amount |
| energy_cost | Integer | Therapist energy consumed |

#### Session Types

**Clinical Session**:
- 1 therapist, 1 client
- Standard 50 minutes
- Energy cost: 5-25 (severity-based)
- Payment: $100-200

**Supervision Session**:
- 1 supervisor + 1-4 supervisees
- Standard 50 minutes
- Energy: 10 supervisor, 5 per supervisee
- No payment (internal development)
- High XP gain (40 for supervisees, 15+5n for supervisor)

---

## 5. Core Systems

### 5.1 Economy System

Manages all financial transactions and cash flow.

#### Key Operations

```
add_money(amount, reason)      # Income
remove_money(amount, reason)   # Expense (returns success bool)
can_afford(amount)             # Pre-check
process_daily_expenses()       # End-of-day deductions
```

#### Insurance Payment Flow

1. Session completes with insured client
2. Roll for denial (5-15% based on insurer)
3. If approved: schedule payment with insurer-specific delay
4. If denied: emit notification, no payment

**Insurer Delays**:
| Insurer | Delay | Denial Rate |
|---------|-------|-------------|
| Aetna | 3 days | 8% |
| BlueCross | 4 days | 5% |
| Cigna | 4 days | 6% |
| United | 6 days | 12% |
| Medicaid | 8 days | 15% |

### 5.2 Session System

Manages therapy sessions from scheduling through completion.

#### Session Lifecycle

1. **Scheduled**: Booked for future time
2. **In Progress**: Running (game time matches scheduled time)
3. **Completed**: Progress reached 100%, outcomes calculated
4. **Cancelled**: Manually cancelled before start

#### Quality Calculation

```
Base Quality = therapist.base_skill / 100

Modifiers:
  + Therapist-Client Match (0.0 to +0.4)
  + Decision Event Choices (±0.1 to ±0.3 per choice)
  - Low Energy Penalty (up to -0.3)

Final Quality = clamp(0.0, 1.0)
```

**Quality Tiers**:
| Range | Tier | Reputation Impact | Payment Multiplier |
|-------|------|-------------------|-------------------|
| 0.8+ | Excellent | +2 to +5 | 1.0x |
| 0.6-0.8 | Good | +1 | 0.9x |
| 0.4-0.6 | Fair | 0 | 0.7x |
| 0.2-0.4 | Poor | -2 | 0.5x |
| 0.0-0.2 | Very Poor | -3 to -5 | 0.3x |

#### Decision Events

Random scenarios during sessions requiring player choice:

```
Session Running
    ↓
Random roll (1.5% base, scales with game speed)
    ↓
Event Triggered → Show popup with 2-4 choices
    ↓
Player chooses → Apply effects (quality ±, energy ±)
    ↓
Continue session
```

**Event Structure**:
```json
{
  "id": "client_resistant",
  "title": "Client Resistance",
  "description": "Your client seems reluctant to engage today...",
  "choices": [
    {
      "text": "Gently explore the resistance",
      "effects": { "quality": +0.1, "energy": -5 }
    },
    {
      "text": "Push through with the planned approach",
      "effects": { "quality": -0.1, "energy": 0 }
    }
  ]
}
```

**Auto-Resolution**: If enabled, remembered choices are applied automatically without pausing.

### 5.3 Scheduling System

Manages the practice calendar and session booking.

#### Schedule Structure

```
schedule[day][hour][therapist_id] = session_id
```

#### Slot Availability Checks

A slot is available if:
1. No existing session at that time for therapist
2. No scheduled break
3. Therapist not in offline training
4. Therapist not burned out
5. Client not already booked at that time
6. Client availability includes that day/hour
7. Room available (for in-person) or telehealth unlocked (for virtual)

#### Smart Scheduling

Score-based slot recommendation:

```
Base Score: 1.0

Modifiers:
  + Time Match: +0.5 (if matches client preference)
  + Therapist Match: +0.0 to +1.0 (specialization fit)
  - Workload Penalty: -0.8 (5 sessions/day), -2.0 (6+ sessions/day)
  - Back-to-Back Penalty: -0.6 to -1.2 (based on therapist energy)
  + Proximity Bonus: +0.0 to +1.0 (prefer earlier available days)
```

#### Recurring Sessions

Book multiple sessions at regular intervals:
- Frequencies: weekly, biweekly, monthly
- Skip conflicts by default
- Returns: { sessions: [...], skipped: [...] }

#### Break Management

- Schedule breaks in advance or start immediately
- Energy recovery: 8+ per hour
- Blocks session booking for that hour
- Break ends automatically, therapist becomes available

### 5.4 Reputation System

Tracks practice reputation and progression through levels.

#### Level Progression

When reputation crosses threshold:
1. Update practice_level
2. Update staff cap
3. Emit level_changed signal
4. Show unlock notifications

#### Clinic Certification Score

- Sum of all certifications across all therapists
- Every 5 certifications → +1 reputation daily (passive bonus)
- Rewards building diverse expertise

### 5.5 Training System

Manages therapist development and certification programs.

#### Training Tracks

**Clinical Track (Offline)**:
- Therapist unavailable for sessions during training
- Grants certifications and skill increases
- Duration: 5-100 hours
- Cost: $500-5,000

**Business Track (Night School)**:
- Therapist remains available for sessions
- Grants clinic-wide bonuses
- Duration: 5-20 hours
- Cost: $500-2,000

#### Training Catalog (Examples)

| Program | Track | Cost | Duration | Prerequisites | Grants |
|---------|-------|------|----------|---------------|--------|
| CBT Fundamentals | Clinical | $500 | 8 hrs | None | +10 skill |
| Trauma-Informed Care | Clinical | $1,000 | 16 hrs | Skill 40+ | +15 skill, trauma_certified |
| EMDR Certification | Clinical | $2,000 | 40 hrs | Skill 60+ | +20 skill, emdr_certified |
| Clinical Supervision | Clinical | $3,000 | 60 hrs | Skill 80+ | +25 skill, supervisor_certified |
| Marketing Essentials | Business | $500 | 8 hrs | None | +1 hiring_capacity |
| Insurance Negotiation | Business | $1,000 | 12 hrs | None | +0.1 insurance_multiplier |

#### Training Completion

On completion:
1. Restore therapist availability (if offline)
2. Add certification to therapist
3. Apply skill bonuses
4. Apply clinic bonuses (if business track)
5. Add +1 reputation

### 5.6 Random Events System

Injects narrative variety through scripted events with player choices.

#### Event Triggering

- 30% chance per day (not on Day 1)
- Each event type has cooldown (3-14 days)
- Events can have conditions (min reputation, min therapists, etc.)

#### Event Structure

```json
{
  "id": "therapist_sick",
  "title": "Staff Illness",
  "description": "One of your therapists has called in sick...",
  "type": "negative",
  "conditions": {
    "min_therapists": 2
  },
  "choices": [
    {
      "text": "Cover their sessions yourself",
      "effects": {
        "player_energy": -20,
        "reputation": +2
      }
    },
    {
      "text": "Cancel their sessions for today",
      "effects": {
        "cancel_therapist_sessions": true,
        "reputation": -3
      }
    }
  ]
}
```

#### Event Categories

**Daily Pool** (common):
- Referral call, scheduling conflict, positive review, difficult session

**Weekly Pool** (moderate):
- Insurance audit, networking opportunity, staff issue

**Monthly Pool** (rare):
- Grant opportunity, expansion offer, award nomination

**Special Events** (milestone-triggered):
- First hire, first cure, level up, practice anniversary

#### Modifiers

Temporary gameplay effects:
- `busy_week`: +20% client arrivals (7 days)
- `reputation_boost`: +50% reputation gains (5 days)
- `economic_downturn`: -20% session fees (14 days)

### 5.7 Office System

Manages physical practice infrastructure.

#### Buildings

| Tier | Name | Rooms | Monthly Rent | Upgrade Cost | Required Level |
|------|------|-------|--------------|--------------|----------------|
| 1 | Starter Suite | 1 | $50 | $0 (default) | 1 |
| 2 | Small Clinic | 3 | $250 | $2,500 | 2+ |
| 3 | Professional Center | 8 | $1,000 | $15,000 | 4+ |

#### Room Capacity

- Each in-person session requires 1 room
- Virtual sessions don't consume rooms
- If rooms full: only virtual sessions can be booked

#### Telehealth

- One-time unlock: $500-1,000
- Enables virtual sessions (no room required)
- Some clients prefer virtual (bonus satisfaction)

### 5.8 Insurance System

Manages insurance panel membership and claims.

#### Panels

| Panel | Reimbursement | Delay | Denial Rate | App Fee |
|-------|--------------|-------|-------------|---------|
| Aetna | $100 | 3 days | 8% | $50 |
| BlueCross | $120 | 4 days | 5% | $75 |
| Cigna | $95 | 4 days | 6% | $50 |
| United | $110 | 6 days | 12% | $50 |
| Medicaid | $80 | 8 days | 15% | $0 |

#### Panel Application

1. Check reputation meets minimum
2. Deduct application fee
3. Roll for acceptance (70-95%)
4. If accepted: panel becomes active

#### Insurance Multiplier

- Default: 1.0x
- Increased via business training
- Capped at 1.5x
- Applied to all insurance payments

---

## 6. User Interface

### 6.1 HUD (Top Bar)

```
┌────────────────────────────────────────────────────────────┐
│ Day 42  2:30 PM  │  ⏸ ▶ ▶▶ ▶▶▶ ⏭  │  💰 $12,500 ▲  ⭐ 145 │
└────────────────────────────────────────────────────────────┘
```

**Left**: Current day, time
**Center**: Pause, Play, Speed 1x/2x/3x, Skip to next session
**Right**: Balance with trend, Reputation badge, Practice level, Help, Menu

### 6.2 Schedule View

**Grid Layout**:
- Y-axis: Time slots (8 AM - 5 PM)
- X-axis: Therapist columns
- Cells: Sessions (color-coded by status) or empty slots

**Color Coding**:
- Green: Completed
- Blue: In Progress
- Gray: Scheduled
- Red: Conflict

**Interactions**:
- Click empty slot → Book session (if client selected)
- Click session → View details
- Navigation arrows → Previous/next day

### 6.3 Session Panel

Displayed during active sessions:

```
┌─────────────────────────────────┐
│ Session In Progress             │
├─────────────────────────────────┤
│ Therapist: Dr. Smith            │
│ Client: Client AB               │
│ ████████████░░░░░░ 65%          │
│ Quality: Good                   │
└─────────────────────────────────┘
```

### 6.4 Modal Panels

All modal dialogs share standardized design:

**Header Structure**:
```
┌─────────────────────────────────┐
│ 📋 PANEL TITLE            ✕     │
├─────────────────────────────────┤
│                                 │
│    Content area...              │
│                                 │
└─────────────────────────────────┘
```

**Standard Panels**:

1. **Hiring Panel** 👤 - Browse and hire therapists
2. **Training Panel** 📚 - Enroll in training courses
3. **Budget Panel** 💰 - View finances, transactions, pending insurance
4. **Progression Panel** 📈 - Practice level and milestones
5. **Reputation Panel** ⭐ - Reputation details and reviews
6. **Client Management** 📋 - Client list, filtering, actions
7. **Client Details** 👥 - Individual client profile
8. **Scheduling Panel** 🗓 - Advanced booking, recurring sessions
9. **Office Panel** 🏢 - Building upgrades, telehealth
10. **Settings Panel** ⚙️ - Game options
11. **Help Overlay** ❓ - How to play

### 6.5 Notifications

Toast-style notifications for events:
- Session completed (quality tier)
- Client cured
- Insurance claim denied
- Training completed
- Random event triggered
- Level up achieved

---

## 7. Progression & Balance

### 7.1 Early Game (Days 1-14)

**New Practice Bonus**:
- Extra client arrivals (Days 1-7)
- Patient clients with long max_wait_days
- Starting resources: $5,000, 20 reputation, 1 therapist

**Focus**: Learn mechanics, build initial caseload, maintain cash flow

### 7.2 Early Expansion (Days 15-50)

**Goals**:
- Reach Level 2 (50 reputation)
- Hire first additional therapist
- Begin training programs
- Build specialization foundation

### 7.3 Growth Phase (Days 51-200)

**Goals**:
- Reach Level 3-4
- Expand to larger office
- Build diverse staff (3-5 therapists)
- Implement supervision
- Establish insurance panels

### 7.4 Mature Practice (Days 200+)

**Goals**:
- Reach Level 5
- Professional Center with telehealth
- High clinic certification score
- Sustainable high-profit operations
- Optimization and experimentation

### 7.5 Balance Principles

- **No Hard Fail State**: Can always recover (unless truly bankrupt)
- **Early Generosity**: Forgiving early game to learn mechanics
- **Mid-Game Challenge**: Multiple competing priorities
- **Late-Game Complexity**: Optimization and mastery

---

## 8. Save/Load System

### 8.1 Save Structure

```json
{
  "save_version": 2,
  "game_manager": {
    "practice_name": "My Practice",
    "current_day": 42,
    "current_hour": 14,
    "current_minute": 30,
    "game_speed": 1.0,
    "auto_sessions": true,
    "remembered_decisions": {}
  },
  "economy": {
    "balance": 12500,
    "pending_payments": [],
    "insurance_multiplier": 1.1
  },
  "reputation": {
    "reputation": 145,
    "practice_level": 3
  },
  "therapists": [],
  "clients": [],
  "sessions": {
    "active": [],
    "history": []
  },
  "scheduling": {
    "schedule": {},
    "waiting_list": []
  },
  "training": {
    "active_trainings": {}
  },
  "office": {
    "current_building": "small_clinic",
    "telehealth_unlocked": true
  },
  "insurance": {
    "active_panels": []
  }
}
```

### 8.2 Versioning

- Include version number in save file
- Implement migration for schema changes
- Apply sensible defaults for new fields

### 8.3 History Retention

- Keep 14 days of session history
- Cache therapist/client names at session creation
- Prune old sessions on day start

---

## 9. Special Mechanics

### 9.1 Solo Practice Lock

- Cannot hire until Level 2 (50 reputation)
- Forces focus on single-therapist optimization initially

### 9.2 Staff Cap System

- Base cap per practice level
- Can be increased via business training
- Example: Level 2 (cap 2) + training bonus = 3 staff allowed

### 9.3 Client Waiting & Churn

- Clients drop out if max_wait_days exceeded
- Waiting clients lose engagement daily
- High reputation = impatient clients (shorter wait tolerance)

### 9.4 Supervision Benefits

- Much higher XP for supervisees (40 vs 10-30)
- Lower energy cost (10 supervisor, 5 per supervisee)
- Clinic-wide reputation benefits
- Requires supervisor_certified certification

### 9.5 Insurance Claim Denials

- Random roll per claim (5-15%)
- Denied claims = lost payment
- No resubmission mechanism
- Encourages diversifying revenue

---

## 10. Technical Architecture (Recommended)

### 10.1 Signal-Based Communication

Systems communicate via central event bus, not direct references:

```
EventBus.session_completed.emit(session_id, outcome)
EventBus.reputation_changed.emit(old_value, new_value)
EventBus.client_arrived.emit(client_id)
```

### 10.2 Core Signals

**Time**:
- `day_started(day_num)`
- `hour_changed(hour, is_initial)`
- `minute_changed(minute)`

**Sessions**:
- `session_scheduled(session_id)`
- `session_started(session_id)`
- `session_completed(session_id, quality)`
- `session_cancelled(session_id)`

**Clients**:
- `client_arrived(client_id)`
- `client_scheduled(client_id, session_id)`
- `client_cured(client_id)`
- `client_dropped(client_id, reason)`

**Economy**:
- `money_changed(old_balance, new_balance, reason)`
- `insurance_claim_scheduled(amount, insurer, day)`
- `insurance_claim_denied(amount, insurer)`

**Reputation**:
- `reputation_changed(old_value, new_value)`
- `practice_level_changed(old_level, new_level)`

**Training**:
- `training_started(therapist_id, program_id)`
- `training_completed(therapist_id, program_id)`

**Events**:
- `random_event_triggered(event_id)`
- `decision_event_triggered(session_id, event_id)`

### 10.3 System Organization

```
game/
├── autoloads/
│   ├── event_bus        # Central signal hub
│   ├── game_manager     # Time, state, save/load
│   └── preloader        # Script preloading
├── data/
│   ├── therapist_data
│   ├── client_data
│   ├── session_data
│   └── training_data
├── systems/
│   ├── economy_system
│   ├── session_system
│   ├── scheduling_system
│   ├── reputation_system
│   ├── training_system
│   ├── office_system
│   ├── insurance_system
│   └── events_system
├── ui/
│   ├── hud
│   ├── schedule_view
│   ├── session_panel
│   └── panels/
└── main
```

### 10.4 Pause System

Stack-based pause to prevent conflicts:

```
pause_game("hiring_panel")    # Push reason
resume_game("hiring_panel")   # Pop reason
# Only unpauses when stack is empty
```

---

## 11. Appendix: Full Event Catalog

### Decision Events (In-Session)

| ID | Title | Choices |
|----|-------|---------|
| client_resistant | Client Resistance | Explore gently (+quality), Push through (-quality) |
| emotional_breakthrough | Emotional Breakthrough | Process deeply (+quality, -energy), Stabilize and continue (neutral) |
| boundary_issue | Boundary Concern | Address directly (+quality), Redirect conversation (neutral) |
| crisis_disclosure | Crisis Disclosure | Extend session (+quality, -energy), Create safety plan (neutral) |
| transference | Therapeutic Relationship | Explore therapeutically (+quality), Maintain boundaries (neutral) |

### Random Events (Daily)

| ID | Title | Type | Choices |
|----|-------|------|---------|
| therapist_sick | Staff Illness | Negative | Cover sessions / Cancel sessions |
| referral_call | New Referral | Positive | Accept (new client) / Decline |
| positive_review | Glowing Review | Positive | Share publicly (+rep) / Keep private |
| difficult_session | Challenging Client | Neutral | Extra support (-energy, +satisfaction) / Standard approach |

### Milestone Events

| ID | Trigger | Effect |
|----|---------|--------|
| first_hire | Hire first therapist | Tutorial notification |
| first_cure | Cure first client | +5 reputation, celebration |
| level_up | Reach new level | Unlock notification |

---

## 12. Design Philosophy

### Core Pillars

1. **Accessible**: Easy to learn, satisfying to master
2. **Meaningful**: Choices feel consequential
3. **Cozy**: Relaxed pace, no harsh punishments
4. **Ethical**: Therapeutic context encourages empathy
5. **Emergent**: Systems create natural stories

### What This Game Is

- A relaxing management experience
- A sandbox for building your ideal practice
- A gentle introduction to therapy practice operations
- An opportunity for meaningful decisions about client care

### What This Game Is Not

- A realistic therapy simulator
- A stressful optimization puzzle
- A game with hard fail states
- A deep narrative experience

---

*This document provides the complete design specification for implementing a therapy practice management game. All systems, mechanics, and values are derived from an existing implementation and can be adjusted for balance during development.*
