/**
 * Valid tab IDs that can be navigated to during tutorial
 * Must match the data-tab attributes in GameView.tsx
 */
export type TutorialTabId = 'today' | 'booking' | 'people' | 'practice' | 'office'

/**
 * Definition of a tutorial step
 */
export interface TutorialStep {
  id: string
  title: string
  content: string
  /** CSS selector for the target element to highlight */
  targetSelector?: string
  /** Position of tooltip relative to target */
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** Tab to navigate to for this step */
  tab?: TutorialTabId
  /** Whether this step can be skipped */
  canSkip: boolean
}

/**
 * Tutorial steps for new players
 * Each step introduces a key game mechanic
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Therapy Tycoon!',
    content: 'You\'re about to start your journey as a therapy practice owner. Let\'s take a quick tour of the key features to help you get started.',
    position: 'center',
    canSkip: true,
  },
  {
    id: 'waiting_list',
    title: 'Your Waiting List',
    content: 'New clients arrive in your waiting list. Open the People tab to see clients with unique conditions, payment methods, and session preferences. Review them carefully before scheduling.',
    targetSelector: '[data-tab="people"]',
    position: 'bottom',
    tab: 'people',
    canSkip: true,
  },
  {
    id: 'booking',
    title: 'Schedule Sessions',
    content: 'Use the Booking tab to schedule clients with available therapists. Match therapists with clients based on specializations for better session quality.',
    targetSelector: '[data-tab="booking"]',
    position: 'bottom',
    tab: 'booking',
    canSkip: true,
  },
  {
    id: 'schedule',
    title: 'View Your Schedule',
    content: 'The Today tab shows your daily schedule with all upcoming sessions. Click on time slots to see session details or book new appointments.',
    targetSelector: '[data-tab="today"]',
    position: 'bottom',
    tab: 'today',
    canSkip: true,
  },
  {
    id: 'session_history',
    title: 'Review Past Sessions',
    content:
      'Open the Practice tab and select Sessions to review completed appointments, quality scores, and trends over time. Use it to spot stand-out therapists or sessions that need attention.',
    targetSelector: '[data-tab="practice"]',
    position: 'bottom',
    tab: 'practice',
    canSkip: true,
  },
  {
    id: 'session_quality',
    title: 'Session Quality Matters',
    content: 'During sessions, you\'ll face decision events that affect quality. Good decisions lead to happy clients, better reputation, and more referrals!',
    position: 'center',
    canSkip: true,
  },
  {
    id: 'therapist_energy',
    title: 'Manage Therapist Energy',
    content: 'Your therapists have limited energy. Open the People tab to monitor their levels and give them breaks to prevent burnout. A burned out therapist can\'t see clients!',
    targetSelector: '[data-tab="people"]',
    position: 'bottom',
    tab: 'people',
    canSkip: true,
  },
  {
    id: 'training',
    title: 'Improve Skills Through Training',
    content: 'Enroll therapists in training programs to gain certifications and improve their skills. Better skills mean higher session quality and more income!',
    position: 'center',
    tab: 'people',
    canSkip: true,
  },
  {
    id: 'finances',
    title: 'Track Your Finances',
    content: 'The Practice tab shows your financial overview. Keep an eye on your income, expenses, and insurance claims to grow your practice.',
    targetSelector: '[data-tab="practice"]',
    position: 'bottom',
    tab: 'practice',
    canSkip: true,
  },
  {
    id: 'complete',
    title: 'You\'re Ready!',
    content: 'That covers the basics! Grow your reputation, expand your team, and build the most successful therapy practice. Good luck!',
    position: 'center',
    canSkip: false,
  },
]

/**
 * Get total number of tutorial steps
 */
export function getTutorialStepCount(): number {
  return TUTORIAL_STEPS.length
}

/**
 * Get a specific tutorial step by index
 */
export function getTutorialStep(index: number): TutorialStep | null {
  if (index < 0 || index >= TUTORIAL_STEPS.length) {
    return null
  }
  return TUTORIAL_STEPS[index]
}
