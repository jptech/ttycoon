import { test, expect } from '@playwright/test'
import type { Therapist } from '@/core/types'

type E2EStoreState = {
  currentDay: number
  balance: number
  therapists: Array<{ certifications?: string[] }>
  addTherapist: (therapist: Therapist) => void
}

type E2EWindow = {
  gameStore?: {
    getState?: () => E2EStoreState
    setState?: (partial: Partial<E2EStoreState>) => void
  }
  EventBus?: {
    emit: (event: string, payload: unknown) => void
  }
  GameEvents?: {
    DAY_STARTED: string
  }
}

test.setTimeout(60000)

test('training flow: hire → enroll two therapists → skip day → certifications awarded', async ({ page }) => {
  await page.goto('/')

  // New game (step 1)
  await expect(page.getByRole('heading', { name: 'Therapy Tycoon' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // New game (step 2)
  await expect(page.getByRole('heading', { name: 'Create Your Therapist' })).toBeVisible()

  // Disable tutorial so it doesn't block clicks.
  const tutorialCheckbox = page.getByRole('checkbox')
  if (await tutorialCheckbox.isVisible()) {
    await tutorialCheckbox.uncheck()
  }

  await page.getByRole('button', { name: 'Start Game' }).click()

  // Ensure game UI is ready
  await expect(page.locator('[data-tab="team"]')).toBeVisible()

  // Ensure we can afford hiring/training in this run.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as unknown as E2EWindow
        return Boolean(w.gameStore?.getState)
      })
    )
    .toBe(true)
  await page.evaluate(() => {
    const w = window as unknown as E2EWindow
    w.gameStore?.setState?.({ balance: 100000 })
  })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as unknown as E2EWindow
        return w.gameStore?.getState?.().balance
      })
    )
    .toBe(100000)

  // Go to Team tab
  await page.locator('[data-tab="team"]').click()

  // Deterministically add a 2nd therapist (avoid randomized hiring UI)
  await page.evaluate(() => {
    const w = window as unknown as E2EWindow
    const store = w.gameStore
    const state = store?.getState?.()
    if (!store || !state) return

    store.getState?.().addTherapist({
      id: 'e2e-therapist-2',
      displayName: 'Dr. E2E',
      isPlayer: false,
      energy: 100,
      maxEnergy: 100,
      baseSkill: 50,
      level: 1,
      xp: 0,
      hourlySalary: 30,
      hireDay: state.currentDay,
      certifications: [],
      specializations: [],
      status: 'available',
      burnoutRecoveryProgress: 0,
      traits: { warmth: 5, analytical: 5, creativity: 5 },
    })
  })

  await expect(page.getByRole('heading', { name: 'Dr. E2E' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Training' })).toHaveCount(2)

  // Enroll therapist #1
  await page.getByRole('button', { name: 'Start Training' }).first().click()
  await expect(page.getByRole('heading', { name: /^Training for / })).toBeVisible()
  await page
    .locator('div[class*="programCard"]')
    .filter({ has: page.getByText('Telehealth Certification') })
    .getByRole('button', { name: 'Start Training' })
    .click()

  // Enroll therapist #2 (now only one Start Training button should remain)
  await expect(page.getByRole('button', { name: 'Start Training' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Start Training' }).click()
  await expect(page.getByRole('heading', { name: /^Training for / })).toBeVisible()
  await page
    .locator('div[class*="programCard"]')
    .filter({ has: page.getByText('Telehealth Certification') })
    .getByRole('button', { name: 'Start Training' })
    .click()

  // Advance a day (deterministic) to complete 8h programs.
  await page.evaluate(() => {
    const w = window as unknown as E2EWindow
    const day = w.gameStore?.getState?.().currentDay
    if (day === undefined) return
    w.EventBus?.emit?.(w.GameEvents?.DAY_STARTED ?? 'day_started', { dayNumber: day + 1 })
  })

  // Verify both earned the certification in state.
  await expect
    .poll(
      async () => {
        return await page.evaluate(() => {
          const w = window as unknown as E2EWindow
          const state = w.gameStore?.getState?.()
          if (!state) return -1
          return state.therapists.filter((t) => (t.certifications ?? []).includes('telehealth_certified')).length
        })
      },
      { timeout: 20000 }
    )
    .toBe(2)

  // Both therapists should be available again.
  await expect(page.getByRole('button', { name: 'Start Training' })).toHaveCount(2)
})
