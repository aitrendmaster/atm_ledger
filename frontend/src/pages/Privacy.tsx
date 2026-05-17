export default function Privacy() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">개인정보 처리방침</h1>
      <article className="prose prose-sm text-atm-ink space-y-4">
        <p><strong>※ 본 문서는 초안 템플릿입니다. 정식 출시 전 개인정보보호위원회 표준 양식을 참고하여 작성·검토하세요.</strong></p>

        <h2 className="font-semibold mt-6">1. 수집하는 개인정보 항목</h2>
        <ul className="list-disc pl-5">
          <li>필수: 이메일, 비밀번호(해시), 닉네임(선택)</li>
          <li>서비스 이용 중 생성: 지출 기록, 장소·사진·후기, 회고 텍스트</li>
          <li>자동 수집: 접속 IP, 브라우저 정보, 쿠키</li>
        </ul>

        <h2 className="font-semibold mt-6">2. 이용 목적</h2>
        <ul className="list-disc pl-5">
          <li>서비스 제공 및 회원 식별</li>
          <li>AI 분류·인사이트 생성 (Anthropic Claude API에 익명화된 통계 형태로 전송)</li>
          <li>장애 대응, 통계 분석</li>
        </ul>

        <h2 className="font-semibold mt-6">3. 보유 기간</h2>
        <p>회원 탈퇴 시 즉시 파기. 단, 관련 법령에 의한 보존 의무가 있는 경우 해당 기간 동안 보관.</p>

        <h2 className="font-semibold mt-6">4. 제3자 제공</h2>
        <p>원칙적으로 제공하지 않습니다. 단, AI 처리 목적으로 Anthropic(미국)에 일부 텍스트가 전송될 수 있으며, 이는 미국 데이터센터에 일시 보관 후 폐기됩니다.</p>

        <h2 className="font-semibold mt-6">5. 이용자 권리</h2>
        <p>회원은 언제든지 본인 정보 열람·수정·삭제·탈퇴를 요청할 수 있습니다.</p>

        <h2 className="font-semibold mt-6">6. 개인정보 보호책임자</h2>
        <p>이메일: privacy@atm-ledger.example</p>

        <p className="text-xs text-atm-muted mt-8">시행일: 2026-05-17 (초안)</p>
      </article>
    </div>
  )
}
