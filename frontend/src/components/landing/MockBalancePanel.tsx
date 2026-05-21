import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'

interface MockBalancePanelProps {
  monthLabel?: string
  income?: string
  spent?: string
  saved?: string
  free?: string
}

export default function MockBalancePanel({
  monthLabel = '11월 대차표',
  income = '3,200,000원',
  spent = '1,840,000원',
  saved = '600,000원',
  free = '760,000원',
}: MockBalancePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-3 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-atm-accent" />
        <h3 className="text-sm font-bold text-atm-ink">{monthLabel}</h3>
      </div>

      <div className="px-3 pb-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] text-atm-muted">
              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
              수입
            </span>
            <span className="font-mono text-[12px] text-emerald-700 font-bold">+{income}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] text-atm-muted">
              <ArrowUpRight className="w-3 h-3 text-atm-accent" />
              지출
            </span>
            <span className="font-mono text-[12px] text-atm-accent font-bold">-{spent}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] text-atm-muted">
              <Wallet className="w-3 h-3 text-atm-ink" />
              저축
            </span>
            <span className="font-mono text-[12px] text-atm-ink font-bold">-{saved}</span>
          </div>
          <div className="h-px bg-stone-200" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-atm-muted">
              자유롭게 쓸 돈
            </span>
            <span className="font-mono text-base text-atm-ink font-bold">{free}</span>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 flex-1">
        <div className="bg-atm-ink text-atm-bg rounded-2xl p-3">
          <div className="text-[9px] font-mono tracking-[0.2em] uppercase opacity-60 mb-1">
            한눈에 정리
          </div>
          <p className="text-[11px] leading-relaxed">
            수입 - 고정지출 - 저축을 빼고 나면 진짜 쓸 수 있는 돈이 보여요.
          </p>
        </div>
      </div>
    </div>
  )
}
