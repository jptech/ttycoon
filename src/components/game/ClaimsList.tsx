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
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
            <div className="text-xs text-blue-600 dark:text-blue-400">Pending</div>
            <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
              {EconomyManager.formatCurrency(pendingTotal)}
            </div>
            <div className="text-xs text-blue-500">{pending.length} claims</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
            <div className="text-xs text-green-600 dark:text-green-400">Paid</div>
            <div className="text-lg font-semibold text-green-700 dark:text-green-300">
              {EconomyManager.formatCurrency(paidTotal)}
            </div>
            <div className="text-xs text-green-500">{paid.length} claims</div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
            <div className="text-xs text-red-600 dark:text-red-400">Denied</div>
            <div className="text-lg font-semibold text-red-700 dark:text-red-300">
              {EconomyManager.formatCurrency(deniedTotal)}
            </div>
            <div className="text-xs text-red-500">{denied.length} claims</div>
          </div>
        </div>

        {/* Pending Claims */}
        {sortedPending.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Pending Claims
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedPending.map((claim) => {
                const panel = getInsurancePanel(claim.insurerId)
                const daysUntilPayment = claim.scheduledPaymentDay - currentDay

                return (
                  <div
                    key={claim.id}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    {getStatusIcon(claim)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {panel?.name ?? claim.insurerId}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {daysUntilPayment > 0
                          ? `Expected in ${daysUntilPayment} days`
                          : 'Processing...'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
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
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
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
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                      className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      {getStatusIcon(claim)}
                      <span className="flex-1 text-xs text-gray-600 dark:text-gray-400">
                        {panel?.name ?? claim.insurerId}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          claim.status === 'paid' ? 'text-green-600' : 'text-red-600'
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
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-700 dark:text-yellow-400 text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Some claims are past their expected payment date</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
