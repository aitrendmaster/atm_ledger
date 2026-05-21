import { Sparkles, TrendingUp, TrendingDown, Target } from 'lucide-react'

interface MockInsightPanelProps {
  monthLabel?: string
  total?: string
  strength?: string
  weakness?: string
  advice?: string
}

export default function MockInsightPanel({
  monthLabel = '10월 회고',
  total = '1,284,500원',
  strength = '카페 지출이 지난달보다 18% 줄었어요. 잘하고 있어요!',
  weakness = '식비가 평소보다 32% 많아요. 외식이 늘었네요.',
  advice = '주 1회 집밥의 날을 만들어볼까요? 한 달에 약 12만원 아낄 수 있어요.',
}: MockInsightPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-atm-accent" />
        <h3 className="text-sm font-bold text-atm-ink">{monthLabel}</h3>
      </div>

      <div className="px-3 pb-3">
        <div className="bg-atm-ink text-atm-bg rounded-2xl p-3">
          <div className="text-[9px] font-mono tracking-[0.2em] uppercase opacity-60 mb-0.5">
            이번 달 합계
          </div>
          <div className="text-base font-bold font-mono">{total}</div>
        </div>
      </div>

      <div className="px-3 pb-4 flex-1 space-y-2">
        <div className="bg-white border border-stone-200 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] font-mono tracking-wider uppercase text-emerald-600">
              잘한 점
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-atm-ink">{strength}</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-atm-accent" />
            <span className="text-[10px] font-mono tracking-wider uppercase text-atm-accent">
              아쉬운 점
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-atm-ink">{weakness}</p>
        </div>

        <div className="bg-atm-accent/10 border border-atm-accent/20 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-atm-accent" />
            <span className="text-[10px] font-mono tracking-wider uppercase text-atm-accent">
              다음 달 조언
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-atm-ink">{advice}</p>
        </div>
      </div>
    </div>
  )
}
