# Office System

Manages physical practice infrastructure including buildings, rooms, and virtual capabilities.

## Buildings

Progressive office upgrades with increasing capacity and rent:

```typescript
const BUILDINGS = [
  {
    id: 'starter_suite',
    name: 'Starter Suite',
    tier: 1,
    rooms: 1,
    monthly_rent: 50,      // $1.67/day
    upgrade_cost: 0,       // Default building
    required_level: 1,
    description: 'One therapy room. Perfect for a solo practice.'
  },
  {
    id: 'small_clinic',
    name: 'Small Clinic',
    tier: 2,
    rooms: 3,
    monthly_rent: 250,     // $8.33/day
    upgrade_cost: 2500,    // Cost to upgrade from Starter
    required_level: 2,
    description: 'Three therapy rooms. Room to grow.'
  },
  {
    id: 'professional_center',
    name: 'Professional Center',
    tier: 3,
    rooms: 8,
    monthly_rent: 1000,    // $33.33/day
    upgrade_cost: 15000,   // Cost to upgrade from Small
    required_level: 4,
    description: 'Eight rooms plus reception area. A real practice.'
  }
];

interface Office {
  current_building: Building;
  telehealth_unlocked: boolean;
  rooms_occupied_today: number;  // Track usage per day
}
```

## Room Capacity

In-person sessions require room availability:

```typescript
function canScheduleInPersonSession(day: number, hour: number): boolean {
  const office = getOffice();
  const sessionsAtTime = getSessionsAtTime(day, hour)
    .filter(s => !s.is_virtual);

  // Count occupied rooms
  const occupiedRooms = sessionsAtTime.length;

  return occupiedRooms < office.current_building.rooms;
}

function reserveRoom(session: Session) {
  if (session.is_virtual) return true;  // No room needed

  const office = getOffice();
  const currentSessions = getSessionsAtTime(session.scheduled_day, session.scheduled_hour)
    .filter(s => !s.is_virtual);

  if (currentSessions.length >= office.current_building.rooms) {
    return false;  // No rooms available
  }

  return true;
}

// Can only book virtual sessions if rooms full
function getBookableSessionTypes(day: number, hour: number): ('virtual' | 'in_person')[] {
  const canDoInPerson = canScheduleInPersonSession(day, hour);
  const canDoVirtual = getOffice().telehealth_unlocked;

  const types: ('virtual' | 'in_person')[] = [];
  if (canDoInPerson) types.push('in_person');
  if (canDoVirtual) types.push('virtual');

  return types;
}
```

## Upgrading Buildings

```typescript
function upgradeBuilding(newBuildingId: string): boolean {
  const currentBuilding = getOffice().current_building;
  const newBuilding = BUILDINGS.find(b => b.id === newBuildingId);

  if (!newBuilding) return false;

  // Check requirements
  if (newBuilding.required_level > practiceLevel) {
    EventBus.emit('upgrade_failed', 'Practice level too low');
    return false;
  }

  if (newBuilding.upgrade_cost > 0) {
    if (!economySystem.can_afford(newBuilding.upgrade_cost)) {
      EventBus.emit('upgrade_failed', 'Cannot afford');
      return false;
    }

    economySystem.removeMoney(newBuilding.upgrade_cost, `office_upgrade_${newBuildingId}`);
  }

  // Apply upgrade
  getOffice().current_building = newBuilding;

  EventBus.emit('office_upgraded', newBuildingId, currentBuilding.id);
  showNotification(`Upgraded to ${newBuilding.name}!`);

  return true;
}
```

## Telehealth

Enables virtual sessions:

```typescript
const TELEHEALTH_UNLOCK_COST = 750;

function unlockTelehealth(): boolean {
  const office = getOffice();

  if (office.telehealth_unlocked) {
    return false;  // Already unlocked
  }

  if (!economySystem.can_afford(TELEHEALTH_UNLOCK_COST)) {
    EventBus.emit('telehealth_unlock_failed', 'Cannot afford');
    return false;
  }

  economySystem.removeMoney(TELEHEALTH_UNLOCK_COST, 'telehealth_unlock');

  office.telehealth_unlocked = true;

  // Some clients prefer virtual
  for (const client of clients) {
    if (client.prefers_virtual) {
      client.satisfaction += 5;  // Happy to have option
    }
  }

  EventBus.emit('telehealth_unlocked');
  showNotification('Telehealth enabled! Virtual sessions available.');

  return true;
}

// Virtual sessions don't require certification
function canScheduleVirtualSession(therapist: Therapist, client: Client): boolean {
  if (!getOffice().telehealth_unlocked) {
    return false;
  }

  // No certification check for virtual (therapist handles it)
  return true;
}

// Some clients prefer virtual
function matchClientPreference(session: Session, client: Client) {
  if (client.prefers_virtual && session.is_virtual) {
    client.satisfaction += 3;  // Satisfied with format
  } else if (client.prefers_virtual && !session.is_virtual) {
    client.satisfaction -= 2;  // Wanted virtual
  }
}
```

## Office Panel

UI for viewing and upgrading office:

```typescript
interface OfficePanel {
  current_building: {
    name: string;
    rooms: number;
    monthly_rent: number;
    tier: number;
  };

  telehealth: {
    enabled: boolean;
    unlock_cost: number;
    can_afford: boolean;
  };

  available_upgrades: {
    building: Building;
    cost: number;
    can_afford: boolean;
    required_level: number;
    level_met: boolean;
  }[];

  stats: {
    total_rooms: number;
    rooms_in_use: number;
    daily_rent: number;
    monthly_rent: number;
    days_until_next_payment: number;
  };

  benefits: {
    capacity_increase: number;
    rent_increase: number;
    unlocks: string[];
  };
}
```

## Room Visualization

Optional visual representation of office:

```typescript
// Could be rendered with PixiJS
interface RoomVisualization {
  building_id: string;
  rooms: RoomSprite[];
  therapists: TherapistSprite[];
  animations: SessionAnimation[];
}

interface RoomSprite {
  room_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_occupied: boolean;
  current_session?: Session;
}

// Visual feedback during sessions
function animateSessionInProgress(session: Session) {
  const room = getRoomForSession(session);
  if (room) {
    room.is_occupied = true;
    // Visual effects: light in room, sounds, etc.
    EventBus.emit('room_animated', session.id);
  }
}

function animateSessionEnd(session: Session) {
  const room = getRoomForSession(session);
  if (room) {
    room.is_occupied = false;
    // Fade out animation
  }
}
```

## Room Efficiency

Optimize session scheduling to maximize room usage:

```typescript
function calculateRoomUtilization(building: Building, day: number): number {
  let totalRoomHours = 0;
  let usedRoomHours = 0;

  // Business hours = 10 hours, each room available
  totalRoomHours = building.rooms * 10;

  // Count occupied room-hours
  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
    const sessionsAtTime = getSessionsAtTime(day, hour)
      .filter(s => !s.is_virtual);
    usedRoomHours += sessionsAtTime.length;
  }

  return usedRoomHours / totalRoomHours;
}

function getOfficeMetrics(building: Building): OfficeMetrics {
  const lastWeek = [];
  for (let i = 0; i < 7; i++) {
    lastWeek.push(calculateRoomUtilization(building, currentDay - i));
  }

  const avgUtilization = lastWeek.reduce((a, b) => a + b) / 7;

  return {
    avg_utilization: avgUtilization,
    recommendation: avgUtilization > 0.8
      ? 'Consider upgrading for more rooms'
      : avgUtilization < 0.3
      ? 'Plenty of room capacity'
      : 'Good utilization'
  };
}
```

## Office Bonuses

Buildings can provide benefits beyond rooms:

```typescript
// Future expansion
interface BuildingBonus {
  building_id: string;
  reputation_bonus?: number;  // Some practices gain rep from professional setting
  therapist_satisfaction?: number;  // Nicer office = happier staff
  client_satisfaction?: number;  // Professional space
  insurance_bonus?: number;  // Some insurers prefer established locations
}

const BUILDING_BONUSES: Record<string, BuildingBonus> = {
  'starter_suite': {
    building_id: 'starter_suite',
    reputation_bonus: 0,
    therapist_satisfaction: -2,
    client_satisfaction: -1
  },
  'small_clinic': {
    building_id: 'small_clinic',
    reputation_bonus: 2,
    therapist_satisfaction: 0,
    client_satisfaction: 1
  },
  'professional_center': {
    building_id: 'professional_center',
    reputation_bonus: 5,
    therapist_satisfaction: 5,
    client_satisfaction: 3,
    insurance_bonus: 0.05
  }
};

function applyBuildingBonuses() {
  const bonus = BUILDING_BONUSES[getOffice().current_building.id];
  if (bonus.reputation_bonus) {
    reputationSystem.updateReputation(bonus.reputation_bonus);
  }
  // ... apply other bonuses ...
}
```

## Events Emitted

```typescript
EventBus.emit('office_upgraded', newBuildingId, oldBuildingId);
EventBus.emit('telehealth_unlocked');
EventBus.emit('room_reserved', roomId, sessionId);
EventBus.emit('room_animated', sessionId);
EventBus.emit('upgrade_failed', reason);
```

## Testing Strategy

```typescript
test('cannot book in-person session if no rooms available', () => {
  const office = getOffice();
  office.current_building.rooms = 1;

  // Book 1 session (fills the room)
  const session1 = createSession(therapist, client, 1, 8, { is_virtual: false });
  expect(session1).toBeTruthy();

  // Try to book 2nd session in same slot
  const session2 = createSession(therapist, client, 1, 8, { is_virtual: false });
  expect(session2).toBeNull();
});

test('virtual session can be booked when rooms full', () => {
  const office = getOffice();
  office.current_building.rooms = 1;
  office.telehealth_unlocked = true;

  // Book 1 in-person (fills room)
  const session1 = createSession(therapist, client1, 1, 8, { is_virtual: false });
  expect(session1).toBeTruthy();

  // Book virtual for different client (no room needed)
  const session2 = createSession(therapist, client2, 1, 8, { is_virtual: true });
  expect(session2).toBeTruthy();
});

test('office upgrade costs money and increases rooms', () => {
  const initialBalance = economy.balance;
  const initialRooms = office.current_building.rooms;

  upgradeBuilding('small_clinic');

  expect(economy.balance).toBeLessThan(initialBalance);
  expect(office.current_building.rooms).toBeGreaterThan(initialRooms);
});

test('telehealth unlock allows virtual sessions', () => {
  unlockTelehealth();

  const session = createSession(therapist, client, 1, 8, { is_virtual: true });
  expect(session).toBeTruthy();
  expect(session.is_virtual).toBe(true);
});
```
