import { CalendarDays } from 'lucide-react'

interface MockCalendarPanelProps {
  month?: string
  upcoming?: { day: number; label: string; amount: string }[]
  markedDays?: { day: number; type: 'spent' | 'planned' }[]
}

const DEFAULT_UPCOMING = [
  { day: 25, label: '월세', amount: '600,000원' },
  { day: 28, label: '넷플릭스', amount: '13,500원' },
  { day: 30, label: '실비보험', amount: '42,000원' },
]

const DEFAULT_MARKED: { day: number; type: 'spent' | 'planned' }[] = [
  { day: 3, type: 'spent' },
  { day: 8, type: 'spent' },
  { day: 12, type: 'spent' },
  { day: 17, type: 'spent' },
  { day: 21, type: 'spent' },
  { day: 25, type: 'planned' },
  { day: 28, type: 'planned' },
  { day: 30, type: 'planned' },
]

export default function MockCalendarPanel({
  month = '11월',
  upcoming = DEFAULT_UPCOMING,
  markedDays = DEFAULT_MARKED,
}: MockCalendarPanelProps) {
  const days = Array.from({ length: 30 }, (_, i) => i + 1)
  const markMap = new Map(markedDays.map((m) => [m.day, m.type]))

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{month}</h3>
        <CalendarDays className="w-4 h-4 text-ink-tertiary" />
      </div>

      <div className="px-4 pb-2">
        <div className="grid grid-cols-7 gap-1 text-[9px] font-mono tracking-wider text-ink-tertiary text-center mb-1">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={`pad-${i}`} className="aspect-square" />
          ))}
          {days.map((day) => {
            const mark = markMap.get(day)
            return (
              <div
                key={day}
                className={`aspect-square flex flex-col items-center justify-center rounded-md text-[10px] font-medium ${
                  mark === 'spent'
                    ? 'bg-sunken text-ink'
                    : mark === 'planned'
                      ? 'bg-record/10 text-record'
                      : 'text-ink-tertiary'
                }`}
              >
                {day}
                {mark && (
                  <span
                    className={`w-1 h-1 rounded-full mt-0.5 ${
                      mark === 'spent' ? 'bg-ink' : 'bg-grad-record'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto px-3 pb-4">
        <div className="bg-surface border border-line rounded-2xl p-3">
          <div className="text-[9px] font-mono tracking-[0.18em] uppercase text-ink-tertiary mb-1.5">
            Upcoming
          </div>
          <ul className="space-y-1">
            {upcoming.map((u) => (
              <li
                key={u.day}
                className="flex items-center justify-between text-[11px] text-ink"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-record/15 text-record text-[9px] font-mono flex items-center justify-center">
                    {u.day}
                  </span>
                  {u.label}
                </span>
                <span className="font-mono text-ink-tertiary">{u.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
