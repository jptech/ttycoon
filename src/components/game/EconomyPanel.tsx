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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Finances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Balance */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400">Balance</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {EconomyManager.formatCurrency(balance)}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {todayNet >= 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">
                  {EconomyManager.formatCurrencyWithSign(todayNet)} today
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600">
                  {EconomyManager.formatCurrencyWithSign(todayNet)} today
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <Clock className="w-3 h-3" />
              Pending Claims
            </div>
            <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
              {EconomyManager.formatCurrency(budget.pendingIncome)}
            </div>
            <div className="text-xs text-blue-500">{pendingCount} claims</div>
          </div>

          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-3 h-3" />
              Daily Expenses
            </div>
            <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">
              {EconomyManager.formatCurrency(budget.dailyExpenses)}
            </div>
            <div className="text-xs text-orange-500">per day</div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Daily Expenses
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span>Rent</span>
              </div>
              <span>{EconomyManager.formatCurrency(getDailyRent(currentBuildingId))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span>Salaries</span>
              </div>
              <span>
                {EconomyManager.formatCurrency(
                  budget.dailyExpenses - getDailyRent(currentBuildingId)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Runway */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Financial Runway
            </span>
            <Badge variant={runwayStatus}>
              {budget.runway === Infinity ? '∞' : `${budget.runway} days`}
            </Badge>
          </div>
          {budget.runway !== Infinity && (
            <ProgressBar
              value={Math.min(budget.runway, 90)}
              max={90}
              variant={runwayStatus}
              size="sm"
            />
          )}
          {budget.runway < 14 && budget.runway !== Infinity && (
            <div className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Low funds! Consider reducing expenses or booking more sessions.
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Recent Activity
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentTransactions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                    {t.description}
                  </span>
                  <span
                    className={
                      t.type === 'income'
                        ? 'text-green-600 font-medium'
                        : 'text-red-600 font-medium'
                    }
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
