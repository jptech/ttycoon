import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EconomyManager } from '@/core/economy'
import { getDailyRent } from '@/data'
import type { PendingClaim, Therapist, Transaction } from '@/core/types'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Building2,
  Users,
} from 'lucide-react'

export interface EconomyPanelProps {
  balance: number
  pendingClaims: PendingClaim[]
  therapists: Therapist[]
  transactions: Transaction[]
  currentBuildingId: string
  currentDay: number
}

export function EconomyPanel({
  balance,
  pendingClaims,
  therapists,
  transactions,
  currentBuildingId,
  currentDay,
}: EconomyPanelProps) {
  const monthlyRent = useMemo(() => {
    const dailyRent = getDailyRent(currentBuildingId)
    return dailyRent * 30
  }, [currentBuildingId])

  const budget = useMemo(() => {
    return EconomyManager.calculateBudgetSummary(
      balance,
      pendingClaims,
      monthlyRent,
      therapists
    )
  }, [balance, pendingClaims, monthlyRent, therapists])

  const recentTransactions = useMemo(() => {
    return EconomyManager.getRecentTransactions(transactions, currentDay, 7)
  }, [transactions, currentDay])

  const todayNet = useMemo(() => {
    return EconomyManager.getDailyNet(transactions, currentDay)
  }, [transactions, currentDay])

  const pendingCount = pendingClaims.filter((c) => c.status === 'pending').length
  const runwayStatus =
    budget.runway === Infinity ? 'success' : budget.runway > 30 ? 'success' : budget.runway > 14 ? 'warning' : 'error'

  return (
    <Card className="h-full" hasAccentHeader>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" useDisplayFont>
          <DollarSign className="w-5 h-5 text-primary" />
          Finances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current Balance */}
        <div className="p-4 bg-surface-elevated rounded-xl border border-border-subtle">
          <div className="text-xs uppercase tracking-wider text-text-muted mb-1">Current Balance</div>
          <div className="text-3xl font-bold text-text font-mono tabular-nums">
            {EconomyManager.formatCurrency(balance)}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {todayNet >= 0 ? (
              <>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-bg">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs font-medium text-success">
                    {EconomyManager.formatCurrencyWithSign(todayNet)} today
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-bg">
                  <TrendingDown className="w-3.5 h-3.5 text-error" />
                  <span className="text-xs font-medium text-error">
                    {EconomyManager.formatCurrencyWithSign(todayNet)} today
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-info-bg rounded-xl border border-info/20">
            <div className="flex items-center gap-1.5 text-xs text-info mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-medium">Pending Claims</span>
            </div>
            <div className="text-xl font-bold text-info font-mono tabular-nums">
              {EconomyManager.formatCurrency(budget.pendingIncome)}
            </div>
            <div className="text-xs text-info/60 mt-0.5">{pendingCount} claims awaiting</div>
          </div>

          <div className="p-3.5 bg-warning-bg rounded-xl border border-warning/20">
            <div className="flex items-center gap-1.5 text-xs text-warning mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium">Daily Expenses</span>
            </div>
            <div className="text-xl font-bold text-warning font-mono tabular-nums">
              {EconomyManager.formatCurrency(budget.dailyExpenses)}
            </div>
            <div className="text-xs text-warning/60 mt-0.5">per day</div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="p-3.5 bg-surface rounded-xl space-y-3">
          <div className="text-xs uppercase tracking-wider text-text-muted font-medium">
            Expense Breakdown
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent-bg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-accent" />
                </div>
                <span className="text-text">Rent</span>
              </div>
              <span className="font-mono tabular-nums text-text-secondary">
                {EconomyManager.formatCurrency(getDailyRent(currentBuildingId))}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary-bg flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <span className="text-text">Salaries</span>
              </div>
              <span className="font-mono tabular-nums text-text-secondary">
                {EconomyManager.formatCurrency(
                  budget.dailyExpenses - getDailyRent(currentBuildingId)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Runway */}
        <div className="p-3.5 bg-surface rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-text-muted font-medium">
              Financial Runway
            </span>
            <Badge variant={runwayStatus} size="sm">
              {budget.runway === Infinity ? '∞ Sustainable' : `${budget.runway} days`}
            </Badge>
          </div>
          {budget.runway !== Infinity && (
            <ProgressBar
              value={Math.min(budget.runway, 90)}
              max={90}
              variant={runwayStatus}
              size="md"
            />
          )}
          {budget.runway < 14 && budget.runway !== Infinity && (
            <div className="text-xs text-error flex items-center gap-1.5 p-2 bg-error-bg rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              Low funds! Consider reducing expenses or booking more sessions.
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-text-muted font-medium">
              Recent Activity
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {recentTransactions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-sm py-2 px-2.5 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <span className="text-text-secondary truncate flex-1 mr-3">
                    {t.description}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-medium ${
                      t.type === 'income' ? 'text-success' : 'text-error'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {EconomyManager.formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
