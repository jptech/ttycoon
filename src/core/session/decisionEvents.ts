import type { DecisionEvent } from '@/core/types'

/**
 * Session decision events - therapeutic choices that affect session quality
 */
export const SESSION_DECISION_EVENTS: DecisionEvent[] = [
  {
    id: 'client_resistant',
    title: 'Client Resistance',
    description:
      'Your client seems hesitant to discuss deeper issues today. They keep steering the conversation to surface-level topics.',
    choices: [
      {
        text: 'Gently challenge them to explore underlying feelings',
        effects: { quality: 0.1, energy: -5 },
      },
      {
        text: 'Meet them where they are and work with lighter material',
        effects: { quality: 0.0, satisfaction: 5 },
      },
      {
        text: 'Point out the avoidance pattern directly',
        effects: { quality: 0.15, satisfaction: -5, energy: -3 },
      },
    ],
  },
  {
    id: 'emotional_breakthrough',
    title: 'Emotional Breakthrough',
    description:
      'Your client has just had a significant emotional realization. Tears are flowing and they seem overwhelmed.',
    choices: [
      {
        text: 'Sit with them in silence, offering presence',
        effects: { quality: 0.15, satisfaction: 10 },
      },
      {
        text: 'Help them process the emotion verbally',
        effects: { quality: 0.1, energy: -5 },
      },
      {
        text: 'Move to grounding exercises to help regulate',
        effects: { quality: 0.05, satisfaction: 5 },
      },
    ],
  },
  {
    id: 'session_tangent',
    title: 'Off-Topic Discussion',
    description:
      "The client has gone off on a tangent about something unrelated to their treatment goals. It seems important to them, but time is limited.",
    choices: [
      {
        text: 'Allow them space to process, this might be important',
        effects: { quality: 0.05, satisfaction: 5 },
      },
      {
        text: 'Gently redirect back to treatment focus',
        effects: { quality: 0.1, satisfaction: -3 },
      },
      {
        text: 'Explore how this connects to their main concerns',
        effects: { quality: 0.15, energy: -5 },
      },
    ],
  },
  {
    id: 'crisis_disclosure',
    title: 'Crisis Disclosure',
    description:
      'Your client has just disclosed something concerning about their safety. The session mood has shifted dramatically.',
    triggerConditions: {
      minSeverity: 6,
    },
    choices: [
      {
        text: 'Conduct a thorough safety assessment',
        effects: { quality: 0.2, energy: -10 },
      },
      {
        text: 'Create a safety plan together',
        effects: { quality: 0.15, satisfaction: 5, energy: -5 },
      },
      {
        text: 'Focus on immediate coping strategies',
        effects: { quality: 0.1, satisfaction: 3 },
      },
    ],
  },
  {
    id: 'homework_incomplete',
    title: 'Incomplete Homework',
    description:
      "Your client didn't complete the homework from last session. They seem embarrassed about it.",
    choices: [
      {
        text: 'Explore what got in the way without judgment',
        effects: { quality: 0.1, satisfaction: 5 },
      },
      {
        text: 'Emphasize the importance of practice between sessions',
        effects: { quality: 0.05, satisfaction: -5 },
      },
      {
        text: 'Modify the assignment to make it more achievable',
        effects: { quality: 0.05, satisfaction: 10 },
      },
    ],
  },
  {
    id: 'therapeutic_rapport',
    title: 'Building Connection',
    description:
      'There\'s a moment of genuine connection. The client says, "I feel like you really understand me."',
    choices: [
      {
        text: 'Acknowledge the connection and validate their experience',
        effects: { quality: 0.15, satisfaction: 15 },
      },
      {
        text: 'Use this moment to deepen therapeutic work',
        effects: { quality: 0.2, energy: -5 },
      },
      {
        text: 'Explore what feeling understood means to them',
        effects: { quality: 0.1, satisfaction: 10 },
      },
    ],
  },
  {
    id: 'progress_plateau',
    title: 'Progress Plateau',
    description:
      "Your client mentions feeling stuck - like they're not making progress anymore. Their engagement seems lower.",
    choices: [
      {
        text: 'Review their progress together and celebrate wins',
        effects: { quality: 0.1, satisfaction: 10 },
      },
      {
        text: 'Explore if the treatment approach needs adjusting',
        effects: { quality: 0.15, energy: -5 },
      },
      {
        text: 'Normalize the plateau as part of the healing process',
        effects: { quality: 0.05, satisfaction: 5 },
      },
    ],
  },
  {
    id: 'boundary_test',
    title: 'Boundary Testing',
    description:
      'Your client asks you a personal question that feels like it crosses a professional boundary.',
    choices: [
      {
        text: 'Maintain the boundary while validating their curiosity',
        effects: { quality: 0.1, satisfaction: 0 },
      },
      {
        text: 'Explore what prompted the question therapeutically',
        effects: { quality: 0.15, energy: -3 },
      },
      {
        text: 'Share a minimal, appropriate self-disclosure',
        effects: { quality: 0.05, satisfaction: 5 },
      },
    ],
  },
  {
    id: 'anxiety_spike',
    title: 'Anxiety Spike',
    description:
      'Your client is becoming visibly anxious during the session. Their breathing has quickened and they seem distressed.',
    triggerConditions: {
      conditionCategories: ['anxiety', 'trauma', 'stress'],
    },
    choices: [
      {
        text: 'Guide them through a grounding exercise',
        effects: { quality: 0.1, satisfaction: 10 },
      },
      {
        text: 'Explore what triggered the anxiety response',
        effects: { quality: 0.15, energy: -5 },
      },
      {
        text: 'Offer reassurance and slow the pace of session',
        effects: { quality: 0.05, satisfaction: 5 },
      },
    ],
  },
  {
    id: 'insight_moment',
    title: 'Moment of Insight',
    description:
      'Your client has just connected two important patterns in their life. Their eyes widen with recognition.',
    choices: [
      {
        text: 'Reinforce the insight and help them integrate it',
        effects: { quality: 0.2, satisfaction: 10 },
      },
      {
        text: 'Ask them to elaborate on what they noticed',
        effects: { quality: 0.15, energy: -3 },
      },
      {
        text: 'Let them sit with the realization in silence',
        effects: { quality: 0.1, satisfaction: 5 },
      },
    ],
  },
]

/**
 * Get a random decision event, optionally filtered by conditions
 */
export function getRandomDecisionEvent(
  severity?: number,
  conditionCategory?: string
): DecisionEvent | undefined {
  let events = SESSION_DECISION_EVENTS

  // Filter by severity if specified
  if (severity !== undefined) {
    events = events.filter((e) => {
      if (!e.triggerConditions?.minSeverity) return true
      return severity >= e.triggerConditions.minSeverity
    })
  }

  // Filter by condition category if specified
  if (conditionCategory) {
    events = events.filter((e) => {
      if (!e.triggerConditions?.conditionCategories) return true
      return e.triggerConditions.conditionCategories.includes(conditionCategory as never)
    })
  }

  if (events.length === 0) return undefined
  return events[Math.floor(Math.random() * events.length)]
}
