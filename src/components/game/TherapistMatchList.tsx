import { useMemo } from 'react'
import type { Client, Therapist } from '@/core/types'
import { ClientManager } from '@/core/clients'
import { Badge } from '@/components/ui'
import { User, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TherapistMatchListProps {
  client: Client
  therapists: Therapist[]
  selectedTherapistId?: string | null
  onSelect: (therapist: Therapist) => void
  className?: string
}

export function TherapistMatchList({
  client,
  therapists,
  selectedTherapistId,
  onSelect,
  className,
}: TherapistMatchListProps) {
  // Calculate match scores for all therapists
  const matches = useMemo(() => {
    return therapists
      .map((therapist) => ({
        therapist,
        match: ClientManager.calculateMatchScore(client, therapist),
      }))
      .sort((a, b) => b.match.score - a.match.score)
  }, [client, therapists])

  // Get valid matches (those with certification)
  const validMatches = matches.filter((m) => m.match.breakdown.certificationMatch > 0)
  const invalidMatches = matches.filter((m) => m.match.breakdown.certificationMatch === 0)

  const getMatchVariant = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 70) return 'success'
    if (score >= 50) return 'warning'
    return 'error'
  }

  return (
    <div className={className}>
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground" />
        Select Therapist
      </h4>

      {validMatches.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
          No therapists meet the required certifications for this client
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {validMatches.map(({ therapist, match }) => (
            <button
              key={therapist.id}
              onClick={() => onSelect(therapist)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                selectedTherapistId === therapist.id
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {therapist.displayName}
                  {therapist.isPlayer && ' (You)'}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={getMatchVariant(match.score)} size="sm">
                    {match.score}% match
                  </Badge>
                  {match.breakdown.specializationMatch >= 70 && (
                    <span className="text-xs text-success flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" />
                      Specialist
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Show invalid matches as disabled */}
          {invalidMatches.map(({ therapist }) => (
            <button
              key={therapist.id}
              disabled
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 opacity-50 cursor-not-allowed"
              title="Missing required certification"
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-muted-foreground">
                  {therapist.displayName}
                  {therapist.isPlayer && ' (You)'}
                </span>
                <span className="text-xs text-error flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  Missing certification
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
