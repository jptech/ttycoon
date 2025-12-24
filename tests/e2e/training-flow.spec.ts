import { test, expect } from '@playwright/test'

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
  await expect.poll(() => page.evaluate(() => Boolean((window as any).gameStore?.getState))).toBe(true)
  await page.evaluate(() => {
    ;(window as any).gameStore.setState({ balance: 100000 })
  })
  await expect.poll(() => page.evaluate(() => (window as any).gameStore.getState().balance)).toBe(100000)

  // Go to Team tab
  await page.locator('[data-tab="team"]').click()

  // Deterministically add a 2nd therapist (avoid randomized hiring UI)
  await page.evaluate(() => {
    const store = (window as any).gameStore
    const state = store.getState()
    store.getState().addTherapist({
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
    const { EventBus, GameEvents, gameStore } = window as any
    const day = gameStore.getState().currentDay
    EventBus.emit(GameEvents.DAY_STARTED, { dayNumber: day + 1 })
  })

  // Verify both earned the certification in state.
  await expect
    .poll(
      async () => {
        return await page.evaluate(() => {
          const store = (window as any).gameStore
          const state = store?.getState?.()
          if (!state) return -1
          return state.therapists.filter((t: any) =>
            (t.certifications || []).includes('telehealth_certified')
          ).length
        })
      },
      { timeout: 20000 }
    )
    .toBe(2)

  // Both therapists should be available again.
  await expect(page.getByRole('button', { name: 'Start Training' })).toHaveCount(2)
})
