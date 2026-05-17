import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-5xl font-semibold text-atm-ink mb-3">ATM 가계부</h1>
        <p className="text-atm-muted text-lg">대화하듯 기록하고, 한 달을 회고하세요.</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        <Feature title="채팅으로 입력" desc="‘오늘 점심 9천원’이라고 적으면 AI가 카테고리·금액·날짜를 알아서 분류" />
        <Feature title="장소 핀과 후기" desc="간 곳마다 별점·사진·코멘트. 다시 갈 곳, 안 갈 곳을 한눈에" />
        <Feature title="캘린더·리스트" desc="이번 달 지출과 예정 지출이 한 화면에" />
        <Feature title="월별 회고" desc="아쉬운 점·잘한 점·다음달 약속을 기록하고 AI가 코칭" />
      </section>

      <div className="flex gap-3">
        {user ? (
          <Link to="/app" className="px-6 py-3 bg-atm-accent text-white rounded-lg">가계부 열기</Link>
        ) : (
          <>
            <Link to="/signup" className="px-6 py-3 bg-atm-accent text-white rounded-lg">시작하기</Link>
            <Link to="/login" className="px-6 py-3 border border-stone-300 rounded-lg">로그인</Link>
          </>
        )}
      </div>

      <footer className="mt-24 text-xs text-atm-muted flex gap-4">
        <Link to="/terms">이용약관</Link>
        <Link to="/privacy">개인정보 처리방침</Link>
      </footer>
    </div>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <h3 className="font-semibold text-atm-ink mb-1">{title}</h3>
      <p className="text-sm text-atm-muted leading-relaxed">{desc}</p>
    </div>
  )
}
