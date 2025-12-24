# Economy System

Manages all financial transactions, cash flow, and monetary resources for the practice.

## Core Concept

The Economy System tracks:
- Current balance (cash on hand)
- Income sources (session payments, insurance reimbursements)
- Expenses (salaries, rent, training)
- Pending payments (insurance claims with delays)
- Transaction history

## Balance Management

```typescript
interface Economy {
  balance: number;              // Current cash ($5,000 starting)
  transaction_history: Transaction[];
  pending_payments: InsurancePayment[];
  insurance_multiplier: number; // 1.0 default, increased via training

  // Methods
  addMoney(amount: number, reason: string): void;
  removeMoney(amount: number, reason: string): boolean;
  can_afford(amount: number): boolean;
  process_daily_expenses(): void;
  process_insurance_payment(payment: InsurancePayment): void;
}

interface Transaction {
  id: string;
  day: number;
  amount: number;
  type: 'income' | 'expense';
  reason: string;  // "session_payment", "therapist_salary", "training_cost"
  source?: string; // Client name, therapist name, insurer
}
```

## Income Sources

### Session Payment (Private Pay)

When a private-pay session completes:

```
Base Payment = $100-200 (quality-dependent)
Quality Tier Multiplier:
  Excellent (0.8+):  1.0x → $100-200
  Good (0.6-0.8):    0.9x → $90-180
  Fair (0.4-0.6):    0.7x → $70-140
  Poor (0.2-0.4):    0.5x → $50-100
  Very Poor (0.0-0.2): 0.3x → $30-60

// Called by SessionSystem.completeSession()
function processSessionPayment(session: Session) {
  const basePayment = 100 + (session.quality * 100);
  const qualityMultiplier = getQualityMultiplier(session.quality);
  const finalPayment = Math.round(basePayment * qualityMultiplier);

  addMoney(finalPayment, `session_payment_from_${session.client_id}`);
  EventBus.emit('money_changed', oldBalance, newBalance, 'session_payment');
}
```

### Insurance Reimbursement

When an insurance-paid session completes:

```typescript
function processInsuranceSession(session: Session) {
  if (!session.is_insurance) return;

  const client = getClient(session.client_id);
  const panel = getInsurancePanel(client.insurance_provider);

  // Roll for denial
  const denial_rate = panel.denial_rate; // 5-15%
  const isApproved = Math.random() > denial_rate;

  if (!isApproved) {
    EventBus.emit('insurance_claim_denied', panel.name, panel.reimbursement_rate);
    return;
  }

  // Schedule payment with delay
  const paymentAmount = Math.round(
    panel.reimbursement_rate * economy.insurance_multiplier
  );
  const due_day = currentDay + panel.claim_delay_days;

  const payment: InsurancePayment = {
    id: `payment-${session.id}`,
    amount: paymentAmount,
    insurer: panel.name,
    due_day: due_day,
    status: 'pending'
  };

  economy.pending_payments.push(payment);
  EventBus.emit('insurance_claim_scheduled', paymentAmount, panel.name, due_day);
}
```

**Insurance Panels**:

| Panel | Rate | Delay | Denial | Fee |
|-------|------|-------|--------|-----|
| BlueCross | $120 | 4 days | 5% | $75 |
| Aetna | $100 | 3 days | 8% | $50 |
| Cigna | $95 | 4 days | 6% | $50 |
| United | $110 | 6 days | 12% | $50 |
| Medicaid | $80 | 8 days | 15% | $0 |

### Random Event Bonuses

Events can provide money bonuses:

```typescript
// Example events:
{
  id: "grant_opportunity",
  title: "Grant Opportunity",
  description: "A foundation offers funding to your practice",
  choices: [
    {
      text: "Accept the grant (+$2,000)",
      effects: { money: 2000 }
    }
  ]
}

// Applied when player selects choice
function applyEventEffects(choice: EventChoice) {
  if (choice.effects.money) {
    addMoney(choice.effects.money, 'random_event_bonus');
  }
}
```

## Expense Categories

### Therapist Salaries

End-of-day automatic deduction:

```typescript
function processDailyExpenses() {
  // Salary: hourly_rate * hours worked
  for (const therapist of therapists) {
    if (therapist.is_player) continue; // Player doesn't earn salary

    // Calculate hours worked (count sessions + breaks)
    const hoursWorked = calculateHoursWorked(therapist);
    const dailySalary = therapist.hourly_salary * hoursWorked;

    removeMoney(dailySalary, `therapist_salary_${therapist.id}`);
  }
}

// If practice goes negative:
if (balance < 0) {
  EventBus.emit('practice_bankrupt');  // Game over (or grace period)
}
```

**Salary Range**: $0-500/hour
- Entry level: $50-100/hour
- Experienced: $150-250/hour
- Senior: $300-500/hour

### Building Rent

Daily prorated expense:

```typescript
function processDailyExpenses() {
  // Rent is monthly, prorated daily
  const dailyRent = office.currentBuilding.monthly_rent / 30;
  removeMoney(dailyRent, 'building_rent');
}
```

**Monthly Rent by Building**:
- Starter Suite: $50/month ($1.67/day)
- Small Clinic: $250/month ($8.33/day)
- Professional Center: $1,000/month ($33.33/day)

### Training Enrollment

Upfront cost when therapist enrolls:

```typescript
function enrollInTraining(therapist: Therapist, program: TrainingProgram) {
  if (!can_afford(program.cost)) {
    return false;  // Cannot afford
  }

  removeMoney(program.cost, `training_enrollment_${program.id}`);
  therapist.current_training = program;
  EventBus.emit('training_started', therapist.id, program.id);
  return true;
}
```

**Training Costs**: $500-$5,000

### Hiring Costs

1 week salary upfront:

```typescript
function hireTherapist(candidate: Therapist) {
  const oneWeekSalary = candidate.hourly_salary * 40;

  if (!can_afford(oneWeekSalary)) {
    return false;
  }

  removeMoney(oneWeekSalary, `hiring_cost_${candidate.id}`);
  therapists.push(candidate);
  EventBus.emit('therapist_hired', candidate.id);
  return true;
}
```

### Insurance Panel Application

One-time fee to apply for coverage:

```typescript
function applyForInsurancePanel(panel: InsurancePanel) {
  if (!can_afford(panel.application_fee)) {
    return false;
  }

  removeMoney(panel.application_fee, `insurance_application_${panel.id}`);

  // Roll for acceptance (70-95% based on reputation)
  const acceptanceChance = Math.min(0.95, 0.7 + (reputation / 500) * 0.25);
  const isAccepted = Math.random() < acceptanceChance;

  if (isAccepted) {
    panel.status = 'active';
    EventBus.emit('insurance_panel_accepted', panel.name);
  } else {
    EventBus.emit('insurance_panel_rejected', panel.name);
  }

  return isAccepted;
}
```

**Application Fees**: $0-$75 per panel

### Office Upgrades

One-time cost:

```typescript
function upgradeBuilding(newBuilding: Building) {
  if (!can_afford(newBuilding.upgrade_cost)) {
    return false;
  }

  removeMoney(newBuilding.upgrade_cost, `office_upgrade_${newBuilding.id}`);
  office.currentBuilding = newBuilding;
  EventBus.emit('office_upgraded', newBuilding.id);
  return true;
}
```

**Upgrade Costs**:
- Starter → Small: $2,500
- Small → Professional: $15,000

### Telehealth Unlock

One-time setup cost:

```typescript
function unlockTelehealth() {
  const TELEHEALTH_COST = 750;

  if (!can_afford(TELEHEALTH_COST)) {
    return false;
  }

  removeMoney(TELEHEALTH_COST, 'telehealth_unlock');
  office.telehealth_unlocked = true;
  EventBus.emit('telehealth_unlocked');
  return true;
}
```

## Daily Expense Processing

Called at start of each new day:

```typescript
function processDailyExpenses() {
  // 1. Therapist Salaries
  for (const therapist of therapists) {
    if (therapist.is_player) continue;
    const salary = therapist.hourly_salary * 10;  // 10-hour day
    if (!removeMoney(salary, `salary_${therapist.id}`)) {
      // Alert: cannot pay therapist!
      EventBus.emit('insufficient_funds_salary', therapist.display_name);
    }
  }

  // 2. Building Rent
  const dailyRent = office.currentBuilding.monthly_rent / 30;
  if (!removeMoney(dailyRent, 'rent')) {
    EventBus.emit('insufficient_funds_rent');
  }

  // 3. Process pending insurance payments (if due today)
  for (const payment of pending_payments) {
    if (payment.due_day === currentDay) {
      addMoney(payment.amount, `insurance_reimbursement_${payment.insurer}`);
      payment.status = 'received';
    }
  }

  // Emit summary event for UI
  EventBus.emit('daily_expenses_processed', {
    salaries_paid: totalSalaries,
    rent_paid: dailyRent,
    insurance_received: insuranceAmount
  });
}
```

## Cash Flow Analysis

### Breakeven Point

```
Daily Revenue (average):
  - 5 sessions × $150 average = $750/day

Daily Expenses (typical level 2):
  - 2 therapists × $100/hour × 10 hours = $2,000
  - Rent: $250 / 30 = $8.33
  - Total: ~$2,008/day

Need: 27 sessions/day to break even
Reality: ~5-10 sessions early game = LOSS

Solution: Early game is negative until hired therapist pays for themselves
         Late game: Multiple therapists × 10-15 sessions each
```

### Income Timing

Sessions are paid immediately, but insurance takes 3-8 days:

```
Day 1: Patient pays $150 immediately
Day 1: Insurance patient session (no payment yet)
Day 4-8: Insurance payment of $120 arrives (depends on insurer)

Consequence: Early practice needs private-pay clients
             Mix of insurance is important for cash flow stability
```

## Money Display

The HUD always shows current balance with trend:

```typescript
// HUD displays:
💰 $12,500 ▲

// Where:
// - $ amount is current balance
// - ▲ = gaining money this day (net positive)
// - ▼ = losing money this day (net negative)
// - → = balanced (rare)

function calculateDayTrend(): 'up' | 'down' | 'neutral' {
  const income = transactionsToday.filter(t => t.type === 'income').sum();
  const expenses = transactionsToday.filter(t => t.type === 'expense').sum();
  return income > expenses ? 'up' : income < expenses ? 'down' : 'neutral';
}
```

## Budget Panel

Detailed financial breakdown available in UI:

```typescript
interface BudgetPanel {
  // Current balance
  current_balance: number;

  // Today's transactions
  today_income: Transaction[];
  today_expenses: Transaction[];
  today_net: number;

  // Pending insurance
  pending_payments: InsurancePayment[];
  total_pending: number;

  // Weekly average
  weekly_average_income: number;
  weekly_average_expenses: number;

  // Historical
  last_30_days_net: number;
  monthly_trend: 'positive' | 'negative' | 'neutral';
}
```

## Insurance Multiplier

Increases reimbursement rates via business training:

```typescript
// Default: 1.0x
// After "Insurance Negotiation" training: 1.1x
// Capped at: 1.5x

function applyInsuranceMultiplier(baseRate: number): number {
  const rate = baseRate * economy.insurance_multiplier;
  return Math.min(rate, baseRate * 1.5);  // Capped
}

// Example:
// BlueCross default: $120
// With 1.2x multiplier: $144
```

## Edge Cases

### Insufficient Funds

If practice can't afford an expense:

```typescript
function removeMoney(amount: number, reason: string): boolean {
  if (balance < amount) {
    EventBus.emit('insufficient_funds', amount, reason);
    return false;  // Transaction blocked
  }

  balance -= amount;
  addTransaction({ type: 'expense', amount, reason });
  return true;
}

// Consequences:
// - Cannot start training
// - Cannot hire therapist
// - Cannot apply for insurance
// - Cannot upgrade building
// - Salaries still deducted (grace period, then game over)
```

### Bankruptcy

If balance goes negative for too long:

```typescript
function checkBankruptcy() {
  if (balance < 0) {
    daysNegative++;
    if (daysNegative > 7) {
      EventBus.emit('practice_bankrupt');
      // Game over or reload save
    }
  } else {
    daysNegative = 0;
  }
}
```

## Events Emitted

```typescript
EventBus.emit('money_changed', oldBalance, newBalance, reason);
EventBus.emit('insufficient_funds', amount, reason);
EventBus.emit('insurance_claim_scheduled', amount, insurer, due_day);
EventBus.emit('insurance_claim_denied', insurer, amount);
EventBus.emit('daily_expenses_processed', summary);
EventBus.emit('practice_bankrupt');
```

## Testing Strategy

```typescript
// Unit tests
test('addMoney increases balance', () => {
  economy.balance = 1000;
  economy.addMoney(500, 'test');
  expect(economy.balance).toBe(1500);
});

test('removeMoney returns false if insufficient funds', () => {
  economy.balance = 100;
  const result = economy.removeMoney(500, 'test');
  expect(result).toBe(false);
  expect(economy.balance).toBe(100);
});

// Integration tests
test('session completion adds payment', () => {
  const listener = vi.fn();
  EventBus.on('money_changed', listener);
  sessionSystem.completeSession(sessionId);
  expect(listener).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'session_payment');
});

test('daily expenses deducts salaries and rent', () => {
  const initialBalance = economy.balance;
  economySystem.processDailyExpenses();
  expect(economy.balance).toBeLessThan(initialBalance);
});
```
