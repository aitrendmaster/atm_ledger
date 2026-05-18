import { Link } from 'react-router-dom'
import { MessageCircle, Calendar, MapPin, BarChart3, Mail, Sparkles } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { SUPPORT_EMAIL } from '../services/api'
import Faq from '../components/Faq'

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-atm-bg">
      {/* Hero */}
      <section className="px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs text-atm-muted mb-6">
          <Sparkles size={14} className="text-atm-accent" />
          베타 무료 — AI 가계부
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold text-atm-ink mb-5 leading-tight tracking-tight">
          대화하듯 적고,<br />
          <span className="text-atm-accent">한 달을 회고하세요.</span>
        </h1>
        <p className="text-atm-muted text-lg sm:text-xl leading-relaxed max-w-2xl mb-10">
          "스벅 6500원" 한 줄이면 끝. AI가 카테고리·금액·날짜를 알아서 분류하고,
          매월 코칭으로 소비 습관을 함께 돌봅니다.
        </p>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link
              to="/app"
              className="px-6 py-3 bg-atm-accent text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              가계부 열기 →
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="px-6 py-3 bg-atm-accent text-white rounded-lg font-medium hover:opacity-90 transition"
              >
                무료로 시작하기
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 bg-white border border-stone-300 text-atm-ink rounded-lg font-medium hover:bg-stone-50 transition"
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </section>

      {/* USP — 4개 핵심 가치 */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-atm-ink mb-3">
            가계부가 이렇게 쉬워질 줄 몰랐죠?
          </h2>
          <p className="text-atm-muted">매일 1분, 한 달을 다시 보게 됩니다.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Usp
            icon={MessageCircle}
            title="채팅으로 1초 입력"
            desc='"점심 9천원" 처럼 자유롭게 적으면 AI가 카테고리·금액·날짜를 자동으로 분류합니다. 영수증 사진도 인식해요.'
          />
          <Usp
            icon={Calendar}
            title="캘린더 + 예정 지출"
            desc="이번 달 실제 지출과 예정 지출을 한 화면에. 다음 결제일까지 진짜로 남은 돈을 정확히 보여드립니다."
          />
          <Usp
            icon={MapPin}
            title="장소 핀과 후기"
            desc="간 곳마다 별점·사진·코멘트를 남기면 지도에서 한눈에. 다시 갈 곳·안 갈 곳이 분명해집니다."
          />
          <Usp
            icon={BarChart3}
            title="월별 AI 회고 코칭"
            desc="아쉬운 점·잘한 점·다음 달 약속을 기록하면 AI 코치가 지난 달과 비교해 따뜻한 인사이트를 줍니다."
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 bg-white border-y border-stone-200">
        <Faq />
      </section>

      {/* CTA + 연락처 */}
      <section className="px-6 py-16 max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-atm-ink mb-3">
          지금 시작해도 첫 달부터 달라집니다.
        </h2>
        <p className="text-atm-muted mb-6">
          가입은 30초. 신용카드 불필요. 베타 기간 무료.
        </p>
        {!user && (
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-atm-accent text-white rounded-lg font-medium hover:opacity-90 transition"
          >
            무료로 시작하기
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 bg-stone-50 border-t border-stone-200">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 text-sm">
          <div>
            <div className="font-semibold text-atm-ink mb-1">Moa AI 가계부</div>
            <div className="text-xs text-atm-muted">대화로 기록하는 AI 가계부</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-atm-muted">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 hover:text-atm-ink"
            >
              <Mail size={14} /> {SUPPORT_EMAIL}
            </a>
            <Link to="/terms" className="hover:text-atm-ink">이용약관</Link>
            <Link to="/privacy" className="hover:text-atm-ink">개인정보 처리방침</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface UspProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  desc: string
}

function Usp({ icon: Icon, title, desc }: UspProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200">
      <div className="w-10 h-10 rounded-lg bg-atm-bg flex items-center justify-center mb-4">
        <Icon size={20} className="text-atm-accent" />
      </div>
      <h3 className="font-semibold text-atm-ink text-lg mb-2">{title}</h3>
      <p className="text-sm text-atm-muted leading-relaxed">{desc}</p>
    </div>
  )
}
