# Reputation System

Tracks practice reputation and progression through practice levels, unlocking features and expansion opportunities.

## Reputation Score (0-500)

**Starting**: 20 reputation at Level 1

**Range**: 0-500 (clamped to this range)

**Display**: Shown in HUD with level badge and progress to next level

## Practice Levels

Levels unlock features and staff capacity:

| Level | Name | Rep Required | Staff Cap | Key Unlocks |
|-------|------|--------------|-----------|-------------|
| 1 | Starting Practice | 0 | 1 | Base gameplay (solo only) |
| 2 | Established | 50 | 2+ | Hiring, Training programs |
| 3 | Growing | 125 | 3+ | Better hiring pool, Advanced training |
| 4 | Respected | 250 | 4+ | Large office access, Premium insurance |
| 5 | Premier | 400 | 5+ | All features unlocked, highest prestige |

**Implementation**: `src/core/types/state.ts` - `PRACTICE_LEVELS`

## Reputation Gains

### Session Quality (Primary Source)

Based on session quality at completion:

```typescript
const REPUTATION_BY_QUALITY = {
  excellent: 5,      // 0.80+ quality
  good: 2,           // 0.65-0.80 quality
  fair: 0,           // 0.50-0.65 quality
  poor: -2,          // 0.30-0.50 quality
  very_poor: -5      // 0.00-0.30 quality
};
```

**Implementation**: `src/core/reputation/ReputationManager.ts` - `getSessionReputationDelta(quality)`

Awarded in `App.tsx` during `handleSessionComplete()` callback.

### Training Completion (Secondary Source)

Clinical and business training programs grant reputation bonuses upon completion:

**Clinical certifications**:
- Trauma, Couples, Children, Substance: +2 rep each
- Telehealth: +1 rep
- CBT: +2 rep
- DBT, EMDR, Supervisor: +4-5 rep each

**Business training**:
- Practice Management: +5 rep
- Insurance Billing: Multiplier bonus (no direct rep)
- Leadership: Hiring capacity bonus (no direct rep)

**Implementation**: `src/data/trainingPrograms.ts` - `clinicBonus.type: 'reputation_bonus'`

Awarded in `src/hooks/useTrainingProcessor.ts` when training completes.

### Events (Tertiary Source)

Random events can award or penalize reputation (-3 to +8 per event, ~30% daily chance).

**Implementation**: `src/data/randomEvents.ts` - event `effects.reputation`

## Reputation Losses

Occurs when:
- Session quality is fair or poor (automatic deduction based on quality)
- Random negative events trigger
- No direct client dropout penalty currently implemented

## HUD Display

Shows in the top right, next to balance:

**Format**: `★ 175 [L3] 50/125` on first line, `Growing` on second line

**Components**:
- `★` - Reputation icon
- `175` - Current reputation value
- `[L3]` - Level badge (compact)
- `50/125` - Progress toward next level (or "Max" at level 5)
- `Growing` - Level name

**Compact design**: Two lines only (value line + level name), all progress info inline

**Component**: `src/components/game/HUD.tsx` - `ReputationDisplay` sub-component

**Helper**: `src/core/reputation/ReputationManager.ts` - `getReputationDisplay(reputation)`

## Progression Timeline

Estimated time to reach each level (assuming good session quality):

- **Level 1→2** (0→50): ~10-15 sessions at +2-5 rep each
- **Level 2→3** (50→125): ~20-25 sessions
- **Level 3→4** (125→250): ~30-40 sessions
- **Level 4→5** (250→400): ~40-50 sessions
- **Total**: ~100-130 high-quality sessions (~13-26 weeks at 2 sessions/day)

With training bonuses and random events, progression is faster.

## Files

**Core**:
- `src/core/reputation/ReputationManager.ts` - Session quality calculations, display helpers
- `src/core/types/state.ts` - Practice level definitions

**Data**:
- `src/data/trainingPrograms.ts` - Training program reputation bonuses
- `src/data/randomEvents.ts` - Random event reputation effects

**Components**:
- `src/components/game/HUD.tsx` - Reputation display in HUD

**Hooks**:
- `src/hooks/useTrainingProcessor.ts` - Training completion reputation awards
- `App.tsx` - Session completion reputation awards

## Events Emitted

```typescript
EventBus.emit(GameEvents.REPUTATION_CHANGED, {
  oldValue: number,
  newValue: number,
  reason: string,        // e.g., "Excellent session", "Practice Management Training"
})

EventBus.emit(GameEvents.PRACTICE_LEVEL_CHANGED, {
  oldLevel: PracticeLevel,
  newLevel: PracticeLevel,
})
```

## Testing

All reputation calculations are pure functions and can be tested in isolation:

```typescript
test('excellent session awards 5 reputation', () => {
  const delta = getSessionReputationDelta(0.85)
  expect(delta).toBe(5)
})

test('reputation display shows correct level and progress', () => {
  const display = getReputationDisplay(175)  // Level 3, 50 toward level 4
  expect(display.level).toBe(3)
  expect(display.levelName).toBe('Growing')
  expect(display.progressToNext).toBe(50)
})
```
