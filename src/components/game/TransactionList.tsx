import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EconomyManager } from '@/core/economy'
import type { Transaction } from '@/core/types'
import {
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Calendar,
} from 'lucide-react'

export interface TransactionListProps {
  transactions: Transaction[]
  currentDay: number
}

type FilterType = 'all' | 'income' | 'expense'
type TimeRange = 7 | 14 | 30 | 'all'

export function TransactionList({ transactions, currentDay }: TransactionListProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>(7)

  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    // Filter by time range
    if (timeRange !== 'all') {
      const startDay = currentDay - timeRange
      filtered = filtered.filter((t) => t.day >= startDay)
    }

    // Filter by type
    if (filter !== 'all') {
      filtered = filtered.filter((t) => t.type === filter)
    }

    // Sort by day (newest first)
    return [...filtered].sort((a, b) => b.day - a.day)
  }, [transactions, filter, timeRange, currentDay])

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [filteredTransactions])

  // Group transactions by day
  const groupedByDay = useMemo(() => {
    const groups: Record<number, Transaction[]> = {}
    for (const t of filteredTransactions) {
      if (!groups[t.day]) {
        groups[t.day] = []
      }
      groups[t.day].push(t)
    }
    return groups
  }, [filteredTransactions])

  const days = Object.keys(groupedByDay)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              <Button
                variant={filter === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'income' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('income')}
              >
                Income
              </Button>
              <Button
                variant={filter === 'expense' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('expense')}
              >
                Expenses
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              <Button
                variant={timeRange === 7 ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(7)}
              >
                7d
              </Button>
              <Button
                variant={timeRange === 14 ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(14)}
              >
                14d
              </Button>
              <Button
                variant={timeRange === 30 ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(30)}
              >
                30d
              </Button>
              <Button
                variant={timeRange === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange('all')}
              >
                All
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">Income</div>
            <div className="text-sm font-semibold text-green-600">
              {EconomyManager.formatCurrency(summary.income)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">Expenses</div>
            <div className="text-sm font-semibold text-red-600">
              {EconomyManager.formatCurrency(summary.expenses)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">Net</div>
            <div
              className={`text-sm font-semibold ${
                summary.net >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {EconomyManager.formatCurrencyWithSign(summary.net)}
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {days.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found
            </div>
          ) : (
            days.map((day) => (
              <div key={day} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span>Day {day}</span>
                  {day === currentDay && (
                    <Badge variant="info" size="sm">
                      Today
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  {groupedByDay[day].map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700"
                    >
                      {t.type === 'income' ? (
                        <ArrowUpCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <ArrowDownCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {t.description}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t.category.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold flex-shrink-0 ${
                          t.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {EconomyManager.formatCurrency(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
