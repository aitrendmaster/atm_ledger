/**
 * moa365 온보딩 3화면 (L1 첫 대면) — 브랜드 플레이북 Part 7-1.
 * 첫 로그인 1회만 노출(localStorage). 마지막 CTA "첫 줄 쓰기" → 채팅 진입.
 * 인앱 입력 가이드(InputGuideModal)와 역할 분리: 이쪽은 가치 제안, 저쪽은 사용법.
 * 표면 언어 원칙: 행동은 평어, 메타포 0%(세계관 단어 미사용).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DotLine, { type DotLineColor } from './brand/DotLine'

const SEEN_KEY = 'moa_onboarding_seen'

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return false
  }
}

const STEPS: { key: string; accent: DotLineColor }[] = [
  { key: 's1', accent: 'record' },
  { key: 's2', accent: 'insight' },
  { key: 's3', accent: 'growth' },
]

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* noop */
    }
    onDone()
  }
  const next = () => (last ? finish() : setI(i + 1))

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-atm-bg pt-safe-top">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-md mx-auto w-full">
        <DotLine color={step.accent} count={6} filled={i + 2} className="max-w-[170px] mb-8" />
        <h2 className="text-2xl md:text-3xl font-bold text-atm-ink mb-3 [word-break:keep-all]">
          {t(`onboarding.${step.key}.head`)}
        </h2>
        <p className="text-atm-muted leading-relaxed [word-break:keep-all]">
          {t(`onboarding.${step.key}.sub`)}
        </p>
      </div>
      <div className="px-8 pb-10 pb-safe-bottom max-w-md mx-auto w-full">
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, j) => (
            <span
              key={j}
              className={`h-1.5 rounded-full transition-all ${
                j === i ? 'w-6 bg-atm-ink' : 'w-1.5 bg-stone-300'
              }`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-full min-h-touch py-3.5 rounded-xl font-bold text-white bg-atm-ink active:scale-[0.98] transition"
        >
          {last ? t('onboarding.s3.cta') : t('onboarding.common.next')}
        </button>
        {!last && (
          <button onClick={finish} className="w-full mt-2 py-2 text-sm text-atm-muted">
            {t('onboarding.common.skip')}
          </button>
        )}
      </div>
    </div>
  )
}
