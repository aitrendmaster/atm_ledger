import { Repeat, Calendar } from 'lucide-react'

interface RecurringRow {
  name: string
  amount: string
  cycle: string
  next: string
}

interface MockRecurringPanelProps {
  rows?: RecurringRow[]
}

const DEFAULT_ROWS: RecurringRow[] = [
  { name: '월세', amount: '600,000원', cycle: '매월 25일', next: '11/25' },
  { name: '넷플릭스', amount: '13,500원', cycle: '매월 28일', next: '11/28' },
  { name: '실비보험', amount: '42,000원', cycle: '매월 30일', next: '11/30' },
  { name: '헬스장', amount: '85,000원', cycle: '매월 5일', next: '12/05' },
]

export default function MockRecurringPanel({ rows = DEFAULT_ROWS }: MockRecurringPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-3 flex items-center gap-2">
        <Repeat className="w-4 h-4 text-record" />
        <h3 className="text-sm font-bold text-ink">반복 지출</h3>
      </div>

      <div className="px-3 pb-3">
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="text-[11px] font-bold text-ink truncate">{r.name}</div>
                <div className="text-[9px] text-ink-tertiary flex items-center gap-1 mt-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                  {r.cycle}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] text-ink">{r.amount}</div>
                <div className="text-[9px] font-mono text-record">다음 {r.next}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 pb-4 mt-auto">
        <div className="bg-record/10 border border-record/20 rounded-2xl p-3 text-[10px] leading-relaxed text-ink">
          한번 등록하면 종료일까지 자동으로 캘린더에 채워져요.
        </div>
      </div>
    </div>
  )
}
