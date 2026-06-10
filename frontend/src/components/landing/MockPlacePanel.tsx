import { MapPin, Star, Heart } from 'lucide-react'

interface PlaceCard {
  name: string
  visits: number
  total: string
  rating: number
  verdict: '또 가고 싶음' | '괜찮음' | '안 갈래'
}

interface MockPlacePanelProps {
  places?: PlaceCard[]
}

const DEFAULT_PLACES: PlaceCard[] = [
  { name: '스타벅스 부천역점', visits: 8, total: '52,000원', rating: 4.5, verdict: '또 가고 싶음' },
  { name: '돈까스 명가', visits: 3, total: '36,000원', rating: 5.0, verdict: '또 가고 싶음' },
  { name: '편의점 도시락', visits: 12, total: '64,200원', rating: 2.5, verdict: '안 갈래' },
]

function verdictStyle(v: PlaceCard['verdict']) {
  if (v === '또 가고 싶음') return 'bg-record/15 text-record'
  if (v === '괜찮음') return 'bg-sunken text-ink-tertiary'
  return 'bg-sunken text-ink-tertiary line-through'
}

export default function MockPlacePanel({ places = DEFAULT_PLACES }: MockPlacePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-8 pb-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-record" />
        <h3 className="text-sm font-bold text-ink">자주 가는 곳</h3>
      </div>

      <div className="px-3 pb-4 flex-1 space-y-2">
        {places.map((p, i) => (
          <div key={i} className="bg-surface border border-line rounded-2xl px-3 py-2.5">
            <div className="flex items-start justify-between mb-1">
              <div className="text-[11px] font-bold text-ink truncate pr-2">{p.name}</div>
              <span
                className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded ${verdictStyle(p.verdict)}`}
              >
                {p.verdict}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-ink-tertiary">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-atm-accent text-record" />
                <span className="font-mono">{p.rating.toFixed(1)}</span>
                <span className="text-ink-faint">·</span>
                <span className="font-mono">{p.visits}회 방문</span>
              </span>
              <span className="font-mono text-ink">{p.total}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-4">
        <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-[0.18em] uppercase text-ink-tertiary">
          <Heart className="w-2.5 h-2.5" />
          후기는 다음 가계부에 반영
        </div>
      </div>
    </div>
  )
}
