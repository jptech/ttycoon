import { useState, useEffect } from 'react'
import { Modal, ModalFooter, Button, Badge, ProgressBar, Card } from '@/components/ui'
import { Heart, Calendar, Star, TrendingUp, Award, Sparkles } from 'lucide-react'
import type { Client, Session } from '@/core/types'

export interface ClientSuccessStoryProps {
  /** Whether the modal is open */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** The client who completed treatment */
  client: Client
  /** Sessions completed with this client */
  sessions: Session[]
}

/**
 * Generate a flavor text testimonial based on client data
 */
function generateTestimonial(
  client: Client,
  averageQuality: number,
  sessionsCount: number
): string {
  const qualityDescriptor =
    averageQuality >= 0.85
      ? 'life-changing'
      : averageQuality >= 0.7
        ? 'incredibly helpful'
        : averageQuality >= 0.55
          ? 'valuable'
          : 'helpful'

  const lengthDescriptor =
    sessionsCount <= 6
      ? 'focused and efficient'
      : sessionsCount <= 10
        ? 'thorough'
        : 'comprehensive'

  const testimonials = [
    `"The ${lengthDescriptor} approach was exactly what I needed. I can't recommend this practice enough!"`,
    `"These sessions were ${qualityDescriptor}. I feel like a different person now."`,
    `"I was skeptical at first, but the care I received here was ${qualityDescriptor}."`,
    `"Thank you for the ${lengthDescriptor} treatment. It made all the difference."`,
    `"Every session felt ${qualityDescriptor}. I'm so grateful for this journey."`,
  ]

  // Use client ID to deterministically select a testimonial
  const index = client.id.charCodeAt(client.id.length - 1) % testimonials.length
  return testimonials[index]
}

export function ClientSuccessStory({
  open,
  onClose,
  client,
  sessions,
}: ClientSuccessStoryProps) {
  const [showSparkles, setShowSparkles] = useState(true)

  useEffect(() => {
    // Hide sparkles after animation
    const timer = setTimeout(() => setShowSparkles(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  // Calculate statistics
  const completedSessions = sessions.filter((s) => s.status === 'completed')
  const totalSessions = completedSessions.length
  const averageQuality =
    totalSessions > 0
      ? completedSessions.reduce((sum, s) => sum + s.quality, 0) / totalSessions
      : 0
  const qualityRating =
    averageQuality >= 0.8
      ? 'Excellent'
      : averageQuality >= 0.65
        ? 'Good'
        : averageQuality >= 0.5
          ? 'Fair'
          : 'Needs Improvement'
  const qualityVariant =
    averageQuality >= 0.8
      ? 'success'
      : averageQuality >= 0.65
        ? 'accent'
        : averageQuality >= 0.5
          ? 'warning'
          : 'error'

  // Calculate treatment duration (first session day to last)
  const sessionDays = completedSessions.map((s) => s.scheduledDay)
  const firstDay = Math.min(...sessionDays)
  const lastDay = Math.max(...sessionDays)
  const treatmentDuration = lastDay - firstDay + 1

  // Get condition display name
  const conditionDisplay = client.conditionCategory
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const testimonial = generateTestimonial(client, averageQuality, totalSessions)

  return (
    <Modal open={open} onClose={onClose} title="Treatment Complete" size="md">
      <div className="space-y-6">
        {/* Success Header */}
        <div className="relative text-center">
          {/* Sparkle effect on open */}
          {showSparkles && (
            <div className="absolute inset-0 pointer-events-none">
              <Sparkles
                className="absolute top-0 left-1/4 w-6 h-6 text-accent animate-ping"
                style={{ animationDuration: '1s' }}
              />
              <Sparkles
                className="absolute top-2 right-1/4 w-5 h-5 text-success animate-ping"
                style={{ animationDuration: '1.5s', animationDelay: '0.3s' }}
              />
              <Star
                className="absolute bottom-0 left-1/3 w-4 h-4 text-accent fill-accent animate-ping"
                style={{ animationDuration: '1.2s', animationDelay: '0.5s' }}
              />
            </div>
          )}

          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-success to-success/60 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-success/20">
            <Award className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold">{client.displayName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Successfully completed treatment for {conditionDisplay}
          </p>
          <Badge variant="success" size="md" className="mt-3">
            Treatment Complete
          </Badge>
        </div>

        {/* Journey Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Duration</span>
            </div>
            <div className="text-xl font-bold">{treatmentDuration} days</div>
            <div className="text-xs text-muted-foreground">
              Day {firstDay} to Day {lastDay}
            </div>
          </Card>

          <Card className="bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Sessions</span>
            </div>
            <div className="text-xl font-bold">{totalSessions}</div>
            <div className="text-xs text-muted-foreground">
              {client.sessionsRequired} required
            </div>
          </Card>

          <Card className="bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Star className="w-4 h-4" />
              <span className="text-sm">Avg Quality</span>
            </div>
            <div className="text-xl font-bold">
              {Math.round(averageQuality * 100)}%
            </div>
            <Badge variant={qualityVariant} size="sm" className="mt-1">
              {qualityRating}
            </Badge>
          </Card>

          <Card className="bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Heart className="w-4 h-4" />
              <span className="text-sm">Final Satisfaction</span>
            </div>
            <div className="text-xl font-bold">{client.satisfaction}%</div>
            <ProgressBar
              value={client.satisfaction}
              variant={client.satisfaction >= 70 ? 'success' : 'warning'}
              className="mt-1 h-1.5"
            />
          </Card>
        </div>

        {/* Treatment Progress */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-success" />
            <span className="font-medium">Treatment Journey</span>
          </div>
          <ProgressBar value={100} variant="success" className="mb-2" />
          <div className="text-sm text-muted-foreground text-center">
            {client.displayName} has successfully completed their treatment plan
          </div>
        </Card>

        {/* Testimonial */}
        <Card className="bg-accent/5 border-accent/20">
          <div className="flex items-start gap-3">
            <div className="text-3xl text-accent">"</div>
            <div>
              <p className="text-sm italic text-muted-foreground">
                {testimonial}
              </p>
              <p className="text-xs text-accent mt-2">— {client.displayName}</p>
            </div>
          </div>
        </Card>

        {/* Reputation Bonus Note */}
        <div className="text-center text-sm text-muted-foreground">
          <Star className="w-4 h-4 inline-block text-accent mr-1" />
          <span>+5 Reputation earned for completing treatment</span>
        </div>
      </div>

      <ModalFooter>
        <Button onClick={onClose}>Continue</Button>
      </ModalFooter>
    </Modal>
  )
}
