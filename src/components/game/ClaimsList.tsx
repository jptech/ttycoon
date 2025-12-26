import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EconomyManager } from '@/core/economy'
import { getInsurancePanel } from '@/data'
import type { PendingClaim } from '@/core/types'
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

export interface ClaimsListProps {
  claims: PendingClaim[]
  currentDay: number
}

export function ClaimsList({ claims, currentDay }: ClaimsListProps) {
  const { pending, paid, denied } = useMemo(() => {
    return {
      pending: claims.filter((c) => c.status === 'pending'),
      paid: claims.filter((c) => c.status === 'paid'),
      denied: claims.filter((c) => c.status === 'denied'),
    }
  }, [claims])

  const pendingTotal = pending.reduce((sum, c) => sum + c.amount, 0)
  const paidTotal = paid.reduce((sum, c) => sum + c.amount, 0)
  const deniedTotal = denied.reduce((sum, c) => sum + c.amount, 0)

  // Sort pending claims by expected payment date
  const sortedPending = useMemo(() => {
    return [...pending].sort((a, b) => a.scheduledPaymentDay - b.scheduledPaymentDay)
  }, [pending])

  const getStatusIcon = (claim: PendingClaim) => {
    switch (claim.status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'paid':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusBadge = (claim: PendingClaim) => {
    const daysUntilPayment = claim.scheduledPaymentDay - currentDay

    switch (claim.status) {
      case 'pending':
        if (daysUntilPayment <= 0) {
          return <Badge variant="warning">Due Today</Badge>
        } else if (daysUntilPayment <= 3) {
          return <Badge variant="info">Due in {daysUntilPayment}d</Badge>
        } else {
          return (
            <Badge variant="outline">
              Day {claim.scheduledPaymentDay}
            </Badge>
          )
        }
      case 'paid':
        return <Badge variant="success">Paid</Badge>
      case 'denied':
        return <Badge variant="error">Denied</Badge>
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Insurance Claims
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-info-bg rounded-lg text-center">
            <div className="text-xs text-info">Pending</div>
            <div className="text-lg font-semibold text-info">
              {EconomyManager.formatCurrency(pendingTotal)}
            </div>
            <div className="text-xs text-info/70">{pending.length} claims</div>
          </div>
          <div className="p-3 bg-success-bg rounded-lg text-center">
            <div className="text-xs text-success">Paid</div>
            <div className="text-lg font-semibold text-success">
              {EconomyManager.formatCurrency(paidTotal)}
            </div>
            <div className="text-xs text-success/70">{paid.length} claims</div>
          </div>
          <div className="p-3 bg-error-bg rounded-lg text-center">
            <div className="text-xs text-error">Denied</div>
            <div className="text-lg font-semibold text-error">
              {EconomyManager.formatCurrency(deniedTotal)}
            </div>
            <div className="text-xs text-error/70">{denied.length} claims</div>
          </div>
        </div>

        {/* Pending Claims */}
        {sortedPending.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-text-secondary">
              Pending Claims
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedPending.map((claim) => {
                const panel = getInsurancePanel(claim.insurerId)
                const daysUntilPayment = claim.scheduledPaymentDay - currentDay

                return (
                  <div
                    key={claim.id}
                    className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border"
                  >
                    {getStatusIcon(claim)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text">
                        {panel?.name ?? claim.insurerId}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {daysUntilPayment > 0
                          ? `Expected in ${daysUntilPayment} days`
                          : 'Processing...'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-text">
                        {EconomyManager.formatCurrency(claim.amount)}
                      </div>
                      {getStatusBadge(claim)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {claims.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
            <FileText className="w-12 h-12 mb-2 opacity-50" />
            <div className="text-sm">No insurance claims yet</div>
            <div className="text-xs mt-1">
              Accept insurance clients to see claims here
            </div>
          </div>
        )}

        {/* Recent History */}
        {(paid.length > 0 || denied.length > 0) && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-text-secondary">
              Recent Results
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...paid, ...denied]
                .slice(0, 10)
                .map((claim) => {
                  const panel = getInsurancePanel(claim.insurerId)
                  return (
                    <div
                      key={claim.id}
                      className="flex items-center gap-2 py-1 border-b border-border last:border-0"
                    >
                      {getStatusIcon(claim)}
                      <span className="flex-1 text-xs text-text-secondary">
                        {panel?.name ?? claim.insurerId}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          claim.status === 'paid' ? 'text-success' : 'text-error'
                        }`}
                      >
                        {claim.status === 'paid' ? '+' : ''}
                        {EconomyManager.formatCurrency(claim.amount)}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Warning for overdue claims */}
        {sortedPending.some((c) => c.scheduledPaymentDay < currentDay) && (
          <div className="flex items-center gap-2 p-2 bg-warning-bg rounded text-warning text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Some claims are past their expected payment date</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
