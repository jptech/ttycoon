import type { TrainingProgram, Certification } from '@/core/types'

/**
 * All available training programs
 */
export const TRAINING_PROGRAMS: Record<string, TrainingProgram> = {
  // Clinical Track - Certifications
  trauma_training: {
    id: 'trauma_training',
    name: 'Trauma-Informed Care Certification',
    description: 'Comprehensive training in trauma therapy techniques including assessment and treatment approaches.',
    track: 'clinical',
    cost: 2500,
    durationHours: 40,
    prerequisites: {
      minSkill: 40,
    },
    grants: {
      certification: 'trauma_certified',
      clinicBonus: {
        type: 'reputation_bonus',
        value: 3,
      },
    },
  },

  couples_training: {
    id: 'couples_training',
    name: 'Couples & Family Therapy Certification',
    description: 'Learn Gottman method and other evidence-based couples therapy techniques.',
    track: 'clinical',
    cost: 2000,
    durationHours: 32,
    prerequisites: {
      minSkill: 35,
    },
    grants: {
      certification: 'couples_certified',
      clinicBonus: {
        type: 'reputation_bonus',
        value: 2,
      },
    },
  },

  children_training: {
    id: 'children_training',
    name: 'Child & Adolescent Therapy Certification',
    description: 'Specialized training for working with minors including play therapy and developmental considerations.',
    track: 'clinical',
    cost: 2200,
    durationHours: 36,
    prerequisites: {
      minSkill: 40,
    },
    grants: {
      certification: 'children_certified',
      clinicBonus: {
        type: 'reputation_bonus',
        value: 2,
      },
    },
  },

  substance_training: {
    id: 'substance_training',
    name: 'Substance Abuse Counseling Certification',
    description: 'Training in addiction treatment, motivational interviewing, and relapse prevention.',
    track: 'clinical',
    cost: 1800,
    durationHours: 28,
    prerequisites: {
      minSkill: 35,
    },
    grants: {
      certification: 'substance_certified',
      clinicBonus: {
        type: 'reputation_bonus',
        value: 2,
      },
    },
  },

  telehealth_training: {
    id: 'telehealth_training',
    name: 'Telehealth Certification',
    description: 'Learn best practices for providing therapy via video sessions.',
    track: 'clinical',
    cost: 500,
    durationHours: 8,
    prerequisites: {},
    grants: {
      certification: 'telehealth_certified',
      clinicBonus: {
        type: 'reputation_bonus',
        value: 1,
      },
    },
  },

  cbt_training: {
    id: 'cbt_training',
    name: 'Cognitive Behavioral Therapy (CBT) Certification',
    description: 'Master CBT techniques for treating anxiety, depression, and other conditions.',
    track: 'clinical',
    cost: 1500,
    durationHours: 24,
    prerequisites: {
      minSkill: 30,
    },
    grants: {
      certification: 'cbt_certified',
      skillBonus: 3,
      clinicBonus: {
        type: 'reputation_bonus',
        value: 2,
      },
    },
  },

  dbt_training: {
    id: 'dbt_training',
    name: 'Dialectical Behavior Therapy (DBT) Certification',
    description: 'Learn DBT skills for treating borderline personality disorder and emotional dysregulation.',
    track: 'clinical',
    cost: 2800,
    durationHours: 48,
    prerequisites: {
      minSkill: 50,
      certifications: ['cbt_certified'],
    },
    grants: {
      certification: 'dbt_certified',
      skillBonus: 5,
      clinicBonus: {
        type: 'reputation_bonus',
        value: 4,
      },
    },
  },

  emdr_training: {
    id: 'emdr_training',
    name: 'EMDR Therapy Certification',
    description: 'Eye Movement Desensitization and Reprocessing training for trauma treatment.',
    track: 'clinical',
    cost: 3000,
    durationHours: 50,
    prerequisites: {
      minSkill: 45,
      certifications: ['trauma_certified'],
    },
    grants: {
      certification: 'emdr_certified',
      skillBonus: 4,
      clinicBonus: {
        type: 'reputation_bonus',
        value: 4,
      },
    },
  },

  supervisor_training: {
    id: 'supervisor_training',
    name: 'Clinical Supervisor Certification',
    description: 'Learn to supervise and mentor other therapists.',
    track: 'clinical',
    cost: 3500,
    durationHours: 60,
    prerequisites: {
      minSkill: 70,
    },
    grants: {
      certification: 'supervisor_certified',
      clinicBonus: {
        type: 'reputation_bonus',
        value: 5,
      },
    },
  },

  // Clinical Track - Skill Boosters
  clinical_foundations: {
    id: 'clinical_foundations',
    name: 'Clinical Foundations Workshop',
    description: 'Refresh and enhance core therapeutic skills.',
    track: 'clinical',
    cost: 400,
    durationHours: 8,
    prerequisites: {},
    grants: {
      skillBonus: 2,
    },
  },

  advanced_assessment: {
    id: 'advanced_assessment',
    name: 'Advanced Clinical Assessment',
    description: 'Improve diagnostic and assessment capabilities.',
    track: 'clinical',
    cost: 800,
    durationHours: 16,
    prerequisites: {
      minSkill: 40,
    },
    grants: {
      skillBonus: 4,
    },
  },

  crisis_intervention: {
    id: 'crisis_intervention',
    name: 'Crisis Intervention Training',
    description: 'Learn to effectively handle crisis situations in therapy.',
    track: 'clinical',
    cost: 600,
    durationHours: 12,
    prerequisites: {
      minSkill: 35,
    },
    grants: {
      skillBonus: 3,
    },
  },

  // Business Track
  practice_management: {
    id: 'practice_management',
    name: 'Practice Management Essentials',
    description: 'Learn to run an efficient therapy practice.',
    track: 'business',
    cost: 350,
    durationHours: 6,
    prerequisites: {},
    grants: {
      clinicBonus: {
        type: 'reputation_bonus',
        value: 5,
      },
    },
  },

  insurance_billing: {
    id: 'insurance_billing',
    name: 'Insurance Billing Mastery',
    description: 'Master insurance billing to reduce denials and speed up payments.',
    track: 'business',
    cost: 450,
    durationHours: 8,
    prerequisites: {},
    grants: {
      clinicBonus: {
        type: 'insurance_multiplier',
        value: 0.1,
      },
    },
  },

  leadership_training: {
    id: 'leadership_training',
    name: 'Leadership & Team Building',
    description: 'Develop leadership skills to manage a growing practice.',
    track: 'business',
    cost: 800,
    durationHours: 16,
    prerequisites: {
      minSkill: 50,
    },
    grants: {
      clinicBonus: {
        type: 'hiring_capacity',
        value: 1,
      },
    },
  },
}

/**
 * Get a training program by ID
 */
export function getTrainingProgram(id: string): TrainingProgram | undefined {
  return TRAINING_PROGRAMS[id]
}

/**
 * Get all training programs sorted by track and cost
 */
export function getTrainingProgramsSorted(): TrainingProgram[] {
  return Object.values(TRAINING_PROGRAMS).sort((a, b) => {
    if (a.track !== b.track) {
      return a.track === 'clinical' ? -1 : 1
    }
    return a.cost - b.cost
  })
}

/**
 * Get training programs by track
 */
export function getTrainingProgramsByTrack(track: 'clinical' | 'business'): TrainingProgram[] {
  return Object.values(TRAINING_PROGRAMS)
    .filter((p) => p.track === track)
    .sort((a, b) => a.cost - b.cost)
}

/**
 * Get certification training programs
 */
export function getCertificationPrograms(): TrainingProgram[] {
  return Object.values(TRAINING_PROGRAMS)
    .filter((p) => p.grants.certification)
    .sort((a, b) => a.cost - b.cost)
}

/**
 * Get skill-boosting programs
 */
export function getSkillPrograms(): TrainingProgram[] {
  return Object.values(TRAINING_PROGRAMS)
    .filter((p) => p.grants.skillBonus && !p.grants.certification)
    .sort((a, b) => a.cost - b.cost)
}

/**
 * Get program that grants a specific certification
 */
export function getProgramForCertification(cert: Certification): TrainingProgram | undefined {
  return Object.values(TRAINING_PROGRAMS).find((p) => p.grants.certification === cert)
}

/**
 * Format training duration for display
 */
export function formatTrainingDuration(hours: number): string {
  if (hours < 8) return `${hours} hours`
  const days = Math.ceil(hours / 8)
  return `${days} day${days > 1 ? 's' : ''} (${hours}h)`
}
