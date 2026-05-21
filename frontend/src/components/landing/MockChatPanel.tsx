import { Sparkles, Send } from 'lucide-react'

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
  inputPlaceholder = '오늘 뭐 썼는지 적어줘…',
}: MockChatPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-2 text-[10px] tracking-[0.2em] uppercase text-atm-muted font-mono">
        Moa AI
      </div>

      <div className="flex-1 px-4 py-3 space-y-3 overflow-hidden">
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-atm-ink text-atm-bg text-xs leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-br-md">
            {userText}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-atm-accent/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-atm-accent" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-[80%]">
            <div className="bg-white text-atm-ink text-xs leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-bl-md border border-stone-200">
              {aiText}
            </div>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-md bg-atm-accent/10 text-atm-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 pt-2">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-2">
          <span className="flex-1 text-[11px] text-atm-muted truncate">{inputPlaceholder}</span>
          <button
            className="w-7 h-7 rounded-full bg-atm-accent flex items-center justify-center"
            aria-label="send"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
