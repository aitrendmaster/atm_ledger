/**
 * moa365 키 비주얼 — "한 줄 → 길" 점-선 모티프.
 * 점(dot) = 하루의 기록, 선(line) = 여정. 일부 채움/아웃라인으로 "아직 안 쓴 날" 표현 가능.
 * 베이스라인이 마지막 점 너머로 연장돼 '계속 이어지는 여정'의 인상을 준다.
 * 키비주얼·연속기록(P2 StreakDots)·결산 카드에서 공용.
 */
import { useId } from 'react'

const GRAD: Record<string, [string, string]> = {
  record: ['#FF6B2C', '#FFA63D'],
  journey: ['#01DCE3', '#2D7DFF'],
  insight: ['#7B61FF', '#A78BFA'],
  growth: ['#9BE15D', '#00C48C'],
}

export type DotLineColor = keyof typeof GRAD

type Props = {
  count?: number              // 총 점 개수
  filled?: number             // 채워진 점 개수(나머지는 아웃라인). 기본 = count
  color?: DotLineColor
  className?: string
  height?: number
}

export default function DotLine({
  count = 7,
  filled,
  color = 'record',
  className,
  height = 16,
}: Props) {
  const [c1, c2] = GRAD[color] ?? GRAD.record
  const filledCount = filled ?? count
  const gap = 18
  const r = 4
  const padL = 6
  const tail = gap * 1.6 // 마지막 점 너머로 선 연장(여정 지속)
  const width = padL + (count - 1) * gap + tail
  const cy = height / 2
  // 인스턴스별 고유 id — 같은 화면에 동색 DotLine 여러 개여도 gradient id 충돌 없음.
  const id = `dotline-${color}-${useId().replace(/:/g, '')}`
  return (
    <svg
      className={className}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <line
        x1={padL}
        y1={cy}
        x2={width}
        y2={cy}
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
      {Array.from({ length: count }).map((_, i) => (
        <circle
          key={i}
          cx={padL + i * gap}
          cy={cy}
          r={r}
          fill={i < filledCount ? `url(#${id})` : '#FFFFFF'}
          stroke={`url(#${id})`}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}
