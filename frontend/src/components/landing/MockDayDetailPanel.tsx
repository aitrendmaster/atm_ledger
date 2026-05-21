import { Coffee, ShoppingCart, Bus, Utensils } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ExpenseRow {
  icon: LucideIcon
  category: string
  place: string
  amount: string
  color: string
}

interface MockDayDetailPanelProps {
  dateLabel?: string
  total?: string
  rows?: ExpenseRow[]
}

const DEFAULT_ROWS: ExpenseRow[] = [
  { icon: Coffee, category: '카페', place: '스벅 부천역점', amount: '6,500원', color: '#A0633C' },
  {
    icon: Utensils,
    category: '식비',
    place: '돈까스집',
    amount: '12,000원',
    color: '#C97B5B',
  },
  {
    icon: ShoppingCart,
    category: '생활',
    place: '이마트 24',
    amount: '8,420원',
    color: '#8C7A6B',
  },
  { icon: Bus, category: '교통', place: '지하철', amount: '1,500원', color: '#6E8B6E' },
]

export default function MockDayDetailPanel({
  dateLabel = '11월 17일 (월)',
  total = '28,420원',
  rows = DEFAULT_ROWS,
}: MockDayDetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-3">
        <div className="text-[9px] font-mono tracking-[0.2em] uppercase text-atm-muted mb-1">
          오늘 쓴 돈
        </div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-atm-ink">{dateLabel}</h3>
          <span className="text-base font-bold text-atm-ink font-mono">{total}</span>
        </div>
      </div>

      <div className="px-3 pb-4 flex-1 space-y-2">
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div
              key={i}
              className="bg-white border border-stone-200 rounded-2xl px-3 py-2.5 flex items-center gap-2.5"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${row.color}20` }}
              >
                <Icon className="w-4 h-4" style={{ color: row.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-atm-ink truncate">{row.place}</div>
                <div className="text-[10px] text-atm-muted">{row.category}</div>
              </div>
              <span className="text-[11px] font-mono text-atm-ink whitespace-nowrap">
                {row.amount}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
