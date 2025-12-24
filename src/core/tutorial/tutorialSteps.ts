/**
 * Valid tab IDs that can be navigated to during tutorial
 */
export type TutorialTabId = 'schedule' | 'booking' | 'clients' | 'team' | 'finances' | 'office' | 'insurance'

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
    content: 'New clients arrive in your waiting list. Each client has unique conditions, payment methods, and session preferences. Review them carefully before scheduling.',
    targetSelector: '[data-tab="clients"]',
    position: 'bottom',
    tab: 'clients',
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
    content: 'The Schedule shows all upcoming sessions. Click on time slots to see session details or book new appointments.',
    targetSelector: '[data-tab="schedule"]',
    position: 'bottom',
    tab: 'schedule',
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
    content: 'Your therapists have limited energy. Monitor their levels and give them breaks to prevent burnout. A burned out therapist can\'t see clients!',
    targetSelector: '[data-tab="team"]',
    position: 'bottom',
    tab: 'team',
    canSkip: true,
  },
  {
    id: 'training',
    title: 'Improve Skills Through Training',
    content: 'Enroll therapists in training programs to gain certifications and improve their skills. Better skills mean higher session quality and more income!',
    position: 'center',
    tab: 'team',
    canSkip: true,
  },
  {
    id: 'finances',
    title: 'Track Your Finances',
    content: 'Keep an eye on your income and expenses in the Finances tab. Balance session revenue with operating costs to grow your practice.',
    targetSelector: '[data-tab="finances"]',
    position: 'bottom',
    tab: 'finances',
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
