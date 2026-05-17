import { useState } from 'react'
import { ChevronDown, Mail } from 'lucide-react'
import { FAQ_ITEMS } from '../data/faq'
import { SUPPORT_EMAIL } from '../services/api'

interface FaqProps {
  compact?: boolean
}

export default function Faq({ compact = false }: FaqProps) {
  const [open, setOpen] = useState<number | null>(compact ? null : 0)

  return (
    <section className={compact ? '' : 'max-w-3xl mx-auto'}>
      {!compact && (
        <header className="mb-6">
          <h2 className="text-3xl font-semibold text-atm-ink mb-2">자주 묻는 질문</h2>
          <p className="text-atm-muted text-sm">궁금한 점이 있으면 먼저 확인해보세요.</p>
        </header>
      )}

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const expanded = open === i
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-stone-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
              >
                <span className="text-sm font-medium text-atm-ink">{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`flex-shrink-0 text-atm-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
              {expanded && (
                <div className="px-4 pb-4 text-sm text-atm-muted leading-relaxed border-t border-stone-100 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-stone-50 rounded-xl p-4 flex items-center gap-3">
        <Mail size={18} className="text-atm-accent flex-shrink-0" />
        <div className="text-sm">
          <span className="text-atm-muted">더 궁금한 점이 있으신가요? </span>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-atm-accent font-medium hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  )
}
