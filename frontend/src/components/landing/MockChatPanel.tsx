import { Send } from 'lucide-react'

/**
 * 랜딩용 채팅 목업 — 실제 앱 홈(크림 벤토)과 동일한 룩.
 * 유저 말풍선 = bg-ink 필(도장의 잉크색), AI 응답 = 화이트 카드 + shadow-soft.
 * AI 에 아바타·캐릭터 부여 금지 (브랜드 플레이북 11-3).
 */
interface MockChatPanelProps {
  userText?: string
  aiText?: string
  tags?: string[]
  inputPlaceholder?: string
}

export default function MockChatPanel({
  userText = '스벅 강남역 6500원',
  aiText = '기록 완료! 카페에 이번 달 32,400원 썼어요. 평소보다 좀 많네요 :)',
  tags = ['카페', '6,500원', '강남역'],
  inputPlaceholder = '오늘 한 줄을 적어보세요',
}: MockChatPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-2 text-[10px] tracking-[0.2em] uppercase text-ink-faint font-mono">
        Moa AI
      </div>

      <div className="flex-1 px-4 py-3 space-y-3 overflow-hidden">
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-ink text-ink-ondark text-xs font-medium leading-relaxed px-3.5 py-2.5 rounded-pill">
            {userText}
          </div>
        </div>

        <div className="flex justify-start">
          <div className="flex flex-col gap-1.5 max-w-[85%]">
            <div className="bg-surface text-ink text-xs leading-relaxed px-3.5 py-2.5 rounded-card shadow-soft">
              {aiText}
            </div>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-pill bg-sunken text-ink-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 pt-2">
        <div className="flex items-center gap-2 bg-surface border-[1.5px] border-line rounded-pill px-3 py-2">
          <span className="flex-1 text-[11px] text-ink-faint truncate">{inputPlaceholder}</span>
          <button
            className="w-7 h-7 rounded-pill bg-grad-record flex items-center justify-center"
            aria-label="send"
          >
            <Send className="w-3.5 h-3.5 text-ink-ondark" />
          </button>
        </div>
      </div>
    </div>
  )
}
