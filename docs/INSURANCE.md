# Insurance System

Manages insurance panel membership, claims, reimbursements, and denials.

## Insurance Panels

Available insurance providers with different rates and delays:

```typescript
interface InsurancePanel {
  id: string;
  name: string;
  reimbursement_rate: number;    // Per session ($80-150)
  claim_delay_days: number;      // Days to receive payment (3-8)
  denial_rate: number;           // Percentage of claims denied (5-15%)
  application_fee: number;       // Cost to apply ($0-75)
  status: 'pending' | 'active' | 'rejected';
  applied_day: number;
  activated_day?: number;
}

const INSURANCE_PANELS: InsurancePanel[] = [
  {
    id: 'bluecross',
    name: 'BlueCross BlueShield',
    reimbursement_rate: 120,
    claim_delay_days: 4,
    denial_rate: 0.05,
    application_fee: 75,
    status: 'inactive'
  },
  {
    id: 'aetna',
    name: 'Aetna',
    reimbursement_rate: 100,
    claim_delay_days: 3,
    denial_rate: 0.08,
    application_fee: 50,
    status: 'inactive'
  },
  {
    id: 'cigna',
    name: 'Cigna',
    reimbursement_rate: 95,
    claim_delay_days: 4,
    denial_rate: 0.06,
    application_fee: 50,
    status: 'inactive'
  },
  {
    id: 'united',
    name: 'United Healthcare',
    reimbursement_rate: 110,
    claim_delay_days: 6,
    denial_rate: 0.12,
    application_fee: 50,
    status: 'inactive'
  },
  {
    id: 'medicaid',
    name: 'Medicaid',
    reimbursement_rate: 80,
    claim_delay_days: 8,
    denial_rate: 0.15,
    application_fee: 0,        // Free to apply
    status: 'inactive'
  }
];
```

## Panel Application

```typescript
function applyForInsurancePanel(panelId: string): boolean {
  const panel = INSURANCE_PANELS.find(p => p.id === panelId);
  if (!panel || panel.status !== 'inactive') return false;

  // Check reputation minimum (varies by panel)
  const minRepByPanel = {
    'bluecross': 50,
    'aetna': 40,
    'cigna': 45,
    'united': 60,
    'medicaid': 0  // No minimum
  };

  if (reputation < minRepByPanel[panelId]) {
    EventBus.emit('application_failed', `Need ${minRepByPanel[panelId]} reputation`);
    return false;
  }

  // Check affordability
  if (!economySystem.can_afford(panel.application_fee)) {
    EventBus.emit('application_failed', 'Cannot afford application fee');
    return false;
  }

  // Deduct application fee
  economySystem.removeMoney(panel.application_fee, `insurance_application_${panelId}`);

  // Roll for acceptance (70-95% based on reputation)
  const baseAcceptance = 0.7;
  const repBonus = (reputation / 500) * 0.25;  // Up to +25%
  const acceptanceChance = Math.min(0.95, baseAcceptance + repBonus);

  if (Math.random() < acceptanceChance) {
    panel.status = 'active';
    panel.activated_day = currentDay;
    EventBus.emit('insurance_panel_accepted', panelId);
    showNotification(`Accepted to ${panel.name} panel!`);
    return true;
  } else {
    panel.status = 'rejected';
    panel.applied_day = currentDay;
    EventBus.emit('insurance_panel_rejected', panelId);
    showNotification(`Application to ${panel.name} denied.`);
    return false;
  }
}
```

## Claim Processing

```typescript
function processInsuranceSession(session: Session): void {
  const client = getClient(session.client_id);
  if (!client.insurance_provider) return;  // Not insurance

  const panel = getInsurancePanel(client.insurance_provider);
  if (!panel || panel.status !== 'active') {
    // Fall back to private pay
    processPrivatePaySession(session);
    return;
  }

  // Roll for claim denial
  const denialChance = panel.denial_rate;
  if (Math.random() < denialChance) {
    // Claim denied
    EventBus.emit('insurance_claim_denied', {
      panel_name: panel.name,
      amount: panel.reimbursement_rate,
      session_id: session.id
    });
    showNotification(`Insurance claim denied for ${client.display_name}`);
    return;
  }

  // Schedule payment with delay
  const paymentAmount = Math.round(
    panel.reimbursement_rate * economySystem.insurance_multiplier
  );

  const dueDay = currentDay + panel.claim_delay_days;

  const payment: InsurancePayment = {
    id: `payment-${session.id}`,
    session_id: session.id,
    panel_id: panel.id,
    panel_name: panel.name,
    amount: paymentAmount,
    due_day: dueDay,
    status: 'pending',
    created_day: currentDay
  };

  economySystem.pending_payments.push(payment);

  EventBus.emit('insurance_claim_scheduled', {
    panel_name: panel.name,
    amount: paymentAmount,
    due_day: dueDay
  });
}
```

## Denial Reasons

When a claim is denied, a specific reason is provided. Each reason has different appeal success rates:

| Reason | Description | Appeal Success Rate |
|--------|-------------|---------------------|
| **Coding Error** | Incorrect billing code submitted | 85% |
| **Insufficient Documentation** | Session notes didn't meet requirements | 70% |
| **Medical Necessity** | Treatment not deemed necessary | 40% |
| **Prior Auth Required** | Pre-approval was not obtained | 30% |
| **Session Limit Exceeded** | Client reached annual limit | 20% |
| **Out of Network** | Provider not in network | 10% |

### Denial Reason Distribution

Reasons are weighted by likelihood:
- Insufficient Documentation: 30%
- Medical Necessity: 25%
- Coding Error: 20%
- Session Limit Exceeded: 10%
- Prior Authorization Required: 10%
- Out of Network: 5%

### Implementation

```typescript
// Get denial reason details
const details = InsuranceManager.getDenialReasonDetails('coding_error')
// Returns: { label: 'Coding Error', description: '...', appealSuccessRate: 0.85 }

// When a claim is denied, it includes:
interface ClaimResolution {
  claimId: string
  paid: boolean
  amount: number
  denied: boolean
  denialReason?: DenialReason    // Specific reason
  appealDeadlineDay?: number     // Days to appeal
}
```

## Appeal System

Denied claims can be appealed within a limited window:

### Configuration

```typescript
// INSURANCE_CONFIG
APPEAL_WINDOW_DAYS: 14,       // Days to submit appeal
APPEAL_PROCESSING_DAYS: 7,    // Days to process appeal
APPEAL_SUCCESS_RATE: 0.5,     // Base success rate (overridden by reason)
```

### Appeal Flow

1. **Denial Occurs**: Claim is denied with specific reason, appeal deadline set
2. **Player Reviews**: Can see denial reason and appeal success chance
3. **Submit Appeal**: If within deadline, player can appeal
4. **Processing**: Appeal takes 7 days to process
5. **Resolution**: Appeal approved (payment issued) or rejected (final denial)

### Implementation

```typescript
// Check if claim can be appealed
const check = InsuranceManager.canAppealClaim(claim, currentDay)
if (check.canAppeal) {
  const result = InsuranceManager.submitAppeal(claim, currentDay)
  if (result.success) {
    // Update claim status to 'appealed'
    // Payment will be processed on result.newPaymentDay if approved
  }
}

// Process appeals at day start
const { approvedAppeals, rejectedAppeals, remainingClaims } =
  InsuranceManager.processAppeals(claims, currentDay)

// Handle results
for (const approved of approvedAppeals) {
  addMoney(approved.amount, 'Appeal approved')
}
```

### Appeal Success Factors

Appeal success is primarily determined by denial reason:

- **Easy to Fix** (high success): Coding errors, documentation issues
- **Subjective** (medium): Medical necessity disputes
- **Policy Limits** (low): Session limits, network restrictions

### Player Strategy

- **Coding Errors**: Almost always appeal - 85% success rate
- **Documentation Issues**: Worth appealing - 70% success rate
- **Medical Necessity**: Consider based on amount - 40% success rate
- **Policy Limits**: Rarely worth the wait - 20% or less

## Pending Payments

Track insurance claims awaiting payment:

```typescript
interface InsurancePayment {
  id: string;
  session_id: string;
  panel_id: string;
  panel_name: string;
  amount: number;
  due_day: number;
  status: 'pending' | 'received' | 'denied';
  created_day: number;
}

// Called at start of each day
function processPendingInsurancePayments(day: number) {
  for (const payment of economySystem.pending_payments) {
    if (payment.status === 'pending' && payment.due_day === day) {
      economySystem.addMoney(payment.amount, `insurance_reimbursement_${payment.panel_id}`);
      payment.status = 'received';
      EventBus.emit('insurance_payment_received', payment.panel_name, payment.amount);
    }
  }
}
```

## Insurance Multiplier

Increases reimbursement rates through business training:

```typescript
interface EconomyState {
  insurance_multiplier: number;  // Default: 1.0, max: 1.5
}

// Applied to all insurance payments
function calculateInsurancePayment(baseRate: number): number {
  const multiplied = baseRate * economySystem.insurance_multiplier;
  // Cap at 1.5x
  return Math.min(multiplied, baseRate * 1.5);
}

// Example:
// BlueCross: $120 base
// With 1.2x multiplier: $144
// Capped at: $180 (1.5x)

// Increased through training
function completeInsuranceTraining() {
  economySystem.insurance_multiplier += 0.1;
  economySystem.insurance_multiplier = Math.min(1.5, economySystem.insurance_multiplier);
}
```

## Insurance Panel Panel

UI for viewing active and pending insurance:

```typescript
interface InsurancePanelUI {
  active_panels: {
    name: string;
    rate: string;            // "$120/session"
    delay_days: number;
    denial_rate: string;     // "5%"
    activated_day: number;
    sessions_this_month: number;
    revenue_this_month: number;
  }[];

  pending_applications: {
    name: string;
    application_fee: number;
    status: 'processing' | 'pending';
    applied_day: number;
    estimated_decision_day: number;
  }[];

  available_panels: {
    name: string;
    rate: string;
    delay_days: number;
    denial_rate: string;
    application_fee: number;
    reputation_required: number;
    can_afford: boolean;
    reputation_met: boolean;
    can_apply: boolean;
  }[];

  pending_payments: {
    panel_name: string;
    amount: number;
    due_day: number;
    status: 'pending' | 'received';
  }[];

  stats: {
    total_insured_clients: number;
    total_pending_payments: number;
    pending_total_amount: number;
    estimated_monthly_from_insurance: number;
    insurance_multiplier: number;
  };
}
```

## Client Insurance Status

Clients have insurance assigned at arrival:

```typescript
function selectInsuranceProvider(): string | null {
  // 60% of clients have insurance
  if (Math.random() > 0.6) return null;  // Private pay

  // Weighted by insurer prevalence
  const weights = {
    'bluecross': 0.25,
    'aetna': 0.20,
    'cigna': 0.20,
    'united': 0.20,
    'medicaid': 0.15
  };

  const rand = Math.random();
  let cumulative = 0;
  for (const [insurer, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return insurer;
    }
  }

  return 'bluecross';  // Fallback
}

function getClientInsuranceInfo(client: Client) {
  if (!client.insurance_provider) {
    return {
      type: 'private_pay',
      rate: 'Negotiated',
      payment_timing: 'Immediate'
    };
  }

  const panel = getInsurancePanel(client.insurance_provider);
  return {
    type: 'insurance',
    provider: panel.name,
    rate: `$${panel.reimbursement_rate}/session`,
    delay_days: panel.claim_delay_days,
    denial_rate: `${(panel.denial_rate * 100).toFixed(0)}%`,
    active: panel.status === 'active'
  };
}
```

## Revenue Mix

Diversify income between private pay and insurance:

```typescript
function analyzeRevenueChannel(period: number = 30) {
  const sessions = getRecentSessions(period);

  const privatePaySessions = sessions.filter(s => !s.is_insurance).length;
  const insuranceSessions = sessions.filter(s => s.is_insurance).length;

  const privatePayRevenue = sessions
    .filter(s => !s.is_insurance)
    .reduce((sum, s) => sum + s.payment, 0);

  const insuranceRevenue = sessions
    .filter(s => s.is_insurance)
    .reduce((sum, s) => sum + s.payment, 0);

  return {
    private_pay_percentage: (privatePaySessions / sessions.length) * 100,
    insurance_percentage: (insuranceSessions / sessions.length) * 100,
    private_pay_revenue: privatePayRevenue,
    insurance_revenue: insuranceRevenue,
    recommendation:
      insurance_percentage > 80
        ? 'Consider recruiting more private-pay clients'
        : insurance_percentage < 30
        ? 'Insurance provides stability - recruit insured clients'
        : 'Good mix'
  };
}
```

## Events Emitted

```typescript
EventBus.emit('application_failed', reason);
EventBus.emit('insurance_panel_accepted', panelId);
EventBus.emit('insurance_panel_rejected', panelId);
EventBus.emit('insurance_claim_scheduled', { panel_name, amount, due_day });
EventBus.emit('insurance_claim_denied', { panel_name, amount, session_id });
EventBus.emit('insurance_payment_received', panel_name, amount);
```

## Testing Strategy

```typescript
test('claim denied based on denial rate', () => {
  const panel = INSURANCE_PANELS.find(p => p.denial_rate > 0);
  const client = createClient({ insurance_provider: panel.id });
  const session = createSession(therapist, client, 1, 8, { is_insurance: true });

  // Mock random for denial
  const listeners = vi.fn();
  EventBus.on('insurance_claim_denied', listeners);

  // Run enough times to expect at least one denial
  for (let i = 0; i < 100; i++) {
    processInsuranceSession(session);
  }

  expect(listeners).toHaveBeenCalled();
});

test('pending insurance payment processed on due day', () => {
  const listener = vi.fn();
  EventBus.on('insurance_payment_received', listener);

  const payment: InsurancePayment = {
    id: 'test',
    session_id: 'session-1',
    panel_id: 'bluecross',
    panel_name: 'BlueCross',
    amount: 120,
    due_day: currentDay + 3,
    status: 'pending',
    created_day: currentDay
  };

  economySystem.pending_payments.push(payment);

  // Advance 2 days (not yet due)
  advanceDay(); advanceDay();
  processPendingInsurancePayments(currentDay);
  expect(listener).not.toHaveBeenCalled();

  // Advance 1 more day (now due)
  advanceDay();
  processPendingInsurancePayments(currentDay);
  expect(listener).toHaveBeenCalledWith('BlueCross', 120);
  expect(payment.status).toBe('received');
});

test('insurance multiplier increases payment', () => {
  economySystem.insurance_multiplier = 1.0;
  const basePayment = calculateInsurancePayment(100);
  expect(basePayment).toBe(100);

  economySystem.insurance_multiplier = 1.2;
  const boostedPayment = calculateInsurancePayment(100);
  expect(boostedPayment).toBe(120);
});
```
