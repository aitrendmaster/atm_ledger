import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface HeroCarouselProps {
  /** 각 슬라이드 콘텐츠. 모두 DOM 에 렌더되어 SEO·접근성에 안전. */
  slides: ReactNode[]
  /** 페이징 점의 aria-label (슬라이드 수와 동일 길이) */
  labels: string[]
  /** 자동 로테이션 간격(ms). 기본 3000 (3초). */
  intervalMs?: number
}

/**
 * KV(히어로) 캐러셀.
 *
 * - 가로 슬라이드 트랙(translateX) — 모든 슬라이드를 항상 렌더해 높이 안정 + SEO 안전.
 * - {intervalMs}ms 자동 로테이션. hover·포커스·탭 비활성·reduced-motion 시 일시정지.
 * - 페이징 점 + 좌우 화살표로 수동 조작 가능.
 */
export default function HeroCarousel({ slides, labels, intervalMs = 3000 }: HeroCarouselProps) {
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count])
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count])
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count])

  // reduced-motion 사용자는 자동 전환 비활성 (수동 조작은 유지).
  const reducedMotion = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => (reducedMotion.current = e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  // 자동 로테이션.
  useEffect(() => {
    if (count <= 1 || paused || reducedMotion.current) return
    const id = window.setInterval(next, intervalMs)
    return () => window.clearInterval(id)
  }, [count, paused, next, intervalMs])

  // 탭이 백그라운드면 일시정지(배터리·불필요 리렌더 방지).
  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (count === 0) return null

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Moa 소개 슬라이드"
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="w-full flex-shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${labels[i] ?? `슬라이드 ${i + 1}`} (${i + 1}/${count})`}
              aria-hidden={i !== index}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          {/* 좌우 화살표 */}
          <button
            type="button"
            onClick={prev}
            aria-label="이전 슬라이드"
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 md:-ml-3 w-9 h-9 rounded-full
                       bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center
                       text-white/80 hover:bg-white/20 transition hidden sm:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="다음 슬라이드"
            className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 md:-mr-3 w-9 h-9 rounded-full
                       bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center
                       text-white/80 hover:bg-white/20 transition hidden sm:flex"
          >
            <ChevronRight size={18} />
          </button>

          {/* 페이징 점 */}
          <div className="flex justify-center gap-2.5 mt-8">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={labels[i] ?? `슬라이드 ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-record' : 'w-2 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
