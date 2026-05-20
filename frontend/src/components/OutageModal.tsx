import { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, X } from 'lucide-react'

const DISMISS_KEY = 'moa_outage_dismissed_2026_05_20'

export default function OutageModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) !== '1') setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  if (!open) return null

  const close = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outage-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-red-50 border-b border-red-100 px-5 py-4 flex items-start gap-3">
          <AlertCircle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 id="outage-title" className="text-base font-bold text-red-900">
              서비스 일시 장애 안내
            </h2>
            <p className="text-xs text-red-700 mt-0.5">
              2026-05-20 (한국시간) · 복구 진행 중
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-red-600/70 hover:text-red-700 flex-shrink-0"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-gray-800 leading-relaxed">
          <p>
            현재 Moa AI 가계부 백엔드 호스팅 플랫폼(<strong>Railway</strong>)에서 광범위한 장애가
            발생해 <strong>로그인·회원가입·가계부 데이터 조회가 일시적으로 불가</strong>합니다.
          </p>
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5">
            원인: Google Cloud 가 Railway 계정을 차단해 인프라 다수가 중단된 상황입니다.
            Railway 측에서 Google 에 직접 에스컬레이션해 복구 중이며, 가계부 서비스 자체나
            사용자 데이터에는 문제가 없습니다.
          </p>
          <p>
            복구 후 자동으로 정상화되며, 그동안 입력하신 데이터는 안전하게 보존되어 있습니다.
            불편을 드려 죄송합니다.
          </p>

          <a
            href="https://status.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-800 hover:underline"
          >
            Railway 실시간 복구 현황 보기
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
