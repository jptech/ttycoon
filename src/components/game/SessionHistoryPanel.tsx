import { useMemo, useState } from 'react'
import type { Session, Therapist } from '@/core/types'
import { SessionManager } from '@/core/session'
import { Card, Badge, Button, ProgressBar } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { History, TrendingUp, Users, Clock, Star } from 'lucide-react'

type TimeRange = 'all' | '30' | '7'

export interface SessionHistoryPanelProps {
  sessions: Session[]
  therapists: Therapist[]
  currentDay: number
  limit?: number
}

type QualityBucket = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor'

type QualitySummary = Record<QualityBucket, number>

function getQualityBucket(quality: number): QualityBucket {
  if (quality >= 0.9) return 'Excellent'
  if (quality >= 0.75) return 'Good'
  if (quality >= 0.5) return 'Fair'
  if (quality >= 0.25) return 'Poor'
  return 'Very Poor'
}

function getSessionDay(session: Session): number {
  const completedAt = session.completedAt
  return completedAt?.day ?? session.scheduledDay
}

function formatDayAndTime(session: Session): string {
  const completedAt = session.completedAt
  const day = getSessionDay(session)
  const hour = completedAt?.hour ?? session.scheduledHour
  const minute = completedAt?.minute ?? 0

  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const minuteStr = minute.toString().padStart(2, '0')

  return `Day ${day} • ${displayHour}:${minuteStr} ${ampm}`
}

function getSortKey(session: Session): number {
  const completedAt = session.completedAt
  const day = getSessionDay(session)
  const hour = completedAt?.hour ?? session.scheduledHour
  const minute = completedAt?.minute ?? 0
  return day * 24 * 60 + hour * 60 + minute
}

function getRangeCutoff(range: TimeRange, currentDay: number): number | null {
  if (range === 'all') return null
  const days = range === '30' ? 30 : 7
  return Math.max(1, currentDay - days + 1)
}

export function SessionHistoryPanel({ sessions, therapists, currentDay, limit = 25 }: SessionHistoryPanelProps) {
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')

  const completedSessions = useMemo(() => {
    return sessions
      .filter((session) => session.status === 'completed')
      .sort((a, b) => getSortKey(b) - getSortKey(a))
  }, [sessions])

  const sessionsForRange = useMemo(() => {
    const cutoff = getRangeCutoff(timeRange, currentDay)
    if (cutoff === null) return completedSessions
    return completedSessions.filter((session) => getSessionDay(session) >= cutoff)
  }, [completedSessions, timeRange, currentDay])

  const therapistOptions = useMemo(() => {
    return therapists.map((therapist) => ({ id: therapist.id, name: therapist.displayName }))
  }, [therapists])

  const filteredSessions = useMemo(() => {
    const list = selectedTherapist === 'all'
      ? sessionsForRange
      : sessionsForRange.filter((session) => session.therapistId === selectedTherapist)

    return list.slice(0, limit)
  }, [sessionsForRange, selectedTherapist, limit])

  const summary = useMemo(() => {
    if (sessionsForRange.length === 0) {
      return {
        averageQuality: 0,
        bucketCounts: {
          Excellent: 0,
          Good: 0,
          Fair: 0,
          Poor: 0,
          'Very Poor': 0,
        } as QualitySummary,
      }
    }

    const totalQuality = sessionsForRange.reduce((sum, session) => sum + session.quality, 0)
    const bucketCounts = sessionsForRange.reduce<QualitySummary>((acc, session) => {
      const bucket = getQualityBucket(session.quality)
      acc[bucket] += 1
      return acc
    }, {
      Excellent: 0,
      Good: 0,
      Fair: 0,
      Poor: 0,
      'Very Poor': 0,
    })

    return {
      averageQuality: totalQuality / sessionsForRange.length,
      bucketCounts,
    }
  }, [sessionsForRange])

  const activeFilterName = useMemo(() => {
    if (selectedTherapist === 'all') return 'All Therapists'
    const therapist = therapistOptions.find((option) => option.id === selectedTherapist)
    return therapist?.name ?? 'All Therapists'
  }, [selectedTherapist, therapistOptions])

  if (completedSessions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <History className="w-5 h-5" />
          <span>No completed sessions yet. Finish a session to see quality history.</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Average Quality</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{Math.round(summary.averageQuality * 100)}%</span>
              <Badge variant={SessionManager.getQualityVariant(summary.averageQuality)}>
                {SessionManager.getQualityRating(summary.averageQuality)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculated across {sessionsForRange.length} completed sessions
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Filter by Therapist</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTherapist === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTherapist('all')}
              >
                All
              </Button>
              {therapistOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedTherapist === option.id ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedTherapist(option.id)}
                >
                  {option.name}
                </Button>
              ))}
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground mb-2 mt-4">Time Range</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={timeRange === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange('all')}
                >
                  All Time
                </Button>
                <Button
                  variant={timeRange === '30' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange('30')}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant={timeRange === '7' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange('7')}
                >
                  Last 7 Days
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {(
            Object.entries(summary.bucketCounts) as Array<[QualityBucket, number]>
          ).map(([bucket, value]) => (
            <Card key={bucket} className="p-3 bg-muted/40">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{bucket}</span>
                <Badge
                  variant={bucket === 'Excellent' || bucket === 'Good' ? 'success' : bucket === 'Fair' ? 'warning' : 'error'}
                  size="sm"
                  className="px-1"
                >
                  {value}
                </Badge>
              </div>
              <ProgressBar
                value={summary.bucketCounts[bucket] === 0 || sessionsForRange.length === 0 ? 0 : (value / sessionsForRange.length) * 100}
                className="mt-2"
              />
            </Card>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Recent Sessions ({filteredSessions.length})</p>
              <p className="text-xs text-muted-foreground">Showing {activeFilterName}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const qualityPercent = Math.round(session.quality * 100)
            const qualityRating = SessionManager.getQualityRating(session.quality)
            const qualityVariant = SessionManager.getQualityVariant(session.quality)
            const badgeVariant = qualityVariant === 'success' ? 'success' : qualityVariant === 'warning' ? 'warning' : 'error'
            const qualityLabel = `${qualityPercent}%`
            const paymentLabel = formatMoney(session.payment)
            const durationLabel = `${session.durationMinutes} min`

            return (
              <Card key={session.id} className="p-4 border-muted">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-accent" />
                      <span className="text-sm font-semibold">{session.clientName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {session.therapistName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDayAndTime(session)}
                      </span>
                      <span>{durationLabel}</span>
                      <span>{paymentLabel}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={badgeVariant}>{qualityRating}</Badge>
                    <div className="text-lg font-semibold tabular-nums mt-1">{qualityLabel}</div>
                  </div>
                </div>
                <ProgressBar value={qualityPercent} variant={qualityVariant} className="mt-3" />
              </Card>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
